import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', '192.168.1.159'],
  // Browser verification should exercise CardForge's own controls without the
  // development-only Next indicator covering compact bottom-left actions.
  // Compile and runtime errors remain visible when indicators are disabled.
  devIndicators: process.env.CARDFORGE_E2E_BROWSER === 'true' ? false : undefined,
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
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
