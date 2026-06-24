import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const devFirebaseConfig = {
  apiKey: "AIzaSyCg1OU0SnYuMh2wtTulYb_7AkbvSrIBA4U",
  authDomain: "dateish-4edf2.firebaseapp.com",
  databaseURL: "https://dateish-4edf2-default-rtdb.firebaseio.com",
  projectId: "dateish-4edf2",
  storageBucket: "dateish-4edf2.firebasestorage.app",
  messagingSenderId: "482953150124",
  appId: "1:482953150124:web:4d399f3f29df4ee81c2909",
  measurementId: "G-QPKETCCN0Z",
};

const prodFirebaseConfig = {
  apiKey: "AIzaSyAKROwoy0E_o5lbjDU7VZvPisNQV-LCBm4",
  authDomain: "five-to-five.firebaseapp.com",
  databaseURL:
    "https://five-to-five-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "five-to-five",
  storageBucket: "five-to-five.firebasestorage.app",
  messagingSenderId: "339604049664",
  appId: "1:339604049664:web:766b1df321351d14d96de5",
  measurementId: "G-SM5368GGEQ",
};

function getOrCreateFirebaseApp(name, config) {
  const existingApp = getApps().find((app) => app.name === name);

  if (existingApp) {
    return existingApp;
  }

  return initializeApp(config, name);
}

const devApp = getOrCreateFirebaseApp("dev", devFirebaseConfig);
const prodApp = getOrCreateFirebaseApp("prod", prodFirebaseConfig);

export const firebaseEnvs = {
  dev: {
    label: "DEV",
    app: devApp,
    db: getDatabase(devApp),
    auth: getAuth(devApp),
    firestore: getFirestore(devApp),
    storage: getStorage(devApp),
    config: devFirebaseConfig,
  },

  prod: {
    label: "PROD",
    app: prodApp,
    db: getDatabase(prodApp),
    auth: getAuth(prodApp),
    firestore: getFirestore(prodApp),
    storage: getStorage(prodApp),
    config: prodFirebaseConfig,
  },
};

// Default exports for old admin-panel code.
// This keeps your existing imports working:
//
// import { db, auth, firestore, storage } from "./firebase";
//
// By default, they point to DEV.
// ⚠️  DEPRECATED — static exports below ALWAYS point to the DEV project.
// ⚠️  Do NOT use these in any env-aware admin code.
// ⚠️  Use getFirebaseEnv(env) or useEnv() (EnvContext) instead.
// ⚠️  These only exist to prevent accidental import-time crashes.
export const db = firebaseEnvs.dev.db;
export const auth = firebaseEnvs.dev.auth;
export const firestore = firebaseEnvs.dev.firestore;
export const storage = firebaseEnvs.dev.storage;

// Helper for new code.
export function getFirebaseEnv(env) {
  return firebaseEnvs[env] || firebaseEnvs.dev;
}
