/**
 * lib/firebase-admin.js
 *
 * Inisialisasi Firebase Admin SDK — HANYA dipakai di server (API routes),
 * TIDAK PERNAH diimport dari Client Component. Admin SDK ini yang
 * membaca/menulis Firestore dengan hak akses penuh (bypass Security Rules),
 * jadi kredensialnya (private_key) tidak boleh pernah sampai ke browser.
 *
 * Kredensial diambil dari 3 environment variable yang berasal dari file
 * JSON Service Account (Firebase Console > Project Settings > Service
 * Accounts > Generate new private key):
 *   - FIREBASE_PROJECT_ID    <- field "project_id"
 *   - FIREBASE_CLIENT_EMAIL  <- field "client_email"
 *   - FIREBASE_PRIVATE_KEY   <- field "private_key" (lihat catatan newline di bawah)
 *
 * Pola singleton (cek admin.apps.length) WAJIB di Next.js: setiap API route
 * yang di-hit bisa memicu re-evaluasi module di lingkungan serverless/dev
 * hot-reload, dan initializeApp() akan error jika dipanggil dua kali.
 */

import admin from "firebase-admin";

function getPrivateKey() {
    const raw = process.env.FIREBASE_PRIVATE_KEY || "";
    // Vercel Dashboard menyimpan env var sebagai satu baris teks, sehingga
    // newline asli di private_key harus di-escape jadi literal "\n" saat
    // disimpan, dan di-decode balik jadi newline sungguhan di sini.
    return raw.replace(/\\n/g, "\n");
}

function assertEnv() {
    const missing = [];
    if (!process.env.FIREBASE_PROJECT_ID) missing.push("FIREBASE_PROJECT_ID");
    if (!process.env.FIREBASE_CLIENT_EMAIL) missing.push("FIREBASE_CLIENT_EMAIL");
    if (!process.env.FIREBASE_PRIVATE_KEY) missing.push("FIREBASE_PRIVATE_KEY");
    if (missing.length > 0) {
        throw new Error(
            `Firebase Admin SDK: environment variable belum diset: ${missing.join(", ")}`
        );
    }
}

  function ensureAdmin() {
  if (!admin.apps.length) {
  assertEnv();
  admin.initializeApp({
  credential: admin.credential.cert({
  projectId: process.env.FIREBASE_PROJECT_ID,
  clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  privateKey: getPrivateKey(),
  }),
  });
  }
  return admin;
  }

  export const db = new Proxy({}, {
  get(_target, property) {
  return ensureAdmin().firestore()[property];
  },
  });
  export const FieldValue = new Proxy({}, {
  get(_target, property) {
  return ensureAdmin().firestore.FieldValue[property];
  },
  });
export default admin;
