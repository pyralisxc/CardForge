'use client';

import { createContext, useContext, useEffect, useRef, type MutableRefObject } from 'react';

export interface QuickAction {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  active?: boolean;
  onSelect: () => void;
}
export interface QuickActionsContribution { title: string; actions: QuickAction[]; shortcuts?: string[] }
export type QuickActionsRegistry = (ref: MutableRefObject<QuickActionsContribution>) => () => void;
export const QuickActionsContext = createContext<QuickActionsRegistry | null>(null);

/** The active editor supplies its existing actions; the shell only presents them. */
export function useQuickActionsContribution(enabled: boolean, contribution: QuickActionsContribution) {
  const register = useContext(QuickActionsContext);
  const ref = useRef(contribution);
  ref.current = contribution;
  const presentation = JSON.stringify([contribution.title, contribution.shortcuts, contribution.actions.map(({id,label,description,disabled,active}) => [id,label,description,disabled,active])]);
  useEffect(() => {
    if (!enabled || !register) return;
    return register(ref);
  }, [enabled, register, presentation]);
}
