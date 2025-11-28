import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  serverExternalPackages: ['@react-email/render', 'prettier'],
  
  // Enable Fast Refresh (Hot Reload)
  reactStrictMode: true,
  
  // Transpile ESM packages that need to be processed by Next.js
  transpilePackages: ['cmdk', '@radix-ui/react-popover'],
  
  // Optimize for faster development with Turbopack
  experimental: {
    // Enable optimized package imports for faster builds
    optimizePackageImports: ['lucide-react', 'framer-motion', 'cmdk'],
  },
};

export default nextConfig;
