/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `
              default-src 'self';
              
              script-src 'self' 'unsafe-inline' 'unsafe-eval' 
                https://app.midtrans.com 
                https://snap-assets.midtrans.com 
                https://api.midtrans.com 
                https://pay.google.com 
                https://gwk.gopayapi.com 
                https://www.googletagmanager.com 
                https://www.google-analytics.com 
                https://o.alicdn.com 
                https://g.alicdn.com;
              
              connect-src 'self' 
                https://*.googleapis.com 
                https://*.firebaseio.com 
                https://firestore.googleapis.com 
                https://identitytoolkit.googleapis.com 
                wss://*.googleapis.com 
                https://app.midtrans.com 
                https://api.midtrans.com 
                https://snap-assets.midtrans.com;
              
              style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
              img-src 'self' data: https: blob:;
              font-src 'self' data: https://fonts.gstatic.com;
              frame-src 'self' https://app.midtrans.com https://pay.google.com;
              base-uri 'self';
              object-src 'none';
            `.replace(/\s{2,}/g, ' ').trim(),
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
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
};

module.exports = nextConfig;