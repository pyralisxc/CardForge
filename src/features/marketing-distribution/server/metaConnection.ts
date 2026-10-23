import { encryptMarketingToken, decryptMarketingToken } from './marketingTokenCrypto';
import { getSupabaseServerClient } from '@/infrastructure/database/supabaseServer';
import { getPublicAppUrl } from '@/infrastructure/http/publicUrl';

const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
] as const;

export const getMetaConfiguration = () => {
  const required = {
    CARDFORGE_META_APP_ID: process.env.CARDFORGE_META_APP_ID,
    CARDFORGE_META_APP_SECRET: process.env.CARDFORGE_META_APP_SECRET,
    CARDFORGE_META_LOGIN_CONFIGURATION_ID: process.env.CARDFORGE_META_LOGIN_CONFIGURATION_ID,
    CARDFORGE_META_GRAPH_API_VERSION: process.env.CARDFORGE_META_GRAPH_API_VERSION,
    CARDFORGE_SOCIAL_TOKEN_ENCRYPTION_KEY: process.env.CARDFORGE_SOCIAL_TOKEN_ENCRYPTION_KEY,
  };
  const missing = Object.entries(required).filter(([, value]) => !value?.trim()).map(([key]) => key);
  return {
    configured: missing.length === 0,
    publishingEnabled: process.env.CARDFORGE_META_PUBLISHING_ENABLED === 'true',
    missing,
    appId: required.CARDFORGE_META_APP_ID?.trim() ?? '',
    appSecret: required.CARDFORGE_META_APP_SECRET?.trim() ?? '',
    loginConfigurationId: required.CARDFORGE_META_LOGIN_CONFIGURATION_ID?.trim() ?? '',
    graphVersion: required.CARDFORGE_META_GRAPH_API_VERSION?.trim() ?? '',
    pageId: process.env.CARDFORGE_META_PAGE_ID?.trim() ?? '',
    redirectUri: `${getPublicAppUrl()}/api/owner/marketing/meta/callback`,
  };
};

