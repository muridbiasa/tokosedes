/**
 * app/api/product/create/route.js
 *
 * POST /api/product/create
 *
 * Route alternatif (simple) untuk membuat produk baru.
 * FIX: Import `db` (bukan `adminDb` yang tidak pernah di-export).
 * Untuk produksi, gunakan /api/admin/product/create yang lebih lengkap.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase-admin'; // FIX: was `adminDb`, tidak ada di exports

export async function POST(request) {
  try {
    const data = await request.json();

    if (!data.name || !data.price) {
      return NextResponse.json(
        { success: false, message: 'Nama produk dan harga wajib diisi!' },
        { status: 400 }
      );
    }

    const storeId = 'tokosedes';

    // FIX: Pakai `db` (bukan `adminDb`)
    const docRef = await db
      .collection('stores')
      .doc(storeId)
      .collection('products')
      .add({
        name: data.name,
        price: Number(data.price),
        stock: Number(data.stock) || 0,
        description: data.description || '',
        imageUrl: data.imageUrl || '',
        createdAt: new Date(),
      });

    return NextResponse.json(
      {
        success: true,
        message: 'Produk berhasil ditambahkan melalui Admin SDK!',
        productId: docRef.id,
      },
      { status: 201 }
    );

  } catch (error) {
    console.error('Error saat menambahkan produk:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Gagal menambahkan produk ke database',
        error: error.message,
      },
      { status: 500 }
    );
  }
}
