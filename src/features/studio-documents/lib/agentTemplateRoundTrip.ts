"use client";

import type { TCGCardTemplate } from '@/domain/templates';
import { getProjectPersistenceScope } from '@/features/project/client/persistence-workspace';
import { readProjectPreference, removeProjectPreference, writeProjectPreference } from '@/features/project/client/persistence-preferences';
import { readApiErrorMessage } from '@/infrastructure/http/clientResponses';
import { normalizeStudioDocumentPayload, type StudioDocumentSource } from '../model';
import { collectStudioDocumentAssetIds, collectStudioDocumentFontIds, getStudioDocumentAssetReference, getStudioDocumentFontReference } from '../assetReferences';
import { projectAssetArrayScope, projectAssetChildScope, type ProjectAssetScope } from '@/features/project/client/package-document';

const AGENT_TEMPLATE_LINKS_PREFERENCE = 'agent-template-links-v1';

interface AgentTemplateLink { documentId: string; revision: number; }
type AgentTemplateLinks = Record<string, AgentTemplateLink>;

export type AgentTemplateSyncResult =
  | { status: 'unlinked' }
  | { status: 'synced'; revision: number }
  | { status: 'conflict'; revision: number };

const getPreferenceKey = () => `${AGENT_TEMPLATE_LINKS_PREFERENCE}:${getProjectPersistenceScope()}`;

// Reuse exact existing private objects when a browser Template still contains
// their hydrated bytes. This avoids resending large unchanged artwork.
const reusePrivateAssets = async <T>(value: T, project: unknown): Promise<T> => {
  const images = new Set(collectStudioDocumentAssetIds(project));
  const fonts = new Set(collectStudioDocumentFontIds(project));
  const pending = new Map<string, Promise<string>>();
  const resolve = (entry: string) => {
    let result = pending.get(entry);
    if (result) return result;
    result = (async () => {
      const browserId = /^cardforge-browser-asset:\/\/([a-f0-9]{64})$/u.exec(entry)?.[1];
      let id = browserId;
      if (!id && /^data:(?:image\/|font\/|application\/(?:font-woff|x-font-ttf|x-font-opentype))[^,]*;base64,/iu.test(entry)) {
        const blob = await (await fetch(entry)).blob();
        const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
        id = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
      }
      if (id && images.has(id)) return getStudioDocumentAssetReference(id);
      if (id && fonts.has(id)) return getStudioDocumentFontReference(id);
      if (browserId) throw new Error('New browser artwork could not be transferred to the linked ChatGPT draft.');
      return entry;
    })();
    pending.set(entry, result);
    return result;
  };
  const visit = async (entry: unknown, scope: ProjectAssetScope): Promise<unknown> => {
    if (scope === 'opaque') return entry;
    if (typeof entry === 'string') return resolve(entry);
    if (Array.isArray(entry)) return Promise.all(entry.map((child) => visit(child, projectAssetArrayScope(scope))));
    if (entry && typeof entry === 'object') return Object.fromEntries(await Promise.all(Object.entries(entry).map(async ([key, child]) => [key, await visit(child, projectAssetChildScope(scope, key))])));
    return entry;
  };
  return await visit(value, 'root') as T;
};

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
  if (Object.keys(links).length === 0) { await removeProjectPreference(getPreferenceKey()); return; }
  await writeProjectPreference(getPreferenceKey(), links);
};

export const rememberAgentTemplateLink = async (templateId: string, documentId: string, revision: number) => {
  if (!templateId || !documentId || !Number.isInteger(revision) || revision < 1) return;
  await writeLinks({ ...await readLinks(), [templateId]: { documentId, revision } });
};

export const forgetAgentTemplateLink = async (templateId: string) => {
  if (!templateId) return;
  const links = await readLinks();
  if (!links[templateId]) return;
  delete links[templateId];
  await writeLinks(links);
};

export const getAgentTemplateLink = async (templateId: string): Promise<AgentTemplateLink | null> => ((await readLinks())[templateId] ?? null);

