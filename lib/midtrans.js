/**
 * lib/midtrans.js
 *
 * Inisialisasi Midtrans Snap SDK — MODE PRODUCTION.
 * HANYA dipakai di server (API routes). MIDTRANS_SERVER_KEY tidak boleh
 * pernah diekspos ke client (sesuai Don'ts PRD: "JANGAN menyimpan kunci
 * rahasia Server Key Midtrans di sisi Frontend/Client").
 *
 * NEXT_PUBLIC_MIDTRANS_CLIENT_KEY sengaja diberi prefix NEXT_PUBLIC_ karena
 * Client Key memang didesain publik oleh Midtrans (dipakai di frontend
 * untuk memuat snap.js), tapi tetap didaftarkan sebagai pasangan dengan
 * Server Key di sini untuk konsistensi konfigurasi SDK.
 */

import midtransClient from "midtrans-client";

function assertEnv() {
    const missing = [];
    if (!process.env.MIDTRANS_SERVER_KEY) missing.push("MIDTRANS_SERVER_KEY");
    if (!process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY) {
        missing.push("NEXT_PUBLIC_MIDTRANS_CLIENT_KEY");
    }
    if (missing.length > 0) {
        throw new Error(
            `Midtrans SDK: environment variable belum diset: ${missing.join(", ")}`
        );
    }
}

/**
 * Instance Snap SDK, MODE PRODUCTION (isProduction: true).
 * Instantiated lazily so Next.js can collect route metadata during builds
 * where server-only credentials are not exposed to the build process.
 */
let snapInstance;
export function getSnap() {
    if (!snapInstance) {
        assertEnv();
        snapInstance = new midtransClient.Snap({
            isProduction: true,
            serverKey: process.env.MIDTRANS_SERVER_KEY,
            clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
        });
    }
    return snapInstance;
}

export const snap = new Proxy({}, {
    get(_target, property) {
        return getSnap()[property];
    },
});

/**
 * Server Key diekspos ulang lewat helper ini (bukan diakses langsung dari
 * process.env di file lain) supaya semua pemakaian Server Key — termasuk
 * verifikasi signature webhook — melewati satu titik yang sama, memudahkan
 * audit "di mana saja Server Key dipakai".
 */
export function getServerKey() {
    return process.env.MIDTRANS_SERVER_KEY;
}
