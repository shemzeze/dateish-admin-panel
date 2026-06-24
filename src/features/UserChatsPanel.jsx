import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { useEnv } from "../context/EnvContext";
import { styles } from "../styles/adminStyles";
import { adminColors } from "../styles/adminColors";

const CHAT_LIMIT = 100;
const MESSAGE_LIMIT = 300;

function normalizeTimestampMs(value) {
  if (value === null || value === undefined) return null;

  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 0 && value < 1e12 ? value * 1000 : value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;

    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber) && asNumber > 0) {
      return asNumber < 1e12 ? asNumber * 1000 : asNumber;
    }

    const parsed = Date.parse(trimmed);
    return Number.isNaN(parsed) ? null : parsed;
  }

  if (typeof value === "object") {
    if (typeof value.toDate === "function") {
      const date = value.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime())
        ? date.getTime()
        : null;
    }

    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.getTime();
    }

    const seconds = Number(value.seconds ?? value._seconds);
    const nanos = Number(value.nanoseconds ?? value._nanoseconds ?? 0);

    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000 + (Number.isFinite(nanos) ? nanos / 1e6 : 0);
    }
  }

  return null;
}

function formatDateTime(value) {
  const timestampMs = normalizeTimestampMs(value);

  if (timestampMs === null) return "—";

  try {
    return new Date(timestampMs).toLocaleString();
  } catch {
    return "—";
  }
}

function uniqueStrings(values) {
  return [
    ...new Set(
      (values || []).map((value) => String(value || "").trim()).filter(Boolean),
    ),
  ];
}

function getTextValue(record) {
  if (!record) return "";
  if (typeof record === "string") return record;
  return record.text || record.body || record.message || "";
}

function getSenderValue(record) {
  if (!record) return "";
  if (typeof record === "string") return record;
  return (
    record.senderId ||
    record.userId ||
    record.from ||
    record.sender ||
    record.uid ||
    record.id ||
    record.name ||
    ""
  );
}

function getParticipants(chat) {
  if (Array.isArray(chat?.users) && chat.users.length > 0) {
    return uniqueStrings(chat.users);
  }

  if (chat?.members && typeof chat.members === "object") {
    return uniqueStrings(Object.keys(chat.members));
  }

  if (Array.isArray(chat?.visibleFor) && chat.visibleFor.length > 0) {
    return uniqueStrings(chat.visibleFor);
  }

  return [];
}

function getOtherUid(chat, selectedUserUid) {
  const participants = getParticipants(chat);
  return participants.find((uid) => uid !== selectedUserUid) || "";
}

function getChatUpdatedAtMs(chat) {
  return (
    normalizeTimestampMs(chat?.updatedAt) ??
    normalizeTimestampMs(chat?.lastMessageAt) ??
    0
  );
}

function getMessageTimestampMs(message) {
  return (
    normalizeTimestampMs(message?.createdAt) ??
    normalizeTimestampMs(message?.timestamp) ??
    normalizeTimestampMs(message?.updatedAt) ??
    0
  );
}

function getBucketLabel(timestampMs) {
  if (!timestampMs) return "Older";

  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);

  const startYesterday = new Date(startToday);
  startYesterday.setDate(startYesterday.getDate() - 1);

  const startSevenDays = new Date(startToday);
  startSevenDays.setDate(startSevenDays.getDate() - 7);

  if (timestampMs >= startToday.getTime()) return "Today";
  if (timestampMs >= startYesterday.getTime()) return "Yesterday";
  if (timestampMs >= startSevenDays.getTime()) return "Last 7 days";

  return "Older";
}

function getUserDisplayName(profile) {
  if (!profile) return "";

  return (
    profile.displayName ||
    profile.name ||
    profile.username ||
    profile.fullName ||
    profile.email ||
    ""
  );
}

function formatSenderLabel(senderValue, senderUid, profilesByUid) {
  const cleanUid = String(senderUid || "").trim();
  const cleanValue = typeof senderValue === "string" ? senderValue.trim() : "";
  const senderProfile = cleanUid ? profilesByUid?.[cleanUid] : null;
  const displayName = getUserDisplayName(senderProfile);

  if (displayName && cleanUid) {
    return `${displayName} (${cleanUid})`;
  }

  if (cleanValue && cleanUid && cleanValue !== cleanUid) {
    return `${cleanValue} (${cleanUid})`;
  }

  return cleanUid || cleanValue || "—";
}

