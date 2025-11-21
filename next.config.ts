import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  serverExternalPackages: ['@react-email/render', 'prettier'],
};

export default nextConfig;
