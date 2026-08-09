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

assertEnv();

/**
 * Instance Snap SDK, MODE PRODUCTION (isProduction: true).
 * Server Key production Midtrans berawalan "Mid-server-" (bukan "SB-Mid-server-").
 * Pastikan MIDTRANS_SERVER_KEY di Vercel adalah key dari Dashboard Midtrans
 * mode Production, BUKAN Sandbox — key Sandbox tidak akan bisa memproses
 * pembayaran nyata dan sebaliknya key Production tidak bisa dipakai di
 * environment Sandbox.
 */
export const snap = new midtransClient.Snap({
    isProduction: true,
    serverKey: process.env.MIDTRANS_SERVER_KEY,
    clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
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