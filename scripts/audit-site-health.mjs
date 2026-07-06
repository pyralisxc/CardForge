import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import { clerk, clerkSetup, setupClerkTestingToken } from '@clerk/testing/playwright';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(rootDir, 'test-results', 'site-health');
const summaryPath = path.join(outputDir, 'summary.json');
const defaultBaseUrl = 'http://localhost:9002';

const publicRoutes = [
  { route: '/', name: 'landing' },
  { route: '/about', name: 'about' },
  { route: '/access', name: 'access' },
  { route: '/studio', name: 'studio' },
  { route: '/roadmap', name: 'roadmap' },
  { route: '/developer', name: 'developer-public' },
  { route: '/account', name: 'account-public' },
  { route: '/privacy', name: 'privacy' },
  { route: '/terms', name: 'terms' },
  { route: '/refund', name: 'refund' },
  { route: '/contact', name: 'contact' },
  { route: '/developer-terms', name: 'developer-terms' },
  { route: '/creator-pool', name: 'creator-pool' },
];

const authRouteGroups = [
  {
    role: 'owner',
    emailEnv: 'CARDFORGE_E2E_OWNER_EMAIL',
    routes: [
      { route: '/owner', name: 'owner-console' },
      { route: '/developer', name: 'developer-owner' },
      { route: '/account', name: 'account-owner' },
    ],
  },
  {
    role: 'developer',
    emailEnv: 'CARDFORGE_E2E_DEV_EMAIL',
    routes: [
      { route: '/developer', name: 'developer-dev' },
      { route: '/account', name: 'account-dev' },
    ],
  },
  {
    role: 'paid',
    emailEnv: 'CARDFORGE_E2E_PAID_EMAIL',
    routes: [
      { route: '/account', name: 'account-paid' },
    ],
  },
];

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex < 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) process.env[key] = value;
  }
}

function ensureOutputDir() {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
}

function summarizeMessages(messages) {
  return messages
    .filter((message) => !message.text.includes('Clerk has been loaded with development keys'))
    .map((message) => ({
      type: message.type,
      text: message.text.slice(0, 500),
    }))
    .slice(0, 12);
}

function summarizeFailures(failures) {
  return failures
    .filter((failure) => !failure.failure.includes('net::ERR_ABORTED'))
    .map((failure) => ({
      url: failure.url,
      failure: failure.failure,
    }))
    .slice(0, 12);
}

async function waitForRouteReady(page, route) {
  if (route === '/owner') {
    await page.waitForFunction(
      () => !document.body.innerText.includes('Preparing command center')
        || document.body.innerText.includes('Run the forge like a product.')
        || document.body.innerText.includes('Owner console unavailable'),
      null,
      { timeout: 30_000 },
    ).catch(() => {});
    return;
  }

  if (route === '/studio') {
    await page.waitForFunction(
      () => document.querySelector('[data-testid="studio-ready"]')
        && !document.body.innerText.includes('PREPARING STUDIO'),
      null,
      { timeout: 30_000 },
    ).catch(() => {});
    return;
  }

  await page.waitForTimeout(700);
}

async function collectPageState(page) {
  return page.evaluate(() => {
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.visibility !== 'hidden'
      && style.display !== 'none'
      && box.width > 0
      && box.height > 0
      && element.getAttribute('aria-hidden') !== 'true'
      && !element.closest('[aria-hidden="true"]');
    };
    const text = (element) => (element.innerText || element.textContent || '').replace(/\s+/g, ' ').trim();
    const controlName = (element) => (
      text(element)
      || element.getAttribute('aria-label')
      || element.getAttribute('title')
      || element.getAttribute('placeholder')
      || element.getAttribute('aria-labelledby')
      || ''
    ).trim();
    const hasLabelElement = (element) => {
      if ('labels' in element && element.labels && element.labels.length > 0) return true;
      const id = element.getAttribute('id');
      return Boolean(id && document.querySelector(`label[for="${CSS.escape(id)}"]`));
    };

    const unlabeledControls = Array.from(document.querySelectorAll('button,a,input,textarea,select'))
      .filter(visible)
      .filter((element) => element.tabIndex >= 0)
      .filter((element) => {
        const tagName = element.tagName.toLowerCase();
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
          return !controlName(element) && !hasLabelElement(element) && element.getAttribute('type') !== 'hidden';
        }
        return !controlName(element);
      })
      .map((element) => element.outerHTML.slice(0, 320))
      .slice(0, 20);

    const bodyText = text(document.body);
    const stuckLoaders = [];
    if (bodyText.includes('Loading owner console...')) stuckLoaders.push('legacy_owner_loading');
    if (bodyText.includes('Preparing command center')) stuckLoaders.push('owner_preparing_command_center');
    if (bodyText.includes('PREPARING STUDIO')) stuckLoaders.push('studio_preparing');
    if (location.pathname === '/studio' && !document.querySelector('[data-testid="studio-ready"]')) {
      stuckLoaders.push('studio_ready_marker_missing');
    }

    return {
      title: document.title,
      h1: Array.from(document.querySelectorAll('h1')).filter(visible).map(text).filter(Boolean).slice(0, 4),
      bodySample: bodyText.slice(0, 800),
      innerWidth: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      overflowX: document.documentElement.scrollWidth > window.innerWidth + 2,
      unlabeledControls,
      stuckLoaders,
    };
  });
}

