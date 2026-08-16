'use client';

/**
 * app/payment/page.jsx
 *
 * FIX: Hapus manual document.createElement('script') untuk snap.js —
 * ini dianggap inline script oleh CSP dan akan diblock.
 * snap.js sudah diload global via layout.js, tinggal pakai window.snap langsung.
 */

export default function PaymentPage() {
  const handlePayment = async () => {
    if (typeof window === 'undefined') return;

    // snap.js sudah diload di layout.js — langsung pakai, tidak perlu inject ulang
    if (!window.snap) {
      alert('Midtrans Snap belum siap. Coba refresh halaman.');
      return;
    }

    try {
      const response = await fetch('/api/order/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ /* data order */ }),
      });
      const data = await response.json();
      if (data.token) window.snap.pay(data.token);
    } catch (error) {
      console.error('Gagal memuat pembayaran:', error);
      alert('Gagal memuat pembayaran. Silakan coba lagi.');
    }
  };

  return (
    <div className="p-4">
      <button
        onClick={handlePayment}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Bayar Sekarang
      </button>
    </div>
  );
}
