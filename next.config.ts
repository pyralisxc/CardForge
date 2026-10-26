import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', '192.168.1.159'],
  // Browser verification should exercise CardForge's own controls without the
  // development-only Next indicator covering compact bottom-left actions.
  // Compile and runtime errors remain visible when indicators are disabled.
  devIndicators: process.env.CARDFORGE_E2E_BROWSER === 'true' ? false : undefined,
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  async rewrites() {
    return [{
      // Retain the retired landing share-image URL as a compatibility alias.
      // Cached clients and crawlers may keep requesting it long after current
      // pages move to the canonical site-fallback location.
      source: '/card-assets/landing/cardforge-hero-workbench.png',
      destination: '/site-fallbacks/landing/cardforge-hero-workbench.png',
    }];
  },
  outputFileTracingIncludes: {
    '/api/plugin-downloads': [
      'plugins/cardforge-studio/.codex-plugin/plugin.json',
      'plugins/cardforge-studio/.mcp.json',
      'plugins/cardforge-studio/skills/*/SKILL.md',
      'plugins/cardforge-owner/.codex-plugin/plugin.json',
      'plugins/cardforge-owner/.mcp.json',
      'plugins/cardforge-owner/skills/*/SKILL.md',
      'public/brand/cardforge-studio/favicon.svg',
    ],
    '/mcp': [
      'plugins/cardforge-studio/skills/*/SKILL.md',
      'node_modules/@sparticuz/chromium/bin/**/*',
    ],
  },
  images: {
    localPatterns: [
      {
        pathname: '/brand/**',
      },
      {
        pathname: '/site-fallbacks/**',
      },
      {
        pathname: '/api/public/site-media/**',
      },
    ],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
