import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "../context/EnvContext";
import {
  collection,
  onSnapshot,
  query,
  limit,
  orderBy,
  where,
} from "firebase/firestore";

const MM_ADMIN_UID = "3GnLuPEnVwVCjuWXraREBJnVGfS2";
const MM_ARCHIVED_STORAGE_KEY = "dateish_admin_mm_archived_chat_ids";
const MM_HIDDEN_STORAGE_KEY = "dateish_admin_mm_hidden_chat_ids";

function readStoredIds(storageKey) {
  try {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getChatUpdatedAtMs(chat) {
  const updatedAt = chat?.updatedAt;

  if (updatedAt?.seconds) {
    return updatedAt.seconds * 1000;
  }

  if (updatedAt instanceof Date) {
    return updatedAt.getTime();
  }

  return 0;
}

export default function MMChatBadgeWatcher({
  firebase,
  env,
  setSectionBadges,
}) {
  const envCtx = useEnv();
  const resolvedFirebase = firebase ?? envCtx.firebase;
  const firestore = resolvedFirebase.firestore;
  const [chats, setChats] = useState([]);
  const [latestByChatId, setLatestByChatId] = useState({});
  const latestUnsubsRef = useRef([]);

  useEffect(() => {
    const chatsCol = collection(firestore, "chats");
    const q = query(chatsCol, where("chatType", "==", "mm_admin"));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .sort((a, b) => getChatUpdatedAtMs(b) - getChatUpdatedAtMs(a));

        setChats(rows);

        latestUnsubsRef.current.forEach((fn) => fn && fn());
        latestUnsubsRef.current = [];

        rows.forEach((chat) => {
          const msgsCol = collection(firestore, "chats", chat.id, "messages");
          const latestQ = query(
            msgsCol,
            orderBy("createdAt", "desc"),
            limit(1),
          );

          const unsubLatest = onSnapshot(
            latestQ,
            (snap) => {
              const latestDoc = snap.docs[0];
              const latestMessage = latestDoc
                ? { id: latestDoc.id, ...latestDoc.data() }
                : null;

              setLatestByChatId((prev) => ({
                ...prev,
                [chat.id]: latestMessage,
              }));
            },
            () => {
              setLatestByChatId((prev) => ({
                ...prev,
                [chat.id]: null,
              }));
            },
          );

          latestUnsubsRef.current.push(unsubLatest);
        });
      },
      (err) => {
        console.error("Failed to watch MM chats for badge:", err);
      },
    );

    return () => {
      unsub();
      latestUnsubsRef.current.forEach((fn) => fn && fn());
      latestUnsubsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firestore]);

  const unansweredCount = useMemo(() => {
    const archivedChatIds = readStoredIds(MM_ARCHIVED_STORAGE_KEY);
    const hiddenChatIds = readStoredIds(MM_HIDDEN_STORAGE_KEY);

    const visibleActiveChats = chats.filter(
      (chat) =>
        !hiddenChatIds.includes(chat.id) && !archivedChatIds.includes(chat.id),
    );

    return visibleActiveChats.filter((chat) => {
      const latest = latestByChatId[chat.id];
      if (!latest) return false;

      return (
        latest.sender &&
        latest.sender !== MM_ADMIN_UID &&
        latest.from !== "admin" &&
        latest.from !== "bartender"
      );
    }).length;
  }, [chats, latestByChatId]);

  useEffect(() => {
    if (!setSectionBadges) return;

    setSectionBadges((prev) => ({
      ...prev,
      mmChat: unansweredCount,
    }));
  }, [unansweredCount, setSectionBadges]);

  return null;
}
