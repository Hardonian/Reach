/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@reach/sdk'],
  },
};

module.exports = nextConfig;
