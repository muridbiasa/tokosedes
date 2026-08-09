import "./globals.css";

export const metadata = {
  title: "Tokosedes — Order Form Generator",
  description: "Platform pembuatan formulir pemesanan e-commerce ringan untuk UMKM.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
