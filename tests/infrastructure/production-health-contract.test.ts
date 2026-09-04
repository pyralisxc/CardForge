import { describe, expect, it } from 'vitest';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

import {
  assertContributorPublicTruth,
  assertContributorTermsPublicTruth,
  assertPrivacyPublicTruth,
  assertRepresentativeCatalogRouting,
} from '../../scripts/lib/production-health-contract.mjs';

const page = (content: string, shell = '') => `<!doctype html><html><body>${shell}<main>${content}</main></body></html>`;
const publication = (content: string, shell = '') => page(`<article>${content}</article>`, shell);
const currentTerms = '<h1>Contributor Terms</h1><p>Contributors submit work through the review Pipeline.</p>';
const currentPrivacy = '<h1>Privacy Policy</h1><p>Contributor profiles are provider records. Work remains separate from browser-local CardForge projects.</p>';

describe('production health semantic contracts', () => {
  it('runs the route-only CLI in a clean directory without installed packages', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'cardforge-route-health-'));
    const server = createServer((_request, response) => {
      response.end('CardForge — Open your Desk — Cameron — Contributor — Roadmap — independent sole proprietor based in Oregon');
    });
    try {
      await mkdir(path.join(directory, 'lib'));
      await copyFile('scripts/check-production-health.mjs', path.join(directory, 'check-production-health.mjs'));
      await copyFile('scripts/lib/production-health-contract.mjs', path.join(directory, 'lib/production-health-contract.mjs'));
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Test server did not start');
      const result = await promisify(execFile)(process.execPath, [path.join(directory, 'check-production-health.mjs'), '--category=route'], {
        cwd: directory,
        env: { ...process.env, CARDFORGE_HEALTH_ORIGIN: `http://127.0.0.1:${address.port}`, VERCEL_AUTOMATION_BYPASS_SECRET: '' },
        timeout: 10_000,
      });
      expect(result.stdout).toContain('production health passed (9 route checks)');
      expect(result.stderr).toBe('');
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('rejects retired public Contributor and legal claims', () => {
    expect(() => assertContributorPublicTruth(page('<p>Contributors may propose clearer public-site text. Public-site editing remains owner-only.</p>'))).toThrow(/retired public-site/iu);
    expect(() => assertPrivacyPublicTruth(publication('<h1>Privacy Policy</h1><p>developer profiles, owner/developer accounts, Owner Console, browser-local Studio projects</p>'))).toThrow(/retired/iu);
    expect(() => assertContributorTermsPublicTruth(publication('<h1>Developer Contributor Terms</h1><p>Developer votes use the Developer path.</p>'))).toThrow(/retired/iu);
  });

  it('accepts the current Contributor and legal vocabulary', () => {
    expect(() => assertContributorPublicTruth(page('<p>Approved contributors add shared assets. Public-site editing remains owner-only.</p>'))).not.toThrow();
    expect(() => assertPrivacyPublicTruth(publication(currentPrivacy))).not.toThrow();
    expect(() => assertContributorTermsPublicTruth(publication(currentTerms))).not.toThrow();
  });

  it('ignores unrelated announcements, navigation and serialized framework data', () => {
    const shell = `<header>ChatGPT is open to OpenAI developers.</header>
      <nav>Developer resources</nav>
      <script>self.__next_f.push([1, "Developer Contributor Terms; developer profiles; propose clearer public-site text"])</script>`;
    expect(() => assertContributorTermsPublicTruth(publication(currentTerms, shell))).not.toThrow();
    expect(() => assertPrivacyPublicTruth(publication(currentPrivacy, shell))).not.toThrow();
    expect(() => assertContributorPublicTruth(page('<p>Public-site editing remains owner-only.</p>', shell))).not.toThrow();
  });

  it('reads decoded text across inline markup without hiding retired claims', () => {
    expect(() => assertContributorTermsPublicTruth(publication('<h1>Contributor Terms</h1><p>Use the review&nbsp;<strong>Pipeline</strong>.</p>'))).not.toThrow();
    expect(() => assertContributorTermsPublicTruth(publication('<h1>Contributor Terms</h1><p>Dev<span>eloper</span> votes use the review Pipeline.</p>'))).toThrow(/retired/iu);
    expect(() => assertPrivacyPublicTruth(publication(`${currentPrivacy}<p>Owner <strong>Console</strong></p>`))).toThrow(/retired/iu);
  });

  it.each([assertContributorTermsPublicTruth, assertPrivacyPublicTruth])('requires a unique, nonempty legal article in the main page', (assertion) => {
    expect(() => assertion(page('<p>No publication available</p>'))).toThrow(/article/iu);
    expect(() => assertion(page('<article></article>'))).toThrow(/empty/iu);
    expect(() => assertion(page(`<article>${currentTerms}${currentPrivacy}</article><article>Other publication</article>`))).toThrow(/article/iu);
    expect(() => assertion(`<article>${currentTerms}${currentPrivacy}</article>`)).toThrow(/main/iu);
  });

  it('does not let non-rendered content satisfy or contradict the legal contract', () => {
    const ignored = `<script>Developer Contributor Terms</script><style>/* Developer */</style>
      <template>Developer votes</template><p hidden>Developer path</p><p aria-hidden="true">Developers</p>`;
    expect(() => assertContributorTermsPublicTruth(publication(currentTerms + ignored))).not.toThrow();
    expect(() => assertContributorTermsPublicTruth(publication(`<h1>Contributor Terms</h1><script>review Pipeline</script>`))).toThrow(/missing/iu);
    expect(() => assertContributorTermsPublicTruth(publication('<h1>Contributor Terms</h1><p hidden>review Pipeline</p>'))).toThrow(/missing/iu);
    expect(() => assertContributorTermsPublicTruth(page('<h1>Contributor Terms</h1><article><p>review Pipeline</p></article>'))).toThrow(/h1/iu);
    expect(() => assertContributorTermsPublicTruth(publication('<h1>Wrong publication</h1><p>Contributor Terms use the review Pipeline.</p>'))).toThrow(/missing/iu);
    expect(() => assertContributorPublicTruth(page('<p>Publication unavailable</p>', '<footer>Public-site editing remains owner-only.</footer>'))).toThrow(/Owner-only/iu);
  });

  it('requires representative Set, Template, and icon destinations', () => {
    const catalog = {
      sets: { items: [{ id: 'standard-playing-card-deck', access: 'free', packageUrl: 'https://assets.example/starter.zip' }] },
      templates: { defaults: [{ id: 'default-mtg-theme' }] },
      assets: { icons: [{ id: 'arcane-star', previewUrl: 'https://assets.example/icon.svg', studioDestinations: ['element.icon'] }] },
      pipeline: { items: [
        { id: 'standard-playing-card-deck', assetType: 'set', previewUrl: 'https://assets.example/card.webp' },
        { id: 'default-mtg-theme', assetType: 'template', previewUrl: '/api/templates#default-mtg-theme' },
        { id: 'arcane-star', assetType: 'icon', previewUrl: 'https://assets.example/icon.svg' },
      ] },
    };
    expect(() => assertRepresentativeCatalogRouting(catalog)).not.toThrow();
    expect(() => assertRepresentativeCatalogRouting({ ...catalog, assets: { icons: [] } })).toThrow(/icon/iu);
  });
});
