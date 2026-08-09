/**
 * lib/driveImageConverter.js
 *
 * Utility untuk mengonversi berbagai format link Google Drive menjadi
 * direct image URL yang bisa langsung dirender di tag <img>.
 *
 * Referensi PRD - Do's:
 * "Auto-convert Link Drive: Form Builder harus otomatis mengubah format
 *  link Google Drive menjadi link direktori gambar yang bisa dirender HTML
 *  (lh3.googleusercontent.com/d/FILE_ID)."
 *
 * Mendukung format input:
 *  - https://drive.google.com/file/d/FILE_ID/view?usp=sharing
 *  - https://drive.google.com/open?id=FILE_ID
 *  - https://drive.google.com/uc?id=FILE_ID&export=download
 *  - https://lh3.googleusercontent.com/d/FILE_ID  (sudah terkonversi, pass-through)
 *  - URL gambar eksternal biasa (bukan Drive)      (pass-through)
 */

const DRIVE_ID_PATTERNS = [
  /\/file\/d\/([a-zA-Z0-9_-]{10,})/, // .../file/d/FILE_ID/view
  /[?&]id=([a-zA-Z0-9_-]{10,})/, // ...?id=FILE_ID atau uc?id=FILE_ID
  /\/d\/([a-zA-Z0-9_-]{10,})/, // lh3.googleusercontent.com/d/FILE_ID
];

/**
 * Ekstrak FILE_ID dari berbagai bentuk URL Google Drive.
 * @param {string} url
 * @returns {string|null}
 */
export function extractDriveFileId(url) {
  if (!url || typeof url !== "string") return null;

  for (const pattern of DRIVE_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

function isGoogleDriveUrl(url) {
  return /drive\.google\.com|googleusercontent\.com/.test(url || "");
}

/**
 * Konversi link Google Drive (share link) menjadi direct image URL.
 * Jika input bukan link Drive (mis. Admin menempel URL gambar eksternal),
 * dikembalikan apa adanya (pass-through) supaya tetap fleksibel.
 *
 * @param {string} rawUrl - Link yang dimasukkan Admin
 * @returns {{
 *   url: string,
 *   isValid: boolean,
 *   fileId: string|null,
 *   source: 'drive' | 'external' | 'empty'
 * }}
 */
export function convertDriveLinkToDirectUrl(rawUrl) {
  const trimmed = (rawUrl || "").trim();

  if (!trimmed) {
    return { url: "", isValid: false, fileId: null, source: "empty" };
  }

  if (!isGoogleDriveUrl(trimmed)) {
    return { url: trimmed, isValid: true, fileId: null, source: "external" };
  }

  const fileId = extractDriveFileId(trimmed);

  if (!fileId) {
    // Link Drive tapi format tidak dikenali / FILE_ID tidak ditemukan.
    return { url: trimmed, isValid: false, fileId: null, source: "drive" };
  }

  return {
    url: `https://lh3.googleusercontent.com/d/${fileId}`,
    isValid: true,
    fileId,
    source: "drive",
  };
}

/**
 * Helper singkat kalau hanya butuh string URL-nya saja.
 * @param {string} rawUrl
 * @returns {string}
 */
export function toDirectImageUrl(rawUrl) {
  return convertDriveLinkToDirectUrl(rawUrl).url;
}
