"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";

/**
 * useStoreSettings Hook
 * Fetches store settings from Firestore collection: settings, document: store_info
 * 
 * Expected Firestore structure:
 * Collection: settings
 * Document ID: store_info
 * Fields:
 *   - storeName (string)
 *   - description (string)
 *   - themeColor (string, hex code e.g., "#3b82f6")
 *   - isStoreOpen (boolean)
 *   - catalogGridSize (string: "small" | "medium" | "large")
 */
export function useStoreSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const settingsRef = doc(db, "settings", "store_info");
        const settingsSnap = await getDoc(settingsRef);

        if (settingsSnap.exists()) {
          const data = settingsSnap.data();
          setSettings({
            storeName: data.storeName || "Toko Budi",
            description: data.description || "",
            themeColor: data.themeColor || "#f59e0b", // default amber-500
            isStoreOpen: data.isStoreOpen ?? true,
            catalogGridSize: data.catalogGridSize || "medium",
          });
        } else {
          // Fallback defaults if document doesn't exist
          setSettings({
            storeName: "Toko Budi",
            description: "Kaos & merch custom, produksi mingguan.",
            themeColor: "#f59e0b",
            isStoreOpen: true,
            catalogGridSize: "medium",
          });
        }
      } catch (err) {
        console.error("Failed to fetch store settings:", err);
        setError(err);
        // Fallback defaults on error
        setSettings({
          storeName: "Toko Budi",
          description: "Kaos & merch custom, produksi mingguan.",
          themeColor: "#f59e0b",
          isStoreOpen: true,
          catalogGridSize: "medium",
        });
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, []);

  return { settings, loading, error };
}

/**
 * Get grid classes based on catalogGridSize setting
 * @param {string} size - "small" | "medium" | "large"
 * @returns {string} Tailwind grid classes
 */
export function getGridClasses(size) {
  switch (size) {
    case "small":
      return "grid-cols-2 md:grid-cols-4";
    case "large":
      return "grid-cols-1 md:grid-cols-2";
    case "medium":
    default:
      return "grid-cols-1 sm:grid-cols-2";
  }
}
