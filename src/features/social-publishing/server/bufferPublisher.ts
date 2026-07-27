import type {
  SocialPublishJobStatus,
  SocialService,
} from '@/features/social-publishing/model';

const BUFFER_GRAPHQL_ENDPOINT = 'https://api.buffer.com';

type BufferEnvironment = Partial<Record<
  | 'BUFFER_API_KEY'
  | 'BUFFER_ORGANIZATION_ID'
  | 'CARDFORGE_BUFFER_PUBLISHING_ENABLED'
  | 'CARDFORGE_BUFFER_ALLOWED_CHANNEL_IDS',
  string | undefined
>>;

export interface BufferConfiguration {
  configured: boolean;
  publishingEnabled: boolean;
  organizationId: string | null;
  allowedChannelIds: string[];
  missing: string[];
}

export interface BufferChannel {
  id: string;
  name: string;
  displayName: string;
  service: SocialService;
  avatar: string | null;
  isQueuePaused: boolean;
}

export interface BufferPostResult {
  providerPostId: string;
  channelId: string;
  status: SocialPublishJobStatus;
  providerStatus: string;
  dueAt: string | null;
}

export class BufferPublisherError extends Error {
  constructor(message: string, public readonly status = 502) {
    super(message);
  }
}

export const getBufferConfiguration = (
  environment: BufferEnvironment = process.env as BufferEnvironment,
): BufferConfiguration => {
  const apiKey = environment.BUFFER_API_KEY?.trim() ?? '';
  const organizationId = environment.BUFFER_ORGANIZATION_ID?.trim() ?? '';
  const missing = [
    ...(!apiKey ? ['BUFFER_API_KEY'] : []),
    ...(!organizationId ? ['BUFFER_ORGANIZATION_ID'] : []),
  ];
  return {
    configured: missing.length === 0,
    publishingEnabled: environment.CARDFORGE_BUFFER_PUBLISHING_ENABLED === 'true',
    organizationId: organizationId || null,
    allowedChannelIds: (environment.CARDFORGE_BUFFER_ALLOWED_CHANNEL_IDS ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean),
    missing,
  };
};

export const mapBufferPostStatus = (status: string): SocialPublishJobStatus => {
  const normalized = status.trim().toLowerCase();
  if (normalized === 'draft') return 'provider_draft';
  if (normalized === 'buffer' || normalized === 'scheduled' || normalized === 'pending') return 'scheduled';
  if (normalized === 'sent' || normalized === 'published') return 'published';
  if (normalized === 'error' || normalized === 'failed') return 'failed';
  if (normalized === 'cancelled' || normalized === 'canceled') return 'cancelled';
  return 'unknown';
};

const normalizeBufferService = (value: string): SocialService | null => {
  const normalized = value.trim().toLowerCase().replace(/[_\s-]+/g, '');
  if (normalized === 'twitter') return 'x';
  if (normalized === 'googlebusinessprofile' || normalized === 'googlebusiness') return 'googlebusiness';
  const services: SocialService[] = [
    'facebook',
    'instagram',
    'threads',
    'bluesky',
    'linkedin',
    'x',
    'pinterest',
    'tiktok',
    'youtube',
    'mastodon',
    'googlebusiness',
  ];
  return services.find((service) => service === normalized) ?? null;
};

type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

interface BufferPublisherOptions {
  apiKey: string;
  organizationId: string;
  allowedChannelIds?: string[];
  fetcher?: Fetcher;
}

interface BufferPostInput {
  channelId: string;
  text: string;
  mediaUrls?: string[];
}

interface BufferScheduledPostInput extends BufferPostInput {
  dueAt: string;
}

interface GraphqlEnvelope<T> {
  data?: T;
  errors?: Array<{ message?: string }>;
}

interface BufferPostPayload {
  __typename?: string;
  message?: string;
  post?: {
    id?: string;
    channelId?: string;
    status?: string;
    dueAt?: string | null;
  };
}