async function auditRoute(context, baseUrl, routeInfo, label) {
  console.log(`Checking ${label} ${routeInfo.route}...`);
  const page = await context.newPage();
  const consoleMessages = [];
  const requestFailures = [];
  const apiResponses = [];
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleMessages.push({ type: message.type(), text: message.text() });
    }
  });
  page.on('requestfailed', (request) => {
    requestFailures.push({
      url: request.url(),
      failure: request.failure()?.errorText || 'request failed',
    });
  });
  page.on('response', (response) => {
    if (!response.url().includes('/api/')) return;
    apiResponses.push({
      url: response.url().replace(baseUrl, ''),
      status: response.status(),
      serverTiming: response.headers()['server-timing'] || null,
    });
  });

  const startedAt = Date.now();
  let status = null;
  let routeError = null;

  try {
    const response = await page.goto(baseUrl + routeInfo.route, { waitUntil: 'domcontentloaded', timeout: 45_000 });
    status = response?.status() ?? null;
    await waitForRouteReady(page, routeInfo.route);
  } catch (error) {
    routeError = error instanceof Error ? error.message : String(error);
  }

  await page.waitForTimeout(300);
  const elapsedMs = Date.now() - startedAt;
  const pageState = await collectPageState(page).catch((error) => ({
    title: '',
    h1: [],
    bodySample: '',
    innerWidth: 0,
    scrollWidth: 0,
    overflowX: false,
    unlabeledControls: [],
    stuckLoaders: [`evaluation_failed:${error instanceof Error ? error.message : String(error)}`],
  }));
  const screenshot = path.join(outputDir, `${label}-${routeInfo.name}.png`);
  await page.screenshot({ path: screenshot, fullPage: false }).catch(() => {});
  await page.close();

  const hardFailures = [];
  if (routeError) hardFailures.push(`Route error: ${routeError}`);
  if (status && status >= 500) hardFailures.push(`Route returned ${status}`);
  if (pageState.overflowX) hardFailures.push(`Horizontal overflow: ${pageState.scrollWidth}px > ${pageState.innerWidth}px`);
  if (pageState.unlabeledControls.length > 0) hardFailures.push(`${pageState.unlabeledControls.length} unlabeled visible control(s)`);
  if (pageState.stuckLoaders.length > 0) hardFailures.push(`Stuck loader(s): ${pageState.stuckLoaders.join(', ')}`);

  return {
    label,
    route: routeInfo.route,
    name: routeInfo.name,
    status,
    elapsedMs,
    hardFailures,
    consoleMessages: summarizeMessages(consoleMessages),
    requestFailures: summarizeFailures(requestFailures),
    apiResponses,
    screenshot: path.relative(rootDir, screenshot),
    ...pageState,
  };
}

