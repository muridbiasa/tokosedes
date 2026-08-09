/**
 * lib/google-sheets.js
 *
 * Integrasi Google Sheets API (Service Account JWT) — F-06 PRD.
 * HANYA dipakai di server. Menulis baris baru ke Sheet setiap kali sebuah
 * order berhasil dibayar (dipanggil dari webhook Midtrans).
 *
 * PRD §5.4 (Kegagalan API Google Sheets): Firestore adalah Single Source
 * of Truth. Fungsi appendOrderToSheets() di sini SENGAJA melempar error
 * ketika gagal (bukan menelan error diam-diam), supaya pemanggilnya
 * (webhook) bisa menangkapnya dan menandai order sebagai
 * synced_to_sheets: false untuk di-retry belakangan — bukan tanggung
 * jawab modul ini untuk melakukan retry sendiri.
 *
 * Env var yang dipakai (dari file JSON Service Account yang SAMA dengan
 * lib/firebase-admin.js BOLEH dipakai ulang, atau Service Account terpisah
 * khusus akses Sheets — keduanya sah, asal Service Account punya izin
 * "Editor" pada Google Sheet target):
 *   - GOOGLE_SHEETS_CLIENT_EMAIL
 *   - GOOGLE_SHEETS_PRIVATE_KEY
 *   - GOOGLE_SHEET_ID
 */

import { google } from "googleapis";

const SHEET_RANGE = "Orders!A:J";

function assertEnv() {
  const missing = [];
  if (!process.env.GOOGLE_SHEETS_CLIENT_EMAIL) missing.push("GOOGLE_SHEETS_CLIENT_EMAIL");
  if (!process.env.GOOGLE_SHEETS_PRIVATE_KEY) missing.push("GOOGLE_SHEETS_PRIVATE_KEY");
  if (!process.env.GOOGLE_SHEET_ID) missing.push("GOOGLE_SHEET_ID");
  if (missing.length > 0) {
    throw new Error(
      `Google Sheets: environment variable belum diset: ${missing.join(", ")}`
    );
  }
}

function getPrivateKey() {
  return (process.env.GOOGLE_SHEETS_PRIVATE_KEY || "").replace(/\\n/g, "\n");
}

let cachedSheetsClient = null;

/**
 * Buat (atau pakai ulang) client Sheets API terautentikasi.
 * Di-cache di module scope supaya tidak re-auth JWT di setiap request
 * dalam siklus hidup instance serverless yang sama.
 */
async function getSheetsClient() {
  if (cachedSheetsClient) return cachedSheetsClient;

  assertEnv();

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    key: getPrivateKey(),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  await auth.authorize();

  cachedSheetsClient = google.sheets({ version: "v4", auth });
  return cachedSheetsClient;
}

/**
 * Tambahkan satu baris transaksi sukses ke Google Sheets.
 *
 * @param {{
 *   order_id: string,
 *   created_at: string,          // ISO string
 *   customer_name: string,
 *   customer_phone: string,
 *   items: Array<{ name: string, qty: number }>,
 *   total_amount: number,
 *   payment_status: string,
 *   midtrans_transaction_id: string,
 *   payment_type: string,
 *   store_name: string,
 * }} orderData
 *
 * @throws akan melempar error apa adanya jika append gagal (lihat catatan
 *         di atas file ini soal kenapa ini disengaja).
 */
export async function appendOrderToSheets(orderData) {
  const sheets = await getSheetsClient();

  const itemsSummary = orderData.items
    .map((item) => `${item.name} (x${item.qty})`)
    .join(", ");

  const row = [
    orderData.order_id,
    orderData.created_at,
    orderData.customer_name,
    orderData.customer_phone,
    itemsSummary,
    orderData.total_amount,
    orderData.payment_status,
    orderData.midtrans_transaction_id,
    orderData.payment_type || "",
    orderData.store_name || "",
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEET_ID,
    range: SHEET_RANGE,
    valueInputOption: "USER_ENTERED",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      majorDimension: "ROWS",
      values: [row],
    },
  });
}