"use client";

import type { TCGCardTemplate } from '@/domain/templates';
import type { ToastFn } from '@/components/ui/use-toast';
import { ERROR_COPY } from '@/features/card-generator/lib/errorCopy';
import { withNextStep } from '@/shared/userFacingErrors';

const downloadTextFile = ({
  content,
  fileName,
  mimeType,
}: {
  content: string;
  fileName: string;
  mimeType: string;
}) => {
  const blob = new Blob([content], { type: mimeType + ';charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const getSafeTemplateFileName = (template: TCGCardTemplate, fallback: string): string => (
  (template.name || template.id || fallback).replace(/[^a-z0-9_]/gi, '_').substring(0, 20) || fallback
);

export function useBulkExampleDownloads({
  selectedTemplate,
  exampleCsv,
  exampleJson,
  exampleStructuredText,
  toast,
}: {
  selectedTemplate: TCGCardTemplate | undefined;
  exampleCsv: string;
  exampleJson: string;
  exampleStructuredText: string;
  toast: ToastFn;
}) {
  const requireTemplate = (format: string) => {
    if (selectedTemplate) return true;
    toast({
      title: ERROR_COPY.selectTemplateFirst.title,
      description: withNextStep('Choose a Template before downloading ' + format + '.', 'Choose a Template above, then try again.'),
      variant: 'default',
    });
    return false;
  };

  const handleDownloadExampleCsv = () => {
    if (!requireTemplate('an example CSV') || !selectedTemplate) return;
    if (!exampleCsv.trim() || !exampleCsv.includes('\n') || exampleCsv.startsWith('Select a template first.')) {
      toast({
        title: 'Example CSV unavailable',
        description: withNextStep('This Template has no usable card fields.', 'Open Templates, add card fields, save, then download again.'),
        variant: 'destructive',
      });
      return;
    }
    const fileName = 'template_' + getSafeTemplateFileName(selectedTemplate, 'layout') + '.csv';
    downloadTextFile({ content: exampleCsv, fileName, mimeType: 'text/csv' });
    toast({ title: 'Example CSV downloaded', description: fileName + ' is ready. Next step: fill it with your data and upload.' });
  };

  const handleDownloadExampleJson = () => {
    if (!requireTemplate('an example JSON file') || !selectedTemplate) return;
    if (!exampleJson.trim() || exampleJson === '[]') {
      toast({
        title: 'Example JSON unavailable',
        description: withNextStep('This Template has no usable card fields.', 'Open Templates, add card fields, save, then download again.'),
        variant: 'destructive',
      });
      return;
    }
    const fileName = 'template_' + getSafeTemplateFileName(selectedTemplate, 'layout') + '.json';
    downloadTextFile({ content: exampleJson, fileName, mimeType: 'application/json' });
    toast({ title: 'Example JSON downloaded', description: fileName + ' is ready. Next step: fill it with your data and upload.' });
  };

  const handleDownloadStructuredText = () => {
    if (!requireTemplate('a text starter') || !selectedTemplate) return;
    if (!exampleStructuredText.trim() || exampleStructuredText.startsWith('Select a template first.')) {
      toast({
        title: 'Text starter unavailable',
        description: withNextStep('This Template has no usable card fields.', 'Open Templates, add card fields, save, then download again.'),
        variant: 'destructive',
      });
      return;
    }
    const fileName = 'template_' + getSafeTemplateFileName(selectedTemplate, 'layout') + '.md';
    const content = [
      '# CardForge bulk text starter',
      '',
      'Duplicate this block for each card. Keep each value after its Field: label.',
      'Separate cards with --- or a blank line between repeated field groups.',
      '',
      exampleStructuredText,
    ].join('\n');
    downloadTextFile({ content, fileName, mimeType: 'text/markdown' });
    toast({ title: 'Text starter downloaded', description: fileName + ' is ready for a no-spreadsheet bulk workflow.' });
  };

  return {
    handleDownloadExampleCsv,
    handleDownloadExampleJson,
    handleDownloadStructuredText,
  };
}
