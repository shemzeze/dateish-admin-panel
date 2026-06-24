import { useEffect } from "react";
import { useEnv } from "../context/EnvContext";
import { collection, onSnapshot, query, where } from "firebase/firestore";

export default function ReportsBadgeWatcher({
  firebase,
  env,
  setSectionBadges,
}) {
  const envCtx = useEnv();
  const resolvedFirebase = firebase ?? envCtx.firebase;
  const firestore = resolvedFirebase.firestore;
  void env;

  useEffect(() => {
    if (!setSectionBadges) return;

    const reportsRef = collection(firestore, "moderationReports");
    const openReportsQuery = query(reportsRef, where("status", "==", "open"));

    const unsubscribe = onSnapshot(
      openReportsQuery,
      (snapshot) => {
        setSectionBadges((prev) => ({
          ...prev,
          reports: snapshot.size,
        }));
      },
      (err) => {
        console.error("Failed to watch reports badge:", err);
        setSectionBadges((prev) => ({
          ...prev,
          reports: 0,
        }));
      },
    );

    return () => unsubscribe();
  }, [firestore, setSectionBadges]);

  return null;
}
