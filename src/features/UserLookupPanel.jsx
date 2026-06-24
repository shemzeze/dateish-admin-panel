import { useEffect, useRef, useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  collection,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
} from "firebase/firestore";
import { useEnv } from "../context/EnvContext";
import { styles } from "../styles/adminStyles";
import { adminColors } from "../styles/adminColors";

function formatDate(value) {
  if (!hasValue(value)) return "—";

  const parseTimestampMs = (input) => {
    if (input === null || input === undefined) return null;

    if (input instanceof Date) {
      const ms = input.getTime();
      return Number.isFinite(ms) ? ms : null;
    }

    if (typeof input?.toMillis === "function") {
      const ms = input.toMillis();
      return Number.isFinite(ms) ? ms : null;
    }

    if (typeof input?.toDate === "function") {
      const date = input.toDate();
      const ms = date?.getTime?.();
      return Number.isFinite(ms) ? ms : null;
    }

    if (typeof input === "number" && Number.isFinite(input)) {
      return input > 0 && input < 1e12 ? input * 1000 : input;
    }

    if (typeof input === "string") {
      const trimmed = input.trim();
      if (!trimmed) return null;

      const asNumber = Number(trimmed);
      if (Number.isFinite(asNumber) && asNumber > 0) {
        return asNumber < 1e12 ? asNumber * 1000 : asNumber;
      }

      const parsed = Date.parse(trimmed);
      return Number.isNaN(parsed) ? null : parsed;
    }

    if (typeof input === "object") {
      const seconds = Number(input.seconds ?? input._seconds);
      const nanos = Number(input.nanoseconds ?? input._nanoseconds ?? 0);

      if (Number.isFinite(seconds) && seconds > 0) {
        const nanosMs = Number.isFinite(nanos) ? Math.floor(nanos / 1e6) : 0;
        return seconds * 1000 + nanosMs;
      }

      if (hasValue(input.$date)) {
        return parseTimestampMs(input.$date);
      }
    }

    return null;
  };

  const ms = parseTimestampMs(value);
  if (ms === null) return "—";

  const date = new Date(ms);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString(undefined, {
        year: "numeric",
        month: "numeric",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function pickFirstValue(...values) {
  for (const value of values) {
    if (hasValue(value)) return value;
  }
  return null;
}

function hasValue(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

function formatBool(value) {
  if (value === true) return "Yes";
  if (value === false) return "No";
  return "—";
}

function formatList(value) {
  if (!Array.isArray(value) || value.length === 0) return "—";
  const filtered = value
    .map((item) => (typeof item === "string" ? item.trim() : String(item)))
    .filter(Boolean);
  return filtered.length > 0 ? filtered.join(", ") : "—";
}

function formatNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed.toLocaleString() : "—";
}

function formatPlatform(value) {
  if (!hasValue(value)) return "—";
  const normalized = String(value).trim().toLowerCase();
  if (normalized === "ios") return "iOS";
  if (normalized === "android") return "Android";
  if (normalized === "web") return "Web";
  return String(value);
}

function formatDurationMs(value, status) {
  const numeric = Number(value);

  if (Number.isFinite(numeric) && numeric >= 0) {
    const totalSeconds = Math.floor(numeric / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours}h ${String(minutes).padStart(2, "0")}m`;
    }

    if (minutes > 0) {
      return `${minutes}m ${String(seconds).padStart(2, "0")}s`;
    }

    return `${seconds}s`;
  }

  if (status === "online") return "Still online";

  return "Unknown";
}

function FieldGrid({
  title,
  fields,
  collapsible = false,
  collapsed = false,
  onToggle,
}) {
  return (
    <section
      style={{
        marginTop: 14,
        border: `1px solid ${adminColors.borderSoft}`,
        borderRadius: 14,
        background: adminColors.overlaySoft,
        padding: 12,
        width: "100%",
        alignSelf: "flex-start",
        textAlign: "left",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: collapsed ? 0 : 10,
        }}
      >
        {collapsible ? (
          <button
            type="button"
            onClick={onToggle}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: 0,
              border: "none",
              background: "transparent",
              color: adminColors.textPrimary,
              cursor: "pointer",
              textAlign: "left",
            }}
          >
            <p style={{ ...styles.sectionLabel, margin: 0 }}>{title}</p>
            <span
              style={{
                fontSize: 12,
                color: adminColors.textMuted,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                flexShrink: 0,
              }}
            >
              {collapsed ? "Show" : "Hide"}
            </span>
          </button>
        ) : (
          <p style={{ ...styles.sectionLabel, margin: 0 }}>{title}</p>
        )}
      </div>

      {!collapsed && (
        <div>
          {fields.map((field, index) => (
            <div
              key={field.label}
              style={{
                padding: "10px 2px",
                borderBottom:
                  index === fields.length - 1
                    ? "none"
                    : `1px solid ${adminColors.borderSoft}`,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: adminColors.textMuted,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 4,
                  textAlign: "left",
                }}
              >
                {field.label}
              </div>

              <div
                style={{
                  fontSize: 14,
                  color: adminColors.textPrimary,
                  fontWeight: 600,
                  lineHeight: 1.35,
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                  minWidth: 0,
                  textAlign: "left",
                }}
              >
                {hasValue(field.value) ? String(field.value) : "—"}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// EXACT copy of your app's chit chat labels (no guessing)
const chitChatMeta = {
  "what-happened": { label: "What Happened Next?" },
  "if-you-were-me": { label: "If You Were Me" },
  "complete-poem": { label: "Complete a Poem" },
  "unpopular-opinion": { label: "Unpopular Opinion" },
  "dont-usually-ask": { label: "I Don’t Usually Ask That" },
  "emoji-story": { label: "Emoji To Story" },
};

function formatChitChatType(type) {
  return chitChatMeta[type]?.label || type || "Unknown";
}

// Change this if the deployed callable delete function uses a different exported name.
const DELETE_USER_FUNCTION_NAME = "adminRequestUserDeletion";
const FUNCTIONS_REGION = "us-central1";
const MOBILE_BREAKPOINT = 768;

// can delete this comment

const QUICK_REASONS = [
  "User requested deletion",
  "Old account",
  "Duplicate account",
  "Spam account",
  "Abusive behavior",
  "Fake profile",
  "Test account cleanup",
  "Privacy request",
  "Other",
];

async function callDeleteUser(firebaseApp, uid, reason) {
  const functions = getFunctions(firebaseApp, FUNCTIONS_REGION);
  const callable = httpsCallable(functions, DELETE_USER_FUNCTION_NAME);
  return callable({
    uid,
    reason: reason.trim(),
  });
}

export default function UserLookupPanel({
  lookupUid,
  setLookupUid,
  lookupName,
  setLookupName,
  lookupLoading,
  lookupError,
  lookupResult,
  lookupMatches,
  lookupUserByUid,
  lookupUsersByName,
  loadLookupUserByUid,
  banLookupUser,
  onViewChats,
  lookupHistory = [],
  loadLookupHistoryItem,
  clearLookupHistory,
}) {
  const profile = lookupResult?.profileData || {};
  const statusData = lookupResult?.statusData || {};

  const displayName = profile.name || "No name";
  const photoUri = profile.photoUri || "";

  const chitChats = Array.isArray(profile.chitchats) ? profile.chitchats : [];
  const isBanned = lookupResult?.banned === true;

  const { currentEnv, firebase: envFirebase } = useEnv();
  const adminUser = envFirebase.auth.currentUser;

  const uidDropdownRef = useRef(null);
  const nameDropdownRef = useRef(null);
  const reasonInputRef = useRef(null);

  const [showUidHistory, setShowUidHistory] = useState(false);
  const [showNameHistory, setShowNameHistory] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteUidConfirm, setDeleteUidConfirm] = useState("");
  const [deleteProdConfirm, setDeleteProdConfirm] = useState("");
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [deleteSuccess, setDeleteSuccess] = useState("");
  const [showBarVisitsModal, setShowBarVisitsModal] = useState(false);
  const [barVisitsLoading, setBarVisitsLoading] = useState(false);
  const [barVisitsError, setBarVisitsError] = useState("");
  const [barVisits, setBarVisits] = useState([]);
  const [collapsedPanels, setCollapsedPanels] = useState({
    profile: false,
    account: false,
    status: false,
  });

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

  const isAlreadyDeleted = !!(
    lookupResult?.profileData?.deleted || lookupResult?.profileData?.anonymized
  );
  const isSelf = !!(
    lookupResult?.uid &&
    adminUser?.uid &&
    lookupResult.uid === adminUser.uid
  );
  const canDelete =
    !!lookupResult?.uid && !!adminUser?.uid && !isSelf && !isAlreadyDeleted;

  function handleOpenDeleteModal() {
    setDeleteReason("");
    setDeleteUidConfirm("");
    setDeleteProdConfirm("");
    setDeleteError("");
    setDeleteSuccess("");
    setShowDeleteModal(true);
  }

  function handleCloseDeleteModal() {
    setShowDeleteModal(false);
    setDeleteReason("");
    setDeleteUidConfirm("");
    setDeleteProdConfirm("");
    setDeleteError("");
  }

  async function handleDeleteUser() {
    const targetUid = lookupResult?.uid;
    const trimmedReason = deleteReason.trim();

    if (!targetUid) {
      setDeleteError("No user selected.");
      return;
    }
    if (!adminUser) {
      setDeleteError("No signed-in admin.");
      return;
    }
    if (targetUid === adminUser.uid) {
      setDeleteError("You cannot delete yourself.");
      return;
    }
    if (trimmedReason.length < 5) {
      setDeleteError("Reason must be at least 5 characters.");
      return;
    }
    if (trimmedReason.length > 200) {
      setDeleteError("Reason must be 200 characters or fewer.");
      return;
    }
    if (deleteUidConfirm !== targetUid) {
      setDeleteError("UID confirmation does not match.");
      return;
    }
    if (currentEnv === "prod" && deleteProdConfirm !== "DELETE PROD USER") {
      setDeleteError(
        'Type "DELETE PROD USER" exactly to confirm production deletion.',
      );
      return;
    }

    setDeleteLoading(true);
    setDeleteError("");

    try {
      const result = await callDeleteUser(
        envFirebase.app,
        targetUid,
        trimmedReason,
      );
      const responseData = result?.data ?? {};
      const serverSaysFailed =
        responseData?.success === false ||
        responseData?.ok === false ||
        responseData?.deleted === false;

      if (serverSaysFailed) {
        throw new Error(
          responseData?.message || "Server did not confirm user deletion.",
        );
      }

      setShowDeleteModal(false);
      setDeleteReason("");
      setDeleteUidConfirm("");
      setDeleteProdConfirm("");
      setDeleteError("");

      const serverMessage =
        typeof responseData?.message === "string" && responseData.message.trim()
          ? responseData.message.trim()
          : "";

      if (typeof loadLookupUserByUid === "function") {
        const reloaded = await loadLookupUserByUid(targetUid);

        if (reloaded?.uid) {
          setDeleteSuccess(
            serverMessage ||
              "Delete request completed, but user data still exists. Check the Cloud Function logs/status.",
          );
        } else {
          setDeleteSuccess(
            serverMessage || "User deleted/anonymized successfully.",
          );
        }
      } else {
        setDeleteSuccess(
          serverMessage || "User deleted/anonymized successfully.",
        );
      }
    } catch (err) {
      console.error("Delete user failed:", {
        code: err?.code,
        message: err?.message,
      });
      const code = err?.code || "";
      const serverMessage = err?.message || "";
      let userMessage;
      if (code === "functions/permission-denied") {
        userMessage = "You do not have permission to delete users.";
      } else if (code === "functions/not-found") {
        userMessage = "User not found or already deleted.";
      } else if (code === "functions/invalid-argument") {
        userMessage = serverMessage || "Missing or invalid deletion request.";
      } else {
        userMessage = serverMessage || "Failed to delete user.";
      }
      setDeleteError(userMessage);
    } finally {
      setDeleteLoading(false);
    }
  }

  function handleCloseBarVisitsModal() {
    setShowBarVisitsModal(false);
    setBarVisitsError("");
  }

  function togglePanel(panelKey) {
    setCollapsedPanels((current) => ({
      ...current,
      [panelKey]: !current[panelKey],
    }));
  }

  async function handleViewBarVisits() {
    const uid = lookupResult?.uid;

    if (!uid) {
      setBarVisitsError("No user selected.");
      return;
    }

    setShowBarVisitsModal(true);
    setBarVisitsLoading(true);
    setBarVisitsError("");
    setBarVisits([]);

    try {
      const db = getFirestore(envFirebase.app);
      const visitsRef = collection(db, "users", uid, "barVisits");
      const visitsQuery = query(
        visitsRef,
        orderBy("enteredAt", "desc"),
        limit(50),
      );

      const snapshot = await getDocs(visitsQuery);

      const visits = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));

      setBarVisits(visits);
    } catch (error) {
      console.error("Failed to load bar visits:", error);
      setBarVisitsError(error?.message || "Failed to load bar visits.");
    } finally {
      setBarVisitsLoading(false);
    }
  }

  const trimmedReason = deleteReason.trim();
  const reasonValid = trimmedReason.length >= 5 && trimmedReason.length <= 200;
  const uidConfirmValid = deleteUidConfirm === lookupResult?.uid;
  const prodConfirmValid =
    currentEnv !== "prod" || deleteProdConfirm === "DELETE PROD USER";
  const canSubmitDelete =
    canDelete &&
    reasonValid &&
    uidConfirmValid &&
    prodConfirmValid &&
    !deleteLoading;

  const createdAt = pickFirstValue(
    profile.createdAt,
    profile.created_at,
    profile.created,
    profile.timestamp,
  );
  const updatedAt = pickFirstValue(
    profile.updatedAt,
    profile.updated_at,
    profile.updated,
    profile.lastUpdatedAt,
    profile.last_updated_at,
    profile.timestamps?.updatedAt,
    statusData.updatedAt,
    statusData.updated_at,
    statusData.lastChanged,
    statusData.last_changed,
    statusData.timestamp,
  );
  const lastActiveAt = pickFirstValue(
    profile.lastActiveAt,
    profile.lastActive,
    profile.last_active,
    profile.lastSeenAt,
    profile.lastSeen,
    profile.last_seen,
    profile.lastOnlineAt,
    profile.lastOnline,
    profile.last_online,
    profile.presence?.lastActive,
    profile.presence?.last_changed,
    profile.meta?.lastActive,
    profile.meta?.last_changed,
    profile.timestamps?.lastActive,
    profile.timestamps?.last_changed,
    statusData.lastActive,
    statusData.last_active,
    statusData.lastChanged,
    statusData.last_changed,
    statusData.lastOnline,
    statusData.last_online,
    statusData.lastSeen,
    statusData.last_seen,
    statusData.offlineAt,
    statusData.offline_at,
    statusData.timestamp,
    updatedAt,
  );

  const vipValue = hasValue(profile.vip) ? profile.vip : profile.isVip;
  const subscriptionActiveValue = hasValue(profile.subscriptionActive)
    ? profile.subscriptionActive
    : profile.premium;
  const chitChatSummary =
    chitChats.length > 0
      ? chitChats
          .map((chat) => {
            const typeLabel = formatChitChatType(chat?.type);
            const content = hasValue(chat?.content) ? chat.content : "No text";
            return `${typeLabel}: ${content}`;
          })
          .join("\n")
      : "None";

  const accountFields = [
    { label: "UID", value: lookupResult?.uid || "—" },
    { label: "Email", value: profile.email || "—" },
    { label: "Platform", value: formatPlatform(profile.pushTokenType) },
    { label: "Role", value: profile.role || "—" },
    { label: "Provider", value: profile.provider || "—" },
    { label: "Providers", value: formatList(profile.providers) },
    {
      label: "Profile Complete",
      value: formatBool(profile.profileComplete),
    },
    { label: "Created At", value: formatDate(createdAt) },
    { label: "Updated At", value: formatDate(updatedAt) },
    { label: "Last Active", value: formatDate(lastActiveAt) },
  ];

  const profileFields = [
    { label: "Name", value: profile.name || "—" },
    { label: "Username", value: profile.username || "—" },
    { label: "Age", value: hasValue(profile.age) ? String(profile.age) : "—" },
    { label: "Location", value: profile.location || "—" },
    { label: "About", value: profile.about || "—" },
    { label: "Chit Chats", value: chitChatSummary },
  ];

  const statusFields = [
    { label: "Online", value: formatBool(lookupResult?.online) },
    { label: "Banned", value: formatBool(isBanned) },
    { label: "Deleted", value: formatBool(profile.deleted) },
    { label: "Anonymized", value: formatBool(profile.anonymized) },
    { label: "VIP", value: formatBool(vipValue) },
    {
      label: "Subscription Active",
      value: formatBool(subscriptionActiveValue),
    },
    {
      label: "Balance / Moneys",
      value: formatNumber(
        profile.moneys ?? profile.money ?? profile.balance ?? profile.coins,
      ),
    },
    {
      label: "Bar Visits",
      value: formatNumber(profile.barVisitCount),
    },
    {
      label: "Last Bar Visit",
      value: formatDate(profile.lastBarVisitAt),
    },
  ];

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        uidDropdownRef.current &&
        !uidDropdownRef.current.contains(event.target)
      ) {
        setShowUidHistory(false);
      }

      if (
        nameDropdownRef.current &&
        !nameDropdownRef.current.contains(event.target)
      ) {
        setShowNameHistory(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>User Lookup</h2>

      <p style={styles.sectionLabel}>Search by UID</p>

      <div
        ref={uidDropdownRef}
        style={{
          position: "relative",
        }}
      >
        <div
          style={{
            ...styles.lookupRow,
            ...(isMobile
              ? { flexDirection: "column", alignItems: "stretch" }
              : {}),
          }}
        >
          <input
            type="text"
            value={lookupUid}
            onChange={(e) => setLookupUid(e.target.value)}
            onFocus={() => {
              setShowUidHistory(true);
              setShowNameHistory(false);
            }}
            placeholder="Enter user UID"
            style={{ ...styles.input, margin: 0 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setShowUidHistory(false);
                lookupUserByUid();
              }
            }}
          />

          <button
            onClick={() => {
              setShowUidHistory(false);
              lookupUserByUid();
            }}
            disabled={lookupLoading}
            style={{
              ...styles.primaryButton,
              background: adminColors.accentPrimary,
              minWidth: "140px",
              ...(isMobile ? { width: "100%", minWidth: 0 } : {}),
            }}
          >
            {lookupLoading ? "Searching..." : "Look Up UID"}
          </button>
        </div>

        {showUidHistory && lookupHistory.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              right: 0,
              zIndex: 20,
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
                Recent Searches
              </p>

              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearLookupHistory}
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
                maxHeight: isMobile ? 260 : 320,
                overflowY: "auto",
              }}
            >
              {lookupHistory.map((item) => (
                <button
                  key={item.uid}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setLookupUid(item.uid);
                    setShowUidHistory(false);
                    loadLookupHistoryItem?.(item.uid);
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
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 4,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {item.name || "No name"}
                    </div>

                    <span
                      style={{
                        fontSize: 11,
                        opacity: 0.75,
                        flexShrink: 0,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {item.searchType === "name" ? "Name match" : "UID"}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.8,
                      wordBreak: "break-all",
                      marginBottom: 4,
                    }}
                  >
                    UID: {item.uid}
                  </div>

                  <div style={{ fontSize: 11, opacity: 0.65 }}>
                    {formatDate(item.searchedAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <p style={{ ...styles.sectionLabel, marginTop: 18 }}>Search by Name</p>

      <div
        ref={nameDropdownRef}
        style={{
          position: "relative",
        }}
      >
        <div
          style={{
            ...styles.lookupRow,
            ...(isMobile
              ? { flexDirection: "column", alignItems: "stretch" }
              : {}),
          }}
        >
          <input
            type="text"
            value={lookupName}
            onChange={(e) => setLookupName(e.target.value)}
            onFocus={() => {
              setShowNameHistory(true);
              setShowUidHistory(false);
            }}
            placeholder="Enter full or partial name"
            style={{ ...styles.input, margin: 0 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setShowNameHistory(false);
                lookupUsersByName();
              }
            }}
          />

          <button
            onClick={() => {
              setShowNameHistory(false);
              lookupUsersByName();
            }}
            disabled={lookupLoading}
            style={{
              ...styles.primaryButton,
              background: adminColors.accentSecondary,
              minWidth: "140px",
              ...(isMobile ? { width: "100%", minWidth: 0 } : {}),
            }}
          >
            {lookupLoading ? "Searching..." : "Look Up Name"}
          </button>
        </div>

        {showNameHistory && lookupHistory.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              left: 0,
              right: 0,
              zIndex: 20,
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
                Recent Searches
              </p>

              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={clearLookupHistory}
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
                maxHeight: isMobile ? 260 : 320,
                overflowY: "auto",
              }}
            >
              {lookupHistory.map((item) => (
                <button
                  key={item.uid}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setLookupName(item.name || "");
                    setShowNameHistory(false);
                    loadLookupHistoryItem?.(item.uid);
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
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 12,
                      marginBottom: 4,
                    }}
                  >
                    <div style={{ fontWeight: 700 }}>
                      {item.name || "No name"}
                    </div>

                    <span
                      style={{
                        fontSize: 11,
                        opacity: 0.75,
                        flexShrink: 0,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {item.searchType === "name" ? "Name match" : "UID"}
                    </span>
                  </div>

                  <div
                    style={{
                      fontSize: 12,
                      opacity: 0.8,
                      wordBreak: "break-all",
                      marginBottom: 4,
                    }}
                  >
                    UID: {item.uid}
                  </div>

                  <div style={{ fontSize: 11, opacity: 0.65 }}>
                    {formatDate(item.searchedAt)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {lookupError ? (
        <p style={{ ...styles.errorText, marginTop: 14 }}>{lookupError}</p>
      ) : null}

      {Array.isArray(lookupMatches) && lookupMatches.length > 0 && (
        <div style={{ marginTop: 18 }}>
          <p style={styles.sectionLabel}>Matching Users</p>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 10,
              marginTop: 8,
            }}
          >
            {lookupMatches.map((match) => (
              <button
                key={match.uid}
                onClick={() => loadLookupUserByUid(match.uid)}
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
                <div style={{ fontWeight: 700, marginBottom: 4 }}>
                  {match.name || "No name"}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    opacity: 0.8,
                    wordBreak: "break-all",
                  }}
                >
                  UID: {match.uid}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {deleteSuccess && (
        <p
          style={{
            marginTop: 14,
            color: adminColors.accentSuccess,
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          {deleteSuccess}
        </p>
      )}

      {lookupResult && (
        <div style={styles.profileCard}>
          <div
            style={{
              ...styles.profileTop,
              ...(isMobile
                ? { flexDirection: "column", alignItems: "stretch" }
                : {}),
            }}
          >
            <div style={styles.avatarWrap}>
              {photoUri ? (
                <img
                  src={photoUri}
                  alt={displayName}
                  style={styles.avatarImage}
                />
              ) : (
                <div style={styles.avatarFallback}>No Image</div>
              )}
            </div>

            <div style={styles.profileMainInfo}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: 12,
                  ...(isMobile ? { flexDirection: "column" } : {}),
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={styles.profileNameRow}>
                    <h3 style={styles.profileName}>{displayName}</h3>

                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          ...styles.statusBadge,
                          background: lookupResult.online
                            ? adminColors.accentSuccess
                            : adminColors.disabledBg,
                        }}
                      >
                        {lookupResult.online ? "Online" : "Offline"}
                      </span>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 12,
                    flexShrink: 0,
                    ...(isMobile
                      ? { alignItems: "stretch", width: "100%" }
                      : {}),
                  }}
                >
                  {isBanned && (
                    <span
                      style={{
                        ...styles.statusBadge,
                        background: "#7f1d1d",
                      }}
                    >
                      Banned
                    </span>
                  )}

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      width: "100%",
                      padding: 10,
                      borderRadius: 12,
                      border: `1px solid ${adminColors.borderSoft}`,
                      background: adminColors.overlaySoft,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: adminColors.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        textAlign: "left",
                      }}
                    >
                      Navigation
                    </div>

                    <button
                      onClick={() => onViewChats?.(lookupResult?.uid)}
                      disabled={!lookupResult?.uid}
                      style={{
                        ...styles.primaryButton,
                        background: adminColors.accentPrimary,
                        minWidth: "110px",
                        padding: "8px 14px",
                        ...(isMobile ? { width: "100%", minWidth: 0 } : {}),
                      }}
                    >
                      View Chats
                    </button>

                    <button
                      onClick={handleViewBarVisits}
                      disabled={!lookupResult?.uid}
                      style={{
                        ...styles.primaryButton,
                        background:
                          adminColors.accentSecondary ||
                          adminColors.accentInfo ||
                          adminColors.accentPrimary,
                        minWidth: "110px",
                        padding: "8px 14px",
                        ...(isMobile ? { width: "100%", minWidth: 0 } : {}),
                      }}
                    >
                      View Bar Visits
                    </button>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 8,
                      width: "100%",
                      padding: 10,
                      borderRadius: 12,
                      border: `1px solid ${adminColors.borderSoft}`,
                      background: adminColors.overlaySoft,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 10,
                        color: adminColors.textMuted,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        textAlign: "left",
                      }}
                    >
                      Moderation
                    </div>

                    <button
                      onClick={() => banLookupUser?.()}
                      disabled={!lookupResult?.uid}
                      style={{
                        ...styles.primaryButton,
                        background: isBanned ? "#065f46" : "#b91c1c",
                        minWidth: "110px",
                        padding: "8px 14px",
                        ...(isMobile ? { width: "100%", minWidth: 0 } : {}),
                      }}
                    >
                      {isBanned ? "Unban" : "Ban User"}
                    </button>

                    {isAlreadyDeleted ? (
                      <button
                        disabled
                        style={{
                          ...styles.primaryButton,
                          background: adminColors.disabledBg,
                          minWidth: "110px",
                          padding: "8px 14px",
                          cursor: "not-allowed",
                          opacity: 0.6,
                          ...(isMobile ? { width: "100%", minWidth: 0 } : {}),
                        }}
                      >
                        User already deleted
                      </button>
                    ) : isSelf ? (
                      <button
                        disabled
                        style={{
                          ...styles.primaryButton,
                          background: adminColors.disabledBg,
                          minWidth: "110px",
                          padding: "8px 14px",
                          cursor: "not-allowed",
                          opacity: 0.6,
                          ...(isMobile ? { width: "100%", minWidth: 0 } : {}),
                        }}
                      >
                        Cannot delete yourself
                      </button>
                    ) : (
                      <button
                        onClick={handleOpenDeleteModal}
                        disabled={!canDelete}
                        style={{
                          ...styles.primaryButton,
                          background: canDelete
                            ? "#7f1d1d"
                            : adminColors.disabledBg,
                          minWidth: "110px",
                          padding: "8px 14px",
                          border: canDelete ? "1px solid #b91c1c" : "none",
                          ...(isMobile ? { width: "100%", minWidth: 0 } : {}),
                        }}
                      >
                        Delete user
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ marginTop: 14 }}>
            <FieldGrid
              title="Profile"
              fields={profileFields}
              collapsible
              collapsed={collapsedPanels.profile}
              onToggle={() => togglePanel("profile")}
            />
            <FieldGrid
              title="Account"
              fields={accountFields}
              collapsible
              collapsed={collapsedPanels.account}
              onToggle={() => togglePanel("account")}
            />
            <FieldGrid
              title="Status"
              fields={statusFields}
              collapsible
              collapsed={collapsedPanels.status}
              onToggle={() => togglePanel("status")}
            />
          </div>
        </div>
      )}
      {showBarVisitsModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? 12 : 24,
          }}
        >
          <div
            style={{
              background: adminColors.surface,
              border: `1px solid ${adminColors.borderSoft}`,
              borderRadius: 18,
              padding: 24,
              maxWidth: isMobile ? "100%" : 850,
              width: "100%",
              boxSizing: "border-box",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: 16,
                flexWrap: "wrap",
              }}
            >
              <div>
                <h2
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: 22,
                    color: adminColors.textPrimary,
                  }}
                >
                  Bar Visits
                </h2>
                <p
                  style={{
                    margin: "0 0 4px 0",
                    fontSize: 13,
                    color: adminColors.textSecondary,
                  }}
                >
                  Showing latest 50 visits
                </p>
                <div
                  style={{
                    fontSize: 13,
                    color: adminColors.textSecondary,
                    lineHeight: 1.5,
                    wordBreak: "break-word",
                  }}
                >
                  <div>
                    Name: <strong>{displayName}</strong>
                  </div>
                  <div>
                    UID: <strong>{lookupResult?.uid || "—"}</strong>
                  </div>
                </div>
              </div>

              <button
                onClick={handleCloseBarVisitsModal}
                disabled={barVisitsLoading}
                style={styles.secondaryButton}
              >
                Close
              </button>
            </div>

            {barVisitsLoading ? (
              <p
                style={{
                  margin: 0,
                  color: adminColors.textSecondary,
                  fontSize: 14,
                }}
              >
                Loading bar visits...
              </p>
            ) : barVisitsError ? (
              <p
                style={{
                  margin: 0,
                  color: adminColors.danger,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                {barVisitsError}
              </p>
            ) : barVisits.length === 0 ? (
              <p
                style={{
                  margin: 0,
                  color: adminColors.textSecondary,
                  fontSize: 14,
                }}
              >
                No bar visits recorded yet.
              </p>
            ) : (
              <div
                style={{
                  border: `1px solid ${adminColors.borderSoft}`,
                  borderRadius: 14,
                  background: adminColors.overlaySoft,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    overflowX: "auto",
                  }}
                >
                  <div
                    style={{
                      minWidth: 560,
                    }}
                  >
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1.4fr 1.4fr 1fr",
                        gap: 12,
                        padding: "12px 14px",
                        borderBottom: `1px solid ${adminColors.borderSoft}`,
                        color: adminColors.textMuted,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                      }}
                    >
                      <div>Entered</div>
                      <div>Exited</div>
                      <div>Duration</div>
                    </div>

                    {barVisits.map((visit, index) => (
                      <div
                        key={visit.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.4fr 1.4fr 1fr",
                          gap: 12,
                          padding: "12px 14px",
                          borderBottom:
                            index === barVisits.length - 1
                              ? "none"
                              : `1px solid ${adminColors.borderSoft}`,
                          color: adminColors.textPrimary,
                          fontSize: 13,
                          alignItems: "start",
                        }}
                      >
                        <div>{formatDate(visit.enteredAt)}</div>
                        <div>{formatDate(visit.exitedAt)}</div>
                        <div>
                          {formatDurationMs(visit.durationMs, visit.status)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {showDeleteModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 100,
            background: "rgba(0,0,0,0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? 12 : 24,
          }}
        >
          <div
            style={{
              background: adminColors.surface,
              border: `2px solid ${adminColors.dangerSoftBorder}`,
              borderRadius: 18,
              padding: 28,
              maxWidth: isMobile ? "100%" : 520,
              width: "100%",
              boxSizing: "border-box",
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <h2
              style={{
                margin: "0 0 6px 0",
                fontSize: 22,
                color: adminColors.danger,
              }}
            >
              Delete user?
            </h2>

            <p
              style={{
                margin: "0 0 16px 0",
                fontSize: 13,
                color: adminColors.textSecondary,
                lineHeight: 1.5,
              }}
            >
              This will delete/anonymize the user account through the
              server-side deletion function. This action cannot be undone.
            </p>

            <div
              style={{
                background:
                  currentEnv === "prod"
                    ? "rgba(127,29,29,0.3)"
                    : adminColors.overlaySoft,
                border: `1px solid ${
                  currentEnv === "prod"
                    ? adminColors.dangerSoftBorder
                    : adminColors.borderSoft
                }`,
                borderRadius: 10,
                padding: "10px 14px",
                marginBottom: 16,
                fontSize: 13,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>
                Environment:{" "}
                <span
                  style={{
                    color:
                      currentEnv === "prod"
                        ? adminColors.danger
                        : adminColors.accentSuccess,
                  }}
                >
                  {currentEnv === "prod" ? "PROD" : "DEV"}
                </span>
              </div>
              {displayName && (
                <div style={{ marginBottom: 4 }}>
                  Name: <strong>{displayName}</strong>
                </div>
              )}
              {lookupResult?.profileData?.email && (
                <div style={{ marginBottom: 4 }}>
                  Email: <strong>{lookupResult.profileData.email}</strong>
                </div>
              )}
              <div style={{ wordBreak: "break-all" }}>
                UID: <strong>{lookupResult?.uid}</strong>
              </div>
            </div>

            <p
              style={{
                margin: "0 0 6px 0",
                fontSize: 13,
                color: adminColors.textSecondary,
                fontWeight: 600,
              }}
            >
              Reason for deletion
            </p>

            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginBottom: 10,
              }}
            >
              {QUICK_REASONS.map((qr) => {
                const isActive = deleteReason === qr;
                return (
                  <button
                    key={qr}
                    disabled={deleteLoading}
                    onClick={() => {
                      if (qr === "Other") {
                        setDeleteReason("");
                        setTimeout(() => reasonInputRef.current?.focus(), 0);
                      } else {
                        setDeleteReason(qr);
                      }
                    }}
                    style={{
                      padding: "4px 10px",
                      fontSize: 12,
                      borderRadius: 20,
                      border: `1px solid ${
                        isActive
                          ? adminColors.borderStrong
                          : adminColors.borderSoft
                      }`,
                      background: isActive
                        ? adminColors.overlayMedium
                        : adminColors.overlaySoft,
                      color: isActive
                        ? adminColors.textPrimary
                        : adminColors.textSecondary,
                      cursor: deleteLoading ? "not-allowed" : "pointer",
                      fontWeight: isActive ? 700 : 400,
                    }}
                  >
                    {qr}
                  </button>
                );
              })}
            </div>

            <textarea
              ref={reasonInputRef}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              disabled={deleteLoading}
              placeholder="Choose a common reason or write one manually"
              rows={3}
              style={{
                ...styles.input,
                resize: "vertical",
                marginBottom: 4,
                fontFamily: "inherit",
                fontSize: 14,
              }}
            />
            <p
              style={{
                margin: "0 0 16px 0",
                fontSize: 11,
                color:
                  trimmedReason.length > 200
                    ? adminColors.danger
                    : adminColors.textMuted,
                textAlign: "right",
              }}
            >
              {trimmedReason.length} / 200
            </p>

            <p
              style={{
                margin: "0 0 6px 0",
                fontSize: 13,
                color: adminColors.textSecondary,
                fontWeight: 600,
              }}
            >
              Type the user&apos;s UID to confirm
            </p>

            <input
              type="text"
              value={deleteUidConfirm}
              onChange={(e) => setDeleteUidConfirm(e.target.value)}
              disabled={deleteLoading}
              placeholder={lookupResult?.uid || "UID"}
              style={{
                ...styles.input,
                marginBottom: 16,
                fontFamily: "monospace",
                fontSize: 13,
              }}
            />

            {currentEnv === "prod" && (
              <>
                <div
                  style={{
                    background: "rgba(127,29,29,0.3)",
                    border: `1px solid ${adminColors.dangerSoftBorder}`,
                    borderRadius: 10,
                    padding: "10px 14px",
                    marginBottom: 10,
                    fontSize: 13,
                    color: adminColors.dangerSoftText,
                    fontWeight: 600,
                  }}
                >
                  ⚠ You are operating on PRODUCTION. This is irreversible.
                </div>

                <p
                  style={{
                    margin: "0 0 6px 0",
                    fontSize: 13,
                    color: adminColors.danger,
                    fontWeight: 600,
                  }}
                >
                  Type DELETE PROD USER to confirm production deletion
                </p>

                <input
                  type="text"
                  value={deleteProdConfirm}
                  onChange={(e) => setDeleteProdConfirm(e.target.value)}
                  disabled={deleteLoading}
                  placeholder="DELETE PROD USER"
                  style={{
                    ...styles.input,
                    marginBottom: 16,
                    fontFamily: "monospace",
                    fontSize: 13,
                    border: `1px solid ${adminColors.dangerSoftBorder}`,
                  }}
                />
              </>
            )}

            {deleteError && (
              <p
                style={{
                  margin: "0 0 12px 0",
                  color: adminColors.danger,
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                {deleteError}
              </p>
            )}

            <div
              style={{
                display: "flex",
                gap: 10,
                justifyContent: "flex-end",
                flexWrap: "wrap",
                ...(isMobile ? { flexDirection: "column" } : {}),
              }}
            >
              <button
                onClick={handleCloseDeleteModal}
                disabled={deleteLoading}
                style={{
                  ...styles.secondaryButton,
                  opacity: deleteLoading ? 0.5 : 1,
                  cursor: deleteLoading ? "not-allowed" : "pointer",
                  ...(isMobile ? { width: "100%" } : {}),
                }}
              >
                Cancel
              </button>

              <button
                onClick={handleDeleteUser}
                disabled={!canSubmitDelete}
                style={{
                  ...styles.primaryButton,
                  background: canSubmitDelete
                    ? "#b91c1c"
                    : adminColors.disabledBg,
                  minWidth: 120,
                  cursor: canSubmitDelete ? "pointer" : "not-allowed",
                  opacity: canSubmitDelete ? 1 : 0.6,
                  ...(isMobile ? { width: "100%", minWidth: 0 } : {}),
                }}
              >
                {deleteLoading ? "Deleting..." : "Delete user"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
