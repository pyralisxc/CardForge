"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { ToastFn } from '@/components/ui/use-toast';
import { inferTextElementContentModel } from '@/domain/rendering';
import { extractPlaceholderKeysFromText } from '@/domain/rendering';
import type { FreeformCardElement } from '@/domain/templates';
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
    'canvas' | 'commitTemplate' | 'currentTemplate' | 'selectedElement'
  >;
  toast: ToastFn;
}

export function useTemplateEditorVariables({
  controller: { canvas, commitTemplate, currentTemplate, selectedElement },
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

  const upsertFieldContract = useCallback((key: string, updates: Partial<FieldContract>, elementUpdates?: Pick<FreeformCardElement, 'textAutoFit' | 'textMinFontSizePx'>) => {
    const properties=Object.keys(updates).filter(property=>property!=='elementId');
    const continuous=properties.length>0&&properties.every(property=>['defaultValue','example','description','maxLength','fontSizePx','lineHeight','letterSpacing','minFontSizePx'].includes(property));
    commitTemplate((template) => {
      const next = upsertTemplateFieldContract(template, key, updates);
      if (!elementUpdates || !updates.elementId) return next;
      const activeCanvas = next.freeformCanvas ?? canvas;
      return { ...next, freeformCanvas: { ...activeCanvas, elements: activeCanvas.elements.map(element => element.id === updates.elementId ? { ...element, ...elementUpdates } : element) } };
    }, true,undefined,continuous?`field:${updates.elementId??''}:${key}:${properties.toSorted().join(',')}`:undefined);
  }, [canvas, commitTemplate]);

  const upsertFieldContracts=useCallback((keys:string[],updates:Partial<FieldContract>)=>{
    commitTemplate(template=>keys.reduce((next,key)=>upsertTemplateFieldContract(next,key,updates),template));
  },[commitTemplate]);

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
    }));
    focusVariableCard(nextKey);
  }, [canvas, commitTemplate, currentTemplate.fieldContracts, focusVariableCard, selectedElement, toast]);

  const removeVariable = useCallback((key: string) => {
    if (!selectedElement) return;
    commitTemplate(
      (template) => removeScopedTextElementVariableContract(template, selectedElement.id, key),
      true,
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
    return nextKey;
  }, [currentTemplate.fieldContracts, selectedElement, toast]);

  const completeVariableCreation = useCallback((key:string,selectedText:string,content:string) => {
    if (!selectedElement || selectedElement.type !== 'text') return;
    const inferredType=inferTextElementContentModel(currentTemplate,selectedElement);
    commitTemplate(template=>{
      const next=upsertTemplateFieldContract(template,key,{key,elementId:selectedElement.id,label:toTitleCase(key),type:inferredType==='structuredRows'?'structuredRows':'text',required:false,multiline:selectedText.includes('\n'),defaultValue:selectedText,example:selectedText});
      const active=next.freeformCanvas??canvas;
      return {...next,freeformCanvas:{...active,elements:active.elements.map(element=>element.id===selectedElement.id?{...element,content}:element)}};
    });
    toast({title:'Variable created',description:`"${key}" was added to this text element. You can adjust its rich text behavior below.`});
    focusVariableCard(key);
  },[canvas,commitTemplate,currentTemplate,focusVariableCard,selectedElement,toast]);

  const completeVariableRemoval = useCallback((key:string,content:string)=>{
    if (!selectedElement) return;
    commitTemplate(template=>{
      const next=removeScopedTextElementVariableContract(template,selectedElement.id,key);
      const active=next.freeformCanvas??canvas;
      return {...next,freeformCanvas:{...active,elements:active.elements.map(element=>element.id===selectedElement.id?{...element,content}:element)}};
    });
    setActiveVariableKey(null);
  },[canvas,commitTemplate,selectedElement]);

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
    commitTemplate(template=>{
      const active=template.freeformCanvas??canvas;
      let next={...template,freeformCanvas:{...active,elements:active.elements.map(element=>element.id===selectedElement.id?{...element,content:nextContent}:element)}};
      for (const field of [{key:labelKey,label:'Label',example:'Flying'},{key:valueKey,label:'Value',example:'+1'}]) next=upsertTemplateFieldContract(next,field.key,{...field,elementId:selectedElement.id,type:'structuredRows',required:field.key===labelKey,defaultValue:field.example}) as typeof next;
      return next;
    });
    setActiveVariableKey(labelKey);
    toast({
      title: 'Structured row columns added',
      description: `${labelKey} and ${valueKey} were added to this text element. Add actual rows in Make cards.`,
    });
    requestAnimationFrame(() => focusVariableCard(labelKey));
  }, [canvas,commitTemplate,currentTemplate.fieldContracts, focusVariableCard, selectedElement, toast]);

  return {
    activeVariableKey,
    addStructuredRowPattern,
    createVariableFromSelection,
    completeVariableCreation,
    completeVariableRemoval,
    focusVariableCard,
    removeVariable,
    renameVariable,
    selectedElementTemplateFields,
    setActiveVariableKey,
    upsertFieldContract,
    upsertFieldContracts,
    variableCardRefs,
    variableKeyInputRefs,
  };
}

export type TemplateEditorVariables = ReturnType<typeof useTemplateEditorVariables>;
