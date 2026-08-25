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
        {/*
          Meta CSP dihapus — CSP sudah dihandle di vercel.json via HTTP header.
        */}
        {/*
          Font dimuat via <link> di head (BUKAN @import di globals.css):
          @import yang diletakkan setelah rule Tailwind diabaikan browser,
          sehingga sebelumnya semua pilihan font jatuh ke fallback Inter.
        */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Caveat:wght@500;600;700&family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&family=Montserrat:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}

        {/* 
          Midtrans Snap SDK — diletakkan di luar <head>, setelah <body>.
          strategy="afterInteractive" = load setelah halaman interaktif (bukan saat SSR).
          Tidak boleh diletakkan di dalam <head> manual karena Next.js Script
          component punya lifecycle sendiri yang konflik dengan <head> manual.
        */}
        <Script
          src="https://app.midtrans.com/snap/snap.js"
          data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
