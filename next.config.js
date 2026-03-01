/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      allowedOrigins: [
        "ptrustoracle4305.pinet.com",
        "localhost:3000"
      ],
    },
  },
};

export default nextConfig;
