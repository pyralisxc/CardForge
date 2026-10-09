import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

type FontFile = { localName: string; upstreamName: string; gitBlobSha: string; sizeBytes: number };
type Family = { family: string; localDirectory: string; upstreamDirectory: string; licenseGitBlobSha: string; files: FontFile[] };
const root = path.join(process.cwd(), 'public', 'fonts');
const provenance = JSON.parse(readFileSync(path.join(root, 'provenance.json'), 'utf8')) as {
  schemaVersion: number; sourceRepository: string; sourceRevision: string; license: string; families: Family[];
};
const gitSha = (bytes: Buffer) => createHash('sha1')
  .update('blob ' + bytes.byteLength + '\0')
  .update(bytes).digest('hex');
const walkFonts = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
  const full = path.join(dir, entry.name);
  if (entry.isDirectory()) return walkFonts(full);
  return /\.(?:ttf|otf|woff2?)$/iu.test(entry.name) ? [path.relative(root, full).split(path.sep).join('/')] : [];
});

describe('bundled font copyright and exact provenance', () => {
  it('pins one immutable official source for the compatibility assets', () => {
    expect(provenance.schemaVersion).toBe(1);
    expect(provenance.sourceRepository).toBe('https://github.com/google/fonts');
    expect(provenance.sourceRevision).toMatch(/^[a-f0-9]{40}$/u);
    expect(provenance.license).toBe('OFL-1.1');
    expect(provenance.families).toHaveLength(10);
  });

  it('protects every bundled font file against unreviewed binary drift', () => {
    const found: string[] = [];
    for (const family of provenance.families) {
      expect(family.upstreamDirectory).toMatch(/^ofl\/[a-z0-9]+$/u);
      for (const f of family.files) {
        const pathToFile = path.join(root, family.localDirectory, f.localName);
        const bytes = readFileSync(pathToFile);
        expect(bytes.byteLength, pathToFile).toBe(f.sizeBytes);
        expect(gitSha(bytes), pathToFile).toBe(f.gitBlobSha);
        expect(f.upstreamName).toMatch(/\.ttf$/iu);
        found.push(path.posix.join(family.localDirectory, f.localName));
      }
    }
    expect(found).toHaveLength(17);
    expect(new Set(found).size).toBe(found.length);
    expect(walkFonts(root).sort()).toEqual(found.sort());
  });

  it('retains complete unchanged original OFL notice per family', () => {
    for (const family of provenance.families) {
      const bytes = readFileSync(path.join(root, family.localDirectory, 'OFL.txt'));
      expect(gitSha(bytes), family.family).toBe(family.licenseGitBlobSha);
      expect(bytes.toString('utf8')).toMatch(/Copyright/);
      expect(bytes.toString('utf8')).toMatch(/SIL OPEN FONT LICENSE Version 1\.1/);
    }
  });
});
