import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'account_auth_unconfigured'
  | 'account_entitlement_unavailable'
  | 'billing_checkout_failed'
  | 'billing_not_configured'
  | 'billing_status_unavailable'
  | 'developer_access_required'
  | 'developer_asset_request_invalid'
  | 'developer_asset_unavailable'
  | 'founder_beta_unavailable'
  | 'founder_beta_claim_unavailable'
  | 'internal_server_error'
  | 'invalid_json'
  | 'invalid_style_id'
  | 'invalid_style_payload'
  | 'invalid_template_id'
  | 'invalid_template_payload'
  | 'library_writes_disabled'
  | 'payload_too_large'
  | 'owner_access_required'
  | 'owner_console_unavailable'
  | 'owner_request_invalid'
  | 'roadmap_database_unavailable'
  | 'roadmap_item_unavailable'
  | 'roadmap_request_invalid'
  | 'roadmap_vote_failed'
  | 'service_unavailable'
  | 'sign_in_required'
  | 'stripe_checkout_url_missing'
  | 'asset_library_unavailable'
  | 'style_library_unavailable'
  | 'template_library_unavailable';

export interface ApiErrorBody {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: string[];
  };
  correlationId: string;
}

const createCorrelationId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (marker) => {
    const value = Math.floor(Math.random() * 16);
    return (marker === 'x' ? value : (value & 0x3) | 0x8).toString(16);
  });
};

export const createApiErrorResponse = (
  status: number,
  code: ApiErrorCode,
  message: string,
  details?: string[]
) => {
  const correlationId = createCorrelationId();
  const body: ApiErrorBody = {
    ok: false,
    error: {
      code,
      message,
      ...(details && details.length > 0 ? { details } : {}),
    },
    correlationId,
  };

  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'x-correlation-id': correlationId,
    },
  });
};

export const createNoStoreJsonResponse = <Body>(body: Body, init?: ResponseInit) => {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  return NextResponse.json(body, {
    ...init,
    headers,
  });
};
