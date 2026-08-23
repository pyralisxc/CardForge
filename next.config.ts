import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['127.0.0.1', '192.168.1.159'],
  serverExternalPackages: ['@sparticuz/chromium', 'puppeteer-core'],
  outputFileTracingIncludes: {
    '/mcp': ['plugins/cardforge-studio/skills/*/SKILL.md'],
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
