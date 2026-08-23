interface CanonicalBrowserImage {
  subjectId: string;
  bytes: Buffer;
}

const DATA_PNG_PATTERN = /^data:image\/png;base64,([A-Za-z0-9+/=\s]+)$/u;
const RENDER_TIMEOUT_MS = 45_000;

const decodePngDataUrl = (value: string): Buffer => {
  const match = DATA_PNG_PATTERN.exec(value);
  if (!match) throw new Error('The canonical CardForge renderer did not return PNG image data.');
  return Buffer.from(match[1], 'base64');
};

const isAllowedRenderUrl = (value: string, publicOrigin: string): boolean => {
  try {
    const url = new URL(value);
    const allowed = new URL(publicOrigin);
    return url.origin === allowed.origin
      && (url.pathname === '/mcp-template-preview' || url.pathname === '/mcp-card-set-preview');
  } catch {
    return false;
  }
};

const launchCanonicalBrowser = async () => {
  const [{ default: chromium }, { default: puppeteer }] = await Promise.all([
    import('@sparticuz/chromium'),
    import('puppeteer-core'),
  ]);
  const configuredPath = process.env.CARDFORGE_CHROME_EXECUTABLE_PATH?.trim();
  const executablePath = configuredPath || await chromium.executablePath();
  return puppeteer.launch({
    args: chromium.args,
    executablePath,
    headless: 'shell',
    defaultViewport: {
      width: 1440,
      height: 1800,
      deviceScaleFactor: 1,
    },
  });
};

export const renderCanonicalBrowserImages = async ({
  publicOrigin,
  renderUrl,
  selector,
  expectedCount,
}: {
  publicOrigin: string;
  renderUrl: string;
  selector: string;
  expectedCount: number;
}): Promise<CanonicalBrowserImage[]> => {
  if (!Number.isInteger(expectedCount) || expectedCount < 1 || expectedCount > 12) {
    throw new Error('CardForge canonical browser rendering requires between 1 and 12 expected images.');
  }
  if (!isAllowedRenderUrl(renderUrl, publicOrigin)) {
    throw new Error('CardForge refused to render an untrusted preview URL.');
  }

  const browser = await launchCanonicalBrowser();
  try {
    const page = await browser.newPage();
    await page.goto(renderUrl, {
      waitUntil: 'domcontentloaded',
      timeout: RENDER_TIMEOUT_MS,
    });
    await page.waitForFunction(
      ({ targetSelector, count }) => {
        const elements = Array.from(document.querySelectorAll<HTMLImageElement>(targetSelector));
        return elements.length >= count && elements.slice(0, count).every((element) => (
          element.src.startsWith('data:image/png;base64,')
        ));
      },
      { timeout: RENDER_TIMEOUT_MS },
      { targetSelector: selector, count: expectedCount },
    );
    const images = await page.$$eval(selector, (elements, count) => (
      elements.slice(0, count as number).map((element, index) => {
        const image = element as HTMLImageElement;
        return {
          subjectId: image.dataset.cardId || image.dataset.templateId || String(index),
          dataUrl: image.src,
        };
      })
    ), expectedCount);
    return images.map((image) => ({
      subjectId: image.subjectId,
      bytes: decodePngDataUrl(image.dataUrl),
    }));
  } finally {
    await browser.close();
  }
};
