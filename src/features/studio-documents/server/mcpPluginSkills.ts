import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  fromJsonSchema,
} from '@modelcontextprotocol/server';
import { createMcpHandler } from 'mcp-handler';

type RegistrationCallback = Parameters<typeof createMcpHandler>[0];
type McpRegistrationServer = Parameters<RegistrationCallback>[0];

type SkillsListParams = { cursor?: string };
type SkillsGetParams = { uri: string };

const skillsListParamsSchema = fromJsonSchema<SkillsListParams>({
  type: 'object',
  additionalProperties: false,
  properties: {
    cursor: { type: 'string' },
  },
});

const skillsGetParamsSchema = fromJsonSchema<SkillsGetParams>({
  type: 'object',
  additionalProperties: false,
  required: ['uri'],
  properties: {
    uri: { type: 'string', minLength: 1 },
  },
});

const parseFrontmatter = (content: string): Record<string, string> => {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  if (!match) throw new Error('CardForge plugin skill is missing YAML front matter.');
  return Object.fromEntries(match[1].split(/\r?\n/).map((line) => {
    const separator = line.indexOf(':');
    if (separator <= 0) throw new Error('CardForge plugin skill front matter is invalid.');
    return [line.slice(0, separator).trim(), line.slice(separator + 1).trim()];
  }));
};

const loadSkill = (directoryName: string) => {
  const content = readFileSync(resolve(
    process.cwd(),
    'plugins',
    'cardforge-studio',
    'skills',
    directoryName,
    'SKILL.md',
  ), 'utf8');
  const frontmatter = parseFrontmatter(content);
  if (frontmatter.name !== directoryName || !frontmatter.description) {
    throw new Error(`CardForge plugin skill front matter does not match ${directoryName}.`);
  }
  const uri = `skill://cardforge-studio/${directoryName}/SKILL.md`;
  return {
    uri,
    frontmatter,
    resources: [{
      uri,
      digest: `sha256:${createHash('sha256').update(content, 'utf8').digest('hex')}`,
    }],
    content,
  };
};

const pluginSkills = [
  loadSkill('create-editable-template'),
  loadSkill('create-cards-and-sets'),
];

const catalog = pluginSkills.map(({ content: _content, ...skill }) => skill);

type SkillCatalogEntry = typeof catalog[number];
type SkillsListResult = { skills: SkillCatalogEntry[]; nextCursor?: string };
type SkillsGetResult = { skill: SkillCatalogEntry };

const skillResourceSchema = {
  type: 'object' as const,
  additionalProperties: false,
  required: ['uri', 'digest'],
  properties: {
    uri: { type: 'string' as const },
    digest: { type: 'string' as const, pattern: '^sha256:[a-f0-9]{64}$' },
  },
};
const skillCatalogEntrySchema = {
  type: 'object' as const,
  additionalProperties: false,
  required: ['uri', 'frontmatter', 'resources'],
  properties: {
    uri: { type: 'string' as const, pattern: '^skill://' },
    frontmatter: {
      type: 'object' as const,
      additionalProperties: { type: 'string' as const },
      required: ['name', 'description'],
    },
    resources: {
      type: 'array' as const,
      items: skillResourceSchema,
    },
  },
};
const skillsListResultSchema = fromJsonSchema<SkillsListResult>({
  type: 'object',
  additionalProperties: false,
  required: ['skills'],
  properties: {
    skills: { type: 'array', items: skillCatalogEntrySchema },
    nextCursor: { type: 'string' },
  },
});
const skillsGetResultSchema = fromJsonSchema<SkillsGetResult>({
  type: 'object',
  additionalProperties: false,
  required: ['skill'],
  properties: {
    skill: skillCatalogEntrySchema,
  },
});

export const getCardForgePluginSkillCatalog = () => catalog;

export const registerCardForgePluginSkills = (server: McpRegistrationServer) => {
  for (const skill of pluginSkills) {
    server.registerResource(
      skill.frontmatter.name,
      skill.uri,
      {
        title: skill.frontmatter.name,
        description: skill.frontmatter.description,
        mimeType: 'text/markdown',
      },
      async () => ({
        contents: [{
          uri: skill.uri,
          mimeType: 'text/markdown',
          text: skill.content,
        }],
      }),
    );
  }

  server.server.setRequestHandler(
    'skills/list',
    { params: skillsListParamsSchema, result: skillsListResultSchema },
    async () => ({ skills: catalog }),
  );

  server.server.setRequestHandler(
    'skills/get',
    { params: skillsGetParamsSchema, result: skillsGetResultSchema },
    async ({ uri }) => {
      const skill = catalog.find((candidate) => candidate.uri === uri);
      if (!skill) throw new Error('Unknown CardForge plugin skill URI.');
      return { skill };
    },
  );
};
