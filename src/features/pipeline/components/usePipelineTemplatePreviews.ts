"use client";

import { useEffect, useState } from 'react';

import { loadCardForgeCatalog } from '@/features/pipeline/client/catalog';
import { getTemplatePreviewId, type PipelinePublishedTemplatePreview } from './PipelineContributionModel';
import type { PipelineSubmission } from '../lib/pipelineProgram';

export const usePipelineTemplatePreviews = (
  submissions: PipelineSubmission[] | undefined,
): Record<string, PipelinePublishedTemplatePreview> => {
  const [templates, setTemplates] = useState<Record<string, PipelinePublishedTemplatePreview>>({});

  useEffect(() => {
    if (!submissions?.some((submission) => getTemplatePreviewId(submission))) {
      setTemplates({});
      return;
    }
    let isMounted = true;
    void (async () => {
      try {
        const catalog = await loadCardForgeCatalog();
        const body = catalog.templates;
        if (!isMounted) return;
        setTemplates(Object.fromEntries(
          [...body.defaults, ...body.userTemplates]
            .flatMap(template => {
              const publication = catalog.pipeline?.items.find(item => item.id === template.id && item.submissionId && item.lineageId);
              return publication?.submissionId && publication.lineageId && template.id
                ? [[template.id, { template, submissionId: publication.submissionId, lineageId: publication.lineageId }] as const]
                : [];
            }),
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
