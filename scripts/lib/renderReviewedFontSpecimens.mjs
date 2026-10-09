import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';

/** Image-only browser evidence; never an exported font binary or press certification. */
export const renderReviewedFontSpecimens = async ({ items, outputDirectory }) => {
  const escapeHtml = value => String(value).replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
  const faceName = candidate => 'cf-review-' + candidate.assetId;
  const fontFaces = items.map(({ candidate, bytes, fontWeightRange }) =>
    '@font-face{font-family:"' + faceName(candidate) + '";font-style:normal;font-weight:'
      + fontWeightRange + ';src:url("data:font/ttf;base64,' + bytes.toString('base64')
      + '") format("truetype");}'
  ).join('\n');
  const cards = items.map(({ candidate }) => {
    const font = faceName(candidate);
    const styled = (className, content) => '<div class="' + className
      + '" style="font-family:' + font + '">' + escapeHtml(content) + '</div>';
    return '<article class="specimen">'
      + '<div class="title">' + escapeHtml(candidate.family) + '</div>'
      + '<div class="role">' + escapeHtml(candidate.intendedRole) + '</div>'
      + '<div class="card">'
      + styled('display', candidate.family)
      + '<div class="divider"></div>'
      + styled('alphabet', 'Aa Bb Cc Xx Yy Zz')
      + styled('numbers', '0 1 2 3 4 5 6 7 8 9')
      + styled('punct', '! ? . , ; : / ( ) [ ] + -')
      + styled('rules', 'Rules: Draw 2 cards. Pay 3 energy; gain 1 shield. At the end of your turn, discard 1 card. (1/2)')
      + styled('stats', 'ATK 12 · DEF 08 · COST 03')
      + '</div><div class="foot">63 × 88 mm CSS reference · legibility review pending</div>'
      + '</article>';
  }).join('');
  const css = [
    '*{box-sizing:border-box}html,body{margin:0}',
    'body{font-family:system-ui,sans-serif;background:#10151a;color:#ecf1f6;padding:24px}',
    'h1{font-size:24px;margin:0 0 8px}header p{font-size:13px;color:#b8c5d0;margin:0 0 16px}',
    'main{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:18px}',
    '.specimen{min-width:0;padding:12px;border:1px solid #4d626f;background:#1b2530}',
    '.title{font-size:17px;font-weight:700;margin-bottom:7px}',
    '.role{font-size:11px;color:#c5d0d5;min-height:44px}',
    '.card{width:63mm;height:88mm;padding:5mm;display:flex;flex-direction:column;gap:3mm;background:#f5efdf;color:#202123;border:1px solid #8b7757;overflow:hidden}',
    '.display{font-size:20pt;line-height:1.1;min-height:19mm;overflow-wrap:anywhere;max-width:100%}',
    '.divider{height:1px;background:#5e5e59}.alphabet{font-size:11pt}',
    '.numbers{font-size:14pt;font-weight:600}.punct{font-size:10pt}',
    '.rules{font-size:9pt;line-height:1.35;flex:1}.stats{font-size:9pt;border-top:1px solid #5e5e59;padding-top:2mm}',
    '.foot{margin-top:7px;font-size:10px;color:#c5d0d5}',
  ].join('\n');
  const html = '<!doctype html><html lang="en"><meta charset="UTF-8"><style>'
    + fontFaces + '\n' + css + '</style><body><header>'
    + '<h1>CardForge · original-font release candidates</h1>'
    + '<p>True source-verified faces at sample card size. Browser CSS specimen only: NOT professional print, embedding, or legibility certification.</p>'
    + '</header><main>' + cards + '</main></body></html>';
  await mkdir(outputDirectory, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1360, height: 740 }, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load' });
    await page.evaluate(async () => { await document.fonts.ready; return true; });
    const result = path.join(outputDirectory, 'four-reviewed-fonts-card-scale.png');
    await page.screenshot({ path: result, fullPage: true });
    console.log('Original-font image-only specimen created: ' + result);
    return result;
  } finally {
    await browser.close();
  }
};
