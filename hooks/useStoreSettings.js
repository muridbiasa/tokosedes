"use client";

import { useEffect, useState } from "react";
import { subscribeActiveProfile, profileDoc, DEFAULT_PROFILE_SETTINGS, profileSettings } from "@/lib/storeProfiles";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

/**
 * useStoreSettings(preferredId?)
 *
 * Tanpa argumen: mengikuti toko aktif (settings/active_store).
 * Dengan preferredId: mengikat ke toko tersebut secara eksplisit —
 * dipakai halaman editor agar ?storeId=... di URL dihormati, sehingga
 * "Kelola toko X" benar-benar membuka toko X, bukan toko aktif lain.
 */
export function useStoreSettings(preferredId) {
  const [activeFromDb, setActiveFromDb] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => subscribeActiveProfile(setActiveFromDb, setError), []);

  const storeId = preferredId || activeFromDb;

  useEffect(() => {
    if (!storeId) {
      setSettings(null);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    return onSnapshot(profileDoc(storeId), (snapshot) => {
      const data = snapshot.exists() ? snapshot.data() : {};
      setSettings(profileSettings({ settings: data.settings || data }));
      setLoading(false);
    }, (err) => {
      setError(err);
      setSettings(DEFAULT_PROFILE_SETTINGS);
      setLoading(false);
    });
  }, [storeId]);

  return { settings, storeId, loading, error };
}

export { profileSettings };
