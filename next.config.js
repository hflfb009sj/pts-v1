/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'pts-v1.vercel.app',
        'ptrust2837.pinet.com',
        'ptrustoracle4305.pinet.com',
        'localhost:3000',
      ],
    },
  },
  reactStrictMode: true,

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options',    value: 'nosniff'          },
          { key: 'X-Frame-Options',           value: 'DENY'             },
          { key: 'X-XSS-Protection',          value: '1; mode=block'    },
          { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
        ],
      },
    ];
  },
};

export default nextConfig;
