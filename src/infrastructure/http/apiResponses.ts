import { NextResponse } from 'next/server';

import {
  inferBoundaryFailureKind,
  isRetryableBoundaryStatus,
  type BoundaryFailureKind,
  type BoundaryLimit,
} from '@/shared/boundaryFailure';

export type ApiErrorCode =
  | 'account_auth_unconfigured'
  | 'account_entitlement_unavailable'
  | 'account_tool_not_permitted'
  | 'analytics_unavailable'
  | 'billing_checkout_failed'
  | 'billing_not_configured'
  | 'billing_portal_failed'
  | 'billing_status_unavailable'
  | 'support_checkout_failed'
  | 'support_checkout_unconfigured'
  | 'support_amount_invalid'
  | 'support_offering_invalid'
  | 'support_price_mismatch'
  | 'billing_webhook_invalid'
  | 'billing_webhook_unconfigured'
  | 'contact_request_failed'
  | 'contact_request_invalid'
  | 'contact_request_unavailable'
  | 'contributor_access_required'
  | 'contributor_access_unavailable'
  | 'experience_controls_invalid'
  | 'experience_controls_unavailable'
  | 'google_drive_auth_required'
  | 'google_drive_limit'
  | 'google_drive_not_permitted'
  | 'google_drive_project_conflict'
  | 'google_drive_project_invalid'
  | 'google_drive_project_not_found'
  | 'google_drive_project_too_large'
  | 'google_drive_unavailable'
  | 'internal_server_error'
  | 'invalid_json'
  | 'invalid_idempotency_key'
  | 'invalid_style_id'
  | 'invalid_style_payload'
  | 'invalid_template_id'
  | 'invalid_template_payload'
  | 'marketing_command_failed'
  | 'marketing_command_unavailable'
  | 'marketing_content_invalid'
  | 'marketing_content_unavailable'
  | 'mcp_allowance_invalid'
  | 'mcp_usage_unavailable'
  | 'payload_too_large'
  | 'rate_limited'
  | 'site_proposal_invalid'
  | 'site_proposal_retired'
  | 'site_proposal_unavailable'
  | 'owner_access_required'
  | 'owner_operations_conflict'
  | 'owner_operations_unavailable'
  | 'owner_request_invalid'
  | 'owner_account_invalid'
  | 'owner_account_unavailable'
  | 'owner_billing_unavailable'
  | 'owner_email_unavailable'
  | 'owner_activity_unavailable'
  | 'owner_people_unavailable'
  | 'owner_person_confirmation_required'
  | 'owner_person_invalid'
  | 'owner_person_protected'
  | 'owner_person_unavailable'
  | 'personal_library_invalid'
  | 'personal_library_is_local'
  | 'personal_library_not_found'
  | 'personal_library_unavailable'
  | 'pipeline_reaction_invalid'
  | 'pipeline_reaction_not_permitted'
  | 'pipeline_reaction_not_found'
  | 'pipeline_reaction_unavailable'
  | 'pipeline_request_invalid'
  | 'pipeline_limit'
  | 'pipeline_not_permitted'
  | 'pipeline_unavailable'
  | 'portrait_invalid'
  | 'portrait_unavailable'
  | 'site_media_invalid'
  | 'site_media_not_found'
  | 'site_media_unavailable'
  | 'site_configuration_invalid'
  | 'site_configuration_unavailable'
  | 'social_publishing_unavailable'
  | 'roadmap_database_unavailable'
  | 'roadmap_item_unavailable'
  | 'roadmap_request_invalid'
  | 'roadmap_vote_failed'
  | 'service_unavailable'
  | 'sign_in_required'
  | 'stripe_checkout_url_missing'
  | 'stripe_portal_url_missing'
  | 'asset_library_unavailable'
  | 'style_library_unavailable'
  | 'studio_document_conflict'
  | 'studio_document_invalid'
  | 'studio_document_not_found'
  | 'studio_document_unavailable'
  | 'template_library_unavailable';

export interface ApiErrorBody {
  ok: false;
  error: {
    code: ApiErrorCode;
    message: string;
    kind: BoundaryFailureKind;
    retryable: boolean;
    details?: string[];
    nextAction?: string;
    retryAfterSeconds?: number;
    limit?: BoundaryLimit;
  };
  correlationId: string;
}

export interface ApiErrorResponseOptions {
  details?: string[];
  kind?: BoundaryFailureKind;
  retryable?: boolean;
  nextAction?: string;
  retryAfterSeconds?: number;
  limit?: BoundaryLimit;
  headers?: HeadersInit;
}

export interface RateLimitErrorResponseOptions {
  retryAfterSeconds: number;
  nextAction?: string;
  resource?: string;
  maximum?: number;
  unit?: string;
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
  detailsOrOptions?: string[] | ApiErrorResponseOptions,
) => {
  const options = Array.isArray(detailsOrOptions)
    ? { details: detailsOrOptions }
    : detailsOrOptions ?? {};
  const correlationId = createCorrelationId();
  const body: ApiErrorBody = {
    ok: false,
    error: {
      code,
      message,
      kind: options.kind ?? inferBoundaryFailureKind(status),
      retryable: options.retryable ?? isRetryableBoundaryStatus(status),
      ...(options.details && options.details.length > 0 ? { details: options.details } : {}),
      ...(options.nextAction ? { nextAction: options.nextAction } : {}),
      ...(options.retryAfterSeconds !== undefined ? { retryAfterSeconds: options.retryAfterSeconds } : {}),
      ...(options.limit ? { limit: options.limit } : {}),
    },
    correlationId,
  };

  const headers = new Headers(options.headers);
  headers.set('Cache-Control', 'no-store');
  headers.set('x-correlation-id', correlationId);
  if (options.retryAfterSeconds !== undefined) {
    headers.set('Retry-After', String(options.retryAfterSeconds));
  }

  return NextResponse.json(body, {
    status,
    headers,
  });
};

export const createRateLimitErrorResponse = (
  message: string,
  options: RateLimitErrorResponseOptions,
) => createApiErrorResponse(429, 'rate_limited', message, {
  kind: 'limit',
  retryable: true,
  retryAfterSeconds: options.retryAfterSeconds,
  nextAction: options.nextAction ?? 'Wait for the retry window, then try the same action again.',
  ...(options.resource && options.maximum !== undefined && options.unit
    ? { limit: { resource: options.resource, maximum: options.maximum, unit: options.unit } }
    : {}),
});

export const createNoStoreJsonResponse = <Body>(body: Body, init?: ResponseInit) => {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', 'no-store');
  return NextResponse.json(body, {
    ...init,
    headers,
  });
};
