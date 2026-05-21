import type {NextConfig} from 'next';

const isDevelopmentServer = process.env.NODE_ENV === 'development';
const distDir = process.env.NEXT_DIST_DIR || (isDevelopmentServer ? '.next-dev' : '.next');

const nextConfig: NextConfig = {
  distDir,
  allowedDevOrigins: ['127.0.0.1'],
  images: {
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
