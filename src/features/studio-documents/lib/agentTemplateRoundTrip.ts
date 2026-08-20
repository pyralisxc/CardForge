"use client";

import type { TCGCardTemplate } from '@/domain/templates';
import {
  getProjectPersistenceScope,
  readProjectPreference,
  removeProjectPreference,
  writeProjectPreference,
} from '@/features/project/client';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import { normalizeStudioDocumentPayload, type StudioDocumentSource } from '../model';

const AGENT_TEMPLATE_LINKS_PREFERENCE = 'agent-template-links-v1';

interface AgentTemplateLink {
  documentId: string;
  revision: number;
}

type AgentTemplateLinks = Record<string, AgentTemplateLink>;

export type AgentTemplateSyncResult =
  | { status: 'unlinked' }
  | { status: 'synced'; revision: number }
  | { status: 'conflict'; revision: number };

const getPreferenceKey = () => `${AGENT_TEMPLATE_LINKS_PREFERENCE}:${getProjectPersistenceScope()}`;

const readLinks = async (): Promise<AgentTemplateLinks> => {
  const parsed = await readProjectPreference<unknown>(getPreferenceKey());
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
  const links: AgentTemplateLinks = {};
  Object.entries(parsed as Record<string, unknown>).forEach(([templateId, value]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return;
    const record = value as Record<string, unknown>;
    if (typeof record.documentId !== 'string' || !Number.isInteger(record.revision) || Number(record.revision) < 1) return;
    links[templateId] = { documentId: record.documentId, revision: Number(record.revision) };
  });
  return links;
};

const writeLinks = async (links: AgentTemplateLinks) => {
  if (Object.keys(links).length === 0) {
    await removeProjectPreference(getPreferenceKey());
    return;
  }
  await writeProjectPreference(getPreferenceKey(), links);
};

export const rememberAgentTemplateLink = async (
  templateId: string,
  documentId: string,
  revision: number,
) => {
  if (!templateId || !documentId || !Number.isInteger(revision) || revision < 1) return;
  await writeLinks({
    ...await readLinks(),
    [templateId]: { documentId, revision },
  });
};

export const forgetAgentTemplateLink = async (templateId: string) => {
  if (!templateId) return;
  const links = await readLinks();
  if (!links[templateId]) return;
  delete links[templateId];
  await writeLinks(links);
};

export const getAgentTemplateLink = async (templateId: string): Promise<AgentTemplateLink | null> => (
  (await readLinks())[templateId] ?? null
);

const discoverAgentTemplateLink = async (templateId: string): Promise<AgentTemplateLink | null> => {
  const response = await fetch('/api/studio-documents', {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response, 'Unable to look up linked ChatGPT working drafts.'));
  }
  const payload = await response.json() as {
    documents?: Array<{
      id?: unknown;
      creationSource?: StudioDocumentSource;
      revision?: unknown;
      updatedAt?: unknown;
    }>;
  };
  const candidates = (payload.documents ?? [])
    .filter((document) => document.creationSource === 'gpt' && typeof document.id === 'string' && Number.isInteger(document.revision))
    .sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? '')))
    .slice(0, 20);

  for (const candidate of candidates) {
    const documentId = String(candidate.id);
    const documentResponse = await fetch(`/api/studio-documents/${encodeURIComponent(documentId)}`, {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!documentResponse.ok) continue;
    const documentPayload = await documentResponse.json() as {
      document?: { revision?: unknown; document?: unknown };
    };
    const revision = Number.isInteger(documentPayload.document?.revision)
      ? Number(documentPayload.document?.revision)
      : null;
    const project = normalizeStudioDocumentPayload(documentPayload.document?.document);
    if (revision === null || !project?.userTemplates.some((template) => template.id === templateId)) continue;
    await rememberAgentTemplateLink(templateId, documentId, revision);
    return { documentId, revision };
  }

  return null;
};

export const syncAgentTemplateSave = async (
  template: TCGCardTemplate,
): Promise<AgentTemplateSyncResult> => {
  const templateId = template.id?.trim();
  if (!templateId) return { status: 'unlinked' };
  const link = await getAgentTemplateLink(templateId) ?? await discoverAgentTemplateLink(templateId);
  if (!link) return { status: 'unlinked' };

  const response = await fetch(`/api/studio-documents/${encodeURIComponent(link.documentId)}`, {
    cache: 'no-store',
    credentials: 'same-origin',
  });
  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      await forgetAgentTemplateLink(templateId);
      const rediscoveredLink = await discoverAgentTemplateLink(templateId);
      if (!rediscoveredLink) return { status: 'unlinked' };
      return syncAgentTemplateSave(template);
    }
    throw new Error(await readApiErrorMessage(response, 'Unable to reload the linked ChatGPT working draft.'));
  }

  const payload = await response.json() as {
    document?: {
      id?: unknown;
      title?: unknown;
      creationSource?: StudioDocumentSource;
      revision?: unknown;
      document?: unknown;
    };
  };
  const currentRevision = Number.isInteger(payload.document?.revision)
    ? Number(payload.document?.revision)
    : null;
  const title = typeof payload.document?.title === 'string' ? payload.document.title.trim() : '';
  const project = normalizeStudioDocumentPayload(payload.document?.document);
  if (
    payload.document?.creationSource !== 'gpt'
    || currentRevision === null
    || !title
    || !project
  ) {
    await forgetAgentTemplateLink(templateId);
    return { status: 'unlinked' };
  }

  if (currentRevision !== link.revision) {
    return { status: 'conflict', revision: currentRevision };
  }

  const templateIndex = project.userTemplates.findIndex((candidate) => candidate.id === templateId);
  if (templateIndex < 0) {
    await forgetAgentTemplateLink(templateId);
    return { status: 'unlinked' };
  }

  const nextTemplates = [...project.userTemplates];
  nextTemplates[templateIndex] = {
    ...template,
    templateSource: 'user',
    templateLibrarySource: 'personal',
    templateRevision: currentRevision + 1,
  };

  const updateResponse = await fetch(`/api/studio-documents/${encodeURIComponent(link.documentId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({
      expectedRevision: currentRevision,
      title,
      document: {
        ...project,
        userTemplates: nextTemplates,
      },
    }),
  });
  if (!updateResponse.ok) {
    if (updateResponse.status === 409) {
      const latestResponse = await fetch(`/api/studio-documents/${encodeURIComponent(link.documentId)}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      });
      if (latestResponse.ok) {
        const latestPayload = await latestResponse.json() as { document?: { revision?: unknown } };
        if (Number.isInteger(latestPayload.document?.revision)) {
          return { status: 'conflict', revision: Number(latestPayload.document?.revision) };
        }
      }
    }
    throw new Error(await readApiErrorMessage(updateResponse, 'Your Template was saved locally, but its ChatGPT working draft could not be updated.'));
  }

  const updatedPayload = await updateResponse.json() as { document?: { revision?: unknown } };
  const updatedRevision = Number.isInteger(updatedPayload.document?.revision)
    ? Number(updatedPayload.document?.revision)
    : currentRevision + 1;
  await rememberAgentTemplateLink(templateId, link.documentId, updatedRevision);
  return { status: 'synced', revision: updatedRevision };
};
