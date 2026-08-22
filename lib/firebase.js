import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "tokosedes-prod",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const hasClientConfig = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.authDomain &&
  firebaseConfig.projectId &&
  firebaseConfig.appId
);

const app = getApps().length > 0
  ? getApps()[0]
  : initializeApp(firebaseConfig);

// Keep the module import-safe when a deployment is missing a public Firebase
// variable. The UI can show a useful setup message instead of crashing blank.
export const firebaseConfigReady = hasClientConfig;
export const db = getFirestore(app);
export const storage = getStorage(app);

// Firebase Auth must only initialize in the browser. During Next.js prerender/build,
// public Firebase env vars may not be available and getAuth validates the API key.
export const auth = typeof window === "undefined" || !hasClientConfig
  ? null
  : getAuth(app);
