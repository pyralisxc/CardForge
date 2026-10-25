import { buildSync } from 'esbuild';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { expect, test } from '@playwright/test';

// A test-only React root exercises real Owner components without a privileged
// route, fabricated account session, provider mutation or production test page.
const fixture = buildSync({
  entryPoints: ['tests/product/fixtures/ownerSiteDraftPreview.tsx'], bundle: true,
  platform: 'browser', format: 'iife', write: false,
  outfile: join(tmpdir(), 'cardforge-owner-preview-test.js'),
  define: { 'process.env.NODE_ENV': '"production"', 'process.env': '{}' },
});

test('@golden keeps responsive draft theme, nested menu and keyboard focus inside its iframe', async ({ page }) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  const presentation = await page.evaluate(() => ({
    styles: Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map((node) => node.outerHTML).join('\n'),
    htmlClass: document.documentElement.className,
    bodyClass: document.body.className,
  }));
  // A modal mounted into an independently bundled root must not race Next's
  // hydration (Radix legitimately changes aria-hidden outside its own root).
  // This route exists only in the test browser, with the application's styles.
  await page.route('**/__owner-preview-proof', (route) => route.fulfill({
    contentType: 'text/html',
    body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">${presentation.styles}</head><body></body></html>`,
  }));
  await page.goto('/__owner-preview-proof');
  await page.evaluate(({ htmlClass, bodyClass }) => {
    document.documentElement.className = htmlClass;
    document.body.className = bodyClass;
  }, presentation);
  for (const file of fixture.outputFiles.filter((item) => item.path.endsWith('.css'))) await page.addStyleTag({ content: file.text });
  await page.addScriptTag({ content: fixture.outputFiles.find((item) => item.path.endsWith('.js'))!.text });
  const outer = page.getByRole('dialog', { name: 'Isolated Owner preview proof', exact: true });
  await expect(outer).toBeVisible();
  // Iframe child actionability does not wait for its ancestor Sheet's entrance.
  // Use the finite native animation lifecycle, not a timing delay or force-click.
  await outer.evaluate(async (panel) => {
    await Promise.all(panel.getAnimations().map((animation) => animation.finished));
  });
  await page.evaluate(() => {
    document.documentElement.dataset.cfPalette = 'slate';
    document.documentElement.dataset.cfAccent = 'arcane';
    document.documentElement.dataset.cfCorners = 'square';
    document.documentElement.dataset.cfContrast = 'high';
  });
  const viewport = outer.getByRole('combobox', { name: 'Viewport', exact: true });
  await viewport.selectOption('phone');
  const frame = outer.frameLocator('iframe');
  await expect(frame.getByRole('heading', { name: 'Curated website preview', exact: true })).toBeVisible();
  await expect(frame.locator('html')).toHaveAttribute('data-cf-palette', 'slate');
  await expect(frame.locator('html')).toHaveAttribute('data-cf-accent', 'arcane');
  await expect(frame.locator('html')).toHaveAttribute('data-cf-corners', 'square');
  await expect(frame.locator('html')).toHaveAttribute('data-cf-contrast', 'high');
  const trigger = frame.getByRole('button', { name: 'Open menu', exact: true });
  await trigger.click();
  const menu = frame.getByRole('dialog', { name: 'Navigation', exact: true });
  await expect(menu).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  const first = menu.getByRole('link', { name: 'How it works', exact: true });
  const last = menu.getByRole('button', { name: 'Close', exact: true });
  await expect(first).toBeFocused();
  await first.press('Shift+Tab'); await expect(last).toBeFocused();
  await last.press('Tab'); await expect(first).toBeFocused();
  await first.press('Escape');
  await expect(menu).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await expect(outer).toBeVisible();
  const canvas = page.frames().find((item) => item.parentFrame());
  const geometry = await canvas!.evaluate(() => ({ width: window.innerWidth, scroll: document.documentElement.scrollWidth, scripts: document.querySelectorAll('script').length }));
  expect(geometry).toEqual({ width: 390, scroll: 390, scripts: 0 });
  await viewport.selectOption('tablet');
  await expect(outer.locator('iframe')).toHaveCSS('width', '768px');
  await viewport.selectOption('desktop');
  await expect(outer.locator('iframe')).toHaveCSS('width', '1440px');
});

