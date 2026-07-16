import type { AppearanceStyleLibrary, TCGCardTemplate } from '@/domain/templates';

type TemplatesPayload = {
  defaults?: Partial<TCGCardTemplate>[];
  userTemplates?: Partial<TCGCardTemplate>[];
};
type StylesPayload = Partial<AppearanceStyleLibrary>;

let templatesPromise: Promise<TemplatesPayload> | null = null;
let stylesPromise: Promise<StylesPayload> | null = null;

const fetchJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json() as Promise<T>;
};

export const loadBootstrapTemplates = () => {
  templatesPromise ??= fetchJson<TemplatesPayload>('/api/templates').catch((error) => {
    templatesPromise = null;
    throw error;
  });
  return templatesPromise;
};

export const loadBootstrapStyles = () => {
  stylesPromise ??= fetchJson<StylesPayload>('/api/styles').catch((error) => {
    stylesPromise = null;
    throw error;
  });
  return stylesPromise;
};
