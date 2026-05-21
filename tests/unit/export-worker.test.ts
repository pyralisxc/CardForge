import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import { BlobReader, ZipReader } from '@zip.js/zip.js';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';

import { buildExportJobPreflight } from '@/lib/exportPreflight';
import { createExportJobStore } from '@/lib/server/exportJobStore';
import { processExportJob } from '@/lib/server/exportWorkerEngine';
import { renderCardFaceToPng } from '@/lib/server/serverCardRenderer';
import type { DisplayCard, PaperSize } from '@/types';

const letter: PaperSize = { name: 'US Letter', widthMm: 215.9, heightMm: 279.4 };

const makeCard = (id: string, hasBack = true): DisplayCard => ({
  uniqueId: id,
  data: {
    cardName: `Worker Card ${id}`,
    rules: '**Bold rule**\n[color:#00ffff]Neon clause[/color]',
  },
  template: {
    id: 'worker-template',
    name: 'Worker Template',
    aspectRatio: '63:88',
    baseBackgroundColor: '#020617',
    baseTextColor: '#f8fafc',
    freeformCanvas: {
      width: 630,
      height: 880,
      gridSize: 18,
      elements: [
        {
          id: 'title',
          type: 'text',
          name: 'Title',
          x: 40,
          y: 40,
          width: 550,
          height: 80,
          zIndex: 1,
          content: '{{cardName:"Untitled"}}',
          fontSizePx: 34,
          fontWeight: 'font-bold',
          textAlign: 'center',
          textColor: '#67e8f9',
        },
        {
          id: 'rules',
          type: 'text',
          name: 'Rules',
          x: 60,
          y: 610,
          width: 510,
          height: 180,
          zIndex: 2,
          content: '{{rules:"No rules."}}',
          fontSizePx: 22,
          lineHeight: '1.2',
          textColor: '#f8fafc',
          backgroundColor: '#0f172a',
        },
      ],
    },
    backCanvas: hasBack
      ? {
          width: 630,
          height: 880,
          elements: [
            {
              id: 'back-title',
              type: 'text',
              name: 'Back Title',
              x: 80,
              y: 360,
              width: 470,
              height: 90,
              zIndex: 1,
              content: 'CardForge',
              fontSizePx: 42,
              fontWeight: 'font-bold',
              textAlign: 'center',
              textColor: '#22d3ee',
            },
          ],
        }
      : undefined,
  },
});

describe('worker-backed export foundation', () => {
  it('preflights large exports with face counts, dimensions, estimates, and missing back warnings', () => {
    const cards = [makeCard('front-only', false), makeCard('duplex', true)];

    const preflight = buildExportJobPreflight({
      cards,
      artifactType: 'zip',
      exportMode: 'physical',
      exportDpi: 300,
      paperSize: letter,
      pdfMarginMm: 5,
      pdfCardSpacingMm: 0,
      pdfIncludeCutLines: true,
      pdfDuplexLayout: 'separate-pages',
    });

    expect(preflight.cardCount).toBe(2);
    expect(preflight.faceCount).toBe(3);
    expect(preflight.dimensionsPx).toEqual({ widthPx: 744, heightPx: 1039 });
    expect(preflight.estimatedBytes).toBeGreaterThan(500_000);
    expect(preflight.warnings.some((warning) => warning.code === 'missing-back-face')).toBe(true);
  });

  it('stores jobs as local JSON and preserves safe state transitions', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cardforge-export-jobs-'));
    const store = createExportJobStore(root);

    try {
      const created = await store.create({
        cards: [makeCard('one')],
        artifactType: 'zip',
        exportMode: 'physical',
        exportDpi: 300,
        paperSize: letter,
        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: true,
        pdfDuplexLayout: 'separate-pages',
        preflight: buildExportJobPreflight({
          cards: [makeCard('one')],
          artifactType: 'zip',
          exportMode: 'physical',
          exportDpi: 300,
          paperSize: letter,
          pdfMarginMm: 5,
          pdfCardSpacingMm: 0,
          pdfIncludeCutLines: true,
          pdfDuplexLayout: 'separate-pages',
        }),
      });

      expect(created.status).toBe('queued');
      expect(created.progress).toMatchObject({ done: 0, total: 2 });

      const running = await store.markRunning(created.id);
      expect(running?.status).toBe('running');

      await store.requestCancel(created.id);
      const cancelled = await store.cancelIfRequested(created.id);
      expect(cancelled?.status).toBe('cancelled');
      expect(cancelled?.cancelRequested).toBe(true);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('renders a server PNG face at the requested print dimensions', async () => {
    const rendered = await renderCardFaceToPng(makeCard('render'), 'front', 300);
    const metadata = await sharp(Buffer.from(rendered.bytes)).metadata();

    expect(rendered.widthPx).toBe(744);
    expect(rendered.heightPx).toBe(1039);
    expect(metadata.width).toBe(744);
    expect(metadata.height).toBe(1039);
  });

  it('processes a queued ZIP job into exact front/back archive entries', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cardforge-export-jobs-'));
    const store = createExportJobStore(root);
    const cards = [makeCard('one'), makeCard('two')];

    try {
      const job = await store.create({
        cards,
        artifactType: 'zip',
        exportMode: 'physical',
        exportDpi: 300,
        paperSize: letter,
        pdfMarginMm: 5,
        pdfCardSpacingMm: 0,
        pdfIncludeCutLines: true,
        pdfDuplexLayout: 'separate-pages',
        preflight: buildExportJobPreflight({
          cards,
          artifactType: 'zip',
          exportMode: 'physical',
          exportDpi: 300,
          paperSize: letter,
          pdfMarginMm: 5,
          pdfCardSpacingMm: 0,
          pdfIncludeCutLines: true,
          pdfDuplexLayout: 'separate-pages',
        }),
      });

      const completed = await processExportJob(job.id, { store });

      expect(completed.status).toBe('completed');
      expect(completed.artifact?.fileName).toBe('cardforge-physical-print-card-faces.zip');
      expect(completed.progress).toMatchObject({ done: 4, total: 4 });

      const bytes = await store.readArtifact(job.id);
      const reader = new ZipReader(new BlobReader(new Blob([bytes])));
      const entries = await reader.getEntries();
      await reader.close();

      expect(entries.map((entry) => entry.filename).sort()).toEqual([
        'physical-print-card-faces/001_Worker_Card_one_back.png',
        'physical-print-card-faces/001_Worker_Card_one_front.png',
        'physical-print-card-faces/002_Worker_Card_two_back.png',
        'physical-print-card-faces/002_Worker_Card_two_front.png',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