async function copyText(value) {
  if (!value) return false;

  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function ChatCard({
  chat,
  selectedUserUid,
  otherProfile,
  profilesByUid,
  onToggleChat,
  onCopy,
  isOpen,
}) {
  const otherUid = getOtherUid(chat, selectedUserUid);
  const otherName =
    getUserDisplayName(otherProfile) || otherUid || "Unknown user";
  const updatedAtMs = getChatUpdatedAtMs(chat);
  const lastMessageText =
    getTextValue(chat?.lastMessage) || "(no last message text)";
  const lastMessageSenderUid = getSenderValue(chat?.lastMessageSender);
  const lastMessageSenderLabel = formatSenderLabel(
    chat?.lastMessageSender,
    lastMessageSenderUid,
    profilesByUid,
  );

  const fieldLabelStyle = {
    fontSize: 12,
    color: adminColors.textMuted,
    textAlign: "right",
    fontWeight: 700,
    minWidth: 88,
    flexShrink: 0,
  };

  const fieldValueStyle = {
    fontSize: 13,
    color: adminColors.textPrimary,
    fontWeight: 400,
    minWidth: 0,
    wordBreak: "break-word",
  };

  return (
    <div
      style={{
        background: adminColors.overlaySoft,
        border: `1px solid ${isOpen ? adminColors.accentPrimarySoftBorder : adminColors.borderSoft}`,
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 16,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 400, marginBottom: 6 }}>
            {otherName}
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "baseline",
            }}
          >
            <div style={fieldLabelStyle}>User</div>
            <div style={{ ...fieldValueStyle, wordBreak: "break-all" }}>
              {otherUid || "—"}
            </div>
          </div>

          <div style={{ marginTop: 8, display: "grid", gap: 5 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <div style={fieldLabelStyle}>Message</div>
              <div style={fieldValueStyle}>{lastMessageText}</div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <div style={fieldLabelStyle}>Sender</div>
              <div style={fieldValueStyle}>{lastMessageSenderLabel}</div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <div style={fieldLabelStyle}>Time</div>
              <div style={fieldValueStyle}>
                {formatDateTime(chat?.lastMessageAt || chat?.updatedAt)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
              <div style={fieldLabelStyle}>Chat</div>
              <div
                title={chat.id}
                style={{
                  ...fieldValueStyle,
                  fontSize: 11,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  wordBreak: "normal",
                }}
              >
                {chat.id}
              </div>
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            minWidth: 160,
            flexShrink: 0,
          }}
        >
          <button
            type="button"
            onClick={() => onToggleChat(chat.id)}
            style={{
              ...styles.primaryButton,
              background: isOpen
                ? adminColors.overlayMedium
                : adminColors.accentPrimary,
              border: isOpen
                ? `1px solid ${adminColors.borderSoft}`
                : "1px solid transparent",
            }}
          >
            {isOpen ? "Close Chat" : "Open Chat"}
          </button>

          <button
            type="button"
            onClick={() => onCopy(chat.id)}
            style={{
              ...styles.secondaryButton,
              width: "100%",
            }}
          >
            Copy Chat ID
          </button>

          <button
            type="button"
            onClick={() => onCopy(otherUid)}
            disabled={!otherUid}
            style={{
              ...styles.secondaryButton,
              width: "100%",
            }}
          >
            Copy Other UID
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "baseline",
          marginTop: 8,
          fontSize: 12,
          color: adminColors.textMuted,
          wordBreak: "break-word",
        }}
      >
        <div
          style={{
            textAlign: "right",
            fontWeight: 700,
            minWidth: 88,
            flexShrink: 0,
          }}
        >
          Updated
        </div>
        <div
          style={{
            color: adminColors.textPrimary,
            fontWeight: 400,
          }}
        >
          {updatedAtMs ? formatDateTime(updatedAtMs) : "—"}
        </div>
      </div>
    </div>
  );
}

