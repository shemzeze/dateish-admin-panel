import { useCallback, useEffect, useRef, useState } from "react";
import { ref, onValue } from "firebase/database";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  limit,
  where,
} from "firebase/firestore";

// Must match the mobile app constants
const DEV_MM_ADMIN_UID = "3tfmm4f6FDbnmpW4zhPtc5mT9Ps2";
const PROD_MM_ADMIN_UID = "y7RI2gfS6EcZjeJoVqUunntpCRR2";

function getMmAdminUid(env) {
  return env === "prod" ? PROD_MM_ADMIN_UID : DEV_MM_ADMIN_UID;
}

function getStorageKey(env) {
  return `admin_alerts_enabled_${env}`;
}

function readEnabled(env) {
  try {
    return localStorage.getItem(getStorageKey(env)) !== "false";
  } catch {
    return true;
  }
}

function writeEnabled(env, val) {
  try {
    localStorage.setItem(getStorageKey(env), val ? "true" : "false");
  } catch {
    /* ignore */
  }
}

function playSound(src) {
  try {
    const audio = new Audio(src);
    audio.play().catch(() => {});
  } catch {
    /* ignore — browser may block autoplay */
  }
}

function getNotifPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

let _toastIdCounter = 0;

/**
 * useAdminAlerts
 *
 * Provides real-time admin alerts for:
 *   - Real users coming online in the bar (RTDB /status)
 *   - Real users sending new messages to MM (Firestore chats)
 *
 * Returns everything needed by AdminAlertsPanel + a toast overlay.
 *
 * @param {object} params
 * @param {object} params.firebase - The current env Firebase object from EnvContext
 * @param {string} params.currentEnv - "dev" | "prod"
 * @param {object|null} params.adminUser - Firebase auth user (null when signed out)
 */
