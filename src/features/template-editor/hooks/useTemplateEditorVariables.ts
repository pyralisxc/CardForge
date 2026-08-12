"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ToastFn } from '@/components/ui/use-toast';
import { inferTextElementContentModel } from '@/domain/rendering';
import { extractPlaceholderKeysFromText } from '@/domain/rendering';
import { extractTemplateFieldDefinitions } from '@/domain/templates';
import type { TemplateEditorController } from '@/features/template-editor/hooks/useTemplateEditorController';
import {
  getNextScopedVariableKey as buildNextScopedVariableKey,
  hasScopedVariableKeyConflict,
  normalizeTemplateVariableKey,
  removeScopedTextElementVariableContract,
  renameScopedTextElementVariable,
  upsertTemplateFieldContract,
  type FieldContract,
} from '@/features/template-editor/lib/templateVariableContracts';
import { toTitleCase } from '@/shared/text';

interface UseTemplateEditorVariablesInput {
  controller: Pick<
    TemplateEditorController,
    'canvas' | 'commitTemplate' | 'currentTemplate' | 'selectedElement' | 'updateElement'
  >;
  toast: ToastFn;
}

export function useTemplateEditorVariables({
  controller: { canvas, commitTemplate, currentTemplate, selectedElement, updateElement },
  toast,
}: UseTemplateEditorVariablesInput) {
  const [activeVariableKey, setActiveVariableKey] = useState<string | null>(null);
  const variableKeyInputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const variableCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const templateFieldDefinitions = useMemo(
    () => extractTemplateFieldDefinitions(currentTemplate),
    [currentTemplate],
  );
  const selectedElementTemplateFields = useMemo(() => {
    if (selectedElement?.type !== 'text') return [];
    return templateFieldDefinitions.filter(
      (field) => !field.isImage && field.sourceElementId === selectedElement.id,
    );
  }, [selectedElement, templateFieldDefinitions]);

  useEffect(() => {
    setActiveVariableKey(null);
  }, [selectedElement?.id]);

  const upsertFieldContract = useCallback((key: string, updates: Partial<FieldContract>) => {
    commitTemplate((template) => upsertTemplateFieldContract(template, key, updates), false);
  }, [commitTemplate]);

  const focusVariableCard = useCallback((key: string) => {
    setActiveVariableKey(key);
    requestAnimationFrame(() => {
      variableCardRefs.current[key]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      variableKeyInputRefs.current[key]?.focus();
      variableKeyInputRefs.current[key]?.select();
    });
  }, []);

  const renameVariable = useCallback((oldKey: string, nextKeyRaw: string) => {
    if (!selectedElement || selectedElement.type !== 'text') return;
    const nextKey = normalizeTemplateVariableKey(nextKeyRaw);
    if (!nextKey || oldKey === nextKey) return;
    if (hasScopedVariableKeyConflict(currentTemplate.fieldContracts, selectedElement.id, oldKey, nextKey)) {
      toast({
        title: 'Variable name already used',
        description: `This element already has a variable named "${nextKey}". Choose a different name.`,
        variant: 'destructive',
      });
      focusVariableCard(oldKey);
      return;
    }
    commitTemplate((template) => renameScopedTextElementVariable({
      template,
      fallbackCanvas: canvas,
      selectedElementId: selectedElement.id,
      oldKey,
      nextKey,
    }), false);
    focusVariableCard(nextKey);
  }, [canvas, commitTemplate, currentTemplate.fieldContracts, focusVariableCard, selectedElement, toast]);

  const removeVariable = useCallback((key: string) => {
    if (!selectedElement) return;
    commitTemplate(
      (template) => removeScopedTextElementVariableContract(template, selectedElement.id, key),
      false,
    );
    setActiveVariableKey(null);
  }, [commitTemplate, selectedElement]);

  const createVariableFromSelection = useCallback((selectedText: string, existingKey?: string) => {
    if (!selectedElement || selectedElement.type !== 'text') return undefined;
    const cleanSelectedText = selectedText.trim();
    if (!cleanSelectedText) {
      toast({
        title: 'Select text first',
        description: 'Highlight the text you want to turn into a variable, then use the variable button.',
      });
      return undefined;
    }
    const nextKey = buildNextScopedVariableKey(
      currentTemplate.fieldContracts,
      selectedElement,
      existingKey,
    );
    if (!nextKey) return undefined;
    const inferredType = inferTextElementContentModel(currentTemplate, selectedElement);
    upsertFieldContract(nextKey, {
      key: nextKey,
      elementId: selectedElement.id,
      label: toTitleCase(nextKey),
      type: inferredType === 'structuredRows' ? 'structuredRows' : 'text',
      required: false,
      multiline: cleanSelectedText.includes('\n'),
      defaultValue: cleanSelectedText,
      example: cleanSelectedText,
    });
    toast({
      title: 'Variable created',
      description: `"${nextKey}" was added to this text element. You can adjust its rich text behavior below.`,
    });
    focusVariableCard(nextKey);
    return nextKey;
  }, [currentTemplate, focusVariableCard, selectedElement, toast, upsertFieldContract]);

  const addStructuredRowPattern = useCallback(() => {
    if (!selectedElement || selectedElement.type !== 'text') return;
    const existingKeys = new Set([
      ...extractPlaceholderKeysFromText(selectedElement.content),
      ...(currentTemplate.fieldContracts ?? [])
        .filter((contract) => contract.elementId === selectedElement.id)
        .map((contract) => contract.key),
    ]);
    const createUniqueKey = (baseKey: string) => {
      const cleanBase = normalizeTemplateVariableKey(baseKey) || 'row';
      let candidate = cleanBase;
      let index = 2;
      while (
        existingKeys.has(candidate)
        || hasScopedVariableKeyConflict(currentTemplate.fieldContracts, selectedElement.id, '', candidate)
      ) {
        candidate = `${cleanBase}${index}`;
        index += 1;
      }
      existingKeys.add(candidate);
      return candidate;
    };
    const labelKey = createUniqueKey('label');
    const valueKey = createUniqueKey('value');
    const rowPattern = `{{${labelKey}:"Flying"}}: {{${valueKey}:"+1"}}`;
    const nextContent = selectedElement.content?.trim()
      ? `${selectedElement.content}\n${rowPattern}`
      : rowPattern;
    updateElement(selectedElement.id, { content: nextContent });
    [
      { key: labelKey, label: 'Label', example: 'Flying' },
      { key: valueKey, label: 'Value', example: '+1' },
    ].forEach((field) => {
      upsertFieldContract(field.key, {
        key: field.key,
        elementId: selectedElement.id,
        label: field.label,
        type: 'structuredRows',
        required: field.key === labelKey,
        defaultValue: field.example,
        example: field.example,
      });
    });
    setActiveVariableKey(labelKey);
    toast({
      title: 'Structured row columns added',
      description: `${labelKey} and ${valueKey} were added to this text element. Add actual rows in Make cards.`,
    });
    requestAnimationFrame(() => focusVariableCard(labelKey));
  }, [currentTemplate.fieldContracts, focusVariableCard, selectedElement, toast, updateElement, upsertFieldContract]);

  return {
    activeVariableKey,
    addStructuredRowPattern,
    createVariableFromSelection,
    focusVariableCard,
    removeVariable,
    renameVariable,
    selectedElementTemplateFields,
    setActiveVariableKey,
    upsertFieldContract,
    variableCardRefs,
    variableKeyInputRefs,
  };
}

export type TemplateEditorVariables = ReturnType<typeof useTemplateEditorVariables>;
