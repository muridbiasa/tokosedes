import { db } from "@/lib/firebase";
import {
  collection,
  doc,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

export const DEFAULT_PROFILE_ID = "tokosedes-prod";

export const DEFAULT_PROFILE_SETTINGS = {
  storeName: "Toko Sedes",
  description: "Kaos & merch custom, produksi mingguan.",
  themeColor: "#f59e0b",
  fontFamily: "sans-serif",
  headerMode: "solid",
  headerValue: "",
  isStoreOpen: true,
  closedMessage: "Maaf, toko sedang tidak menerima pesanan saat ini.",
  catalogGridSize: "medium",
  custom_form_fields: [],
};

export function normalizeProfile(id, data = {}) {
  return {
    id,
    name: data.name || data.storeName || id,
    enabled: data.enabled ?? data.is_active ?? true,
    created_at: data.created_at || null,
    settings: { ...DEFAULT_PROFILE_SETTINGS, ...data.settings, ...data },
  };
}

export function subscribeProfiles(callback, onError) {
  return onSnapshot(query(collection(db, "store_profiles")), (snapshot) => {
    const profiles = snapshot.docs.map((item) => normalizeProfile(item.id, item.data()));
    callback(profiles.sort((a, b) => a.name.localeCompare(b.name)));
  }, onError);
}

export function subscribeActiveProfile(callback, onError) {
  return onSnapshot(doc(db, "settings", "active_store"), (snapshot) => {
    callback(snapshot.exists() ? snapshot.data()?.storeId || DEFAULT_PROFILE_ID : DEFAULT_PROFILE_ID);
  }, onError);
}

export async function createProfile(name) {
  const id = `${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || "store"}-${Date.now().toString(36)}`;
  await setDoc(doc(db, "store_profiles", id), {
    name: name.trim(),
    enabled: true,
    settings: { ...DEFAULT_PROFILE_SETTINGS, storeName: name.trim() },
    created_at: serverTimestamp(),
    updated_at: serverTimestamp(),
  });
  return id;
}

export async function setActiveProfile(storeId) {
  await setDoc(doc(db, "settings", "active_store"), { storeId, updated_at: serverTimestamp() }, { merge: true });
}

export async function updateProfile(storeId, patch) {
  await setDoc(doc(db, "store_profiles", storeId), { ...patch, updated_at: serverTimestamp() }, { merge: true });
}

export async function updateProfileSettings(storeId, settings) {
  await setDoc(doc(db, "store_profiles", storeId), {
    name: settings.storeName || storeId,
    enabled: true,
    settings,
    updated_at: serverTimestamp(),
  }, { merge: true });
}

export function profileSettings(profile) {
  return { ...DEFAULT_PROFILE_SETTINGS, ...(profile?.settings || {}) };
}

export function getProfileProductsPath(storeId) {
  return ["stores", storeId, "products"];
}

export function isUnlimitedStock(stock) {
  return Number(stock || 0) === 0;
}

export function stockAllows(stock, quantity) {
  return isUnlimitedStock(stock) || quantity <= Number(stock);
}

export function getGridClasses(size) {
  switch (size) {
    case "small": return "grid-cols-2 md:grid-cols-4";
    case "large": return "grid-cols-1 md:grid-cols-2";
    case "carousel": return "flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [&>*]:min-w-[78%] sm:[&>*]:min-w-[42%]";
    default: return "grid-cols-1 sm:grid-cols-2";
  }
}

export function safePhone(value) {
  return String(value || "").replace(/[^0-9+]/g, "");
}

export function isValidPhone(value) {
  return /^\+?[0-9]{8,15}$/.test(String(value || ""));
}

export function toCsv(rows) {
  const keys = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  const quote = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  return [keys.map(quote).join(","), ...rows.map((row) => keys.map((key) => quote(row[key])).join(","))].join("\n");
}

export { serverTimestamp };

// Kept for legacy imports that still expect a single-store settings hook.
export const profileDoc = (storeId) => doc(db, "store_profiles", storeId);
