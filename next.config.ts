import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'www.gravatar.com',
      },
      {
        protocol: 'https',
        hostname: 'gravatar.com',
      },
    ],
  },
  serverExternalPackages: ['@react-email/render', 'prettier'],
  
  // Enable Fast Refresh (Hot Reload)
  reactStrictMode: true,
  
  // Transpile ESM packages that need to be processed by Next.js
  transpilePackages: ['cmdk', '@radix-ui/react-popover'],
  
  // Enable standalone output for Docker
  output: 'standalone',
  
  // Optimize for faster development with Turbopack
  experimental: {
    // Enable optimized package imports for faster builds
    optimizePackageImports: ['lucide-react', 'framer-motion', 'cmdk'],
    
    // Server Actions configuration
    serverActions: {
      // Increase body size limit to 25MB to allow document uploads (2 files × 10MB max + overhead)
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