export const buildMetaAuthorizationUrl = (state: string): string => {
  const config = getMetaConfiguration();
  if (!config.configured) throw new Error(`Meta is not configured: ${config.missing.join(', ')}.`);
  const url = new URL(`https://www.facebook.com/${config.graphVersion}/dialog/oauth`);
  url.searchParams.set('client_id', config.appId);
  url.searchParams.set('config_id', config.loginConfigurationId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('response_type', 'code');
  return url.toString();
};

type MetaPage = {
  id: string;
  name: string;
  access_token: string;
  instagram_business_account?: { id?: string; username?: string; name?: string };
};

const metaGet = async <Payload>(path: string, parameters: Record<string, string>): Promise<Payload> => {
  const config = getMetaConfiguration();
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/${path}`);
  for (const [key, value] of Object.entries(parameters)) url.searchParams.set(key, value);
  const response = await fetch(url, { cache: 'no-store' });
  const payload = await response.json().catch(() => ({})) as Payload & { error?: { message?: string } };
  if (!response.ok || payload.error) throw new Error(payload.error?.message ?? 'Meta connection request failed.');
  return payload;
};

const saveConnection = async ({
  actorId,
  service,
  accountId,
  displayName,
  accessToken,
}: {
  actorId: string;
  service: 'facebook' | 'instagram';
  accountId: string;
  displayName: string;
  accessToken: string;
}): Promise<string> => {
  const database = getSupabaseServerClient();
  if (!database) throw new Error('The marketing database is not configured.');
  const encrypted = encryptMarketingToken(accessToken);
  const { data, error } = await database.from('cardforge_marketing_connections').upsert({
    provider: 'meta',
    service,
    external_account_id: accountId,
    display_name: displayName,
    access_token_ciphertext: encrypted.ciphertext,
    access_token_iv: encrypted.iv,
    access_token_auth_tag: encrypted.authTag,
    granted_scopes: META_SCOPES,
    status: 'active',
    status_note: '',
    connected_by: actorId,
    last_verified_at: new Date().toISOString(),
  }, { onConflict: 'provider,service,external_account_id' }).select('id').limit(1);
  if (error || !data?.[0]?.id) {
    console.error('Unable to save Meta connection:', error);
    throw new Error('Unable to save the connected Meta account.');
  }
  return data[0].id as string;
};

const saveAutomaticDestination = async ({
  actorId,
  connectionId,
  service,
  accountId,
  displayName,
}: {
  actorId: string;
  connectionId: string;
  service: 'facebook' | 'instagram';
  accountId: string;
  displayName: string;
}) => {
  const database = getSupabaseServerClient();
  if (!database) throw new Error('The marketing database is not configured.');
  const { data: existing, error: lookupError } = await database
    .from('cardforge_marketing_destinations')
    .select('id')
    .eq('provider', 'meta')
    .eq('service', service)
    .eq('external_account_id', accountId)
    .limit(1);
  if (lookupError) throw new Error('Unable to check existing Meta destinations.');
  const row = {
    connection_id: connectionId,
    name: displayName,
    service,
    kind: 'owned',
    provider: 'meta',
    publishing_mode: 'automatic',
    external_account_id: accountId,
    active: true,
  };
  const result = existing?.[0]?.id
    ? await database.from('cardforge_marketing_destinations').update(row).eq('id', existing[0].id)
    : await database.from('cardforge_marketing_destinations').insert({ ...row, created_by: actorId });
  if (result.error) throw new Error('Unable to save the Meta destination.');
};

export const connectMetaAccounts = async (code: string, actorId: string) => {
  const config = getMetaConfiguration();
  if (!config.configured) throw new Error(`Meta is not configured: ${config.missing.join(', ')}.`);
  const shortToken = await metaGet<{ access_token: string }>('oauth/access_token', {
    client_id: config.appId,
    client_secret: config.appSecret,
    redirect_uri: config.redirectUri,
    code,
  });
  const longToken = await metaGet<{ access_token: string }>('oauth/access_token', {
    grant_type: 'fb_exchange_token',
    client_id: config.appId,
    client_secret: config.appSecret,
    fb_exchange_token: shortToken.access_token,
  });
  const pages = await metaGet<{ data?: MetaPage[] }>('me/accounts', {
    fields: 'id,name,access_token,instagram_business_account{id,username,name}',
    access_token: longToken.access_token,
  });
  if (!pages.data?.length) throw new Error('Meta did not return a Facebook Page that this account can manage.');
  const selectedPages = config.pageId
    ? pages.data.filter(page => page.id === config.pageId)
    : pages.data;
  if (!selectedPages.length) throw new Error('The configured Facebook Page was not returned by Meta.');
  const database = getSupabaseServerClient();
  if (!database) throw new Error('The marketing database is unavailable.');
  const encrypted = encryptMarketingToken(JSON.stringify(selectedPages));
  const { data: pending, error } = await database.from('cardforge_meta_page_selections').insert({
    owner_user_id: actorId, payload_ciphertext: encrypted.ciphertext,
    payload_iv: encrypted.iv, payload_auth_tag: encrypted.authTag,
  }).select('id').single();
  if (error || !pending?.id) throw new Error('Unable to prepare Meta Page selection.');
  // All paths use one atomic consume-and-persist operation. The selected Page
  // is still confirmed by the owner if discovery returned more than one.
  if (selectedPages.length > 1) return { pageCount:selectedPages.length, connectionCount:0, selectionId:String(pending.id) };
  const result = await completePendingMetaPageSelection(String(pending.id),actorId,selectedPages[0].id);
  return { pageCount:1, connectionCount:result.connectionCount };
};

export const readPendingMetaPageSelection = async (selectionId: string, actorId: string) => {
  const database = getSupabaseServerClient();
  if (!database) throw new Error('The marketing database is unavailable.');
  const { data, error } = await database.from('cardforge_meta_page_selections')
    .select('id,owner_user_id,payload_ciphertext,payload_iv,payload_auth_tag,expires_at,terminal_receipt')
    .eq('id', selectionId).eq('owner_user_id', actorId).maybeSingle();
  if (error) throw new Error('Unable to read the pending Meta Page selection.');
  if (!data) throw new Error('The Meta Page selection was not found.');
  if (data.terminal_receipt) return { pages: [] as MetaPage[], receipt: data.terminal_receipt as {cancelled:boolean;connectionCount:number;selectedPageId:string|null} };
  if (Date.parse(data.expires_at) <= Date.now()) throw new Error('The Meta Page selection expired. Reconnect to start again.');
  if (!data.payload_ciphertext || !data.payload_iv || !data.payload_auth_tag) throw new Error('The Meta Page selection is unavailable.');
  let pages: MetaPage[];
  try {
    pages = JSON.parse(decryptMarketingToken({
      ciphertext: data.payload_ciphertext, iv: data.payload_iv, authTag: data.payload_auth_tag,
    })) as MetaPage[];
    if (!Array.isArray(pages)) throw new Error('Invalid Page payload');
  } catch { throw new Error('Unable to recover the encrypted Meta Page selection.'); }
  return { pages, receipt: null };
};

export const listPendingMetaPages = async (selectionId: string, actorId: string) => {
  const { pages, receipt } = await readPendingMetaPageSelection(selectionId, actorId);
  if (receipt) throw new Error('This Meta Page selection has already completed.');
  return pages.map(page => ({ id: page.id, name: page.name, instagram: page.instagram_business_account?.username ?? null }));
};

export const completePendingMetaPageSelection = async (selectionId: string, actorId: string, selectedPageId: string | null) => {
  const database = getSupabaseServerClient();
  if (!database) throw new Error('The marketing database is unavailable.');
  if (selectedPageId === null) {
    const { data, error } = await database.rpc('cardforge_complete_meta_page_selection', {
      p_selection_id:selectionId,p_actor_id:actorId,p_page_id:null,p_accounts:[],
    });
    if (error || !data) throw new Error('Unable to cancel the pending Meta selection.');
    return data as {cancelled:boolean;connectionCount:number};
  }
  const { pages, receipt } = await readPendingMetaPageSelection(selectionId, actorId);
  if (receipt) {
    if (receipt.selectedPageId !== selectedPageId) throw new Error('The selection was already completed with a different Page.');
    return receipt;
  }
  if (selectedPageId && !pages.some(page => page.id === selectedPageId))
    throw new Error('The selected Facebook Page is unavailable.');
  const page = pages.find(page => page.id === selectedPageId);
  const prepare = (service: 'facebook' | 'instagram', accountId: string, displayName: string, token: string) => ({
    service, account_id: accountId, display_name: displayName, ...encryptMarketingToken(token),
  });
  const accounts = page ? [
    prepare('facebook', page.id, page.name, page.access_token),
    ...(page.instagram_business_account?.id ? [prepare(
      'instagram', page.instagram_business_account.id,
      page.instagram_business_account.username ? `@${page.instagram_business_account.username}`
        : page.instagram_business_account.name ?? `${page.name} Instagram`, page.access_token,
    )] : []),
  ] : [];
  const { data, error } = await database.rpc('cardforge_complete_meta_page_selection', {
    p_selection_id: selectionId,
    p_actor_id: actorId,
    p_page_id: selectedPageId,
    p_accounts: accounts,
  });
  if (error || !data) {
    try {
      const observed = await readPendingMetaPageSelection(selectionId,actorId);
      if (observed.receipt) {
        if (observed.receipt.selectedPageId !== selectedPageId) throw new Error('The selection completed with a different Page.');
        return observed.receipt;
      }
    } catch { /* Readback itself may be unavailable: outcome remains unknown. */ }
    throw new Error('Meta selection outcome unknown. Check the connected account before retrying.');
  }
  return data as { cancelled: boolean; connectionCount: number; selectedPageId: string | null };
};
