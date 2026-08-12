/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "script-src 'self'",
              "https://snap-assets.midtrans.com",
              "https://api.midtrans.com",
              "https://pay.google.com",
              "https://gwk.gopayapi.com",
              "https://www.googletagmanager.com",
              "https://o.alicdn.com",
              "https://g.alicdn.com",
              "'unsafe-inline'",
              "'unsafe-eval'",
            ].join(' '),
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'no-referrer',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;