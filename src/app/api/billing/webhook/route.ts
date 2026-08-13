import { processStripeWebhook } from '@/features/billing/server/processStripeWebhook';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export const POST = processStripeWebhook;
