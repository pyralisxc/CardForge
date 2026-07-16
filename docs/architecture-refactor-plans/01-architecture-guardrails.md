# Architecture Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add CI-enforced dependency rules that reject new architecture violations, require the active migration baseline to shrink exactly, and report focused file-size warnings.

**Architecture:** A repository-owned Node script uses the installed TypeScript parser to inspect local imports, classify source layers, validate feature public interfaces and client/server direction, detect cyclic feature edges, and compare results with a checked-in shrinking baseline. Vitest exercises the CLI against temporary fixture repositories so the production checker and CI command use the same behavior.

**Tech Stack:** Node.js 22, TypeScript compiler API, Vitest 4, GitHub Actions, npm scripts.

## Global Constraints

- Preserve current product behavior, routes, exports, entitlements, and provider state.
- Do not add a runtime dependency.
- New architecture violations must fail CI immediately.
- Existing violations may appear only in the active baseline; every removal requires the baseline to shrink and final convergence deletes it.
- File size above 500 lines is a review warning, not an automatic failure.
- No deprecated import alias, compatibility wrapper, or empty scaffold may be introduced.

---

### Task 1: Characterize the architecture CLI contract

**Files:**
- Create: `tests/unit/architecture-boundaries.test.ts`
- Create later: `scripts/check-architecture.mjs`

**Interfaces:**
- Consumes: Node executable and a repository fixture containing `src/`.
- Produces: CLI contract `node scripts/check-architecture.mjs --root "$FIXTURE_ROOT" --baseline "$BASELINE_PATH" [--write-baseline]`.

- [ ] **Step 1: Write the failing fixture tests**

Create helpers that make an isolated directory, write source files and a baseline, and invoke the CLI with `execFile`:

```ts
const runArchitectureCheck = async (
  root: string,
  baseline: string,
  extraArgs: string[] = [],
) => new Promise<{ exitCode: number; stdout: string; stderr: string }>((resolve) => {
  execFile(
    process.execPath,
    [scriptPath, '--root', root, '--baseline', baseline, ...extraArgs],
    (error, stdout, stderr) => resolve({
      exitCode: typeof error?.code === 'number' ? error.code : 0,
      stdout,
      stderr,
    }),
  );
});
```

Cover these independent behaviors:

1. A feature importing `@/features/other/server/internalRepository` fails with `cross-feature-internal`.
2. A client component importing `@/features/other/server` fails with `client-imports-server`.
3. A feature cycle reports the participating feature edges.
4. `--write-baseline` records current violations; a matching baseline passes.
5. Adding a violation produces `new architecture violation` and fails.
6. Removing a violation without shrinking the baseline produces `stale architecture baseline` and fails.
7. Valid `app -> feature public entry -> domain -> shared` imports pass.
8. A source file longer than 500 lines prints a warning while returning success.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
npm test -- tests/unit/architecture-boundaries.test.ts
```

Expected: FAIL because `scripts/check-architecture.mjs` does not exist.

- [ ] **Step 3: Commit the failing contract test**

```bash
git add tests/unit/architecture-boundaries.test.ts
git commit -m "test: define architecture boundary contract"
```

### Task 2: Implement import classification and rule evaluation

**Files:**
- Create: `scripts/check-architecture.mjs`
- Modify: `tests/unit/architecture-boundaries.test.ts` only if a fixture defect prevents the stated contract from executing.

**Interfaces:**
- Consumes: `--root`, `--baseline`, and optional `--write-baseline` arguments.
- Produces: deterministic violation keys, size warnings, exact baseline comparison, and process status.

- [ ] **Step 1: Implement deterministic source discovery**

Use `node:fs/promises`, `node:path`, and the installed `typescript` package. Walk only the fixture/repository `src` tree, include `.ts` and `.tsx`, exclude `.d.ts`, and sort every path before analysis.

```js
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

const collectSourceFiles = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await collectSourceFiles(entryPath));
    else if (SOURCE_EXTENSIONS.has(path.extname(entry.name)) && !entry.name.endsWith('.d.ts')) files.push(entryPath);
  }
  return files;
};
```

- [ ] **Step 2: Parse and resolve local imports**

Use `ts.preProcessFile(source, true, true).importedFiles`. Resolve `@/` against `src`, resolve relative specifiers against the importing file, strip recognized TypeScript/JavaScript extensions, and ignore packages plus paths outside `src`.

- [ ] **Step 3: Classify layers and feature ownership**

Return structured ownership for `app`, `components/ui`, `domain`, `features/FEATURE_NAME`, `infrastructure`, `shared`, and `legacy` roots (`lib`, `store`, `types`). Unknown roots receive an `unowned-source-root` violation.

- [ ] **Step 4: Evaluate dependency rules**

Emit stable objects containing `code`, `source`, `target`, and `message`. Enforce:

```text
shared -> shared
domain -> domain | shared
components/ui -> components/ui | shared
infrastructure -> infrastructure | domain | shared
features -> own internals | domain | shared | components/ui | another feature's client/server entry
app -> public feature entry points | domain | shared | components/ui | infrastructure adapters used by route composition
```

Also reject:

- feature imports of `app`;
- cross-feature deep imports;
- client entry/components/hooks or `"use client"` modules importing a server entry;
- local files remaining under `src/lib`, `src/store`, or `src/types`;
- imports targeting those legacy roots.

- [ ] **Step 5: Detect cyclic feature edges**

Build the unique feature-to-feature edge set from resolved imports. For each edge `A -> B`, test whether `B` can reach `A`. Emit one `feature-cycle-edge` violation per participating edge. Sort by source and target so the baseline shrinks predictably as edges are removed.

- [ ] **Step 6: Implement size warnings**

Count source lines and print a warning for production source files above 500 lines. Exclude generated Next.js output and tests because discovery is restricted to `src`.

- [ ] **Step 7: Implement baseline semantics and CLI output**

The baseline format is:

```json
{
  "version": 1,
  "violations": [
    "code|source|target"
  ]
}
```

`--write-baseline` writes the exact sorted set and exits successfully. Normal checks fail for both `actual - baseline` and `baseline - actual`, distinguishing new violations from a stale baseline. A matching set succeeds even while the active refactor is in progress.

- [ ] **Step 8: Run the focused test and verify GREEN**

```bash
npm test -- tests/unit/architecture-boundaries.test.ts
```

Expected: all architecture CLI contract tests pass.

- [ ] **Step 9: Refactor without changing behavior**

Remove duplicated formatting and graph helpers only after the test is green. Keep one focused CLI file rather than adding empty framework folders.

- [ ] **Step 10: Commit the checker**

```bash
git add scripts/check-architecture.mjs tests/unit/architecture-boundaries.test.ts
git commit -m "feat: enforce architecture boundaries"
```

### Task 3: Establish and enforce the active repository baseline

**Files:**
- Create: `config/architecture-baseline.json`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/unit/repository-maintenance.test.ts`
- Modify: `.github/CODEOWNERS`

