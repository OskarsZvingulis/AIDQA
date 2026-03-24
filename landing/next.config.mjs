/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.aidesignqa.com' }],
        destination: 'https://aidesignqa.com/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'www.lp.aidesignqa.com' }],
        destination: 'https://lp.aidesignqa.com/:path*',
        permanent: true,
      },
    ];
  },
};
export default nextConfig;
