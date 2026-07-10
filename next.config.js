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
};

export default nextConfig;
