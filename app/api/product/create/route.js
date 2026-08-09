import { NextResponse } from 'next/server';
// Sesuaikan path import ini dengan letak file konfigurasi Firebase kamu!
// Contoh: import { db } from '@/lib/firebase' atau '@/config/firebase'
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase'; 

export async function POST(request) {
  try {
    // 1. Ambil data (payload) yang dikirim dari form admin
    const data = await request.json();

    // 2. Validasi sederhana (pastikan nama dan harga tidak kosong)
    if (!data.name || !data.price) {
      return NextResponse.json(
        { success: false, message: 'Nama produk dan harga wajib diisi!' },
        { status: 400 }
      );
    }

    // 3. Proses simpan ke koleksi 'products' di Firestore
    const docRef = await addDoc(collection(db, 'products'), {
      name: data.name,
      price: Number(data.price),
      stock: Number(data.stock) || 0,
      description: data.description || '',
      imageUrl: data.imageUrl || '', // URL gambar jika kamu pakai Firebase Storage/hosting lain
      createdAt: serverTimestamp(),
    });

    // 4. Kembalikan respon sukses beserta ID dokumen yang baru dibuat
    return NextResponse.json(
      { 
        success: true, 
        message: 'Produk berhasil ditambahkan ke Firebase!', 
        productId: docRef.id 
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error saat menambahkan produk:', error);
    
    // Kembalikan respon error jika gagal
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