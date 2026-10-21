"use client";

import type { CardData } from '@/domain/cards';
import { extractPlaceholderKeysFromText, getGeneratorImageFieldKeyForElement, getImageFieldKeyForElement } from '@/domain/rendering';
import type { AppearanceStylePreset, FreeformAppearance, FreeformCardElement, TCGCardTemplate } from '@/domain/templates';
import type { ProjectDocumentV1 } from '../model/projectDocument';
import { MAX_PROJECT_PACKAGE_ASSET_BYTES, MAX_PROJECT_PACKAGE_BYTES, MAX_PROJECT_PACKAGE_ASSETS, isProjectPackageAssetMimeType, type ResolvedProjectPackageAssetReference } from '../model/projectPackage';
import { ProjectPackageError } from '../lib/projectPackageError';
import { getBrowserProjectAssetReference } from '../persistence/contentAddressedBrowserAssets';

const unavailable = () => new ProjectPackageError('Referenced artwork could not be included in the portable project. Check that its image URL is accessible and permits browser downloads, or import the image into CardForge, then export again.');

/** Browser-only, bounded capture. No server proxy, cross-origin credentials or redirect fallback. */
async function readRemoteArtwork(reference: string): Promise<Blob> {
  const base = typeof location === 'undefined' ? undefined : location.href;
  let url: URL;
  try { url = new URL(reference, base); } catch { throw unavailable(); }
  const sameOrigin = base !== undefined && url.origin === new URL(base).origin;
  if (url.hash) throw new ProjectPackageError('Artwork URL fragments cannot be preserved in a portable project. Import the intended image first.');
  if (url.username || url.password || (url.protocol !== 'https:' && !(sameOrigin && ['http:', 'blob:'].includes(url.protocol)))) throw unavailable();
  // The browser retains its own DNS, CSP, mixed-content and private-network
  // enforcement. Never transfer this fetch to a privileged server transport.
  const response = await fetch(url.href, {
    mode: 'cors', credentials: 'same-origin', redirect: 'error', referrerPolicy: 'no-referrer',
    signal: AbortSignal.timeout(15_000),
  });
  const mimeType = response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? '';
  if (!response.ok || !response.body || !mimeType.startsWith('image/') || !isProjectPackageAssetMimeType(mimeType)) {
    await response.body?.cancel();
    throw unavailable();
  }
  if (Number(response.headers.get('content-length')) > MAX_PROJECT_PACKAGE_ASSET_BYTES) {
    await response.body.cancel();
    throw new ProjectPackageError('Referenced artwork exceeds the 32 MB portable asset limit.');
  }
  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_PROJECT_PACKAGE_ASSET_BYTES) throw new ProjectPackageError('Referenced artwork exceeds the 32 MB portable asset limit.');
      chunks.push(Uint8Array.from(value).buffer);
    }
  } catch (error) {
    await reader.cancel().catch(() => undefined);
    throw error;
  } finally { reader.releaseLock(); }
  if (!size) throw unavailable();
  return new Blob(chunks, { type: mimeType });
}

