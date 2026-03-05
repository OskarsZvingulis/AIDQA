/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/visual-regression',
        permanent: false,
      },
    ];
  },
};
export default nextConfig;
