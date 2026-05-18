/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  transpilePackages: ['@contextos/calculator'],
  // Suppress React hydration warnings from Mermaid SVG injection
  reactStrictMode: true,
  experimental: {
    serverComponentsExternalPackages: ['pdfkit'],
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
