"use client";

import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { AlignCenter, AlignLeft, AlignRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FreeformCardElement, TCGCardTemplate } from '@/domain/templates';
import { textFontSizePx, CardForgeRichTextEditor, buildContractSegmentStyle } from '@/features/card-rendering/client';
import { cn } from '@/shared/classNames';
import { clamp } from '@/features/template-editor/lib/makerGeometry';
import { makerTheme } from '@/features/template-editor/lib/makerTheme';

type FieldContract = NonNullable<TCGCardTemplate['fieldContracts']>[number];

interface TextExpressionEditorProps {
  element: FreeformCardElement;
  fieldCount: number;
  highlightColor: string;
  onHighlightColorChange: (color: string) => void;
  onContentChange: (value: string) => void;
  onElementChange: (updates: Partial<FreeformCardElement>) => void;
  activeVariableKey: string | null;
  onActiveVariableChange: (key: string | null) => void;
  onCreateVariable: (selectedText: string) => string | undefined;
  onEditVariable: (key: string) => void;
  onRenameVariable: (key: string) => void;
  onRemoveVariable: (key: string) => void;
  showTextMarkerHint: boolean;
  fieldContracts?: FieldContract[];
}
export function TextExpressionEditor({
  element,
  fieldCount,
  highlightColor,
  onHighlightColorChange,
  onContentChange,
  onElementChange,
  activeVariableKey,
  onActiveVariableChange,
  onCreateVariable,
  onEditVariable,
  onRenameVariable,
  onRemoveVariable,
  showTextMarkerHint,
  fieldContracts,
}: TextExpressionEditorProps) {
  const variableStyles = useMemo(() => {
    const styles: Record<string, CSSProperties> = {};
    (fieldContracts || [])
      .filter((contract) => contract.elementId === element.id)
      .forEach((contract) => {
        const style = buildContractSegmentStyle(contract);
        if (style) styles[contract.key] = style;
      });
    return styles;
  }, [element.id, fieldContracts]);

  return (
    <div className="space-y-2 rounded-[6px] border border-[#252b35] bg-[#0b0f15] p-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-[10px] uppercase tracking-[0.16em] text-[#d5ad54]">Text Editor</Label>
        <span className="rounded-full border border-[#2d3340] px-2 py-0.5 text-[10px] text-[#8f95a3]">
          {fieldCount} {fieldCount === 1 ? 'field' : 'fields'}
        </span>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <Label htmlFor="element-template-expression" className="text-xs">Template Text</Label>
          <span className="text-[10px] text-[#8f95a3]">Quoted variable values are preview/default text</span>
        </div>

        <CardForgeRichTextEditor
          id="element-template-expression"
          value={element.content || ''}
          highlightColor={highlightColor}
          onHighlightColorChange={onHighlightColorChange}
          onChange={onContentChange}
          activeVariableKey={activeVariableKey}
          onActiveVariableChange={onActiveVariableChange}
          onCreateVariable={onCreateVariable}
          onEditVariable={onEditVariable}
          onRenameVariable={onRenameVariable}
          onRemoveVariable={onRemoveVariable}
          variableStyles={variableStyles}
          placeholder="Write card text here..."
        >
          <Input
            id="quick-font-size"
            type="number"
            min="6"
            max="96"
            aria-label="Text size"
            value={textFontSizePx(element)}
            onChange={event => onElementChange({ fontSizePx: clamp(Number(event.target.value) || 14, 6, 96) })}
            className="h-7 w-14 rounded-[4px] border-[#2d3340] bg-[#111720] px-1 text-center text-xs text-[#d8d1c4]"
          />
          <Button type="button" variant="outline" size="icon" aria-label="Align text left" title="Align left" className={cn(makerTheme.button, element.textAlign === 'left' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ textAlign: 'left' })}><AlignLeft className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Align text center" title="Align center" className={cn(makerTheme.button, element.textAlign === 'center' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ textAlign: 'center' })}><AlignCenter className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="icon" aria-label="Align text right" title="Align right" className={cn(makerTheme.button, element.textAlign === 'right' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ textAlign: 'right' })}><AlignRight className="h-4 w-4" /></Button>
          <Button type="button" variant="outline" size="sm" aria-label="Justify text" title="Justify" className={cn(makerTheme.button, element.textAlign === 'justify' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ textAlign: 'justify' })}>J</Button>
          <Button type="button" variant="outline" size="sm" aria-label="Use horizontal text direction" title="Horizontal text" className={cn(makerTheme.button, (element.writingMode || 'horizontal-tb') === 'horizontal-tb' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ writingMode: 'horizontal-tb' })}>H</Button>
          <Button type="button" variant="outline" size="sm" aria-label="Use vertical right-to-left text direction" title="Vertical right-to-left" className={cn(makerTheme.button, element.writingMode === 'vertical-rl' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ writingMode: 'vertical-rl' })}>V-RL</Button>
          <Button type="button" variant="outline" size="sm" aria-label="Use vertical left-to-right text direction" title="Vertical left-to-right" className={cn(makerTheme.button, element.writingMode === 'vertical-lr' && 'border-[#d5ad54] text-[#f5d27b]')} onClick={() => onElementChange({ writingMode: 'vertical-lr' })}>V-LR</Button>
        </CardForgeRichTextEditor>
      </div>

      {showTextMarkerHint && (
        <p className="text-[10px] text-[#8f95a3]">
          Prefix paragraphs with [ability], [effect], [reminder], [flavor], or [subtitle] to control semantic card-text rendering.
        </p>
      )}
      <p className="text-[10px] leading-4 text-[#8f95a3]">
        Example: {'{{name:"Aetherglass Vanguard"}}'} shows that value on the canvas and uses it as the generator fallback until a card row replaces it.
      </p>
    </div>
  );
}
