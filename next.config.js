/** @type {import('next').NextConfig} */
const nextConfig = {
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