import { useEffect, useMemo, useRef, useState } from "react";
import { useEnv } from "../context/EnvContext";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  limit,
  orderBy,
  setDoc,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { ref as dbRef, get } from "firebase/database";

function confirmProdAction(env, actionName) {
  if (env !== "prod") return true;
  return window.confirm(
    `You are about to ${actionName} in PROD. Are you sure?`,
  );
}

// These MUST match the mobile app constants/bar2Constants.ts
const DEV_MM_ADMIN_UID = "3tfmm4f6FDbnmpW4zhPtc5mT9Ps2";
const PROD_MM_ADMIN_UID = "y7RI2gfS6EcZjeJoVqUunntpCRR2";

function getMmAdminUid(env) {
  return env === "prod" ? PROD_MM_ADMIN_UID : DEV_MM_ADMIN_UID;
}

const MM_ARCHIVED_STORAGE_KEY = "dateish_admin_mm_archived_chat_ids";
const MM_HIDDEN_STORAGE_KEY = "dateish_admin_mm_hidden_chat_ids";
const MOBILE_BREAKPOINT = 768;

function isMmMessage(message, mmAdminUid) {
  return (
    message?.from === "bartender" ||
    message?.from === "admin" ||
    message?.sender === mmAdminUid ||
    message?.senderRole === "mm"
  );
}

