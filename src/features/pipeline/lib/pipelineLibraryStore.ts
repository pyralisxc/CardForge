import { buildPipelineProgramView, type PipelineProgramView } from './pipelineProgram';
import { fetchPipelineSubmissionPage } from './pipelineProjections';
import { getPipelineProgramContext } from './pipelineStore';

type ProgramContext = Awaited<ReturnType<typeof getPipelineProgramContext>>;

const fetchAllPipelineSubmissions = async ({
  currentUserId,
  profiles,
  includeRegistryRecipePayloads,
  allowSelfVoting,
  scope,
}: {
  currentUserId: string;
  profiles: ProgramContext['profiles'];
  includeRegistryRecipePayloads: boolean;
  allowSelfVoting: boolean;
  scope: 'own' | 'review';
}) => {
  const pageSize = 50;
  const fetchPage = (page: number) => fetchPipelineSubmissionPage({
    currentUserId,
    profiles,
    includeRegistryRecipePayloads,
    allowSelfVoting,
    query: { scope, page, pageSize },
  });
  const firstPage = await fetchPage(1);
  const pageCount = Math.ceil(firstPage.total / pageSize);
  if (pageCount <= 1) return firstPage;
  const remainingPages = await Promise.all(Array.from(
    { length: pageCount - 1 },
    (_, index) => fetchPage(index + 2),
  ));
  return {
    submissions: [firstPage, ...remainingPages].flatMap((page) => page.submissions),
    total: firstPage.total,
    page: 1,
    pageSize: Math.max(1, firstPage.total),
  };
};

export const getPipelineLibraryProgramView = async (
  currentUserId: string,
  currentContributorIds: string[] = [currentUserId],
  { includeRegistryRecipePayloads = false }: { includeRegistryRecipePayloads?: boolean } = {},
): Promise<PipelineProgramView> => {
  const context = await getPipelineProgramContext(currentUserId);
  const [submissionPage, votingPage] = await Promise.all([
    fetchAllPipelineSubmissions({
      currentUserId,
      profiles: context.profiles,
      includeRegistryRecipePayloads,
      allowSelfVoting: context.settings.allowContributorSelfVoting,
      scope: 'own',
    }),
    fetchAllPipelineSubmissions({
      currentUserId,
      profiles: context.profiles,
      includeRegistryRecipePayloads,
      allowSelfVoting: context.settings.allowContributorSelfVoting,
      scope: 'review',
    }),
  ]);
  return buildPipelineProgramView({
    ...context,
    currentUserId,
    currentContributorIds,
    submissions: submissionPage.submissions,
    votingQueue: votingPage.submissions,
    submissionPage,
    votingPage,
  });
};
