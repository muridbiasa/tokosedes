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
              "default-src 'self'",

              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "https://app.midtrans.com",
              "https://snap-assets.midtrans.com",
              "https://api.midtrans.com",
              "https://pay.google.com",
              "https://gwk.gopayapi.com",
              "https://*.gopayapi.com",
              "https://www.googletagmanager.com",
              "https://www.google-analytics.com",
              "https://o.alicdn.com",
              "https://g.alicdn.com",

              // FIX: Tambah semua URL yang dipakai Firebase Client SDK (onSnapshot/realtime)
              "connect-src 'self'",
              "https://*.googleapis.com",
              "https://*.firebaseio.com",
              "https://firestore.googleapis.com",
              "https://identitytoolkit.googleapis.com",
              "wss://*.googleapis.com",
              "wss://*.firebaseio.com",                       // FIX: WebSocket Firebase realtime
              "https://firestore.googleapis.com/google.firestore.v1.Firestore/*", // FIX: gRPC-web Firestore
              "https://*.firebaseapp.com",
              "https://app.midtrans.com",
              "https://api.midtrans.com",
              "https://snap-assets.midtrans.com",
              "https://*.gopayapi.com",
              "https://gwk.gopayapi.com",

              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://fonts.gstatic.com",
              "frame-src 'self' https://app.midtrans.com https://pay.google.com",
              "base-uri 'self'",
              "object-src 'none'",
            ].join('; '),
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
