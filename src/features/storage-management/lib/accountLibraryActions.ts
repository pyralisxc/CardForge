import {
  createActionDefinition,
  type ActionDefinition,
  type ActionDescriptor,
  type ActionOperationInput,
  type ActionOperationResult,
} from '@/features/app-shell/client/environment';
import type { LibraryScope } from '../model/libraryScopes';

export const createLibraryLocationsHref = (scope: LibraryScope): string => {
  const params = new URLSearchParams({ section: 'library', scope, tool: 'locations' });
  return `/account?${params.toString()}`;
};

type LibraryCommand = (input: ActionOperationInput) => ActionOperationResult | Promise<ActionOperationResult>;

export interface AccountLibraryActionCommands {
  closeLocations: LibraryCommand;
  closeTool: LibraryCommand;
  continuePersonal: LibraryCommand;
  openPersonal: LibraryCommand;
  sendPipeline: LibraryCommand;
  saveMove: LibraryCommand;
  duplicate: LibraryCommand;
  deleteCopy: LibraryCommand;
  viewSource: LibraryCommand;
  manageLocation: LibraryCommand;
  usePublished: LibraryCommand;
  copyPublishedTemplate: LibraryCommand;
  editPipeline: LibraryCommand;
  testPipeline: LibraryCommand;
  withdrawPipeline: LibraryCommand;
  retirePipeline: LibraryCommand;
  refresh: LibraryCommand;
}

const commandFor = (id: ActionDescriptor['id'], commands: AccountLibraryActionCommands): LibraryCommand | null => {
  const commandMap: Record<string, LibraryCommand> = {
    'library.close-locations': commands.closeLocations,
    'library.close-tool': commands.closeTool,
    'library.continue': commands.continuePersonal,
    'library.open': commands.openPersonal,
    'library.send-pipeline': commands.sendPipeline,
    'library.save-move': commands.saveMove,
    'library.duplicate': commands.duplicate,
    'library.delete-copy': commands.deleteCopy,
    'library.view-source': commands.viewSource,
    'library.manage-location': commands.manageLocation,
    'library.use-published': commands.usePublished,
    'library.copy-published-template': commands.copyPublishedTemplate,
    'library.edit-pipeline': commands.editPipeline,
    'library.test-pipeline': commands.testPipeline,
    'library.withdraw-pipeline': commands.withdrawPipeline,
    'library.retire-pipeline': commands.retirePipeline,
    'library.refresh': commands.refresh,
  };
  return commandMap[id] ?? null;
};

export const createAccountLibraryActionDefinitions = (
  descriptors: readonly ActionDescriptor[],
  commands: AccountLibraryActionCommands,
): ActionDefinition[] => descriptors.map((descriptor) => {
  const command = commandFor(descriptor.id, commands);
  if (!command) throw new Error(`Library action ${descriptor.id} has no feature-owned operation.`);
  return createActionDefinition(descriptor, async (input) => command(input));
});
