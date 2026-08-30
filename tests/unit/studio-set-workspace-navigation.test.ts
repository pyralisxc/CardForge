import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizeStudioView } from '@/features/project/store/workspaceDefaults';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Studio Set Desk architecture', () => {
  it('migrates legacy destinations into one persisted Set Desk with contextual tools', () => {
    const shell = readSource('src/features/app-shell/components/CardForgeStudioShell.tsx');
    const commands = readSource('src/features/app-shell/components/StudioCommandBar.tsx');
    const contextTools = readSource('src/features/app-shell/components/StudioContextTools.tsx');

    expect(normalizeStudioView('sets')).toBe('desk');
    expect(normalizeStudioView('template-maker')).toBe('template');
    expect(normalizeStudioView('generator')).toBe('generate');
    expect(normalizeStudioView('unknown')).toBe('desk');
    expect(shell).toContain('data-studio-set-desk');
    expect(commands).toContain('Edit Template');
    expect(commands).toContain('Save / move');
    expect(contextTools).toContain('Send {activeSetName} to Pipeline');
    expect(shell).not.toContain('TabsTrigger');
    expect(shell).not.toContain('STUDIO_TABS');
  });

  it('keeps tool workspaces mounted while visibility follows the active Studio view', () => {
    const shell = readSource('src/features/app-shell/components/CardForgeStudioShell.tsx');

    expect(shell).toContain("hidden={studioView !== 'desk'}");
    expect(shell).toContain("hidden={studioView !== 'template'}");
    expect(shell).toContain("hidden={studioView !== 'generate'}");
    expect(shell).toContain("data-state={studioView === 'template' ? 'active' : 'inactive'}");
  });

  it('uses real authored previews and the native Set organization owner', () => {
    const desk = readSource('src/features/card-generator/components/StudioSetDesk.tsx');

    expect(desk).toContain('<AuthoredObjectPreview');
    expect(desk).toContain('<CardPreview');
    expect(desk).toContain('updateCardSetOrganization');
    expect(desk).toContain('addCardSetTag');
    expect(desk).toContain('setCardsTag');
    expect(desk).toContain('setCardPositions');
    expect(desk).toContain('moveGeneratedCardsToSet');
    expect(desk).toContain('reorderGeneratedCard');
    expect(desk).toContain('Freeform');
    expect(desk).toContain('By field');
  });

  it('keeps output and Pipeline behind their existing feature owners', () => {
    const contextTools = readSource('src/features/app-shell/components/StudioContextTools.tsx');
    const contribution = readSource('src/features/pipeline/components/PipelineContributionPanel.tsx');
    const submission = readSource('src/features/pipeline/components/PipelineSubmissionPanel.tsx');

    expect(contextTools).toContain('<StudioOutputPanel');
    expect(contextTools).toContain('<StudioPipelineSubmission compact submitOnly');
    expect(contribution).toContain('submitOnly = false');
    expect(submission).toContain('embedded = false');
    expect(submission).toContain('return embedded ? content');
  });

  it('lazy-loads heavyweight Studio tools and the Set Desk', () => {
    const client = readSource('src/features/card-generator/client.ts');
    const lazy = readSource('src/features/app-shell/components/StudioLazyWorkspaces.tsx');

    expect(client).toContain("loadStudioSetDesk = () => import('./components/StudioSetDesk')");
    expect(lazy).toContain('export const StudioSetDesk = dynamic(');
    expect(lazy).toContain('module.loadStudioSetDesk()');
    expect(lazy).toContain('export const StudioOutputPanel = dynamic(');
    expect(lazy).toContain('export const StudioPipelineSubmission = dynamic(');
  });
});
