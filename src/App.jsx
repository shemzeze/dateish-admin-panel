import { useEffect, useState } from "react";
import { ref, onValue, update, get, set } from "firebase/database";
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import {
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  collection,
  getDocs,
} from "firebase/firestore";
import { ref as storageRef, getDownloadURL } from "firebase/storage";
import { firebaseEnvs } from "./firebase";
import { EnvContext } from "./context/EnvContext";
import { styles } from "./styles/adminStyles";
import Sidebar from "./components/Sidebar";
import OverviewPanel from "./features/OverviewPanel";
import ForceBarClosedPanel from "./features/ForceBarClosedPanel";
import EntranceBannerPanel from "./features/EntranceBannerPanel";
import UserLookupPanel from "./features/UserLookupPanel";
import UserChatsPanel from "./features/UserChatsPanel";
import MMChatPanel from "./features/MMChatPanel";
import ReportsPanel from "./features/ReportsPanel";
import { adminColors } from "./styles/adminColors";
import MMChatBadgeWatcher from "./features/MMChatBadgeWatcher";
import ReportsBadgeWatcher from "./features/ReportsBadgeWatcher";
import PushNotificationsPanel from "./features/PushNotificationsPanel";
import AdminAlertsPanel, {
  AdminAlertsToastOverlay,
} from "./features/AdminAlertsPanel";
import { useAdminAlerts } from "./hooks/useAdminAlerts";
import { getAllowedAdminForEnv, isAllowedAdmin } from "./constants/adminAccess";

const MAX_BANNER_HISTORY = 20;
const MM_ADMIN_UID = "mm_admin";
const ADMIN_ENV_STORAGE_KEY = "admin_selected_env";

function normalizeTimestampMs(value) {
  if (value === null || value === undefined) {
    return null;
  }

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
    const seconds = Number(value.seconds ?? value._seconds);
    if (Number.isFinite(seconds) && seconds > 0) {
      return seconds * 1000;
    }
  }

  return null;
}

function toBool(value) {
  if (value === true || value === false) return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "1") return true;
    if (normalized === "false" || normalized === "0") return false;
  }
  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return false;
}

