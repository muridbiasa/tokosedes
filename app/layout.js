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
          Meta CSP dihapus — CSP sudah dihandle di next.config.js via HTTP header.
          Meta tag CSP di sini justru OVERRIDE header dan lebih restrictive,
          itulah kenapa app.midtrans.com kena block meski sudah ada di next.config.js.
        */}
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