export function useAdminAlerts({ firebase, currentEnv, adminUser }) {
  const [enabled, setEnabledState] = useState(() => readEnabled(currentEnv));
  const [notifPermission, setNotifPermission] = useState(getNotifPermission);
  const [toasts, setToasts] = useState([]);

  // Refs that survive re-renders without triggering re-runs
  const toastTimersRef = useRef({});
  const currentlyOnlineRef = useRef(new Set());
  const onlineInitializedRef = useRef(false);
  const seenMsgIdsRef = useRef(new Set());
  const activeChatListenersRef = useRef(new Set());
  const perChatUnsubsRef = useRef([]);
  const userNameCacheRef = useRef(new Map());

  // Keep enabled in sync with env changes (env switching re-reads localStorage)
  useEffect(() => {
    setEnabledState(readEnabled(currentEnv));
  }, [currentEnv]);

  useEffect(() => {
    userNameCacheRef.current = new Map();
  }, [currentEnv]);

  const setEnabled = useCallback(
    (val) => {
      setEnabledState(val);
      writeEnabled(currentEnv, val);
    },
    [currentEnv],
  );

  // Re-sync notification permission when window gains focus
  useEffect(() => {
    const onFocus = () => setNotifPermission(getNotifPermission());
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  // ── Toasts ──────────────────────────────────────────────────────────────────

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = toastTimersRef.current[id];
    if (timer) {
      clearTimeout(timer);
      delete toastTimersRef.current[id];
    }
  }, []);

  const addToast = useCallback(
    (toast) => {
      const id = ++_toastIdCounter;
      setToasts((prev) => [...prev.slice(-9), { ...toast, id }]); // cap at 10
      toastTimersRef.current[id] = setTimeout(() => dismissToast(id), 8000);
    },
    [dismissToast],
  );

  // ── Core alert trigger ───────────────────────────────────────────────────────

  const triggerAdminAlert = useCallback(
    ({ title, body, type, chatId, notificationTitle, notificationBody }) => {
      const finalNotificationTitle = notificationTitle || title;
      const finalNotificationBody = notificationBody || body;

      // 1. Sound
      const soundSrc =
        type === "mm-message"
          ? "/sounds/admin-mm-message.mp3"
          : "/sounds/admin-online.mp3";
      playSound(soundSrc);

      // 2. Browser notification (only if permission granted)
      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted"
      ) {
        const tag = `admin-alert-${type}-${Date.now()}`;
        const notifOptions = {
          body: finalNotificationBody,
          icon: "/favicon.ico",
          tag,
          requireInteraction: false,
        };

        const showPageNotification = () => {
          try {
            const n = new Notification(finalNotificationTitle, notifOptions);
            n.onerror = (e) => {
              console.warn("[AdminAlerts] Page notification failed:", e);
            };
          } catch (err) {
            console.warn("[AdminAlerts] Page notification threw:", err);
          }
        };

        // Modern Chrome requires showNotification() via a service worker to
        // reliably display OS-level notifications in background tabs.
        // Do not gate on `controller`; in dev that is often null while
        // `ready` still resolves to an active registration.
        if (navigator.serviceWorker) {
          navigator.serviceWorker
            .getRegistration()
            .then((reg) => {
              if (reg) {
                return reg
                  .showNotification(finalNotificationTitle, notifOptions)
                  .catch((err) => {
                    console.warn(
                      "[AdminAlerts] SW showNotification failed:",
                      err,
                    );
                    showPageNotification();
                  });
              }

              // No SW registration for this scope: fall back immediately.
              showPageNotification();

              return null;
            })
            .catch((err) => {
              console.warn("[AdminAlerts] SW notification failed:", err);
              showPageNotification();
            });
        } else {
          showPageNotification();
        }
      }

      // 3. In-panel fallback toast
      addToast({ title, body, type, chatId, createdAt: Date.now() });
    },
    [addToast],
  );

  const requestNotifPermission = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    try {
      const perm = await Notification.requestPermission();
      setNotifPermission(perm);
    } catch {
      /* ignore */
    }
  }, []);

  // ── RTDB online presence listener ───────────────────────────────────────────

  useEffect(() => {
    if (!adminUser || !enabled || !firebase?.db) return;

    const mmAdminUid = getMmAdminUid(currentEnv);
    const adminUid = adminUser.uid;

    // Reset tracking
    currentlyOnlineRef.current = new Set();
    onlineInitializedRef.current = false;

    const statusRef = ref(firebase.db, "status");

    const unsub = onValue(
      statusRef,
      async (snapshot) => {
        const statusMap = snapshot.val() || {};

        // Build set of currently online-in-bar UIDs
        const newOnlineSet = new Set();
        Object.entries(statusMap).forEach(([uid, status]) => {
          if (status?.online && status?.bar) newOnlineSet.add(uid);
        });

        // First snapshot: record baseline without alerting
        if (!onlineInitializedRef.current) {
          currentlyOnlineRef.current = newOnlineSet;
          onlineInitializedRef.current = true;
          return;
        }

        // Alert for UIDs that just came online
        for (const uid of newOnlineSet) {
          if (currentlyOnlineRef.current.has(uid)) continue; // already was online
          if (uid === adminUid || uid === mmAdminUid) continue; // skip admin/MM

          // Try to resolve display name
          let displayName =
            statusMap[uid]?.displayName || statusMap[uid]?.name || "";

          if (!displayName) {
            try {
              const snap = await getDoc(doc(firebase.firestore, "users", uid));
              if (snap.exists()) {
                const d = snap.data();
                displayName = d.name || d.username || d.displayName || "";
              }
            } catch {
              /* use UID as fallback */
            }
          }

          triggerAdminAlert({
            title: "User came online",
            body: `${displayName || uid} came online`,
            type: "online",
            uid,
          });
        }

        currentlyOnlineRef.current = newOnlineSet;
      },
      (err) => {
        console.error("[AdminAlerts] RTDB status error:", err);
      },
    );

    return () => {
      unsub();
      onlineInitializedRef.current = false;
      currentlyOnlineRef.current = new Set();
    };
  }, [adminUser, enabled, firebase, currentEnv, triggerAdminAlert]);

  // ── MM message listener ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!adminUser || !enabled || !firebase?.firestore) return;

    const mmAdminUid = getMmAdminUid(currentEnv);

    // Reset per-run tracking
    perChatUnsubsRef.current.forEach((fn) => fn && fn());
    perChatUnsubsRef.current = [];
    seenMsgIdsRef.current = new Set();
    activeChatListenersRef.current = new Set();

    // Tracks whether the initial chats snapshot has been processed.
    // Chats added AFTER initialization are "new" and their first messages
    // should trigger alerts.
    let chatsInitialized = false;

    const chatsCol = collection(firebase.firestore, "chats");
    const chatsQ = query(chatsCol, where("chatType", "==", "mm_admin"));

    const unsubChats = onSnapshot(
      chatsQ,
      (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added") return;

          const chatId = change.doc.id;
          const chatData = change.doc.data();

          // isPreExisting = true when this chat was there before admin started listening
          const isPreExisting = !chatsInitialized;

          if (activeChatListenersRef.current.has(chatId)) return;
          activeChatListenersRef.current.add(chatId);

          const msgsCol = collection(
            firebase.firestore,
            "chats",
            chatId,
            "messages",
          );
          const msgsQ = query(msgsCol, orderBy("createdAt", "desc"), limit(10));

          let isFirstMsgSnapshot = true;

          const unsubMsgs = onSnapshot(
            msgsQ,
            (msgSnap) => {
              if (isFirstMsgSnapshot) {
                isFirstMsgSnapshot = false;

                if (isPreExisting) {
                  // Pre-existing chat: mark all currently visible messages as
                  // seen so they don't trigger alerts later.
                  msgSnap.docs.forEach((d) => seenMsgIdsRef.current.add(d.id));
                  return;
                }
                // New chat (created after admin started listening): fall
                // through so the first messages can trigger alerts below.
              }

              msgSnap.docChanges().forEach(async (change) => {
                if (change.type !== "added") return;

                const msgId = change.doc.id;
                if (seenMsgIdsRef.current.has(msgId)) return;
                seenMsgIdsRef.current.add(msgId);

                const msg = change.doc.data();

                // Skip messages from MM/admin
                const isFromMM =
                  msg.sender === mmAdminUid ||
                  msg.from === "bartender" ||
                  msg.from === "admin" ||
                  msg.senderRole === "mm";

                if (isFromMM) return;

                // Resolve display name for the alert body
                const partnerUid = Array.isArray(chatData?.users)
                  ? chatData.users.find((u) => u !== mmAdminUid) || ""
                  : "";

                const displayName =
                  msg.senderName ||
                  chatData?.partnerName ||
                  partnerUid ||
                  "Unknown user";

                const senderUid =
                  typeof msg?.sender === "string" && msg.sender
                    ? msg.sender
                    : partnerUid;

                let resolvedDisplayName = displayName;

                if (senderUid) {
                  const cachedName = userNameCacheRef.current.get(senderUid);
                  if (cachedName) {
                    resolvedDisplayName = cachedName;
                  } else if (!displayName || displayName === senderUid) {
                    try {
                      const senderSnap = await getDoc(
                        doc(firebase.firestore, "users", senderUid),
                      );

                      if (senderSnap.exists()) {
                        const senderData = senderSnap.data();
                        const fetchedName =
                          senderData?.name ||
                          senderData?.username ||
                          senderData?.displayName ||
                          "";

                        if (fetchedName) {
                          userNameCacheRef.current.set(senderUid, fetchedName);
                          resolvedDisplayName = fetchedName;
                        }
                      }
                    } catch {
                      // Keep fallback displayName if profile lookup fails.
                    }
                  }
                }

                const rawMessageText =
                  msg?.text ||
                  msg?.message ||
                  msg?.body ||
                  chatData?.lastMessageText ||
                  "";

                const normalizedMessageText = String(rawMessageText).trim();
                const previewLimit = 120;
                const messagePreview = normalizedMessageText
                  ? normalizedMessageText.slice(0, previewLimit) +
                    (normalizedMessageText.length > previewLimit ? "..." : "")
                  : "(no text)";

                triggerAdminAlert({
                  // Toast format (in-panel)
                  title: "New MM message",
                  body: `From ${resolvedDisplayName}: ${messagePreview}`,
                  // Browser notification format
                  notificationTitle: `New MM message from ${resolvedDisplayName}`,
                  notificationBody: messagePreview,
                  type: "mm-message",
                  chatId,
                });
              });
            },
            (err) => {
              console.error(
                `[AdminAlerts] MM messages error (chat ${chatId}):`,
                err,
              );
            },
          );

          perChatUnsubsRef.current.push(unsubMsgs);
        });

        // Mark initialization complete after first snapshot is processed
        chatsInitialized = true;
      },
      (err) => {
        console.error("[AdminAlerts] MM chats error:", err);
      },
    );

    return () => {
      unsubChats();
      perChatUnsubsRef.current.forEach((fn) => fn && fn());
      perChatUnsubsRef.current = [];
      seenMsgIdsRef.current = new Set();
      activeChatListenersRef.current = new Set();
    };
  }, [adminUser, enabled, firebase, currentEnv, triggerAdminAlert]);

  return {
    enabled,
    setEnabled,
    notifPermission,
    toasts,
    dismissToast,
    triggerAdminAlert,
    requestNotifPermission,
  };
}
