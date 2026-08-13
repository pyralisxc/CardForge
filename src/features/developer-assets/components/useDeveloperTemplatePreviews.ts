"use client";

import { useEffect, useState } from 'react';

import type { TCGCardTemplate } from '@/domain/templates';
import { getTemplatePreviewId } from './DeveloperAssetHubModel';
import type { DeveloperAssetSubmission } from '../lib/developerAssetProgram';

interface TemplateLibraryResponse {
  defaults: TCGCardTemplate[];
  userTemplates: TCGCardTemplate[];
}

export const useDeveloperTemplatePreviews = (
  submissions: DeveloperAssetSubmission[] | undefined,
): Record<string, TCGCardTemplate> => {
  const [templates, setTemplates] = useState<Record<string, TCGCardTemplate>>({});

  useEffect(() => {
    if (!submissions?.some((submission) => getTemplatePreviewId(submission))) {
      setTemplates({});
      return;
    }
    let isMounted = true;
    void (async () => {
      try {
        const response = await fetch('/api/templates', { cache: 'no-store' });
        if (!response.ok) return;
        const body = await response.json() as TemplateLibraryResponse;
        if (!isMounted) return;
        setTemplates(Object.fromEntries(
          [...body.defaults, ...body.userTemplates]
            .filter((template): template is TCGCardTemplate & { id: string } => Boolean(template.id))
            .map((template) => [template.id, template]),
        ));
      } catch {
        if (isMounted) setTemplates({});
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [submissions]);

  return templates;
};
