import type { MarketingCommandCenterView } from '@/features/marketing/model';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

export const loadMarketingCommandCenter = async (): Promise<MarketingCommandCenterView> => {
  const response = await fetch('/api/owner/marketing', { cache: 'no-store' });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load marketing.'));
  return (await response.json() as { marketing: MarketingCommandCenterView }).marketing;
};

export const runMarketingCommand = async <Result>(
  payload: Record<string, unknown>,
): Promise<Result> => {
  const response = await fetch('/api/owner/marketing', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to update marketing.'));
  return response.json() as Promise<Result>;
};
