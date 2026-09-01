"use client";

import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Focus } from 'lucide-react';

import { Button } from '@/components/ui/button';
import type { ArtifactPosition } from '@/domain/artifacts';
import type { CardSetOrganization } from '@/domain/cards';

import type { FocusedArtifactLayoutEntry } from '../model/focusedArtifactLayout';
import styles from './HomeDesk.module.css';

interface FocusedArtifactNavigatorProps {
  setName: string;
  entries: FocusedArtifactLayoutEntry[];
  groups: Array<{ label: string; entries: FocusedArtifactLayoutEntry[] }>;
  arrangement: CardSetOrganization['arrangement'];
  selection: readonly string[];
  navigatorFocusId: string | null;
  hidden: boolean;
  onFocusArtifact: (artifactId: string) => void;
  onMoveFocus: (artifactId: string, direction: -1 | 1 | 'first' | 'last') => void;
  onMoveGroup: (artifactId: string, direction: -1 | 1) => void;
  onNudge: (artifactId: string, delta: ArtifactPosition) => void;
  onSetNavigatorFocus: (artifactId: string) => void;
  onToggleArtifact: (artifactId: string, range: boolean, additive: boolean) => void;
}

export function FocusedArtifactNavigator({
  setName,
  entries,
  groups,
  arrangement,
  selection,
  navigatorFocusId,
  hidden,
  onFocusArtifact,
  onMoveFocus,
  onMoveGroup,
  onNudge,
  onSetNavigatorFocus,
  onToggleArtifact,
}: FocusedArtifactNavigatorProps) {
  const activeEntry = entries.find((entry) => entry.identity.artifactId === navigatorFocusId) ?? null;
  return <details className={styles.orderedNavigator} hidden={hidden}>
    <summary>Ordered Artifact navigator · {entries.length}</summary>
    <p>Use Arrow keys to move through the complete Set. Press Space to select and Enter to focus the Artifact on the board.</p>
    <div className={styles.orderedNavigatorControls}>
      <Button type="button" size="sm" variant="outline" disabled={!activeEntry} onClick={() => activeEntry && onFocusArtifact(activeEntry.identity.artifactId)}><Focus className="mr-1.5 h-4 w-4" />Focus on board</Button>
      {arrangement === 'manual' && activeEntry ? <>
        <Button type="button" size="icon" variant="ghost" onClick={() => onNudge(activeEntry.identity.artifactId, { x: -24, y: 0 })} aria-label="Move selected Artifacts left"><ArrowLeft aria-hidden="true" /></Button>
        <Button type="button" size="icon" variant="ghost" onClick={() => onNudge(activeEntry.identity.artifactId, { x: 0, y: -24 })} aria-label="Move selected Artifacts up"><ArrowUp aria-hidden="true" /></Button>
        <Button type="button" size="icon" variant="ghost" onClick={() => onNudge(activeEntry.identity.artifactId, { x: 0, y: 24 })} aria-label="Move selected Artifacts down"><ArrowDown aria-hidden="true" /></Button>
        <Button type="button" size="icon" variant="ghost" onClick={() => onNudge(activeEntry.identity.artifactId, { x: 24, y: 0 })} aria-label="Move selected Artifacts right"><ArrowRight aria-hidden="true" /></Button>
      </> : null}
    </div>
    <div className={styles.orderedArtifactList} role="listbox" aria-label={`Ordered Artifacts in ${setName}`} aria-multiselectable="true">
      {groups.map((group) => <div key={group.label} className={styles.orderedArtifactGroup} role="group" aria-label={`${group.label}, ${group.entries.length} Artifacts`}>
        <div className={styles.orderedArtifactGroupHeading} aria-hidden="true"><strong>{group.label}</strong><span>{group.entries.length}</span></div>
        {group.entries.map((entry) => {
          const artifactId = entry.identity.artifactId;
          const index = entries.findIndex((candidate) => candidate.identity.artifactId === artifactId);
          return <button
            id={`ordered-artifact-${artifactId}`}
            key={artifactId}
            type="button"
            role="option"
            tabIndex={navigatorFocusId === artifactId ? 0 : -1}
            aria-selected={selection.includes(artifactId)}
            aria-posinset={index + 1}
            aria-setsize={entries.length}
            onFocus={() => onSetNavigatorFocus(artifactId)}
            onClick={() => onToggleArtifact(artifactId, false, true)}
            onDoubleClick={() => onFocusArtifact(artifactId)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') { event.preventDefault(); onMoveFocus(artifactId, 1); }
              else if (event.key === 'ArrowUp') { event.preventDefault(); onMoveFocus(artifactId, -1); }
              else if (event.key === 'Home') { event.preventDefault(); onMoveFocus(artifactId, 'first'); }
              else if (event.key === 'End') { event.preventDefault(); onMoveFocus(artifactId, 'last'); }
              else if (event.key === 'PageUp') { event.preventDefault(); onMoveGroup(artifactId, -1); }
              else if (event.key === 'PageDown') { event.preventDefault(); onMoveGroup(artifactId, 1); }
              else if (event.key === 'Enter') { event.preventDefault(); onFocusArtifact(artifactId); }
              else if (event.key === ' ') { event.preventDefault(); onToggleArtifact(artifactId, event.shiftKey, true); }
            }}
          ><span>{index + 1}</span><strong>{entry.title}</strong><small>{entry.subtitle}</small></button>;
        })}
      </div>)}
    </div>
  </details>;
}
