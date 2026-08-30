"use client";

import { useEffect, useState } from 'react';

import type { TCGCardTemplate } from '@/domain/templates';
import { loadCardForgeCatalog } from '@/features/pipeline/client/catalog';
import { getTemplatePreviewId } from './PipelineContributionModel';
import type { PipelineSubmission } from '../lib/pipelineProgram';

export const usePipelineTemplatePreviews = (
  submissions: PipelineSubmission[] | undefined,
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
        const body = (await loadCardForgeCatalog()).templates;
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
