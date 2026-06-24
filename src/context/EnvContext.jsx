import { createContext, useContext } from "react";

/**
 * EnvContext – provides the currently selected environment and its Firebase services.
 *
 * Provider lives in App.jsx.
 * Consumers: call useEnv() to get { currentEnv, firebase }
 *   where firebase = { app, db, auth, firestore, storage, label, config }
 */
export const EnvContext = createContext(null);

export function useEnv() {
  const ctx = useContext(EnvContext);
  if (!ctx) {
    throw new Error("useEnv must be used inside <EnvContext.Provider>");
  }
  return ctx;
}
