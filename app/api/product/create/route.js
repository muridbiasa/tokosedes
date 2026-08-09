import { NextResponse } from 'next/server';
// Sesuaikan import ini dengan file inisialisasi Firebase Admin kamu
// Contoh: import { adminDb } from '@/lib/firebaseAdmin';
import { adminDb } from '@/lib/firebaseAdmin'; 

export async function POST(request) {
  try {
    const data = await request.json();

    if (!data.name || !data.price) {
      return NextResponse.json(
        { success: false, message: 'Nama produk dan harga wajib diisi!' },
        { status: 400 }
      );
    }

    // Tentukan ID Toko sesuai dengan struktur di database kamu.
    // Jika hanya ada satu toko, kamu bisa menuliskannya secara manual di sini (hardcode)
    // Misalnya 'tokosedes' atau ID spesifik lainnya.
    const storeId = 'tokosedes'; 

    // Simpan ke sub-koleksi: stores -> [storeId] -> products
    const docRef = await adminDb
      .collection('stores')
      .doc(storeId)
      .collection('products')
      .add({
        name: data.name,
        price: Number(data.price),
        stock: Number(data.stock) || 0,
        description: data.description || '',
        imageUrl: data.imageUrl || '',
        // Menggunakan waktu dari server Admin SDK
        createdAt: new Date(), 
      });

    return NextResponse.json(
      { 
        success: true, 
        message: 'Produk berhasil ditambahkan melalui Admin SDK!', 
        productId: docRef.id 
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error saat menambahkan produk:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        message: 'Gagal menambahkan produk ke database', 
        error: error.message 
      },
      { status: 500 }
    );
  }
}