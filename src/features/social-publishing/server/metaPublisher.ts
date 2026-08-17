export class MetaPublisherError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
  }
}

export type MetaPublishInput = {
  service: 'facebook' | 'instagram';
  accountId: string;
  accessToken: string;
  text: string;
  destinationUrl: string;
  media: Array<{ url: string; altText: string }>;
};

export type MetaPublishResult = {
  providerPostId: string;
  publicationUrl: string;
};

type FetchLike = typeof fetch;

const readGraphVersion = () => {
  const version = process.env.CARDFORGE_META_GRAPH_API_VERSION?.trim();
  if (!version || !/^v\d+\.\d+$/u.test(version)) {
    throw new MetaPublisherError('A reviewed Meta Graph API version is required.', 503);
  }
  return version;
};

const graphRequest = async (
  fetcher: FetchLike,
  path: string,
  accessToken: string,
  body: Record<string, string>,
): Promise<Record<string, unknown>> => {
  const response = await fetcher(`https://graph.facebook.com/${readGraphVersion()}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...body, access_token: accessToken }),
  });
  const payload = await response.json().catch(() => ({})) as {
    id?: string; post_id?: string; error?: { message?: string };
  };
  if (!response.ok || payload.error) {
    throw new MetaPublisherError(payload.error?.message ?? 'Meta rejected the publication.', response.status || 502);
  }
  return payload;
};

const graphGet = async (
  fetcher: FetchLike,
  path: string,
  accessToken: string,
  fields: string,
): Promise<Record<string, unknown>> => {
  const url = new URL(`https://graph.facebook.com/${readGraphVersion()}/${path}`);
  url.searchParams.set('fields', fields);
  url.searchParams.set('access_token', accessToken);
  const response = await fetcher(url, { cache: 'no-store' });
  const payload = await response.json().catch(() => ({})) as {
    status_code?: string; status?: string; error?: { message?: string };
  };
  if (!response.ok || payload.error) {
    throw new MetaPublisherError(payload.error?.message ?? 'Meta could not verify the media container.', response.status || 502);
  }
  return payload;
};

const waitForInstagramContainer = async (
  fetcher: FetchLike,
  creationId: string,
  accessToken: string,
): Promise<void> => {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const result = await graphGet(fetcher, creationId, accessToken, 'status_code,status');
    const status = typeof result.status_code === 'string' ? result.status_code : '';
    if (status === 'FINISHED') return;
    if (status === 'ERROR' || status === 'EXPIRED') {
      const detail = typeof result.status === 'string' ? ` ${result.status}` : '';
      throw new MetaPublisherError(`Instagram could not prepare the approved image.${detail}`);
    }
    if (attempt < 9) await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new MetaPublisherError('Instagram is still preparing the image. CardForge will retry the delivery.', 503);
};

const readPublicationUrl = async (
  fetcher: FetchLike,
  postId: string,
  accessToken: string,
): Promise<string> => {
  try {
    const result = await graphGet(fetcher, postId, accessToken, 'permalink_url');
    return typeof result.permalink_url === 'string' ? result.permalink_url : '';
  } catch (error) {
    console.error('Meta publication succeeded, but its permalink was unavailable:', error);
    return '';
  }
};

const publishedResult = async (
  fetcher: FetchLike,
  postId: string,
  accessToken: string,
): Promise<MetaPublishResult> => ({
  providerPostId: postId,
  publicationUrl: await readPublicationUrl(fetcher, postId, accessToken),
});

const publishFacebook = async (
  input: MetaPublishInput,
  fetcher: FetchLike,
): Promise<MetaPublishResult> => {
  const message = [input.text.trim(), input.destinationUrl.trim()].filter(Boolean).join('\n\n');
  if (!input.media.length) {
    const result = await graphRequest(fetcher, `${input.accountId}/feed`, input.accessToken, { message });
    if (typeof result.id !== 'string') throw new MetaPublisherError('Meta did not return a Facebook post identifier.');
    return publishedResult(fetcher, result.id, input.accessToken);
  }
  if (input.media.length === 1) {
    const result = await graphRequest(fetcher, `${input.accountId}/photos`, input.accessToken, {
      url: input.media[0]!.url,
      caption: message,
      published: 'true',
    });
    const id = typeof result.post_id === 'string' ? result.post_id : result.id;
    if (typeof id !== 'string') throw new MetaPublisherError('Meta did not return a Facebook post identifier.');
    return publishedResult(fetcher, id, input.accessToken);
  }
  const mediaIds: string[] = [];
  for (const media of input.media) {
    const result = await graphRequest(fetcher, `${input.accountId}/photos`, input.accessToken, {
      url: media.url,
      published: 'false',
    });
    if (typeof result.id !== 'string') throw new MetaPublisherError('Meta did not return a Facebook media identifier.');
    mediaIds.push(result.id);
  }
  const result = await graphRequest(fetcher, `${input.accountId}/feed`, input.accessToken, {
    message,
    attached_media: JSON.stringify(mediaIds.map((media_fbid) => ({ media_fbid }))),
  });
  if (typeof result.id !== 'string') throw new MetaPublisherError('Meta did not return a Facebook post identifier.');
  return publishedResult(fetcher, result.id, input.accessToken);
};

const publishInstagram = async (
  input: MetaPublishInput,
  fetcher: FetchLike,
): Promise<MetaPublishResult> => {
  if (!input.media.length) {
    throw new MetaPublisherError('Instagram publication requires at least one approved image.', 400);
  }
  const caption = [input.text.trim(), input.destinationUrl.trim()].filter(Boolean).join('\n\n');
  let creationId: string;
  if (input.media.length === 1) {
    const result = await graphRequest(fetcher, `${input.accountId}/media`, input.accessToken, {
      image_url: input.media[0]!.url,
      caption,
      alt_text: input.media[0]!.altText,
    });
    if (typeof result.id !== 'string') throw new MetaPublisherError('Meta did not return an Instagram container identifier.');
    creationId = result.id;
  } else {
    const children: string[] = [];
    for (const media of input.media.slice(0, 10)) {
      const result = await graphRequest(fetcher, `${input.accountId}/media`, input.accessToken, {
        image_url: media.url,
        is_carousel_item: 'true',
        alt_text: media.altText,
      });
      if (typeof result.id !== 'string') throw new MetaPublisherError('Meta did not return an Instagram carousel item.');
      children.push(result.id);
    }
    await Promise.all(children.map((childId) => (
      waitForInstagramContainer(fetcher, childId, input.accessToken)
    )));
    const result = await graphRequest(fetcher, `${input.accountId}/media`, input.accessToken, {
      media_type: 'CAROUSEL',
      children: children.join(','),
      caption,
    });
    if (typeof result.id !== 'string') throw new MetaPublisherError('Meta did not return an Instagram carousel container.');
    creationId = result.id;
  }
  await waitForInstagramContainer(fetcher, creationId, input.accessToken);
  const published = await graphRequest(fetcher, `${input.accountId}/media_publish`, input.accessToken, {
    creation_id: creationId,
  });
  if (typeof published.id !== 'string') throw new MetaPublisherError('Meta did not return an Instagram post identifier.');
  return publishedResult(fetcher, published.id, input.accessToken);
};

export const publishToMeta = (
  input: MetaPublishInput,
  fetcher: FetchLike = fetch,
): Promise<MetaPublishResult> => input.service === 'facebook'
  ? publishFacebook(input, fetcher)
  : publishInstagram(input, fetcher);
