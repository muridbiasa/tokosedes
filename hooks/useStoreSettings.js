"use client";

import { useEffect, useState } from "react";
import { subscribeActiveProfile, profileDoc, DEFAULT_PROFILE_SETTINGS, profileSettings } from "@/lib/storeProfiles";
import { db } from "@/lib/firebase";
import { doc, onSnapshot } from "firebase/firestore";

export function useStoreSettings() {
  const [storeId, setStoreId] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => subscribeActiveProfile(setStoreId, setError), []);
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
