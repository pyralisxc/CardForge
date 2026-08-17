"use client";

import type {
  DeveloperCockpitView,
} from '@/features/developer-cockpit/model';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';

export const loadDeveloperCockpit = async (): Promise<DeveloperCockpitView> => {
  const response = await fetch('/api/developer-cockpit', { cache: 'no-store' });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to load the developer cockpit.'));
  const body = await response.json() as { cockpit: DeveloperCockpitView };
  return body.cockpit;
};

export const mutateDeveloperCockpit = async (
  path: 'site-proposals' | 'scopes',
  method: 'POST' | 'PATCH',
  payload: unknown,
): Promise<DeveloperCockpitView> => {
  const response = await fetch(`/api/developer-cockpit/${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to update the developer cockpit.'));
  const body = await response.json() as { cockpit: DeveloperCockpitView };
  return body.cockpit;
};

export type { DeveloperCockpitView };