const editionName = 'Unpublished Summer Collection — carefully reviewed artwork and presentation for the next launch';
for (const width of [320, 390, 768, 1440]) test(`@golden saved Edition controls remain readable at ${width}px`, async ({ page }, testInfo) => {
  test.setTimeout(60000);
  await page.setViewportSize({width,height:850});
  const writes:string[]=[];
  await page.route('**/api/**',route=>{
    const request=route.request();
    if(request.method()!=='GET'){writes.push(request.method()+' '+request.url());return route.abort();}
    if(request.url().includes('/api/owner/website-editions'))return route.fulfill({json:{editions:[{id:'edition-proof',name:editionName,archivedAt:null}]}});
    if(request.url().includes('/api/owner/website-revisions'))return route.fulfill({json:{revisions:[{id:'revision-proof-2',ordinal:2,createdAt:'2026-10-25T00:00:00Z'}]}});
    return route.abort();
  });
  await page.goto('/',{waitUntil:'domcontentloaded'});
  const presentation=await page.evaluate(()=>({styles:Array.from(document.head.querySelectorAll('style,link[rel="stylesheet"]')).map(n=>n.outerHTML).join('\n'),htmlClass:document.documentElement.className,bodyClass:document.body.className}));
  await page.route('**/__owner-controls-proof',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1">${presentation.styles}</head><body></body></html>`}));
  await page.goto('/__owner-controls-proof');
  await page.evaluate(p=>{document.documentElement.className=p.htmlClass;document.body.className=p.bodyClass;},presentation);
  for(const file of fixture.outputFiles.filter(f=>f.path.endsWith('.css')))await page.addStyleTag({content:file.text});
  await page.addScriptTag({content:fixture.outputFiles.find(f=>f.path.endsWith('.js'))!.text});
  const bar=page.locator('[data-owner-live-controls]');
  const status=bar.getByRole('status');
  await expect(status).toHaveAttribute('title',editionName+' · Revision 2');
  await expect(status).toContainText(editionName);
  const measure=async(label:string)=>{
    const geometry=await bar.evaluate(el=>({viewport:innerWidth,document:document.documentElement.scrollWidth,bar:el.getBoundingClientRect().toJSON(),items:Array.from(el.querySelectorAll('button,[role="status"], [role="status"] span')).map(n=>({text:n.textContent,rect:n.getBoundingClientRect().toJSON(),client:n.clientWidth,scroll:n.scrollWidth,style:{overflow:getComputedStyle(n).overflow,textOverflow:getComputedStyle(n).textOverflow,whiteSpace:getComputedStyle(n).whiteSpace}}))}));
    console.log('EDITION_GEOMETRY',JSON.stringify({width,label,...geometry}));
    await testInfo.attach(label,{body:await page.screenshot(),contentType:'image/png'});
    expect.soft(geometry.document).toBeLessThanOrEqual(geometry.viewport);
    const name = geometry.items.find(item => item.text === editionName)!;
    expect.soft(name.client).toBeGreaterThan(24);
    expect.soft(name.style.textOverflow).toBe('ellipsis');
    const revision = geometry.items.find(item => item.text === '· Revision 2')!;
    expect.soft(revision.scroll).toBeLessThanOrEqual(revision.client);
    for (const action of geometry.items.filter(item => ['Save revision','Activate saved','Edit page','Done editing','Site settings'].includes(item.text ?? ''))) {
      expect.soft(revision.rect.right <= action.rect.left || revision.rect.left >= action.rect.right || revision.rect.bottom <= action.rect.top || revision.rect.top >= action.rect.bottom, 'Revision must not overlap an action').toBe(true);
    }
    for(const item of geometry.items.filter(i=>i.text==='· Revision 2'||i.text==='Save revision'||i.text==='Activate saved'||i.text==='Edit page'||i.text==='Done editing'||i.text==='Site settings')){
      expect.soft(item.rect.x,`${label}: ${item.text} left`).toBeGreaterThanOrEqual(0);
      expect.soft(item.rect.right,`${label}: ${item.text} right`).toBeLessThanOrEqual(geometry.viewport);
      expect.soft(item.rect.width,`${label}: ${item.text} width`).toBeGreaterThan(30);
    }
  };
  await measure('saved');
  await bar.getByRole('button',{name:'Edit page',exact:true}).click();
  await measure('editing');
  await bar.getByRole('button',{name:'Site settings',exact:true}).click();
  const panel=page.locator('[data-owner-site-editor-panel]');await expect(panel).toBeVisible();
  await panel.evaluate(async node => { await Promise.all(node.getAnimations().map(animation => animation.finished)); });
  await expect(panel.getByText(/^Revision 2 · Editing/)).toBeVisible();
  console.log('EDITION_PANEL',JSON.stringify(await panel.evaluate(n=>({width:innerWidth,document:document.documentElement.scrollWidth,client:n.clientWidth,scroll:n.scrollWidth,rect:n.getBoundingClientRect().toJSON()}))));
  expect.soft(await panel.evaluate(n=>n.scrollWidth)).toBeLessThanOrEqual(await panel.evaluate(n=>n.clientWidth));
  expect.soft((await panel.getByRole('textbox', {name:'New edition name'}).boundingBox())!.width).toBeGreaterThan(200);
  await testInfo.attach('settings', {body:await page.screenshot(),contentType:'image/png'});
  for (const button of await panel.getByRole('button').all()) {
    await button.scrollIntoViewIfNeeded();
    const rect = (await button.boundingBox())!;
    expect.soft(rect.x).toBeGreaterThanOrEqual(0);
    expect.soft(rect.x + rect.width).toBeLessThanOrEqual(width);
  }
  await page.setViewportSize({width:850,height:width});await expect(panel).toBeVisible();
  await page.setViewportSize({width,height:850});await expect(panel).toBeVisible();
  await panel.getByRole('button',{name:'Close',exact:true}).click();await expect(panel).toHaveCount(0);
  await expect(bar.getByRole('button',{name:'Done editing',exact:true})).toHaveAttribute('aria-pressed','true');
  await expect(status).toHaveAttribute('title',editionName+' · Revision 2');
  await expect(status).toContainText(editionName);
  if(width<768){await page.getByRole('button',{name:'Open menu',exact:true}).click();await expect(page.getByRole('dialog',{name:'Navigation',exact:true})).toBeVisible();await page.keyboard.press('Escape');}
  await bar.getByRole('button',{name:'Done editing',exact:true}).click();
  expect(writes).toEqual([]);
});