/** Transform typed media slots in an export copy, never URL-looking authored text. */
export async function capturePortableRemoteArtwork(source: ProjectDocumentV1) {
  const document = structuredClone(source);
  const assets = new Map<string, ResolvedProjectPackageAssetReference>();
  const captured = new Map<string, string>();
  let totalBytes = 0;
  const media = async (value: string | undefined): Promise<string | undefined> => {
    if (!value || /^(?:data:|css:|cardforge-browser-asset:|cardforge-project-asset:)/u.test(value)) return value;
    if (/url\s*\(/iu.test(value) && !/^url\(\s*(['"]?)(?:data:[^()]*|#[^()]*)\1\s*\)$/iu.test(value)) throw new ProjectPackageError('Linked CSS artwork cannot be packaged. Import it as an image first.');
    // Compound CSS/bindings cannot carry the codec's whole-value asset reference.
    // Fail explicitly rather than claim an offline package with remote dependencies.
    if (value.includes('{{') && !/^\{\{\s*[A-Za-z_][\w.-]*\s*\}\}$/u.test(value)) throw new ProjectPackageError('Compound artwork bindings cannot be packaged. Import the resolved image first.');
    if (/https?:|blob:/iu.test(value) && (!/^(?:https?:|blob:)/iu.test(value) || value.includes('{{'))) {
      throw new ProjectPackageError('Artwork inside a compound CSS value or URL binding cannot be packaged. Import it as an image first.');
    }
    if (!/^(?:https?:|blob:|\/)/iu.test(value)) {
      if (/^[a-z][a-z\d+.-]*:/iu.test(value)) throw unavailable();
      return value; // A field name or template binding, not a fetched resource.
    }
    const previous = captured.get(value);
    if (previous) return previous;
    if (captured.size >= MAX_PROJECT_PACKAGE_ASSETS) throw new ProjectPackageError('This portable project has too many referenced artwork files.');
    let blob: Blob;
    try { blob = await readRemoteArtwork(value); } catch (error) {
      if (error instanceof ProjectPackageError) throw error;
      throw unavailable();
    }
    totalBytes += blob.size;
    if (totalBytes > MAX_PROJECT_PACKAGE_BYTES) throw new ProjectPackageError('Referenced artwork exceeds the 256 MB portable package limit.');
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const id = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
    const reference = getBrowserProjectAssetReference(id);
    // Export-local lazy source only; no IndexedDB writes or workspace mutation.
    assets.set(reference, { mimeType: blob.type, source: { kind: 'lazy', size: blob.size, load: async () => new Uint8Array(await blob.arrayBuffer()) } });
    captured.set(value, reference);
    return reference;
  };
  const appearance = async (value?: FreeformAppearance) => {
    if (!value) return;
    value.assetSource = await media(value.assetSource);
    value.dividerAsset = await media(value.dividerAsset);
    if (value.material?.texture) {
      value.material.texture.assetSource = await media(value.material.texture.assetSource);
      value.material.texture.imageSource = await media(value.material.texture.imageSource);
    }
    if (value.rawCss) {
      value.rawCss.backgroundImage = await media(value.rawCss.backgroundImage);
      value.rawCss.borderImageSource = await media(value.rawCss.borderImageSource);
    }
  };
  const element = async (value: Partial<FreeformCardElement>) => {
    value.imageSource = await media(value.imageSource);
    if (value.type === 'image') {
      value.content = await media(value.content);
    }
    value.iconImageSource = await media(value.iconImageSource);
    value.backgroundImageUrl = await media(value.backgroundImageUrl);
    await appearance(value.appearance);
  };
  const data = async (template: TCGCardTemplate, values?: CardData) => {
    if (!values) return;
    const keys = new Set(template.fieldContracts?.filter((contract) => contract.type === 'image').map((contract) => contract.key));
    const textKeys = new Set<string>();
    for (const binding of [template.cardBackgroundImageUrl, template.cardBorderImageSource]) extractPlaceholderKeysFromText(binding).forEach((key) => keys.add(key));
    for (const item of template.freeformCanvas?.elements ?? []) {
      if (item.type === 'image') {
        keys.add(getImageFieldKeyForElement(item));
        const contract = getGeneratorImageFieldKeyForElement(template, item);
        if (contract) keys.add(contract);
      } else if (item.type === 'text') extractPlaceholderKeysFromText(item.content).forEach((key) => textKeys.add(key));
      for (const binding of [item.iconImageSource, item.backgroundImageUrl]) {
        extractPlaceholderKeysFromText(binding).forEach((key) => keys.add(key));
      }
    }
    for (const key of keys) {
      const value = values[key];
      if (typeof value !== 'string') continue;
      if (textKeys.has(key) && /^(?:https?:|blob:|\/)/iu.test(value)) throw new ProjectPackageError('An artwork URL also supplies a text field. Separate those fields before creating a portable package.');
      values[key] = await media(value) ?? value;
    }
  };
  const template = async (value: Partial<TCGCardTemplate>) => {
    value.cardBackgroundImageUrl = await media(value.cardBackgroundImageUrl);
    value.cardBorderImageSource = await media(value.cardBorderImageSource);
    await appearance(value.appearance);
    for (const item of value.freeformCanvas?.elements ?? []) await element(item);
    for (const contract of value.fieldContracts ?? []) if (contract.type === 'image') contract.defaultValue = await media(contract.defaultValue);
  };
  const style = async (value: AppearanceStylePreset) => {
    await appearance(value.appearance);
    if (value.updates) await element(value.updates);
    if (value.templateUpdates) await template(value.templateUpdates);
  };
  const byId = new Map(source.userTemplates.map((item) => [item.id, item]));
  for (const card of document.storedCards) {
    const front = byId.get(card.templateId);
    const back = card.backingTemplateId ? byId.get(card.backingTemplateId) : undefined;
    if (front) await data(front, card.data);
    if (back) await data(back, card.backingData);
  }
  for (const value of document.userTemplates) {
    await data(byId.get(value.id)!, value.templatePreviewData);
    await template(value);
  }
  for (const values of Object.values(document.customAssets)) for (const value of values) {
    value.url = await media(value.url) ?? value.url;
    value.previewUrl = await media(value.previewUrl);
    if (value.style) await style(value.style);
  }
  for (const value of document.appearanceStyles) await style(value);
  return { document, assets };
}
