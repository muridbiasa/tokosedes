import './globals.css';
import Script from 'next/script';

export const metadata = {
  title: 'Toko Sedes',
  description: 'Official Store Toko Sedes',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        {/* Fallback CSP via meta tag */}
        <meta
          httpEquiv="Content-Security-Policy"
          content="script-src 'self' https://snap-assets.midtrans.com https://api.midtrans.com https://pay.google.com https://gwk.gopayapi.com https://www.googletagmanager.com https://o.alicdn.com https://g.alicdn.com 'unsafe-inline' 'unsafe-eval'"
        />
        {/* Load Midtrans Snap SDK Mode Production */}
        <Script
          src="https://app.midtrans.com/snap/snap.js"
          data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
          strategy="afterInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}