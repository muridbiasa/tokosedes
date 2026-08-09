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