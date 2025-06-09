/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    appDir: true,
  },
  env: {
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
  },
  async rewrites() {
    const targetPort = process.env.BACKEND_PORT || '3001';
    
    return [
      // Only proxy agent routes to backend, leave assessment routes for Next.js
      {
        source: '/api/agent/:path*',
        destination: `http://localhost:${targetPort}/api/agent/:path*`,
      },
    ];
  },
}

module.exports = nextConfig