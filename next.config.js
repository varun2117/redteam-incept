/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live;
              style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
              font-src 'self' https://fonts.gstatic.com data:;
              img-src 'self' data: https: blob:;
              connect-src 'self' https: wss: https://redteam-incept-backend.vercel.app;
              frame-src 'self' https://vercel.live;
              object-src 'none';
              base-uri 'self';
            `.replace(/\s{2,}/g, ' ').trim()
          }
        ]
      }
    ]
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