export default function UserChatsPanel({ firebase, selectedUserUid, onBack }) {
  const envCtx = useEnv();
  const resolvedFirebase = firebase ?? envCtx.firebase;
  const firestore = resolvedFirebase.firestore;

  const [chats, setChats] = useState([]);
  const [profilesByUid, setProfilesByUid] = useState({});
  const [loadingChats, setLoadingChats] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  const [selectedChatId, setSelectedChatId] = useState("");
  const [messages, setMessages] = useState([]);
  const [copyStatus, setCopyStatus] = useState("");

  const userCacheRef = useRef({});
  const pendingUserRequestsRef = useRef({});
  const copyTimerRef = useRef(null);

  const selectedUserProfile = selectedUserUid
    ? profilesByUid[selectedUserUid] || null
    : null;

  const selectedUserName = getUserDisplayName(selectedUserProfile);
  const selectedChat = chats.find((chat) => chat.id === selectedChatId) || null;

  const fetchUserProfile = useCallback(
    async (uid) => {
      const cleanUid = String(uid || "").trim();
      if (!cleanUid) return null;

      const cached = userCacheRef.current[cleanUid];
      if (cached) return cached;

      const pending = pendingUserRequestsRef.current[cleanUid];
      if (pending) return pending;

      const request = (async () => {
        try {
          const snap = await getDoc(doc(firestore, "users", cleanUid));

          if (!snap.exists()) {
            return { uid: cleanUid };
          }

          return {
            uid: cleanUid,
            ...snap.data(),
          };
        } catch (err) {
          console.error("Failed to load user profile:", err);
          return { uid: cleanUid };
        }
      })();

      pendingUserRequestsRef.current[cleanUid] = request;

      try {
        const profile = await request;
        userCacheRef.current[cleanUid] = profile;
        return profile;
      } finally {
        delete pendingUserRequestsRef.current[cleanUid];
      }
    },
    [firestore],
  );

  useEffect(() => {
    setSelectedChatId("");
    setMessages([]);
    setMessageError("");
  }, [selectedUserUid]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const cleanUid = String(selectedUserUid || "").trim();

      if (!cleanUid) {
        setChats([]);
        setProfilesByUid({});
        setLoadingChats(false);
        setError("");
        return;
      }

      setLoadingChats(true);
      setError("");

      try {
        const chatsCol = collection(firestore, "chats");
        const chatsQuery = query(
          chatsCol,
          where("visibleFor", "array-contains", cleanUid),
          orderBy("updatedAt", "desc"),
          limit(CHAT_LIMIT),
        );

        const snapshot = await getDocs(chatsQuery);
        const rows = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));

        rows.sort((a, b) => getChatUpdatedAtMs(b) - getChatUpdatedAtMs(a));

        const uidsToLoad = uniqueStrings([
          cleanUid,
          ...rows.flatMap((chat) => [
            getOtherUid(chat, cleanUid),
            getSenderValue(chat?.lastMessageSender),
          ]),
        ]);

        await Promise.all(uidsToLoad.map((uid) => fetchUserProfile(uid)));

        if (cancelled) return;

        setProfilesByUid({ ...userCacheRef.current });
        setChats(rows);
      } catch (err) {
        if (cancelled) return;

        console.error("Failed to load chats:", err);
        setError(err.message || "Failed to load chats for this user");
        setChats([]);
      } finally {
        if (!cancelled) {
          setLoadingChats(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [fetchUserProfile, firestore, selectedUserUid, refreshTick]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      const cleanUid = String(selectedUserUid || "").trim();

      if (!cleanUid) return;

      try {
        const profile = await fetchUserProfile(cleanUid);

        if (cancelled || !profile) return;

        setProfilesByUid((prev) => ({
          ...prev,
          [cleanUid]: profile,
        }));
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to preload selected user profile:", err);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [fetchUserProfile, selectedUserUid, refreshTick]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!selectedChatId) {
        setMessages([]);
        setMessageError("");
        setLoadingMessages(false);
        return;
      }

      setLoadingMessages(true);
      setMessageError("");

      try {
        const messagesCol = collection(
          firestore,
          "chats",
          selectedChatId,
          "messages",
        );
        const messagesQuery = query(
          messagesCol,
          orderBy("createdAt", "asc"),
          limit(MESSAGE_LIMIT),
        );

        const snapshot = await getDocs(messagesQuery);
        const rows = snapshot.docs
          .map((docSnap) => ({
            id: docSnap.id,
            ...docSnap.data(),
          }))
          .sort((a, b) => getMessageTimestampMs(a) - getMessageTimestampMs(b));

        const senderUids = uniqueStrings(
          rows.map((message) => getSenderValue(message)),
        );
        await Promise.all(senderUids.map((uid) => fetchUserProfile(uid)));

        if (cancelled) return;

        setProfilesByUid({ ...userCacheRef.current });
        setMessages(rows);
      } catch (err) {
        if (cancelled) return;

        console.error("Failed to load messages:", err);
        setMessageError(err.message || "Failed to load messages");
        setMessages([]);
      } finally {
        if (!cancelled) {
          setLoadingMessages(false);
        }
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [fetchUserProfile, firestore, selectedChatId, refreshTick]);

  const groupedChats = useMemo(() => {
    const groups = {
      Today: [],
      Yesterday: [],
      "Last 7 days": [],
      Older: [],
    };

    chats.forEach((chat) => {
      const bucket = getBucketLabel(getChatUpdatedAtMs(chat));
      const otherUid = getOtherUid(chat, selectedUserUid);

      groups[bucket].push({
        ...chat,
        otherUid,
        otherProfile: otherUid ? profilesByUid[otherUid] || null : null,
      });
    });

    return groups;
  }, [chats, profilesByUid, selectedUserUid]);

  const handleCopy = async (value) => {
    const success = await copyText(value);
    setCopyStatus(success ? "Copied" : "Copy failed");

    if (copyTimerRef.current) {
      window.clearTimeout(copyTimerRef.current);
    }

    copyTimerRef.current = window.setTimeout(() => {
      setCopyStatus("");
    }, 1200);
  };

  const handleRefresh = () => {
    setRefreshTick((prev) => prev + 1);
  };

  const handleToggleChat = (chatId) => {
    setSelectedChatId((prev) => (prev === chatId ? "" : chatId));
  };

  const messageRows = messages.map((message) => {
    const senderUid = getSenderValue(message);
    const senderProfile = senderUid ? profilesByUid[senderUid] || null : null;
    const senderName = getUserDisplayName(senderProfile);

    return {
      ...message,
      senderUid,
      senderName,
      messageText: getTextValue(message) || "(empty message)",
      timestampLabel: formatDateTime(
        message.createdAt || message.timestamp || message.updatedAt,
      ),
    };
  });

  return (
    <div style={styles.card}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: 16,
          flexWrap: "wrap",
          marginBottom: 18,
        }}
      >
        <div>
          <h2 style={styles.cardTitle}>View Chats</h2>
          <p style={{ ...styles.mutedText, marginTop: 8 }}>
            Read-only moderation view for chats visible to this user.
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={onBack}
            style={{
              ...styles.secondaryButton,
              background: adminColors.overlaySoft,
            }}
          >
            Back
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loadingChats || loadingMessages}
            style={{
              ...styles.primaryButton,
              background: adminColors.accentPrimary,
            }}
          >
            {loadingChats || loadingMessages ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          marginBottom: 14,
          padding: 14,
          borderRadius: 14,
          background: adminColors.surfaceRaised,
          border: `1px solid ${adminColors.border}`,
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "baseline",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: adminColors.textMuted,
              textAlign: "right",
              fontWeight: 700,
              minWidth: 88,
              flexShrink: 0,
            }}
          >
            Selected user
          </div>
          <div
            style={{
              fontSize: 17,
              fontWeight: 400,
              color: adminColors.textPrimary,
            }}
          >
            {selectedUserName || "Unnamed user"}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "baseline",
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: adminColors.textMuted,
              textAlign: "right",
              fontWeight: 700,
              minWidth: 88,
              flexShrink: 0,
            }}
          >
            UID
          </div>
          <div
            style={{
              fontSize: 13,
              color: adminColors.textPrimary,
              fontWeight: 400,
              wordBreak: "break-all",
            }}
          >
            {selectedUserUid || "—"}
          </div>
        </div>

        {selectedUserProfile?.email ? (
          <div
            style={{
              display: "flex",
              gap: 10,
              alignItems: "baseline",
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: adminColors.textMuted,
                textAlign: "right",
                fontWeight: 700,
                minWidth: 88,
                flexShrink: 0,
              }}
            >
              Email
            </div>
            <div
              style={{
                fontSize: 13,
                color: adminColors.textPrimary,
                fontWeight: 400,
                wordBreak: "break-all",
              }}
            >
              {selectedUserProfile.email}
            </div>
          </div>
        ) : null}
      </div>

      {!selectedUserUid ? (
        <p style={styles.mutedText}>Choose a user first to view their chats.</p>
      ) : null}

      {copyStatus ? (
        <p style={{ ...styles.mutedText, marginBottom: 10 }}>{copyStatus}</p>
      ) : null}

      {error ? <p style={styles.errorText}>{error}</p> : null}

      {loadingChats ? <p style={styles.mutedText}>Loading chats...</p> : null}

      {!loadingChats && !error && chats.length === 0 && selectedUserUid ? (
        <p style={styles.mutedText}>No chats found for this user.</p>
      ) : null}

      {!loadingChats && chats.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {["Today", "Yesterday", "Last 7 days", "Older"].map((bucket) => {
            const bucketChats = groupedChats[bucket] || [];

            if (bucketChats.length === 0) return null;

            return (
              <section
                key={bucket}
                style={{ display: "flex", flexDirection: "column", gap: 10 }}
              >
                <h3 style={{ ...styles.sectionLabel, marginBottom: 0 }}>
                  {bucket} ({bucketChats.length})
                </h3>

                <div
                  style={{ display: "flex", flexDirection: "column", gap: 12 }}
                >
                  {bucketChats.map((chat) => (
                    <ChatCard
                      key={chat.id}
                      chat={chat}
                      selectedUserUid={selectedUserUid}
                      otherProfile={chat.otherProfile}
                      profilesByUid={profilesByUid}
                      onToggleChat={handleToggleChat}
                      onCopy={handleCopy}
                      isOpen={selectedChatId === chat.id}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      {selectedChat ? (
        <div
          style={{
            marginTop: 16,
            padding: 14,
            borderRadius: 14,
            background: adminColors.surfaceRaised,
            border: `1px solid ${adminColors.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-start",
              marginBottom: 14,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 18 }}>Chat Messages</h3>
              <div
                style={{
                  ...styles.mutedText,
                  marginTop: 6,
                  wordBreak: "break-all",
                }}
              >
                Chat ID: {selectedChat.id}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSelectedChatId("")}
              style={{
                ...styles.secondaryButton,
                background: adminColors.overlaySoft,
              }}
            >
              Close Chat
            </button>
          </div>

          {messageError ? <p style={styles.errorText}>{messageError}</p> : null}

          {loadingMessages ? (
            <p style={styles.mutedText}>Loading messages...</p>
          ) : null}

          {!loadingMessages && !messageError && messages.length === 0 ? (
            <p style={styles.mutedText}>No messages found for this chat.</p>
          ) : null}

          {!loadingMessages && messages.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: "52vh",
                overflowY: "auto",
                paddingRight: 4,
              }}
            >
              {messageRows.map((message) => (
                <div
                  key={message.id}
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    background: adminColors.overlaySoft,
                    border: `1px solid ${adminColors.borderSoft}`,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: 12,
                      flexWrap: "wrap",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 400,
                        color: adminColors.textPrimary,
                      }}
                    >
                      {message.senderName || "Unknown sender"}
                    </div>
                    <div style={{ fontSize: 12, color: adminColors.textMuted }}>
                      {message.timestampLabel}
                    </div>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "baseline",
                      marginTop: 3,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: adminColors.textMuted,
                        textAlign: "right",
                        fontWeight: 700,
                        minWidth: 72,
                        flexShrink: 0,
                      }}
                    >
                      UID
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: adminColors.textPrimary,
                        fontWeight: 400,
                        wordBreak: "break-all",
                      }}
                    >
                      {message.senderUid || "—"}
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: 8,
                      whiteSpace: "pre-wrap",
                      lineHeight: 1.4,
                      fontSize: 14,
                    }}
                  >
                    {message.messageText}
                  </div>

                  <div
                    style={{
                      display: "flex",
                      gap: 10,
                      alignItems: "baseline",
                      marginTop: 8,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 11,
                        color: adminColors.textMuted,
                        textAlign: "right",
                        fontWeight: 700,
                        minWidth: 72,
                        flexShrink: 0,
                      }}
                    >
                      Message
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: adminColors.textPrimary,
                        fontWeight: 400,
                        wordBreak: "break-all",
                      }}
                    >
                      {message.id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