const discoverAgentTemplateLink = async (templateId: string): Promise<AgentTemplateLink | null> => {
  const response = await fetch('/api/studio-documents', { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) throw new Error(await readApiErrorMessage(response, 'Unable to look up linked ChatGPT working drafts.'));
  const payload = await response.json() as { documents?: Array<{ id?: unknown; creationSource?: StudioDocumentSource; revision?: unknown; updatedAt?: unknown }> };
  const candidates = (payload.documents ?? []).filter((document) => document.creationSource === 'gpt' && typeof document.id === 'string' && Number.isInteger(document.revision)).sort((a, b) => String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''))).slice(0, 20);
  for (const candidate of candidates) {
    const documentId = String(candidate.id);
    const documentResponse = await fetch(`/api/studio-documents/${encodeURIComponent(documentId)}`, { cache: 'no-store', credentials: 'same-origin' });
    if (!documentResponse.ok) continue;
    const documentPayload = await documentResponse.json() as { document?: { revision?: unknown; document?: unknown } };
    const revision = Number.isInteger(documentPayload.document?.revision) ? Number(documentPayload.document?.revision) : null;
    const project = normalizeStudioDocumentPayload(documentPayload.document?.document);
    if (revision === null || !project?.userTemplates.some((template) => template.id === templateId)) continue;
    await rememberAgentTemplateLink(templateId, documentId, revision);
    return { documentId, revision };
  }
  return null;
};

export const syncAgentTemplateSave = async (template: TCGCardTemplate): Promise<AgentTemplateSyncResult> => {
  if (!getProjectPersistenceScope().startsWith('account:')) return { status: 'unlinked' };
  const templateId = template.id?.trim();
  if (!templateId) return { status: 'unlinked' };
  const link = await getAgentTemplateLink(templateId) ?? await discoverAgentTemplateLink(templateId);
  if (!link) return { status: 'unlinked' };
  const response = await fetch(`/api/studio-documents/${encodeURIComponent(link.documentId)}`, { cache: 'no-store', credentials: 'same-origin' });
  if (!response.ok) {
    if (response.status === 403 || response.status === 404) {
      await forgetAgentTemplateLink(templateId);
      const rediscoveredLink = await discoverAgentTemplateLink(templateId);
      if (!rediscoveredLink) return { status: 'unlinked' };
      return syncAgentTemplateSave(template);
    }
    throw new Error(await readApiErrorMessage(response, 'Unable to reload the linked ChatGPT working draft.'));
  }
  const payload = await response.json() as { document?: { id?: unknown; title?: unknown; creationSource?: StudioDocumentSource; revision?: unknown; document?: unknown } };
  const currentRevision = Number.isInteger(payload.document?.revision) ? Number(payload.document?.revision) : null;
  const title = typeof payload.document?.title === 'string' ? payload.document.title.trim() : '';
  const project = normalizeStudioDocumentPayload(payload.document?.document);
  if (payload.document?.creationSource !== 'gpt' || currentRevision === null || !title || !project) { await forgetAgentTemplateLink(templateId); return { status: 'unlinked' }; }
  if (currentRevision !== link.revision) return { status: 'conflict', revision: currentRevision };
  const templateIndex = project.userTemplates.findIndex((candidate) => candidate.id === templateId);
  if (templateIndex < 0) { await forgetAgentTemplateLink(templateId); return { status: 'unlinked' }; }

  const nextTemplates = [...project.userTemplates];
  // Working-document revision is a container concurrency token. It must never
  // masquerade as the Template's own lineage revision.
  const reusableTemplate = await reusePrivateAssets(template, project);
  nextTemplates[templateIndex] = { ...reusableTemplate, templateSource: 'user', templateLibrarySource: 'personal' };
  const updateResponse = await fetch(`/api/studio-documents/${encodeURIComponent(link.documentId)}`, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin',
    body: JSON.stringify({ expectedRevision: currentRevision, title, document: { ...project, userTemplates: nextTemplates } }),
  });
  if (!updateResponse.ok) {
    if (updateResponse.status === 409) {
      const latestResponse = await fetch(`/api/studio-documents/${encodeURIComponent(link.documentId)}`, { cache: 'no-store', credentials: 'same-origin' });
      if (latestResponse.ok) {
        const latestPayload = await latestResponse.json() as { document?: { revision?: unknown } };
        if (Number.isInteger(latestPayload.document?.revision)) return { status: 'conflict', revision: Number(latestPayload.document?.revision) };
      }
    }
    throw new Error(await readApiErrorMessage(updateResponse, 'Your Template was saved locally, but its ChatGPT working draft could not be updated.'));
  }
  const updatedPayload = await updateResponse.json() as { document?: { revision?: unknown } };
  const updatedRevision = Number.isInteger(updatedPayload.document?.revision) ? Number(updatedPayload.document?.revision) : currentRevision + 1;
  await rememberAgentTemplateLink(templateId, link.documentId, updatedRevision);
  return { status: 'synced', revision: updatedRevision };
};
