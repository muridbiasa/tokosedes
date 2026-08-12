'use client';

export default function PaymentPage() {
  const MIDTRANS_CLIENT_KEY = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY;

  const handlePayment = async () => {
    if (typeof window !== 'undefined') {
      if (!window.snap) {
        const script = document.createElement('script');
        script.src = 'https://app.midtrans.com/snap/snap.js';
        script.setAttribute('data-client-key', MIDTRANS_CLIENT_KEY); 
        script.async = true;
        document.body.appendChild(script);

        script.onload = async () => {
          try {
            const response = await fetch('/api/order/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ /* data order Anda */ }),
            });
            const data = await response.json();
            if (data.token) window.snap.pay(data.token);
          } catch (error) {
            console.error("Gagal memuat pembayaran:", error);
          }
        };
      } else {
        const response = await fetch('/api/order/create', { method: 'POST' });
        const data = await response.json();
        window.snap.pay(data.token);
      }
    }
  }

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