**Interfaces:**
- Consumes: architecture CLI from Task 2.
- Produces: `npm run architecture:check`, required normal CI execution, and ownership for the rule configuration.

- [ ] **Step 1: Add failing repository-policy assertions**

Extend `repository-maintenance.test.ts` to require:

```ts
expect(packageJson.scripts).toMatchObject({
  'architecture:check': 'node scripts/check-architecture.mjs',
});

const ci = await readFile(rootPath('.github', 'workflows', 'ci.yml'), 'utf8');
expect(ci).toContain('npm run architecture:check');
expect(await pathExists('config', 'architecture-baseline.json')).toBe(true);
```

- [ ] **Step 2: Run repository policy test and verify RED**

```bash
npm test -- tests/unit/repository-maintenance.test.ts
```

Expected: FAIL because the command, baseline, and CI step are absent.

- [ ] **Step 3: Add the npm and CI command**

Add:

```json
"architecture:check": "node scripts/check-architecture.mjs"
```

Run it in `.github/workflows/ci.yml` after typecheck and before unit tests:

```yaml
- run: npm run architecture:check
```

- [ ] **Step 4: Generate the exact current baseline**

```bash
node scripts/check-architecture.mjs --write-baseline
```

Expected: `config/architecture-baseline.json` is written with the sorted current violation set and size warnings are reported.

- [ ] **Step 5: Make rule ownership explicit**

Add these CODEOWNERS paths:

```text
/config/architecture-baseline.json @pyralisxc
/scripts/check-architecture.mjs @pyralisxc
/docs/architecture-refactor-design.md @pyralisxc
/docs/architecture-refactor-plans/ @pyralisxc
```

- [ ] **Step 6: Run repository policy and architecture checks**

```bash
npm test -- tests/unit/repository-maintenance.test.ts tests/unit/architecture-boundaries.test.ts
npm run architecture:check
```

Expected: tests pass and the repository violation set exactly matches the baseline.

- [ ] **Step 7: Commit CI integration**

```bash
git add package.json .github/workflows/ci.yml .github/CODEOWNERS config/architecture-baseline.json tests/unit/repository-maintenance.test.ts
git commit -m "ci: gate architecture changes"
```

### Task 4: Verify the first incremental milestone

**Files:**
- Modify only if verification identifies a defect in files created by Tasks 1–3.

**Interfaces:**
- Consumes: the complete guardrail milestone.
- Produces: a reviewable, production-safe branch ready for PR.

- [ ] **Step 1: Run focused checks**

```bash
npm run architecture:check
npm test -- tests/unit/architecture-boundaries.test.ts tests/unit/repository-maintenance.test.ts
```

Expected: pass with only documented size warnings.

- [ ] **Step 2: Run full local verification**

```bash
npm run lint
npm run typecheck
npm run test
npm run build
git diff --check
npm audit --omit=dev
```

Expected: lint, typecheck, tests, build, and diff check pass. Audit has no undocumented high or critical finding; the three currently accepted package-path findings from the same Next/PostCSS-chain advisory may remain.

- [ ] **Step 3: Review the baseline for accidental noise**

Confirm every key corresponds to one of:

- an existing legacy source root;
- an existing forbidden cross-feature import;
- an existing client/server violation;
- an existing cyclic feature edge;
- an existing unowned source root scheduled by the approved design.

Do not delete a valid key merely to shorten the baseline.

- [ ] **Step 4: Commit any verification-only correction**

If Tasks 1–3 needed a correction, commit only the relevant files:

```bash
git add scripts/check-architecture.mjs tests/unit/architecture-boundaries.test.ts tests/unit/repository-maintenance.test.ts config/architecture-baseline.json package.json .github/workflows/ci.yml .github/CODEOWNERS
git commit -m "fix: stabilize architecture guardrail"
```

If no correction was required, do not create an empty commit.

- [ ] **Step 5: Complete branch integration**

Use `superpowers:finishing-a-development-branch`, publish a PR against current `main`, require CI and Public smoke, merge only when green, and verify the exact production deployment plus five production health routes.