const BUFFER_POST_FIELDS = `
  __typename
  ... on PostActionSuccess {
    post {
      id
      channelId
      status
      dueAt
    }
  }
  ... on MutationError {
    message
  }
`;

export class BufferPublisher {
  private readonly apiKey: string;
  private readonly organizationId: string;
  private readonly allowedChannelIds: Set<string>;
  private readonly fetcher: Fetcher;

  constructor({
    apiKey,
    organizationId,
    allowedChannelIds = [],
    fetcher = fetch,
  }: BufferPublisherOptions) {
    if (!apiKey.trim() || !organizationId.trim()) {
      throw new BufferPublisherError('Buffer server credentials are incomplete.', 503);
    }
    this.apiKey = apiKey.trim();
    this.organizationId = organizationId.trim();
    this.allowedChannelIds = new Set(allowedChannelIds);
    this.fetcher = fetcher;
  }

  private assertAllowedChannel(channelId: string) {
    if (this.allowedChannelIds.size > 0 && !this.allowedChannelIds.has(channelId)) {
      throw new BufferPublisherError('That Buffer channel is not in CardForge’s publishing allowlist.', 403);
    }
  }

  private async request<T>(query: string, variables: Record<string, unknown>): Promise<T> {
    const response = await this.fetcher(BUFFER_GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
    });
    let envelope: GraphqlEnvelope<T>;
    try {
      envelope = await response.json() as GraphqlEnvelope<T>;
    } catch {
      throw new BufferPublisherError('Buffer returned an unreadable response.');
    }
    if (!response.ok) {
      throw new BufferPublisherError(`Buffer request failed with HTTP ${response.status}.`);
    }
    const graphqlMessage = envelope.errors?.map((error) => error.message).filter(Boolean).join('; ');
    if (graphqlMessage) throw new BufferPublisherError(graphqlMessage);
    if (!envelope.data) throw new BufferPublisherError('Buffer returned no data.');
    return envelope.data;
  }

  private mapPostPayload(payload: BufferPostPayload | null | undefined): BufferPostResult {
    if (!payload) throw new BufferPublisherError('Buffer returned no post result.');
    if (payload.__typename && payload.__typename !== 'PostActionSuccess') {
      throw new BufferPublisherError(payload.message || `Buffer rejected the post (${payload.__typename}).`);
    }
    const post = payload.post;
    if (!post?.id || !post.channelId || !post.status) {
      throw new BufferPublisherError('Buffer returned an incomplete post result.');
    }
    return {
      providerPostId: post.id,
      channelId: post.channelId,
      status: mapBufferPostStatus(post.status),
      providerStatus: post.status,
      dueAt: post.dueAt ?? null,
    };
  }

  async listChannels(): Promise<BufferChannel[]> {
    const data = await this.request<{
      channels?: Array<{
        id?: string;
        name?: string;
        displayName?: string;
        service?: string;
        avatar?: string | null;
        isQueuePaused?: boolean;
      }>;
    }>(`
      query CardForgeBufferChannels($input: ChannelsInput!) {
        channels(input: $input) {
          id
          name
          displayName
          service
          avatar
          isQueuePaused
        }
      }
    `, { input: { organizationId: this.organizationId } });

    return (data.channels ?? []).flatMap((channel) => {
      const service = normalizeBufferService(channel.service ?? '');
      if (!channel.id || !service) return [];
      if (this.allowedChannelIds.size > 0 && !this.allowedChannelIds.has(channel.id)) return [];
      return [{
        id: channel.id,
        name: channel.name ?? channel.displayName ?? channel.id,
        displayName: channel.displayName ?? channel.name ?? channel.id,
        service,
        avatar: channel.avatar ?? null,
        isQueuePaused: Boolean(channel.isQueuePaused),
      }];
    });
  }

  private getCreatePostInput(
    input: BufferPostInput,
    schedule: { saveToDraft: true } | { dueAt: string },
  ): Record<string, unknown> {
    this.assertAllowedChannel(input.channelId);
    const mediaUrls = input.mediaUrls ?? [];
    for (const mediaUrl of mediaUrls) {
      try {
        if (new URL(mediaUrl).protocol !== 'https:') throw new Error('not https');
      } catch {
        throw new BufferPublisherError('Buffer media must use a stable public HTTPS URL.', 400);
      }
    }
    return {
      text: input.text,
      channelId: input.channelId,
      schedulingType: 'automatic',
      mode: 'saveToDraft' in schedule ? 'addToQueue' : 'customScheduled',
      assets: mediaUrls.map((url) => ({ image: { url } })),
      source: 'cardforge-developer-cockpit',
      ...('saveToDraft' in schedule
        ? { saveToDraft: true }
        : { saveToDraft: false, dueAt: schedule.dueAt }),
    };
  }

  async createDraft(input: BufferPostInput): Promise<BufferPostResult> {
    const data = await this.request<{ createPost?: BufferPostPayload }>(`
      mutation CardForgeCreateBufferDraft($input: CreatePostInput!) {
        createPost(input: $input) {
          ${BUFFER_POST_FIELDS}
        }
      }
    `, { input: this.getCreatePostInput(input, { saveToDraft: true }) });
    return this.mapPostPayload(data.createPost);
  }

  async createScheduledPost(input: BufferScheduledPostInput): Promise<BufferPostResult> {
    const dueAt = new Date(input.dueAt);
    if (!Number.isFinite(dueAt.getTime())) {
      throw new BufferPublisherError('Choose a valid Buffer publish time.', 400);
    }
    const data = await this.request<{ createPost?: BufferPostPayload }>(`
      mutation CardForgeCreateBufferScheduledPost($input: CreatePostInput!) {
        createPost(input: $input) {
          ${BUFFER_POST_FIELDS}
        }
      }
    `, { input: this.getCreatePostInput(input, { dueAt: dueAt.toISOString() }) });
    return this.mapPostPayload(data.createPost);
  }

  async scheduleDraft(postId: string, dueAt: string): Promise<BufferPostResult> {
    const parsed = new Date(dueAt);
    if (!postId.trim() || !Number.isFinite(parsed.getTime())) {
      throw new BufferPublisherError('Choose a valid Buffer draft and publish time.', 400);
    }
    const data = await this.request<{ editPost?: BufferPostPayload }>(`
      mutation CardForgeScheduleBufferDraft($input: EditPostInput!) {
        editPost(input: $input) {
          ${BUFFER_POST_FIELDS}
        }
      }
    `, {
      input: {
        id: postId,
        schedulingType: 'automatic',
        mode: 'customScheduled',
        dueAt: parsed.toISOString(),
        saveToDraft: false,
        source: 'cardforge-developer-cockpit',
      },
    });
    return this.mapPostPayload(data.editPost);
  }

  async getPost(postId: string): Promise<BufferPostResult> {
    const data = await this.request<{
      post?: {
        id?: string;
        channelId?: string;
        status?: string;
        dueAt?: string | null;
      };
    }>(`
      query CardForgeBufferPost($input: PostInput!) {
        post(input: $input) {
          id
          channelId
          status
          dueAt
        }
      }
    `, { input: { id: postId } });
    const post = data.post;
    if (!post?.id || !post.channelId || !post.status) {
      throw new BufferPublisherError('Buffer returned an incomplete post status.');
    }
    return {
      providerPostId: post.id,
      channelId: post.channelId,
      status: mapBufferPostStatus(post.status),
      providerStatus: post.status,
      dueAt: post.dueAt ?? null,
    };
  }
}

export const createBufferPublisherFromEnvironment = (): BufferPublisher | null => {
  const configuration = getBufferConfiguration();
  if (!configuration.configured) return null;
  return new BufferPublisher({
    apiKey: process.env.BUFFER_API_KEY!,
    organizationId: process.env.BUFFER_ORGANIZATION_ID!,
    allowedChannelIds: configuration.allowedChannelIds,
  });
};
