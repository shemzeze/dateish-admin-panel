import { useEffect, useRef, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { useEnv } from "../context/EnvContext";
import { styles } from "../styles/adminStyles";
import { adminColors } from "../styles/adminColors";

function confirmProdAction(env, actionName) {
  if (env !== "prod") return true;
  return window.confirm(
    `You are about to ${actionName} in PROD. Are you sure?`,
  );
}

const PUSH_MESSAGE_HISTORY_KEY = "dateish_push_message_history";
const PUSH_USER_HISTORY_KEY = "dateish_push_user_history";
const HISTORY_LIMIT = 10;

function formatDate(value) {
  if (!value) return "—";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function readStorageArray(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];

    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStorageArray(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can fail in private mode / blocked storage.
  }
}

function cleanUidList(text) {
  return text
    .split(/[\n,]+/)
    .map((uid) => uid.trim())
    .filter(Boolean);
}

export default function PushNotificationsPanel({ firebase, env }) {
  const envCtx = useEnv();
  const resolvedFirebase = firebase ?? envCtx.firebase;
  const resolvedEnv = env ?? envCtx.currentEnv;
  const functions = getFunctions(resolvedFirebase.app, "us-central1");
  const [mode, setMode] = useState("all");
  const [pushText, setPushText] = useState("");
  const [uidsText, setUidsText] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const [messageHistory, setMessageHistory] = useState([]);
  const [userHistory, setUserHistory] = useState([]);

  const [showMessageHistory, setShowMessageHistory] = useState(false);
  const [showUserHistory, setShowUserHistory] = useState(false);

  const messageDropdownRef = useRef(null);
  const userDropdownRef = useRef(null);

  useEffect(() => {
    setMessageHistory(readStorageArray(PUSH_MESSAGE_HISTORY_KEY));
    setUserHistory(readStorageArray(PUSH_USER_HISTORY_KEY));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        messageDropdownRef.current &&
        !messageDropdownRef.current.contains(event.target)
      ) {
        setShowMessageHistory(false);
      }

      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target)
      ) {
        setShowUserHistory(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const addMessageToHistory = (body) => {
    const cleanBody = body.trim();
    if (!cleanBody) return;

    const nextHistory = [
      {
        body: cleanBody,
        savedAt: new Date().toISOString(),
      },
      ...messageHistory.filter((item) => item.body !== cleanBody),
    ].slice(0, HISTORY_LIMIT);

    setMessageHistory(nextHistory);
    saveStorageArray(PUSH_MESSAGE_HISTORY_KEY, nextHistory);
  };

  const addUsersToHistory = (uids) => {
    if (!Array.isArray(uids) || uids.length === 0) return;

    const now = new Date().toISOString();

    const newItems = uids.map((uid) => ({
      uid,
      savedAt: now,
    }));

    const nextHistory = [
      ...newItems,
      ...userHistory.filter((item) => !uids.includes(item.uid)),
    ].slice(0, HISTORY_LIMIT);

    setUserHistory(nextHistory);
    saveStorageArray(PUSH_USER_HISTORY_KEY, nextHistory);
  };

  const clearMessageHistory = () => {
    setMessageHistory([]);
    saveStorageArray(PUSH_MESSAGE_HISTORY_KEY, []);
  };

  const clearUserHistory = () => {
    setUserHistory([]);
    saveStorageArray(PUSH_USER_HISTORY_KEY, []);
  };

  const sendPush = async () => {
    const cleanText = pushText.trim();

    if (!cleanText) {
      setError("Enter push text");
      return;
    }

    const targetUids = mode === "specific" ? cleanUidList(uidsText) : [];

    if (mode === "specific" && targetUids.length === 0) {
      setError("Enter at least one UID");
      return;
    }

    if (!confirmProdAction(resolvedEnv, "send a push notification")) return;

    setSending(true);
    setError("");
    setResult("");

    try {
      const callable = httpsCallable(functions, "sendAdminPush");

      const res = await callable({
        body: cleanText,
        targetMode: mode,
        targetUids,
      });

      setResult(`Push sent. Tokens: ${res.data?.sent || 0}`);

      addMessageToHistory(cleanText);

      if (mode === "specific") {
        addUsersToHistory(targetUids);
      }

      setPushText("");
    } catch (err) {
      console.error("Send push failed:", err);
      setError(err.message || "Failed to send push");
    }

    setSending(false);
  };

  return (
    <section style={styles.card}>
      <h2 style={styles.sectionTitle}>Push Notifications</h2>

      <p style={styles.mutedText}>
        Send a manual push notification from the admin panel.
      </p>

      <div
        ref={messageDropdownRef}
        style={{
          marginTop: 20,
          position: "relative",
        }}
      >
        <label style={styles.label}>Push text</label>

        <textarea
          value={pushText}
          onChange={(e) => setPushText(e.target.value)}
          onFocus={() => {
            setShowMessageHistory(true);
            setShowUserHistory(false);
          }}
          placeholder="Write the notification text..."
          rows={4}
          style={{
            ...styles.input,
            minHeight: 110,
            resize: "vertical",
            width: "100%",
          }}
        />

        {showMessageHistory && messageHistory.length > 0 ? (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              right: 0,
              zIndex: 30,
              background: adminColors.cardBg || "#111827",
              border: `1px solid ${adminColors.borderSoft}`,
              borderRadius: 14,
              boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
              padding: 10,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                marginBottom: 8,
              }}
            >
              <p style={{ ...styles.sectionLabel, margin: 0 }}>
                Recent Messages
              </p>

              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearMessageHistory}
                style={{
                  border: `1px solid ${adminColors.borderSoft}`,
                  background: "transparent",
                  color: adminColors.textSecondary,
                  borderRadius: 10,
                  padding: "6px 10px",
                  cursor: "pointer",
                  fontSize: 12,
                }}
              >
                Clear
              </button>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                maxHeight: 320,
                overflowY: "auto",
              }}
            >
              {messageHistory.map((item, index) => (
                <button
                  key={`${item.body}-${index}`}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setPushText(item.body);
                    setShowMessageHistory(false);
                  }}
                  style={{
                    textAlign: "left",
                    border: `1px solid ${adminColors.borderSoft}`,
                    borderRadius: 12,
                    padding: 12,
                    background: adminColors.overlaySoft,
                    color: adminColors.textPrimary,
                    cursor: "pointer",
                  }}
                >
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 700,
                      marginBottom: 6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {item.body}
                  </div>

                  <div style={{ fontSize: 11, opacity: 0.65 }}>
                    {formatDate(item.savedAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 20 }}>
        <label style={styles.label}>Send to</label>

        <div style={{ display: "flex", gap: 12, marginTop: 10 }}>
          <button
            type="button"
            onClick={() => {
              setMode("all");
              setShowUserHistory(false);
            }}
            style={{
              ...styles.secondaryButton,
              background:
                mode === "all" ? adminColors.accentPrimary : "transparent",
            }}
          >
            Every user
          </button>

          <button
            type="button"
            onClick={() => setMode("specific")}
            style={{
              ...styles.secondaryButton,
              background:
                mode === "specific" ? adminColors.accentPrimary : "transparent",
            }}
          >
            Specific UIDs
          </button>
        </div>
      </div>

      {mode === "specific" ? (
        <div
          ref={userDropdownRef}
          style={{
            marginTop: 20,
            position: "relative",
          }}
        >
          <label style={styles.label}>User UIDs</label>

          <textarea
            value={uidsText}
            onChange={(e) => setUidsText(e.target.value)}
            onFocus={() => {
              setShowUserHistory(true);
              setShowMessageHistory(false);
            }}
            placeholder="Paste UIDs here, one per line or separated by commas"
            rows={5}
            style={{
              ...styles.input,
              minHeight: 130,
              resize: "vertical",
              width: "100%",
            }}
          />

          {showUserHistory && userHistory.length > 0 ? (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                left: 0,
                right: 0,
                zIndex: 30,
                background: adminColors.cardBg || "#111827",
                border: `1px solid ${adminColors.borderSoft}`,
                borderRadius: 14,
                boxShadow: "0 12px 30px rgba(0,0,0,0.35)",
                padding: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 12,
                  marginBottom: 8,
                }}
              >
                <p style={{ ...styles.sectionLabel, margin: 0 }}>
                  Recent Users
                </p>

                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={clearUserHistory}
                  style={{
                    border: `1px solid ${adminColors.borderSoft}`,
                    background: "transparent",
                    color: adminColors.textSecondary,
                    borderRadius: 10,
                    padding: "6px 10px",
                    cursor: "pointer",
                    fontSize: 12,
                  }}
                >
                  Clear
                </button>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  maxHeight: 320,
                  overflowY: "auto",
                }}
              >
                {userHistory.map((item) => (
                  <button
                    key={item.uid}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      setUidsText(item.uid);
                      setShowUserHistory(false);
                    }}
                    style={{
                      textAlign: "left",
                      border: `1px solid ${adminColors.borderSoft}`,
                      borderRadius: 12,
                      padding: 12,
                      background: adminColors.overlaySoft,
                      color: adminColors.textPrimary,
                      cursor: "pointer",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.85,
                        wordBreak: "break-all",
                        marginBottom: 6,
                      }}
                    >
                      UID: {item.uid}
                    </div>

                    <div style={{ fontSize: 11, opacity: 0.65 }}>
                      {formatDate(item.savedAt)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: 24 }}>
        <button
          type="button"
          onClick={sendPush}
          disabled={sending}
          style={{
            ...styles.primaryButton,
            background: adminColors.accentPrimary,
          }}
        >
          {sending ? "Sending..." : "Send Push"}
        </button>
      </div>

      {result ? <p style={styles.successText}>{result}</p> : null}
      {error ? <p style={styles.errorText}>{error}</p> : null}
    </section>
  );
}
