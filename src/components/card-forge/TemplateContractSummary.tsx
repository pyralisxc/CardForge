import { Button } from '@/components/ui/button';
import type { TemplateFieldDefinition } from '@/lib/templateFields';
import { cn } from '@/lib/utils';
import { Braces, Download, FileJson, Highlighter, ImageIcon, ListChecks } from 'lucide-react';
import { isStaticSegmentFieldKey } from '@/lib/textBindings';

interface TemplateContractSummaryProps {
  fieldDefinitions: TemplateFieldDefinition[];
  templateName?: string | null;
  className?: string;
  onDownloadExampleCsv?: () => void;
  onDownloadContractJson?: () => void;
}

const getFieldTypeLabel = (field: TemplateFieldDefinition): string => {
  if (field.isImage) return 'Image';
  if (field.contentModel === 'rulesBlocks') return 'Rules Blocks';
  if (field.supportsRichText) return 'Rich text';
  if (field.isMultiline) return 'Multiline';
  return 'Text';
};

const showFieldKey = (field: TemplateFieldDefinition): boolean =>
  !isStaticSegmentFieldKey(field.key) &&
  field.label.trim().toLowerCase() !== field.key.trim().toLowerCase();

function FieldChip({ field }: { field: TemplateFieldDefinition }) {
  return (
    <div className="rounded-full border border-border/80 bg-background px-2.5 py-1 text-xs text-foreground">
      <span className="font-medium">{field.label}</span>
      {showFieldKey(field) && <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{field.key}</span>}
      <span className="ml-1.5 text-muted-foreground">{getFieldTypeLabel(field)}</span>
      {field.required && <span className="ml-1.5 text-primary">Required</span>}
    </div>
  );
}

export function TemplateContractSummary({
  fieldDefinitions,
  templateName,
  className,
  onDownloadExampleCsv,
  onDownloadContractJson,
}: TemplateContractSummaryProps) {
  const requiredFields = fieldDefinitions.filter((field) => field.required);
  const richTextFields = fieldDefinitions.filter((field) => field.supportsRichText);
  const rulesFields = fieldDefinitions.filter((field) => field.contentModel === 'rulesBlocks');
  const multilineFields = fieldDefinitions.filter((field) => field.isMultiline);
  const imageFields = fieldDefinitions.filter((field) => field.isImage);
  const stats = [
    {
      label: 'Required',
      value: requiredFields.length,
      helper: 'Need values before confident generation.',
      icon: ListChecks,
      iconClassName: 'text-primary',
    },
    {
      label: 'Rich Text',
      value: richTextFields.length,
      helper: 'Marker-aware fields should render consistently everywhere.',
      icon: Highlighter,
      iconClassName: 'text-accent',
    },
    {
      label: 'Rules Blocks',
      value: rulesFields.length,
      helper: 'One field can carry ability, reminder, flavor, and subtitle blocks.',
      icon: Braces,
      iconClassName: 'text-primary',
    },
    {
      label: 'Multiline',
      value: multilineFields.length,
      helper: 'Quote these cells in CSV when line breaks matter.',
      icon: ListChecks,
      iconClassName: 'text-primary',
    },
    {
      label: 'Image',
      value: imageFields.length,
      helper: 'Provide URLs, uploads, or data URIs for artwork fields.',
      icon: ImageIcon,
      iconClassName: 'text-accent',
    },
  ];

  return (
    <section
      className={cn(
        'space-y-4 rounded-lg border border-border/80 bg-background/80 p-4 shadow-sm',
        className
      )}
      aria-label="Template data contract"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Template Data Contract
          </p>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {templateName ? `${templateName} fields` : 'Select a template to inspect its fields'}
            </h3>
            <p className="text-xs text-muted-foreground">
              Bulk import, preview, and export should all follow this same field list.
            </p>
          </div>
        </div>
        {(onDownloadExampleCsv || onDownloadContractJson) && (
          <div className="flex flex-wrap gap-2">
            {onDownloadExampleCsv && (
              <Button type="button" size="sm" variant="outline" onClick={onDownloadExampleCsv} className="gap-2">
                <Download className="h-4 w-4" />
                Example CSV
              </Button>
            )}
            {onDownloadContractJson && (
              <Button type="button" size="sm" variant="outline" onClick={onDownloadContractJson} className="gap-2">
                <FileJson className="h-4 w-4" />
                Contract JSON
              </Button>
            )}
          </div>
        )}
      </div>

      {fieldDefinitions.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/80 bg-muted/20 px-3 py-4 text-sm text-muted-foreground">
          No placeholder fields were detected in this template yet.
        </div>
      ) : (
        <>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.label} className="rounded-lg border border-border/70 bg-card px-3 py-3">
                  <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                    <Icon className={cn('h-4 w-4', stat.iconClassName)} />
                    {stat.label}
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-foreground">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.helper}</p>
                </div>
              );
            })}
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <div className="space-y-2 rounded-lg border border-border/70 bg-card px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Field Inventory
              </p>
              <div className="flex flex-wrap gap-2">
                {fieldDefinitions.map((field) => <FieldChip key={field.key} field={field} />)}
              </div>
            </div>

            <div className="space-y-2 rounded-lg border border-border/70 bg-card px-3 py-3">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Format Rules
              </p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>Use CSV headers that match the field keys exactly when possible.</li>
                <li>Quote multiline cells to preserve line breaks during bulk import.</li>
                <li>Rich-text markers like <span className="font-mono text-[11px] text-foreground">==highlight==</span> should be preserved across entry, preview, and export.</li>
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
