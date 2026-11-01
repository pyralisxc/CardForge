import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Human-only public review packet. Never place it inside the installable ZIP. */
export async function buildStudioReviewerPacket(environment, version) {
  if (environment !== 'production' && environment !== 'preview') throw new Error('Unsupported environment');
  const source = JSON.parse(await readFile(path.join(process.cwd(), 'plugins/cardforge-studio/REVIEW_CASES.json'), 'utf8'));
  if (source.version !== version || source.positive.length !== 5 || source.negative.length !== 5) throw new Error('Reviewer packet does not match this package');
  const endpoint = environment === 'production' ? 'https://cardforges.com/mcp' : 'https://card-forge-git-vercel-preview-pyralis-projects.vercel.app/mcp';
  const lines = [
    '# CardForge Studio — human review packet',
    '', `Package: CardForge Studio ${version} (${environment})`, `MCP endpoint: ${endpoint}`,
    'Evidence status: Not run. Do not infer test execution from the presence of these cases.',
    '', '## Prerequisites and installation',
    'Use a separate ordinary signed-in Free CardForge account linked through the normal Clerk OAuth flow.',
    'Install the matching CardForge Studio ZIP from the same Downloads page in a compatible plugin host, then connect the MCP endpoint using its built-in authentication.',
    'Do not enter reviewer credentials in the ZIP or this packet. Provider credentials belong only in secure submission fields.',
    'Production and Preview use separate environments and account authorization. Installation alone does not grant Contributor or Owner privileges.',
    '', '## Supported workflows',
    'Discover library assets, create and revise private editable Templates, generate cards and Sets, preview canonical renders, and inspect browser installation acknowledgement.',
    'No public publication, physical fulfillment, checkout, or infrastructure deployment is included in ordinary Studio creation.',
    '', '## Human reviewer cases — 5 positive and 5 negative',
    'Each case is intentionally unexecuted until a human reviewer runs it. Record actual Passed, Failed, Blocked or Not run status and a reproducible observation.',
  ];
  for (const [label, items] of [['Positive',source.positive],['Negative',source.negative]]) {
    for (const item of items) {
      lines.push('',`### ${label} ${item.id} — ${item.description}`,`- Setup: ${item.setup}`,`- Prompt: ${item.prompt}`);
      if (label === 'Positive') lines.push(`- Expected tools: ${item.tools_triggered}`);
      lines.push(`- Expected behavior: ${item.expected_behavior}`, '- Status: Not run', '- Observed result / evidence: Pending human execution');
    }
  }
  lines.push('', '## Submission mapping and remaining owner tasks',
    'The plugin manifest encodes positives P1–P5 and negatives N1–N3 (the initial-review 5+3 subset). N4–N5 remain in this full human packet.',
    'Existing authentication, stale-revision and invalid-artwork protections are separate error/recovery checks; they do not replace negative capability cases.',
    'Publisher must supply the genuine reviewer video/demo URL and secure reviewer access through the official portal. Neither is generated here.',
    'Confirm publication targeting, any commerce declaration, public brand-asset review, and final listing fields with the publisher before submission.',
    'This packet is not evidence of portal submission, video completion, policy approval, or public publication.', '');
  return lines.join('\n');
}
