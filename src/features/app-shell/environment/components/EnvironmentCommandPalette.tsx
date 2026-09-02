"use client";

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { isActionAvailable, type ActionDescriptor } from '../model';
import styles from './EnvironmentFoundation.module.css';

export function EnvironmentCommandPalette({
  open,
  actions,
  onOpenChange,
  onAction,
}: {
  open: boolean;
  actions: readonly ActionDescriptor[];
  onOpenChange: (open: boolean) => void;
  onAction: (action: ActionDescriptor) => void;
}) {
  const [query, setQuery] = useState('');
  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    return actions.filter((action) => action.availability.kind !== 'hidden' && (
      normalized.length === 0
      || action.label.toLocaleLowerCase().includes(normalized)
      || action.id.toLocaleLowerCase().includes(normalized)
    ));
  }, [actions, query]);

  return <Dialog open={open} onOpenChange={(nextOpen) => { onOpenChange(nextOpen); if (!nextOpen) setQuery(''); }}>
    <DialogContent className={styles.commandDialog}>
      <DialogHeader>
        <DialogTitle>Actions for this context</DialogTitle>
        <DialogDescription>Search the actions CardForge already owns for the current Zone, selection, or object.</DialogDescription>
      </DialogHeader>
      <label className={styles.commandSearch}>
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">Search actions</span>
        <input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search actions…" />
      </label>
      <div className={styles.commandResults} role="list">
        {matches.map((action) => {
          const available = isActionAvailable(action);
          return <button
            key={action.id}
            type="button"
            role="listitem"
            disabled={!available}
            title={action.availability.kind === 'disabled' ? action.availability.reason : undefined}
            onClick={() => { if (available) { onOpenChange(false); onAction(action); } }}
          >
            <span><strong>{action.label}</strong><small>{action.scope} · {action.ownerFeature}</small></span>
            <small>{action.commitment === 'none' ? action.result : action.commitment}</small>
          </button>;
        })}
        {matches.length === 0 ? <p>No available action matches that search.</p> : null}
      </div>
    </DialogContent>
  </Dialog>;
}