function formatTime(value) {
  if (!value) return "";

  try {
    const date =
      typeof value?.toDate === "function" ? value.toDate() : new Date(value);

    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
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

function getPossibleAvatarValue(profileData) {
  return (
    profileData?.photoUri ||
    profileData?.photoURL ||
    profileData?.avatarUrl ||
    profileData?.avatarURL ||
    profileData?.avatar ||
    profileData?.profilePic ||
    profileData?.profilePicture ||
    profileData?.image ||
    profileData?.imageUrl ||
    profileData?.imageURL ||
    profileData?.photo ||
    ""
  );
}

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

function writeStoredIds(storageKey, ids) {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch (err) {
    console.error(`Failed to write ${storageKey}:`, err);
  }
}

export default function MMChatPanel({ firebase, env, setSectionBadges }) {
  const envCtx = useEnv();
  const resolvedFirebase = firebase ?? envCtx.firebase;
  const resolvedEnv = env ?? envCtx.currentEnv;

  const MM_ADMIN_UID = getMmAdminUid(resolvedEnv);

  const firestore = resolvedFirebase.firestore;
  const db = resolvedFirebase.db;

  const [chats, setChats] = useState([]);
  const [profilesByUid, setProfilesByUid] = useState({});
  const [latestByChatId, setLatestByChatId] = useState({});
  const [selectedChatId, setSelectedChatId] = useState("");
  const [messages, setMessages] = useState([]);
  const [messageInput, setMessageInput] = useState("");
  const [loadingChats, setLoadingChats] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [listMode, setListMode] = useState("active");
  const [isMMAvailable, setIsMMAvailable] = useState(true);
  const [savingMMAvailable, setSavingMMAvailable] = useState(false);

  const [archivedChatIds, setArchivedChatIds] = useState(() =>
    readStoredIds(MM_ARCHIVED_STORAGE_KEY),
  );
  const [hiddenChatIds, setHiddenChatIds] = useState(() =>
    readStoredIds(MM_HIDDEN_STORAGE_KEY),
  );

  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined"
      ? window.innerWidth <= MOBILE_BREAKPOINT
      : false,
  );

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const latestUnsubsRef = useRef([]);
  const messagesBoxRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    writeStoredIds(MM_ARCHIVED_STORAGE_KEY, archivedChatIds);
  }, [archivedChatIds]);

  useEffect(() => {
    writeStoredIds(MM_HIDDEN_STORAGE_KEY, hiddenChatIds);
  }, [hiddenChatIds]);

  useEffect(() => {
    setLoadingChats(true);
    setError("");

    const chatsCol = collection(firestore, "chats");
    const q = query(chatsCol, where("chatType", "==", "mm_admin"));

    const unsub = onSnapshot(
      q,
      async (snapshot) => {
        const rows = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .sort((a, b) => getChatUpdatedAtMs(b) - getChatUpdatedAtMs(a));

        setChats(rows);
        setLoadingChats(false);

        const partnerUids = rows
          .map((chat) => {
            const users = Array.isArray(chat.users) ? chat.users : [];
            return users.find((uid) => uid !== MM_ADMIN_UID) || "";
          })
          .filter(Boolean);

        const uniquePartnerUids = [...new Set(partnerUids)];

        const nextProfiles = {};
        await Promise.all(
          uniquePartnerUids.map(async (uid) => {
            try {
              const userSnap = await getDoc(doc(firestore, "users", uid));
              let online = false;

              try {
                const onlineSnap = await get(dbRef(db, `status/${uid}/online`));
                online = onlineSnap.exists() ? !!onlineSnap.val() : false;
              } catch {
                online = false;
              }

              if (userSnap.exists()) {
                const data = userSnap.data();
                nextProfiles[uid] = {
                  uid,
                  name: data?.name || "",
                  username: data?.username || "",
                  age: data?.age || "",
                  location: data?.location || "",
                  oneLiner: data?.oneLiner || data?.bio || "",
                  avatarUrl: getPossibleAvatarValue(data),
                  online,
                };
              } else {
                nextProfiles[uid] = {
                  uid,
                  name: "",
                  username: "",
                  age: "",
                  location: "",
                  oneLiner: "",
                  avatarUrl: "",
                  online,
                };
              }
            } catch {
              nextProfiles[uid] = {
                uid,
                name: "",
                username: "",
                age: "",
                location: "",
                oneLiner: "",
                avatarUrl: "",
                online: false,
              };
            }
          }),
        );

        setProfilesByUid(nextProfiles);

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
        console.error("Failed to load MM chats:", err);
        setError(err.message || "Failed to load MM chats");
        setLoadingChats(false);
      },
    );

    return () => {
      unsub();
      latestUnsubsRef.current.forEach((fn) => fn && fn());
      latestUnsubsRef.current = [];
    };
  }, [firestore, db, MM_ADMIN_UID]);

  useEffect(() => {
    const mmConfigRef = doc(firestore, "appConfig", "mmChat");

    const unsub = onSnapshot(
      mmConfigRef,
      (snap) => {
        const data = snap.exists() ? snap.data() : null;
        if (typeof data?.isMMAvailable === "boolean") {
          setIsMMAvailable(data.isMMAvailable);
          return;
        }

        setIsMMAvailable(true);
      },
      (err) => {
        console.error("Failed to listen to MM availability:", err);
        setIsMMAvailable(true);
      },
    );

    return () => unsub();
  }, [firestore]);

  const visibleChats = useMemo(() => {
    return chats.filter((chat) => !hiddenChatIds.includes(chat.id));
  }, [chats, hiddenChatIds]);

  const activeChats = useMemo(() => {
    return visibleChats.filter((chat) => !archivedChatIds.includes(chat.id));
  }, [visibleChats, archivedChatIds]);

  const archivedChats = useMemo(() => {
    return visibleChats.filter((chat) => archivedChatIds.includes(chat.id));
  }, [visibleChats, archivedChatIds]);

  const currentChats = useMemo(() => {
    return listMode === "archived" ? archivedChats : activeChats;
  }, [listMode, archivedChats, activeChats]);

  useEffect(() => {
    if (loadingChats) return;

    if (currentChats.length === 0) {
      setSelectedChatId("");
      return;
    }

    const stillExists = currentChats.some((chat) => chat.id === selectedChatId);

    if (!stillExists) {
      setSelectedChatId(currentChats[0].id);
    }
  }, [currentChats, selectedChatId, loadingChats]);

  const selectedChat = useMemo(() => {
    return currentChats.find((chat) => chat.id === selectedChatId) || null;
  }, [currentChats, selectedChatId]);

  useEffect(() => {
    const safeSelectedChatId = selectedChat?.id || "";

    if (!safeSelectedChatId) {
      setMessages([]);
      setLoadingMessages(false);
      return;
    }

    setLoadingMessages(true);
    setError("");

    const msgsCol = collection(
      firestore,
      "chats",
      safeSelectedChatId,
      "messages",
    );
    const q = query(msgsCol, orderBy("createdAt", "asc"), limit(300));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const rows = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setMessages(rows);
        setLoadingMessages(false);
      },
      (err) => {
        console.error("Failed to load MM messages:", err);
        setError(err.message || "Failed to load messages");
        setMessages([]);
        setLoadingMessages(false);
      },
    );

    return () => unsub();
  }, [firestore, selectedChat]);

  useEffect(() => {
    if (!messagesBoxRef.current || loadingMessages) return;

    // Keep the newest message in view as snapshots update.
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, selectedChatId, loadingMessages]);

  const selectedPartnerUid = useMemo(() => {
    if (!selectedChat) return "";
    const users = Array.isArray(selectedChat.users) ? selectedChat.users : [];
    return users.find((uid) => uid !== MM_ADMIN_UID) || "";
  }, [selectedChat, MM_ADMIN_UID]);

  const selectedProfile = selectedPartnerUid
    ? profilesByUid[selectedPartnerUid]
    : null;

  const sendMessage = async () => {
    const text = messageInput.trim();
    const safeSelectedChatId = selectedChat?.id;

    if (!safeSelectedChatId || !text || sending) return;
    if (!confirmProdAction(resolvedEnv, "send a message to a user")) return;

    setSending(true);
    setError("");

    try {
      const msgsCol = collection(
        firestore,
        "chats",
        safeSelectedChatId,
        "messages",
      );

      const chatRef = doc(firestore, "chats", safeSelectedChatId);
      const nowMs = Date.now();

      const messagePayload = {
        from: "bartender",
        sender: MM_ADMIN_UID,
        senderId: MM_ADMIN_UID,
        uid: MM_ADMIN_UID,
        userId: MM_ADMIN_UID,
        senderRole: "mm",
        role: "mm",
        type: "mm",
        displayName: "Mr. Mingles",
        senderName: "Mr. Mingles",
        name: "Mr. Mingles",
        text,
        createdAt: serverTimestamp(),
        createdAtMs: nowMs,
        timestamp: serverTimestamp(),
        timestampMs: nowMs,
        adminSenderUid: resolvedFirebase.auth?.currentUser?.uid || "",
      };

      const chatUpdatePayload = {
        updatedAt: serverTimestamp(),
        updatedAtMs: nowMs,
        lastMessageText: text,
        lastMessage: text,
        lastText: text,
        lastSender: MM_ADMIN_UID,
        lastSenderId: MM_ADMIN_UID,
        lastMessageFrom: "bartender",
        lastMessageSender: MM_ADMIN_UID,
        lastMessageSenderId: MM_ADMIN_UID,
        lastMessageSenderRole: "mm",
        lastMessageSenderName: "Mr. Mingles",
        lastSenderName: "Mr. Mingles",
        lastSenderRole: "mm",
        lastMessageAt: serverTimestamp(),
        lastMessageAtMs: nowMs,
      };

      console.log("MM SEND DEBUG", {
        env: resolvedEnv,
        authUid: resolvedFirebase.auth?.currentUser?.uid,
        mmAdminUid: MM_ADMIN_UID,
        chatId: safeSelectedChatId,
        selectedPartnerUid,
        messagePayload,
        chatUpdatePayload,
      });

      const newMessageRef = doc(msgsCol);
      const batch = writeBatch(firestore);

      batch.set(newMessageRef, messagePayload);
      batch.update(chatRef, {
        ...chatUpdatePayload,
        lastMessageId: newMessageRef.id,
      });

      await batch.commit();

      setMessageInput("");
    } catch (err) {
      console.error("Failed to send MM message:", err);
      setError(err.message || "Failed to send message");
    }

    setSending(false);
  };

  const toggleMMAvailable = async () => {
    const nextValue = !isMMAvailable;

    if (
      !confirmProdAction(
        resolvedEnv,
        nextValue ? "mark MM as available" : "mark MM as away",
      )
    ) {
      return;
    }

    setSavingMMAvailable(true);

    try {
      await setDoc(
        doc(firestore, "appConfig", "mmChat"),
        {
          isMMAvailable: nextValue,
          updatedAt: serverTimestamp(),
        },
        { merge: true },
      );
    } catch (err) {
      console.error("Failed to update MM availability:", err);
      setError(err.message || "Failed to update MM availability");
    }

    setSavingMMAvailable(false);
  };

  const getPartnerUid = (chat) => {
    const users = Array.isArray(chat?.users) ? chat.users : [];
    return users.find((uid) => uid !== MM_ADMIN_UID) || "";
  };

  const isLatestFromUser = (chatId) => {
    const latest = latestByChatId[chatId];
    if (!latest) return false;

    return !isMmMessage(latest, MM_ADMIN_UID);
  };

  const archiveChat = (chatId) => {
    if (!chatId) return;

    setArchivedChatIds((prev) => {
      if (prev.includes(chatId)) return prev;
      return [...prev, chatId];
    });
  };

  const unarchiveChat = (chatId) => {
    if (!chatId) return;

    setArchivedChatIds((prev) => prev.filter((id) => id !== chatId));
  };

  const hideChatFromUi = (chatId) => {
    if (!chatId) return;

    setHiddenChatIds((prev) => {
      if (prev.includes(chatId)) return prev;
      return [...prev, chatId];
    });
  };

  const restoreHiddenChats = () => {
    setHiddenChatIds([]);
  };

  const clearArchivedChats = () => {
    setArchivedChatIds([]);
  };

  return (
    <section style={panelStyles.wrap}>
      <div
        style={{
          ...panelStyles.headerRow,
          ...(isMobile ? { flexDirection: "column" } : {}),
        }}
      >
        <div>
          <h2 style={panelStyles.title}>MM Chat</h2>
          <p style={panelStyles.subtitle}>
            View bartender chats, archive them locally, hide them from this UI,
            and reply as MM.
          </p>
        </div>

        <div
          style={{
            ...panelStyles.headerActions,
            ...(isMobile ? { flexDirection: "column", width: "100%" } : {}),
          }}
        >
          <button
            type="button"
            onClick={toggleMMAvailable}
            disabled={savingMMAvailable}
            style={{
              ...panelStyles.availabilityButton,
              ...(isMMAvailable
                ? panelStyles.availabilityButtonOn
                : panelStyles.availabilityButtonOff),
              ...(savingMMAvailable
                ? panelStyles.availabilityButtonSaving
                : {}),
              ...(isMobile ? { width: "100%" } : {}),
            }}
          >
            {savingMMAvailable
              ? "Saving..."
              : isMMAvailable
                ? "MM Available"
                : "MM Away"}
          </button>

          <button
            type="button"
            onClick={() => setListMode("active")}
            style={{
              ...panelStyles.modeButton,
              ...(listMode === "active" ? panelStyles.modeButtonActive : {}),
              ...(isMobile ? { width: "100%" } : {}),
            }}
          >
            Active ({activeChats.length})
          </button>

          <button
            type="button"
            onClick={() => setListMode("archived")}
            style={{
              ...panelStyles.modeButton,
              ...(listMode === "archived" ? panelStyles.modeButtonActive : {}),
              ...(isMobile ? { width: "100%" } : {}),
            }}
          >
            Archived ({archivedChats.length})
          </button>
        </div>
      </div>

      <div
        style={{
          ...panelStyles.topUtilityRow,
          ...(isMobile ? { flexDirection: "column" } : {}),
        }}
      >
        <button
          type="button"
          onClick={restoreHiddenChats}
          style={{
            ...panelStyles.utilityButton,
            ...(isMobile ? { width: "100%" } : {}),
          }}
        >
          Restore deleted chats ({hiddenChatIds.length})
        </button>

        <button
          type="button"
          onClick={clearArchivedChats}
          style={{
            ...panelStyles.utilityButton,
            ...(isMobile ? { width: "100%" } : {}),
          }}
        >
          Unarchive all ({archivedChatIds.length})
        </button>
      </div>

      {error ? <p style={panelStyles.error}>{error}</p> : null}

      <div
        style={{
          ...panelStyles.layout,
          ...(isMobile ? { gridTemplateColumns: "1fr", height: "auto" } : {}),
        }}
      >
        <div
          style={{
            ...panelStyles.leftPane,
            ...(isMobile ? { maxHeight: "300px" } : {}),
          }}
        >
          <div style={panelStyles.cardHeader}>
            {listMode === "archived"
              ? "Archived Conversations"
              : "Conversations"}
          </div>

          {loadingChats ? (
            <div style={panelStyles.emptyState}>Loading MM chats...</div>
          ) : currentChats.length === 0 ? (
            <div style={panelStyles.emptyState}>
              {listMode === "archived"
                ? "No archived chats."
                : "No active MM chats."}
            </div>
          ) : (
            <div style={panelStyles.chatList}>
              {currentChats.map((chat) => {
                const partnerUid = getPartnerUid(chat);
                const profile = profilesByUid[partnerUid];
                const latest = latestByChatId[chat.id];
                const isActive = chat.id === selectedChatId;
                const showNew = isLatestFromUser(chat.id);

                const displayName =
                  profile?.name ||
                  profile?.username ||
                  partnerUid ||
                  "Unknown user";

                return (
                  <button
                    key={chat.id}
                    type="button"
                    onClick={() => setSelectedChatId(chat.id)}
                    style={{
                      ...panelStyles.chatItem,
                      ...(isActive ? panelStyles.chatItemActive : {}),
                    }}
                  >
                    <div style={panelStyles.chatItemTop}>
                      <div style={panelStyles.chatNameWrap}>
                        <span style={panelStyles.chatName}>{displayName}</span>
                        {showNew && listMode !== "archived" ? (
                          <span style={panelStyles.newBadge}>NEW</span>
                        ) : null}
                      </div>

                      <span style={panelStyles.chatTime}>
                        {latest?.createdAt
                          ? formatTime(latest.createdAt)
                          : formatTime(chat.updatedAt)}
                      </span>
                    </div>

                    <div style={panelStyles.chatMeta}>
                      <span>
                        {profile?.online ? "Online" : "Offline"}
                        {partnerUid ? ` • ${partnerUid}` : ""}
                      </span>
                    </div>

                    <div style={panelStyles.chatPreview}>
                      {latest?.text ||
                        chat.lastMessageText ||
                        "No messages yet"}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div style={panelStyles.rightPane}>
          {!selectedChat ? (
            <div style={panelStyles.emptyState}>Select a conversation.</div>
          ) : (
            <>
              <div
                style={{
                  ...panelStyles.selectedHeader,
                  ...(isMobile ? { flexDirection: "column" } : {}),
                }}
              >
                <div>
                  <div style={panelStyles.selectedTitle}>
                    {selectedProfile?.name ||
                      selectedProfile?.username ||
                      selectedPartnerUid ||
                      "Unknown user"}
                  </div>
                  <div style={panelStyles.selectedMeta}>
                    {selectedProfile?.online ? "Online" : "Offline"}
                    {selectedProfile?.age ? ` • ${selectedProfile.age}` : ""}
                    {selectedProfile?.location
                      ? ` • ${selectedProfile.location}`
                      : ""}
                  </div>
                  {selectedProfile?.oneLiner ? (
                    <div style={panelStyles.oneLiner}>
                      {selectedProfile.oneLiner}
                    </div>
                  ) : null}
                </div>

                <div
                  style={{
                    ...panelStyles.selectedActions,
                    ...(isMobile ? { flexDirection: "column" } : {}),
                  }}
                >
                  {listMode === "archived" ? (
                    <button
                      type="button"
                      onClick={() => unarchiveChat(selectedChat.id)}
                      style={{
                        ...panelStyles.actionButton,
                        ...(isMobile ? { width: "100%" } : {}),
                      }}
                    >
                      Unarchive
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => archiveChat(selectedChat.id)}
                      style={{
                        ...panelStyles.actionButton,
                        ...(isMobile ? { width: "100%" } : {}),
                      }}
                    >
                      Archive
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => hideChatFromUi(selectedChat.id)}
                    style={{
                      ...panelStyles.deleteButton,
                      ...(isMobile ? { width: "100%" } : {}),
                    }}
                  >
                    Delete from UI
                  </button>
                </div>
              </div>

              <div
                ref={messagesBoxRef}
                style={{
                  ...panelStyles.messagesBox,
                  ...(isMobile
                    ? { minHeight: "300px", maxHeight: "50vh" }
                    : {}),
                }}
              >
                {loadingMessages ? (
                  <div style={panelStyles.emptyState}>Loading messages...</div>
                ) : messages.length === 0 ? (
                  <div style={panelStyles.emptyState}>No messages yet.</div>
                ) : (
                  <>
                    {messages.map((message) => {
                      const isMMMessage = isMmMessage(message, MM_ADMIN_UID);

                      return (
                        <div
                          key={message.id}
                          style={{
                            ...panelStyles.messageRow,
                            justifyContent: isMMMessage
                              ? "flex-end"
                              : "flex-start",
                          }}
                        >
                          <div
                            style={{
                              ...panelStyles.messageBubble,
                              ...(isMMMessage
                                ? panelStyles.mmBubble
                                : panelStyles.userBubble),
                              ...(isMobile ? { maxWidth: "88%" } : {}),
                            }}
                          >
                            <div style={panelStyles.messageText}>
                              {message.text || ""}
                            </div>
                            <div style={panelStyles.messageTime}>
                              {formatTime(message.createdAt)}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>

              <div
                style={{
                  ...panelStyles.inputRow,
                  ...(isMobile
                    ? { flexDirection: "column", alignItems: "stretch" }
                    : {}),
                }}
              >
                <textarea
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Reply as MM..."
                  style={{
                    ...panelStyles.textarea,
                    ...(isMobile ? { width: "100%" } : {}),
                  }}
                  rows={3}
                />

                <button
                  type="button"
                  onClick={sendMessage}
                  disabled={!messageInput.trim() || sending}
                  style={{
                    ...panelStyles.sendButton,
                    opacity: !messageInput.trim() || sending ? 0.6 : 1,
                    cursor:
                      !messageInput.trim() || sending
                        ? "not-allowed"
                        : "pointer",
                    ...(isMobile ? { width: "100%", minHeight: 44 } : {}),
                  }}
                >
                  {sending ? "Sending..." : "Send"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const panelStyles = {
  wrap: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  title: {
    margin: 0,
    fontSize: 28,
    color: "#fff",
  },
  subtitle: {
    margin: "8px 0 0 0",
    color: "rgba(255,255,255,0.7)",
  },
  headerActions: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
  },
  availabilityButton: {
    height: 40,
    padding: "0 16px",
    borderRadius: 12,
    border: "1px solid transparent",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
    letterSpacing: 0.2,
    boxShadow: "0 6px 18px rgba(0,0,0,0.24)",
  },
  availabilityButtonOn: {
    background: "#16a34a",
    borderColor: "#22c55e",
  },
  availabilityButtonOff: {
    background: "#b91c1c",
    borderColor: "#ef4444",
  },
  availabilityButtonSaving: {
    opacity: 0.8,
    cursor: "not-allowed",
  },
  modeButton: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "transparent",
    color: "#d3d3d3",
    fontWeight: 700,
    cursor: "pointer",
  },
  modeButtonActive: {
    background: "#ff4da6",
    borderColor: "#ff4da6",
    color: "#fff",
  },
  topUtilityRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  utilityButton: {
    height: 38,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.06)",
    color: "#fff",
    cursor: "pointer",
  },
  error: {
    margin: 0,
    color: "#ff8db8",
    background: "rgba(255,77,166,0.08)",
    border: "1px solid rgba(255,77,166,0.25)",
    borderRadius: 12,
    padding: "12px 14px",
  },
  layout: {
    display: "grid",
    gridTemplateColumns: "360px 1fr",
    gap: 16,
    height: "clamp(420px, 62vh, 560px)",
  },
  leftPane: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    overflow: "hidden",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  rightPane: {
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 16,
    minWidth: 0,
    minHeight: 0,
    overflow: "hidden",
  },
  cardHeader: {
    padding: "16px 16px 12px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    fontWeight: 700,
    color: "#fff",
  },
  chatList: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
  },
  chatItem: {
    border: 0,
    background: "transparent",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    padding: 14,
    textAlign: "left",
    color: "#fff",
    cursor: "pointer",
  },
  chatItemActive: {
    background: "rgba(255,77,166,0.08)",
  },
  chatItemTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  chatNameWrap: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    minWidth: 0,
  },
  chatName: {
    fontWeight: 700,
    color: "#fff",
  },
  newBadge: {
    fontSize: 11,
    fontWeight: 800,
    color: "#111",
    background: "#ffd166",
    padding: "3px 7px",
    borderRadius: 999,
  },
  chatTime: {
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
    whiteSpace: "nowrap",
  },
  chatMeta: {
    marginTop: 6,
    fontSize: 12,
    color: "rgba(255,255,255,0.55)",
  },
  chatPreview: {
    marginTop: 8,
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  selectedHeader: {
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    paddingBottom: 12,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    flexWrap: "wrap",
  },
  selectedTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "#fff",
  },
  selectedMeta: {
    marginTop: 6,
    color: "rgba(255,255,255,0.65)",
    fontSize: 13,
  },
  oneLiner: {
    marginTop: 8,
    color: "rgba(255,255,255,0.82)",
    fontSize: 14,
  },
  selectedActions: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  actionButton: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.12)",
    background: "rgba(255,255,255,0.08)",
    color: "#fff",
    fontWeight: 700,
    cursor: "pointer",
  },
  deleteButton: {
    height: 40,
    padding: "0 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,120,120,0.22)",
    background: "rgba(255,70,70,0.12)",
    color: "#ffd5d5",
    fontWeight: 700,
    cursor: "pointer",
  },
  messagesBox: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingRight: 4,
  },
  messageRow: {
    display: "flex",
    width: "100%",
  },
  messageBubble: {
    maxWidth: "72%",
    borderRadius: 14,
    padding: "8px 10px",
  },
  mmBubble: {
    background: "rgba(255,255,255,0.12)",
    border: "1px solid rgba(255,255,255,0.14)",
  },
  userBubble: {
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  messageText: {
    color: "#fff",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    lineHeight: 1.35,
    fontSize: 13,
    textAlign: "left",
  },
  messageTime: {
    marginTop: 4,
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    textAlign: "right",
  },
  inputRow: {
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
    borderTop: "1px solid rgba(255,255,255,0.08)",
    paddingTop: 14,
  },
  textarea: {
    flex: 1,
    resize: "vertical",
    minHeight: 70,
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(0,0,0,0.2)",
    color: "#fff",
    padding: 12,
    fontFamily: "inherit",
    fontSize: 14,
    outline: "none",
  },
  sendButton: {
    height: 44,
    padding: "0 18px",
    borderRadius: 14,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.12)",
    color: "#fff",
    fontWeight: 700,
  },
  emptyState: {
    padding: 18,
    color: "rgba(255,255,255,0.65)",
  },
};
