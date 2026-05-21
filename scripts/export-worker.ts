import { setTimeout as wait } from 'node:timers/promises';

import { processNextExportJob } from '../src/lib/server/exportWorkerEngine';

const pollMs = Number(process.env.CARD_FORGE_EXPORT_WORKER_POLL_MS || 2_000);
const runOnce = process.argv.includes('--once');

async function main() {
  console.log(`CardForge export worker started${runOnce ? ' (single pass)' : ''}.`);

  while (true) {
    const job = await processNextExportJob();

    if (job) {
      console.log(`[${job.status}] ${job.id} ${job.artifact?.fileName || job.error || ''}`.trim());
    } else if (runOnce) {
      console.log('No queued export jobs.');
      return;
    }

    if (runOnce) return;
    await wait(pollMs);
  }
}

main().catch((error) => {
  console.error('Export worker failed:', error);
  process.exitCode = 1;
});