function getRecordLastActiveMs(record) {
  if (!record) return null;

  if (typeof record !== "object") {
    return normalizeTimestampMs(record);
  }

  const candidates = [
    record.lastActive,
    record.last_active,
    record.lastChanged,
    record.last_changed,
    record.lastOnline,
    record.last_online,
    record.lastSeen,
    record.last_seen,
    record.updatedAt,
    record.updated_at,
    record.offlineAt,
    record.offline_at,
    record.timestamp,
    record.presence?.lastActive,
    record.presence?.last_changed,
    record.meta?.lastActive,
    record.meta?.last_changed,
    record.timestamps?.lastActive,
    record.timestamps?.last_changed,
  ];

  for (const candidate of candidates) {
    const parsed = normalizeTimestampMs(candidate);
    if (parsed !== null) {
      return parsed;
    }
  }

  return null;
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

function confirmProdAction(env, actionName) {
  if (env !== "prod") return true;
  return window.confirm(
    `You are about to ${actionName} in PROD. Are you sure?`,
  );
}

export default function App() {
  const [user, setUser] = useState(null);

  const [env, setEnv] = useState(() => {
    try {
      const stored = localStorage.getItem(ADMIN_ENV_STORAGE_KEY);
      return stored === "prod" ? "prod" : "dev";
    } catch {
      return "dev";
    }
  });
  const firebase = firebaseEnvs[env];
  const { db, auth, firestore, storage } = firebase;

  const [activeSection, setActiveSection] = useState("overview");
  const [selectedUserUid, setSelectedUserUid] = useState("");
  const [userChatsReturnSection, setUserChatsReturnSection] =
    useState("overview");

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth <= 768 : false,
  );

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const [forceBarClosed, setForceBarClosed] = useState(null);
  const [entranceBannerText, setEntranceBannerText] = useState("");
  const [bannerInput, setBannerInput] = useState("");
  const [bannerHistory, setBannerHistory] = useState([]);
  const [selectedHistoryValue, setSelectedHistoryValue] = useState("");

  const [lookupUid, setLookupUid] = useState("");
  const [lookupName, setLookupName] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupMatches, setLookupMatches] = useState([]);

  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const [bannerSaving, setBannerSaving] = useState(false);
  const [copyMessage, setCopyMessage] = useState("");
  const [pendingEnvSwitch, setPendingEnvSwitch] = useState(null);

  const [onlineUsers, setOnlineUsers] = useState([]);
  const [recentlyOnlineUsers, setRecentlyOnlineUsers] = useState([]);
  const [sectionBadges, setSectionBadges] = useState({});

  const adminAlerts = useAdminAlerts({
    firebase,
    currentEnv: env,
    adminUser: user,
  });

  const forceBarClosedRef = ref(db, "accessControl/forceBarClosed");
  const uiDocRef = doc(firestore, "appConfig", "ui");

  const [lookupHistory, setLookupHistory] = useState(() => {
    try {
      const raw = localStorage.getItem("admin_lookup_history");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  function pushLookupHistoryItem(item) {
    if (!item?.uid) return;

    setLookupHistory((prev) => {
      const next = [
        {
          uid: item.uid,
          name: item.name || "No name",
          searchType: item.searchType || "uid",
          searchedAt: Date.now(),
        },
        ...prev.filter((entry) => entry.uid !== item.uid),
      ].slice(0, 10);

      try {
        localStorage.setItem("admin_lookup_history", JSON.stringify(next));
      } catch (err) {
        void err;
      }

      return next;
    });
  }

  function clearLookupHistory() {
    setLookupHistory([]);

    try {
      localStorage.removeItem("admin_lookup_history");
    } catch (err) {
      void err;
    }
  }

  const resetAdminViewState = () => {
    setForceBarClosed(null);
    setEntranceBannerText("");
    setBannerInput("");
    setBannerHistory([]);
    setSelectedHistoryValue("");
    setLookupUid("");
    setLookupName("");
    setLookupResult(null);
    setLookupMatches([]);
    setLookupError("");
    setOnlineUsers([]);
    setRecentlyOnlineUsers([]);
    setSectionBadges({});
    setSelectedUserUid("");
    setUserChatsReturnSection("overview");
    setActiveSection("overview");
  };

  const clearAdminSessionState = () => {
    resetAdminViewState();
    setLookupHistory([]);
    try {
      localStorage.removeItem("admin_lookup_history");
    } catch (err) {
      void err;
    }
    try {
      sessionStorage.removeItem("admin_auth_state");
    } catch (err) {
      void err;
    }
  };

  const signOutAdmin = async (authInstance = auth) => {
    await signOut(authInstance);
  };

  const getAccessDeniedMessage = (targetEnv) => {
    const allowed = getAllowedAdminForEnv(targetEnv);
    return `This Google account is not allowed to access the ${allowed.label} admin panel.`;
  };

  const requestEnvironmentSwitch = (nextEnv) => {
    if (nextEnv === env) return;
    setPendingEnvSwitch({ from: env, to: nextEnv });
  };

  const confirmEnvironmentSwitch = async () => {
    if (!pendingEnvSwitch) return;

    const nextEnv = pendingEnvSwitch.to;
    const nextAllowed = getAllowedAdminForEnv(nextEnv);

    setLoading(true);
    setAuthLoading(true);
    setError("");
    setInfoMessage("");

    try {
      await signOutAdmin(auth);
    } catch (err) {
      console.error("Failed to sign out before environment switch:", err);
      setLoading(false);
      setAuthLoading(false);
      setError(err.message || "Failed to switch environment");
      setPendingEnvSwitch(null);
      return;
    }

    clearAdminSessionState();
    setUser(null);
    setEnv(nextEnv);
    setPendingEnvSwitch(null);

    try {
      localStorage.setItem(ADMIN_ENV_STORAGE_KEY, nextEnv);
    } catch (err) {
      void err;
    }

    setInfoMessage(
      `Switched to ${nextAllowed.label}. Please sign in with the ${nextAllowed.label} admin Google account.`,
    );
    setLoading(false);
  };

  useEffect(() => {
    setAuthLoading(true);
    const unsubAuth = onAuthStateChanged(firebase.auth, async (u) => {
      if (!u) {
        setUser(null);
        setAuthLoading(false);
        return;
      }

      if (!isAllowedAdmin(u, env)) {
        setUser(null);
        setAuthLoading(false);
        setError(getAccessDeniedMessage(env));

        try {
          await signOutAdmin(firebase.auth);
        } catch (err) {
          console.error("Auto sign-out for unauthorized account failed:", err);
        }

        return;
      }

      setUser(u);
      setError("");
      setAuthLoading(false);
    });

    return () => unsubAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env]);

  useEffect(() => {
    if (!user) {
      resetAdminViewState();
      return;
    }

    const unsubRtdb = onValue(
      forceBarClosedRef,
      (snapshot) => {
        const val = snapshot.val();

        setForceBarClosed({
          enabled:
            val === true || val?.enabled === true || val?.enabled === "true",
          updatedAt: val?.updatedAt || null,
        });

        setError("");
      },
      (err) => {
        console.error("RTDB read failed:", err);
        setError(err.message || "Failed to read forceBarClosed");
      },
    );
    const unsubFirestore = onSnapshot(
      uiDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const text = data.entranceBannerText || "";
          const history = Array.isArray(data.entranceBannerHistory)
            ? data.entranceBannerHistory
            : [];

          setEntranceBannerText(text);
          setBannerInput(text);
          setBannerHistory(history);
          setSelectedHistoryValue("");
        } else {
          setEntranceBannerText("");
          setBannerInput("");
          setBannerHistory([]);
          setSelectedHistoryValue("");
        }
      },
      (err) => {
        console.error("Firestore read failed:", err);
        setError(err.message || "Failed to read appConfig/ui");
      },
    );

    return () => {
      unsubRtdb();
      unsubFirestore();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, db, firestore]);

  useEffect(() => {
    if (!user) return;

    let profilesMap = {};
    let statusMap = {};

    const rebuildOverviewLists = () => {
      const allProfiles = Object.entries(profilesMap).map(([uid, data]) => ({
        uid,
        ...(data || {}),
      }));

      const currentOnlineUsers = allProfiles
        .filter((profile) => {
          const status = statusMap?.[profile.uid];

          return toBool(status?.online) && toBool(status?.bar);
        })
        .map((profile) => ({
          uid: profile.uid,
          name:
            profile.name ||
            profile.username ||
            profile.displayName ||
            "Unnamed user",
        }))
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""));

      const allKnownUids = new Set([
        ...Object.keys(statusMap || {}),
        ...Object.keys(profilesMap || {}),
      ]);

      const currentRecentlyOnlineUsers = Array.from(allKnownUids)
        .filter((uid) => uid !== MM_ADMIN_UID)
        .map((uid) => {
          const status = statusMap?.[uid] || null;
          const profile = profilesMap?.[uid] || null;
          const hasStatusRecord =
            statusMap && Object.prototype.hasOwnProperty.call(statusMap, uid);

          const lastActiveMs =
            getRecordLastActiveMs(status) ?? getRecordLastActiveMs(profile);

          return {
            uid,
            status,
            profile,
            hasStatusRecord,
            lastActiveMs,
          };
        })
        .filter((entry) => entry.hasStatusRecord || entry.lastActiveMs !== null)
        .filter(
          ({ status }) => !(toBool(status?.online) && toBool(status?.bar)),
        )
        .sort((aEntry, bEntry) => {
          if (aEntry.lastActiveMs === null && bEntry.lastActiveMs === null) {
            return aEntry.uid.localeCompare(bEntry.uid);
          }

          if (aEntry.lastActiveMs === null) return 1;
          if (bEntry.lastActiveMs === null) return -1;

          return bEntry.lastActiveMs - aEntry.lastActiveMs;
        })
        .slice(0, 25)
        .map(({ uid, status, profile, lastActiveMs }) => {
          const safeProfile = profile || {};

          return {
            uid,
            name:
              safeProfile.name ||
              safeProfile.username ||
              safeProfile.displayName ||
              "Unnamed user",
            lastActive: lastActiveMs,
            online: toBool(status?.online),
            bar: toBool(status?.bar),
          };
        });

      setOnlineUsers(currentOnlineUsers);
      setRecentlyOnlineUsers(currentRecentlyOnlineUsers);
    };

    const usersRef = collection(firestore, "users");

    const unsubUsers = onSnapshot(
      usersRef,
      (snapshot) => {
        const nextProfilesMap = {};

        snapshot.forEach((docSnap) => {
          nextProfilesMap[docSnap.id] = docSnap.data();
        });

        profilesMap = nextProfilesMap;
        rebuildOverviewLists();
      },
      (err) => {
        console.error("Failed to load users for overview:", err);
      },
    );

    const statusRef = ref(db, "status");

    const unsubStatus = onValue(
      statusRef,
      (snapshot) => {
        statusMap = snapshot.val() || {};
        rebuildOverviewLists();
      },
      (err) => {
        console.error("Failed to load status for overview:", err);
      },
    );

    return () => {
      unsubUsers();
      unsubStatus();
    };
  }, [user, db, firestore]);

  // Navigate to MM chat when a browser notification for a new MM message is clicked
  useEffect(() => {
    const handler = () => setActiveSection("mmChat");
    window.addEventListener("admin-alert-open-mm-chat", handler);
    return () =>
      window.removeEventListener("admin-alert-open-mm-chat", handler);
  }, []);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      await signInWithPopup(firebase.auth, googleProvider);
    } catch (err) {
      console.error("Login failed:", err);
      setError(err.message || "Google sign-in failed");
    }

    setLoading(false);
  };

  const handleLogout = async () => {
    setLoading(true);
    setError("");
    setInfoMessage("");

    try {
      await signOutAdmin(firebase.auth);
      clearAdminSessionState();
    } catch (err) {
      console.error("Logout failed:", err);
      setError(err.message || "Logout failed");
    }

    setLoading(false);
  };

  const toggleForceBarClosed = async () => {
    if (!forceBarClosed) return;
    const action = forceBarClosed.enabled ? "open the bar" : "close the bar";
    if (!confirmProdAction(env, action)) return;

    setLoading(true);
    setError("");

    try {
      await set(forceBarClosedRef, {
        enabled: !forceBarClosed.enabled,
        updatedAt: Date.now(),
      });
    } catch (err) {
      console.error("RTDB update failed:", err);
      setError(err.message || "Failed to update forceBarClosed");
    }

    setLoading(false);
  };

  const saveEntranceBannerText = async () => {
    if (!confirmProdAction(env, "update the entrance banner")) return;
    setBannerSaving(true);
    setError("");
    setCopyMessage("");

    try {
      const trimmedNewText = bannerInput.trim();
      const trimmedCurrentText = entranceBannerText.trim();

      let newHistory = [...bannerHistory];

      if (trimmedCurrentText && trimmedCurrentText !== trimmedNewText) {
        newHistory = [
          entranceBannerText,
          ...newHistory.filter((item) => item !== entranceBannerText),
        ];
      }

      newHistory = newHistory
        .filter((item) => item && item.trim() !== "")
        .filter((item, index, arr) => arr.indexOf(item) === index)
        .slice(0, MAX_BANNER_HISTORY);

      await setDoc(
        uiDocRef,
        {
          entranceBannerText: bannerInput,
          entranceBannerHistory: newHistory,
        },
        { merge: true },
      );
    } catch (err) {
      console.error("Firestore update failed:", err);
      setError(err.message || "Failed to update entranceBannerText");
    }

    setBannerSaving(false);
  };

  const restoreSelectedHistory = () => {
    if (!selectedHistoryValue) return;
    setBannerInput(selectedHistoryValue);
    setCopyMessage("");
  };

  const copySelectedHistory = async () => {
    if (!selectedHistoryValue) return;

    try {
      await navigator.clipboard.writeText(selectedHistoryValue);
      setCopyMessage("Copied");
    } catch (err) {
      console.error("Copy failed:", err);
      setCopyMessage("Copy failed");
    }
  };

  const getPossibleAvatarValue = (profileData) => {
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
  };

  const resolveAvatarUrl = async (avatarValue) => {
    if (!avatarValue) return "";

    if (
      avatarValue.startsWith("http://") ||
      avatarValue.startsWith("https://")
    ) {
      return avatarValue;
    }

    try {
      const fileRef = storageRef(storage, avatarValue);
      return await getDownloadURL(fileRef);
    } catch (err) {
      console.error("Failed to resolve storage image:", err);
      return "";
    }
  };

  const loadLookupUserByUid = async (uid) => {
    const cleanUid = uid?.trim();

    if (!cleanUid) {
      setLookupError("Enter a UID");
      setLookupResult(null);
      setLookupMatches([]);
      return null;
    }

    setLookupLoading(true);
    setLookupError("");
    setLookupResult(null);
    setLookupMatches([]);

    try {
      const userDocRef = doc(firestore, "users", cleanUid);
      const userSnap = await getDoc(userDocRef);

      if (!userSnap.exists()) {
        setLookupError("User not found in Firestore");
        return null;
      }

      const profileData = userSnap.data();
      setLookupUid(cleanUid);

      let onlineValue = false;
      let bannedValue = false;
      let statusData = null;

      try {
        const statusSnap = await get(ref(db, `status/${cleanUid}`));
        statusData = statusSnap.exists() ? statusSnap.val() : null;
        onlineValue = toBool(statusData?.online);
        bannedValue = toBool(statusData?.banned);
      } catch (err) {
        console.warn("Could not read user status:", err);
      }

      const avatarValue = getPossibleAvatarValue(profileData);
      const resolvedPhotoUri = await resolveAvatarUrl(avatarValue);

      const finalProfileData = {
        ...profileData,
        photoUri: resolvedPhotoUri || profileData?.photoUri || "",
      };

      const loadedUser = {
        uid: cleanUid,
        profileData: finalProfileData,
        statusData,
        online: !!onlineValue,
        banned: !!bannedValue,
      };

      setLookupResult(loadedUser);
      return loadedUser;
    } catch (err) {
      console.error("User lookup failed:", err);
      setLookupError(err.message || "Failed to look up user");
      return null;
    } finally {
      setLookupLoading(false);
    }
  };

  const openUserChats = (uid) => {
    const cleanUid = String(uid || "").trim();

    if (!cleanUid) return;

    setSelectedUserUid(cleanUid);
    setUserChatsReturnSection(activeSection || "overview");
    setActiveSection("userChats");
  };

  const openUserLookupFromReports = async (uid) => {
    const cleanUid = String(uid || "").trim();

    if (!cleanUid) return;

    setActiveSection("userLookup");
    await loadLookupUserByUid(cleanUid);
  };

  const lookupUserByUid = async () => {
    const loadedUser = await loadLookupUserByUid(lookupUid);

    if (loadedUser?.uid) {
      pushLookupHistoryItem({
        uid: loadedUser.uid,
        name: loadedUser.profileData?.name || "No name",
        searchType: "uid",
      });
    }
  };

  const lookupUsersByName = async () => {
    const cleanName = lookupName.trim();

    if (!cleanName) {
      setLookupError("Enter a name");
      setLookupResult(null);
      setLookupMatches([]);
      return;
    }

    setLookupLoading(true);
    setLookupError("");
    setLookupResult(null);
    setLookupMatches([]);

    try {
      const normalizedSearch = cleanName.toLowerCase();

      const usersRef = collection(firestore, "users");
      const snap = await getDocs(usersRef);

      const matches = snap.docs
        .map((docSnap) => {
          const data = docSnap.data();

          return {
            uid: docSnap.id,
            name: data.name || "",
            username: data.username || "",
          };
        })
        .filter((userItem) => {
          const name = (userItem.name || "").toLowerCase();
          const username = (userItem.username || "").toLowerCase();

          return (
            name.includes(normalizedSearch) ||
            username.includes(normalizedSearch)
          );
        })
        .sort((a, b) => {
          const aName = a.name || "";
          const bName = b.name || "";
          return aName.localeCompare(bName);
        });

      if (matches.length === 0) {
        setLookupError("No users found with that name");
        return;
      }

      if (matches.length === 1) {
        const loadedUser = await loadLookupUserByUid(matches[0].uid);

        if (loadedUser?.uid) {
          pushLookupHistoryItem({
            uid: loadedUser.uid,
            name: loadedUser.profileData?.name || matches[0].name || "No name",
            searchType: "name",
          });
        }

        return;
      }

      setLookupMatches(matches);
    } catch (err) {
      console.error("Name lookup failed:", err);
      setLookupError(err.message || "Failed to search by name");
    } finally {
      setLookupLoading(false);
    }
  };

  const toggleBanLookupUser = async () => {
    const uid = lookupResult?.uid;
    const isBanned = lookupResult?.banned === true;

    if (!uid) return;
    const action = isBanned ? "unban this user" : "ban this user";
    if (!confirmProdAction(env, action)) return;

    try {
      if (!isBanned) {
        // 👇 banning
        await update(ref(db, `status/${uid}`), {
          banned: true,
          online: false,
          bar: false,
          lastActive: Date.now(),
        });
      } else {
        // 👇 unbanning
        await update(ref(db, `status/${uid}`), {
          banned: false,
        });
      }

      setLookupResult((prev) =>
        prev
          ? {
              ...prev,
              banned: !isBanned,
              online: isBanned ? prev.online : false,
            }
          : prev,
      );
    } catch (err) {
      console.error("Failed to toggle ban:", err);
      alert(err.message || "Failed to update ban status");
    }
  };

  const renderMainSection = () => {
    switch (activeSection) {
      case "forceBarClosed":
        return (
          <ForceBarClosedPanel
            forceBarClosed={forceBarClosed}
            error={error}
            loading={loading}
            toggleForceBarClosed={toggleForceBarClosed}
          />
        );

      case "entranceBanner":
        return (
          <EntranceBannerPanel
            entranceBannerText={entranceBannerText}
            bannerInput={bannerInput}
            setBannerInput={setBannerInput}
            bannerSaving={bannerSaving}
            saveEntranceBannerText={saveEntranceBannerText}
            selectedHistoryValue={selectedHistoryValue}
            setSelectedHistoryValue={setSelectedHistoryValue}
            bannerHistory={bannerHistory}
            restoreSelectedHistory={restoreSelectedHistory}
            copySelectedHistory={copySelectedHistory}
            copyMessage={copyMessage}
            error={error}
            setCopyMessage={setCopyMessage}
          />
        );

      case "userLookup":
        return (
          <UserLookupPanel
            lookupUid={lookupUid}
            setLookupUid={setLookupUid}
            lookupName={lookupName}
            setLookupName={setLookupName}
            lookupLoading={lookupLoading}
            lookupError={lookupError}
            lookupResult={lookupResult}
            lookupMatches={lookupMatches}
            lookupUserByUid={lookupUserByUid}
            lookupUsersByName={lookupUsersByName}
            loadLookupUserByUid={async (uid) => {
              const loadedUser = await loadLookupUserByUid(uid);

              if (loadedUser?.uid) {
                pushLookupHistoryItem({
                  uid: loadedUser.uid,
                  name: loadedUser.profileData?.name || "No name",
                  searchType: "name",
                });
              }
            }}
            banLookupUser={toggleBanLookupUser}
            onViewChats={openUserChats}
            lookupHistory={lookupHistory}
            loadLookupHistoryItem={loadLookupUserByUid}
            clearLookupHistory={clearLookupHistory}
          />
        );

      case "reports":
        return (
          <ReportsPanel
            firebase={firebase}
            onOpenUserLookup={openUserLookupFromReports}
          />
        );

      case "userChats":
        return (
          <UserChatsPanel
            firebase={firebase}
            selectedUserUid={selectedUserUid}
            onBack={() =>
              setActiveSection(userChatsReturnSection || "overview")
            }
          />
        );

      case "mmChat":
        return (
          <MMChatPanel
            firebase={firebase}
            env={env}
            setSectionBadges={setSectionBadges}
          />
        );
      case "pushNotifications":
        return <PushNotificationsPanel firebase={firebase} env={env} />;
      case "adminAlerts":
        return (
          <AdminAlertsPanel
            alerts={adminAlerts}
            onNavigateToMmChat={() => setActiveSection("mmChat")}
          />
        );
      case "overview":
      default:
        return (
          <OverviewPanel
            forceBarClosed={forceBarClosed}
            entranceBannerText={entranceBannerText}
            bannerHistory={bannerHistory}
            onlineUsers={onlineUsers}
            recentlyOnlineUsers={recentlyOnlineUsers}
            onUserClick={(uid) => {
              setActiveSection("userLookup");
              loadLookupUserByUid(uid);
            }}
            onViewChats={openUserChats}
          />
        );
    }
  };

  const isProd = env === "prod";
  const allowedAdmin = getAllowedAdminForEnv(env);
  const envBanner = (
    <div
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        width: "100%",
        padding: "8px 20px",
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: isProd ? "#5b0b0b" : "#123d66",
        borderBottom: isProd ? "3px solid #ff5a64" : "2px solid #42a5ff",
        color: "#fff",
        fontWeight: 800,
        fontSize: 14,
        gap: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        {isProd ? (
          <span style={{ fontSize: 15, letterSpacing: 0.5 }}>
            WARNING: PROD DATABASE ACTIVE
          </span>
        ) : (
          <span>DEV ENVIRONMENT</span>
        )}
        <span
          style={{
            fontSize: 12,
            fontWeight: "normal",
            opacity: 0.75,
            fontFamily: "monospace",
          }}
        >
          {firebase.config.projectId}
        </span>
        <span style={{ fontSize: 12, opacity: 0.95 }}>
          Allowed: {allowedAdmin.email}
        </span>
      </div>
      <div style={{ display: "flex", gap: 6 }}>
        {["dev", "prod"].map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => requestEnvironmentSwitch(e)}
            disabled={env === e}
            style={{
              padding: "3px 12px",
              borderRadius: 5,
              border: "1px solid rgba(255,255,255,0.4)",
              background: env === e ? "rgba(255,255,255,0.22)" : "transparent",
              color: "#fff",
              cursor: env === e ? "default" : "pointer",
              fontWeight: "bold",
              fontSize: 12,
              textTransform: "uppercase",
            }}
          >
            {e}
          </button>
        ))}
      </div>
    </div>
  );

  const envSwitchModal = pendingEnvSwitch ? (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          background: "#252c3a",
          border: "1px solid rgba(255,255,255,0.2)",
          borderRadius: 14,
          padding: 22,
          boxSizing: "border-box",
          color: "#f5f7ff",
        }}
      >
        <h2 style={{ margin: 0, fontSize: 24 }}>Switch environment?</h2>
        <p style={{ margin: "14px 0 0 0", color: "#c2cbdf", lineHeight: 1.5 }}>
          You are about to switch from {pendingEnvSwitch.from.toUpperCase()} to{" "}
          {pendingEnvSwitch.to.toUpperCase()}. This will sign you out and take
          you back to the sign-in screen. Are you sure?
        </p>

        <div
          style={{
            marginTop: 18,
            display: "flex",
            justifyContent: "flex-end",
            gap: 10,
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => setPendingEnvSwitch(null)}
            style={{
              ...styles.secondaryButton,
              border: "1px solid rgba(255,255,255,0.2)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmEnvironmentSwitch}
            style={{
              ...styles.primaryButton,
              background:
                pendingEnvSwitch.to === "prod" ? adminColors.danger : "#2a6cc2",
            }}
          >
            Yes, switch to {pendingEnvSwitch.to.toUpperCase()}
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (authLoading) {
    return (
      <EnvContext.Provider value={{ currentEnv: env, firebase }}>
        <div style={styles.page}>
          {envBanner}
          <div style={styles.centerWrap}>
            <div style={styles.loadingCard}>
              <h1 style={styles.title}>Dateish Admin</h1>
              <p style={styles.mutedText}>Checking login...</p>
            </div>
          </div>
          {envSwitchModal}
        </div>
      </EnvContext.Provider>
    );
  }

  if (!user) {
    return (
      <EnvContext.Provider value={{ currentEnv: env, firebase }}>
        <div style={styles.page}>
          {envBanner}
          <div style={styles.centerWrap}>
            <div style={styles.loginCard}>
              <h1 style={styles.title}>Dateish Admin</h1>
              <p style={styles.subtitle}>
                Sign in to {firebase.label} admin with Google.
              </p>
              <p style={{ ...styles.mutedText, marginTop: 10 }}>
                Expected {firebase.label} admin account: {allowedAdmin.email}
              </p>

              <div style={styles.form}>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  style={{
                    ...styles.primaryButton,
                    background: isProd
                      ? adminColors.danger
                      : adminColors.accentInfo,
                    width: "100%",
                    fontWeight: 700,
                  }}
                >
                  {loading
                    ? "Signing in..."
                    : `Sign in with Google (${firebase.label})`}
                </button>

                {infoMessage ? (
                  <p
                    style={{
                      ...styles.mutedText,
                      color: adminColors.textSecondary,
                    }}
                  >
                    {infoMessage}
                  </p>
                ) : null}
                {error ? <p style={styles.errorText}>{error}</p> : null}
              </div>
            </div>
          </div>
          {envSwitchModal}
        </div>
      </EnvContext.Provider>
    );
  }

  return (
    <EnvContext.Provider value={{ currentEnv: env, firebase }}>
      <div style={{ ...styles.page, overflowX: "hidden" }}>
        {envBanner}
        <div
          style={{
            ...styles.appShell,
            ...(isMobile
              ? {
                  display: "flex",
                  flexDirection: "column",
                  padding: "0",
                  gap: 0,
                }
              : {}),
          }}
        >
          <Sidebar
            user={user}
            activeSection={activeSection}
            setActiveSection={(section) => {
              setActiveSection(section);
              if (isMobile) setSidebarOpen(false);
            }}
            handleLogout={handleLogout}
            loading={loading}
            sectionBadges={sectionBadges}
            isMobile={isMobile}
            isOpen={sidebarOpen}
            onToggle={() => setSidebarOpen((prev) => !prev)}
          />

          <main
            style={{
              ...styles.mainContent,
              ...(isMobile ? { padding: "12px" } : {}),
            }}
          >
            {renderMainSection()}
          </main>
          <AdminAlertsToastOverlay
            toasts={adminAlerts.toasts}
            onDismiss={adminAlerts.dismissToast}
            onNavigateToMmChat={() => setActiveSection("mmChat")}
          />
          <MMChatBadgeWatcher
            firebase={firebase}
            env={env}
            setSectionBadges={setSectionBadges}
          />
          <ReportsBadgeWatcher
            firebase={firebase}
            env={env}
            setSectionBadges={setSectionBadges}
          />
        </div>
        {envSwitchModal}
      </div>
    </EnvContext.Provider>
  );
}
