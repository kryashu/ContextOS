/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: [
    '@contextos/ui',
    '@contextos/calculator',
    '@contextos/agents',
    '@contextos/ai',
    '@contextos/orchestrator',
    '@contextos/table-query',
    '@contextos/key-intelligence',
    '@contextos/qa',
    '@contextos/tools',
    '@contextos/types',
  ],
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pdfkit', 'marked'],
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
