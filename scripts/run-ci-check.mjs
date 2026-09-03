import { spawn } from 'node:child_process';
import { appendFile } from 'node:fs/promises';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const stripControlSequences = (value) => value
  .replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '')
  .replace(/\r/gu, '');

export const compactFailureTail = (value, maximumLines = 40, maximumCharacters = 6_000) => {
  const lines = stripControlSequences(value).split('\n').map((line) => line.trimEnd()).filter(Boolean);
  return lines.slice(-maximumLines).join('\n').slice(-maximumCharacters);
};

export const formatCiSummary = ({ title, command, durationSeconds, exitCode, output }) => {
  const passed = exitCode === 0;
  const lines = [
    `## ${passed ? '✅' : '❌'} ${title}`,
    '',
    `- Result: **${passed ? 'passed' : `failed (exit ${exitCode})`}**`,
    `- Duration: ${durationSeconds.toFixed(1)}s`,
    `- Command: \`${command.replaceAll('`', '\\`')}\``,
  ];
  const tail = compactFailureTail(output);
  if (!passed && tail) {
    lines.push('', '<details><summary>Failure tail</summary>', '', '```text', tail.replaceAll('```', "'''"), '```', '', '</details>');
  }
  return `${lines.join('\n')}\n`;
};

const parseArguments = (values) => {
  const separator = values.indexOf('--');
  if (separator < 0 || separator === values.length - 1) throw new Error('Usage: run-ci-check --title <label> -- <command> [args...]');
  const titleIndex = values.indexOf('--title');
  const title = titleIndex >= 0 ? values[titleIndex + 1] : null;
  if (!title || titleIndex >= separator) throw new Error('--title is required before --.');
  return { title, command: values[separator + 1], args: values.slice(separator + 2) };
};

const run = async () => {
  const { title, command, args } = parseArguments(process.argv.slice(2));
  const startedAt = performance.now();
  let output = '';
  const remember = (text) => { output = `${output}${text}`.slice(-12_000); };
  const child = spawn(command, args, { env: process.env, shell: false, stdio: ['inherit', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => { const text = chunk.toString(); remember(text); process.stdout.write(text); });
  child.stderr.on('data', (chunk) => { const text = chunk.toString(); remember(text); process.stderr.write(text); });
  const exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('close', (code) => resolve(code ?? 1));
  });
  const durationSeconds = (performance.now() - startedAt) / 1_000;
  const commandLabel = [command, ...args].join(' ');
  const summary = formatCiSummary({ title, command: commandLabel, durationSeconds, exitCode, output });
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
  process.stdout.write(`\n${exitCode === 0 ? 'PASS' : 'FAIL'} ${title} (${durationSeconds.toFixed(1)}s)\n`);
  if (exitCode !== 0) process.exitCode = exitCode;
};

const isDirectExecution = process.argv[1]
  && pathToFileURL(process.argv[1]).href === import.meta.url;

if (isDirectExecution) {
  run().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
