import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { normalizeStudioView } from '@/features/project/store/workspaceDefaults';

const readSource = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Studio focused workbench architecture', () => {
  it('migrates retired destinations into focused authoring tools', () => {
    const shell = readSource('src/features/app-shell/components/CardForgeStudioShell.tsx');
    const desk = readSource('src/features/home/components/HomeDesk.tsx');
    const toolLayer = readSource('src/features/app-shell/environment/components/EnvironmentToolLayer.tsx');

    expect(normalizeStudioView('sets')).toBe('generate');
    expect(normalizeStudioView('desk')).toBe('generate');
    expect(normalizeStudioView('template-maker')).toBe('template');
    expect(normalizeStudioView('generator')).toBe('generate');
    expect(normalizeStudioView('unknown')).toBe('template');
    expect(shell).not.toContain('data-studio-set-desk');
    expect(shell).not.toContain('StudioSetDesk');
    expect(shell).toContain('useSearchParams()');
    expect(shell).toContain("searchParams.get('returnTo')");
    expect(desk).toContain('presentation="workspace"');
    expect(toolLayer).toContain("presentation?: 'panel' | 'workspace'");
    expect(shell).toContain('data-studio-presentation="contextual-tool"');
    expect(shell).not.toContain('StudioCommandBar');
    expect(shell).not.toContain('AccountControls');
    expect(shell).not.toContain('StudioHeader');
  });

  it('keeps only focused authoring workspaces mounted', () => {
    const shell = readSource('src/features/app-shell/components/CardForgeStudioShell.tsx');

    expect(shell).toContain("hidden={studioView !== 'template'}");
    expect(shell).toContain("hidden={studioView !== 'generate'}");
    expect(shell).toContain("data-state={studioView === 'template' ? 'active' : 'inactive'}");
    expect(shell).not.toContain("hidden={studioView !== 'desk'}");
    expect(shell).toContain("target.closest<HTMLElement>('[data-testid=\"generator-panel\"]')");
    expect(shell).not.toContain('window.scrollTo');
    expect(shell).not.toContain('target?.scrollIntoView');
  });

  it('presents Generate as progressive work and returns new cards to Desk', () => {
    const workspace = readSource('src/features/card-generator/components/GenerationWorkspace.tsx');
    const bulkGenerator = readSource('src/features/card-generator/components/BulkGenerator.tsx');
    const bulkInput = readSource('src/features/card-generator/components/BulkCsvInputPanel.tsx');
    const bulkAction = readSource('src/features/card-generator/components/BulkGenerateActionBar.tsx');

    expect(workspace).toContain("useState<GenerationStage>('setup')");
    expect(workspace).toContain('generation-step-setup');
    expect(workspace).toContain('generation-step-data');
    expect(workspace).toContain('Continue to card data');
    expect(bulkGenerator).not.toContain('BulkTemplateSetupPanel');
    expect(bulkGenerator).not.toContain('<Card>');
    expect(bulkGenerator).toContain('View cards on Desk');
    expect(bulkInput).not.toContain('<Card>');
    expect(bulkAction).not.toContain('-mx-3');
  });

  it('keeps output, storage, and Pipeline behind their native feature owners', () => {
    const contextTools = readSource('src/features/app-shell/components/StudioContextTools.tsx');
    const contribution = readSource('src/features/pipeline/components/PipelineContributionPanel.tsx');
    const submission = readSource('src/features/pipeline/components/PipelineSubmissionPanel.tsx');

    expect(contextTools).toContain('<StudioOutputPanel');
    expect(contextTools).toContain('<StudioSaveMoveDialog');
    expect(contextTools).toContain('<StudioPipelineSubmission compact initialSubmitSetId={activeSetId}');
    expect(contribution).toContain("fetch('/api/pipeline/contributor-summary'");
    expect(contribution).not.toContain('<Tabs');
    expect(contribution).not.toContain('Voting Lane');
    expect(contribution).not.toContain('My Pipeline');
    expect(contribution).not.toContain('Pipeline metrics');
    expect(submission).toContain('Submit to the Pipeline');
    expect(submission).toContain('grid grid-cols-2 gap-px');
    expect(submission).not.toContain('grid gap-2 sm:grid-cols-2 lg:grid-cols-4');
    expect(submission).not.toContain('TabsContent');
  });

  it('does not ship a duplicate Set organization surface through Studio', () => {
    const client = readSource('src/features/card-generator/client.ts');
    const lazy = readSource('src/features/app-shell/components/StudioLazyWorkspaces.tsx');
    const desk = readSource('src/features/home/components/HomeDesk.tsx');
    const deskController = readSource('src/features/home/hooks/useHomeDeskController.ts');
    const artifactCommands = readSource('src/features/home/hooks/useHomeArtifactCommands.ts');
    const projectWorkspace = readSource('src/features/home/hooks/useHomeProjectWorkspace.ts');
    const deskOwnership = `${deskController}\n${artifactCommands}\n${projectWorkspace}`;

    expect(client).not.toContain('loadStudioSetDesk');
    expect(client).not.toContain('loadExportControlsPanel');
    expect(lazy).not.toContain('StudioSetDesk');
    expect(deskOwnership).toContain('updateCardSetOrganization');
    expect(desk).toContain('setCardPositions');
    expect(deskOwnership).toContain('moveGeneratedCardsToSet');
    expect(lazy).toContain('export const StudioOutputPanel = dynamic(');
    expect(lazy).toContain("import('@/features/card-generator/client/export-controls-panel')");
    expect(lazy).toContain("import('@/features/pipeline/client/contribution-panel')");
  });
});