async function signIn(page, baseUrl, email, pathName) {
  await setupClerkTestingToken({ page });

  let lastError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await page.context().clearCookies();
      await page.goto(baseUrl + pathName, { waitUntil: 'domcontentloaded', timeout: 45_000 });
      await page.evaluate(() => {
        window.localStorage.clear();
        window.sessionStorage.clear();
      });
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 45_000 });
      await clerk.loaded({ page });
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
      const activeEmail = await page.evaluate(() => (
        window.Clerk?.user?.primaryEmailAddress?.emailAddress
        ?? window.Clerk?.user?.emailAddresses?.[0]?.emailAddress
        ?? null
      )).catch(() => null);
      if (activeEmail === email) return;
      if (activeEmail) {
        await clerk.signOut({ page }).catch(() => {});
        await page.waitForFunction(() => !window.Clerk?.user, null, { timeout: 10_000 }).catch(() => {});
      }
      await clerk.signIn({ page, emailAddress: email });
      await page.waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 45_000 });
      return;
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes("You're already signed in")) {
        const activeEmail = await page.evaluate(() => (
          window.Clerk?.user?.primaryEmailAddress?.emailAddress
          ?? window.Clerk?.user?.emailAddresses?.[0]?.emailAddress
          ?? null
        )).catch(() => null);
        if (activeEmail === email) return;
      }
      const isNavigationChurn = message.includes('Execution context was destroyed')
        || message.includes('most likely because of a navigation')
        || message.includes('Target page, context or browser has been closed');
      if (isNavigationChurn) {
        const signedInAfterNavigation = await page
          .waitForFunction(() => Boolean(window.Clerk?.user?.id), null, { timeout: 8_000 })
          .then(() => true)
          .catch(() => false);
        if (signedInAfterNavigation) return;
      }
      if (!isNavigationChurn || attempt === 3) break;
      await page.waitForLoadState('domcontentloaded', { timeout: 10_000 }).catch(() => {});
      await page.waitForTimeout(500 * attempt);
    }
  }

  throw lastError;
}

async function createSignedInContext(browser, baseUrl, email) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, baseURL: baseUrl });
  const page = await context.newPage();
  await signIn(page, baseUrl, email, '/');
  await page.close();
  return context;
}

function printSummary(results, skippedAuth) {
  const failed = results.filter((result) => result.hardFailures.length > 0);
  console.log(`Site health audit checked ${results.length} route views.`);
  if (skippedAuth.length > 0) {
    console.log(`Skipped auth roles: ${skippedAuth.join(', ')}`);
  }
  for (const result of results) {
    const marker = result.hardFailures.length > 0 ? 'FAIL' : 'PASS';
    console.log(`${marker} ${result.label} ${result.route} ${result.elapsedMs}ms`);
    if (result.apiResponses.some((response) => response.serverTiming)) {
      for (const response of result.apiResponses.filter((entry) => entry.serverTiming)) {
        console.log(`  timing ${response.url}: ${response.serverTiming}`);
      }
    }
    for (const failure of result.hardFailures) {
      console.log(`  - ${failure}`);
    }
  }
  console.log(`Summary written to ${path.relative(rootDir, summaryPath)}`);
  return failed;
}

async function main() {
  loadEnvFile(path.join(rootDir, '.env.local'));
  loadEnvFile(path.join(rootDir, '.env'));
  ensureOutputDir();

  const baseUrl = process.env.CARDFORGE_E2E_BASE_URL || defaultBaseUrl;
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const skippedAuth = [];

  try {
    const publicContext = await browser.newContext({ viewport: { width: 1440, height: 1100 }, baseURL: baseUrl });
    for (const routeInfo of publicRoutes) {
      results.push(await auditRoute(publicContext, baseUrl, routeInfo, 'public'));
    }
    await publicContext.close();

    let clerkReady = true;
    try {
      await clerkSetup({ dotenv: true });
    } catch (error) {
      clerkReady = false;
      skippedAuth.push(`clerk_setup:${error instanceof Error ? error.message : String(error)}`);
    }

    if (clerkReady) {
      for (const group of authRouteGroups) {
        const email = process.env[group.emailEnv]?.trim();
        if (!email) {
          skippedAuth.push(group.role);
          continue;
        }

        let context;
        try {
          context = await createSignedInContext(browser, baseUrl, email);
          for (const routeInfo of group.routes) {
            results.push(await auditRoute(context, baseUrl, routeInfo, group.role));
          }
        } catch (error) {
          results.push({
            label: group.role,
            route: 'sign-in',
            name: `${group.role}-sign-in`,
            status: null,
            elapsedMs: 0,
            hardFailures: [`Sign-in failed: ${error instanceof Error ? error.message : String(error)}`],
            consoleMessages: [],
            requestFailures: [],
            apiResponses: [],
            screenshot: null,
            title: '',
            h1: [],
            bodySample: '',
            innerWidth: 0,
            scrollWidth: 0,
            overflowX: false,
            unlabeledControls: [],
            stuckLoaders: [],
          });
        } finally {
          if (context) {
            await new Promise((resolve) => {
              setTimeout(resolve, 1500);
            });
            await context.close();
          }
        }
      }
    }
  } finally {
    await browser.close();
  }

  const summary = {
    createdAt: new Date().toISOString(),
    baseUrl,
    skippedAuth,
    results,
  };
  fs.writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`);

  const failed = printSummary(results, skippedAuth);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
