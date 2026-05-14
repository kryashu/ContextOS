/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@contextos/calculator'],
  serverExternalPackages: ['pdfkit'],
  // Suppress React hydration warnings from Mermaid SVG injection
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
