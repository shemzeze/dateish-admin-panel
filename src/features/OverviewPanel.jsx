import { useState, useEffect } from "react";
import { styles } from "../styles/adminStyles";
import { adminColors } from "../styles/adminColors";

const MOBILE_BREAKPOINT = 768;

function getLastConnectedParts(value) {
  if (!value) {
    return {
      formattedDate: "—",
      agoText: "",
    };
  }

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return {
        formattedDate: "—",
        agoText: "",
      };
    }

    const formattedDate = date.toLocaleString(undefined, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    let agoText = "just now";

    if (diffMinutes < 1) {
      agoText = "just now";
    } else if (diffMinutes < 60) {
      agoText = `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
    } else if (diffHours < 24) {
      agoText = `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
    } else {
      agoText = `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
    }

    return {
      formattedDate,
      agoText,
    };
  } catch {
    return {
      formattedDate: "—",
      agoText: "",
    };
  }
}

function UserRow({
  name,
  uid,
  lastActive,
  onViewProfile,
  onViewChats,
  isMobile,
}) {
  const lastConnected = getLastConnectedParts(lastActive);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 14px",
        borderRadius: 12,
        background: adminColors.overlaySoft,
        border: `1px solid ${adminColors.borderSoft}`,
        ...(isMobile ? { flexDirection: "column", alignItems: "stretch" } : {}),
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 15,
            marginBottom: 4,
            wordBreak: "break-word",
          }}
        >
          {name || "Unnamed user"}
        </div>

        <div
          style={{
            fontSize: 12,
            opacity: 0.65,
            wordBreak: "break-all",
          }}
        >
          {uid}
        </div>

        {lastActive ? (
          <div
            style={{
              fontSize: 12,
              opacity: 0.8,
              marginTop: 4,
            }}
          >
            Last connected:{" "}
            <strong
              style={{
                fontSize: 13,
                opacity: 1,
              }}
            >
              {lastConnected.formattedDate}
            </strong>{" "}
            <span style={{ opacity: 0.75 }}>({lastConnected.agoText})</span>
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          flexShrink: 0,
          minWidth: 138,
          ...(isMobile ? { minWidth: 0, width: "100%" } : {}),
        }}
      >
        <button
          onClick={() => onViewProfile(uid)}
          style={{
            ...styles.primaryButton,
            background: adminColors.accentSecondary,
            whiteSpace: "nowrap",
          }}
        >
          View Profile
        </button>

        <button
          onClick={() => onViewChats(uid)}
          style={{
            ...styles.primaryButton,
            background: adminColors.accentPrimary,
            whiteSpace: "nowrap",
          }}
        >
          View Chats
        </button>
      </div>
    </div>
  );
}

function UserListCard({
  title,
  users,
  emptyText,
  onViewProfile,
  onViewChats,
  isOpen,
  onToggle,
  isMobile,
}) {
  return (
    <div
      style={{
        background: adminColors.overlaySoft,
        border: `1px solid ${adminColors.borderSoft}`,
        borderRadius: 14,
        padding: 16,
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          background: adminColors.overlaySoft,
          border: `1px solid ${adminColors.borderSoft}`,
          borderRadius: 12,
          color: adminColors.textPrimary,
          padding: "12px 14px",
          cursor: "pointer",
          textAlign: "left",
          marginBottom: isOpen ? 12 : 0,
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = adminColors.overlayMedium;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = adminColors.overlaySoft;
        }}
      >
        <div
          style={{
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {title} ({users.length})
        </div>

        <div
          style={{
            fontSize: 18,
            opacity: 0.8,
            lineHeight: 1,
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 14,
              transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
              display: "inline-block",
            }}
          >
            ▶
          </span>{" "}
        </div>
      </button>

      {isOpen ? (
        users.length === 0 ? (
          <div style={{ opacity: 0.7 }}>{emptyText}</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {users.map((user) => (
              <UserRow
                key={user.uid}
                uid={user.uid}
                name={user.name}
                lastActive={user.lastActive}
                onViewProfile={onViewProfile}
                onViewChats={onViewChats}
                isMobile={isMobile}
              />
            ))}
          </div>
        )
      ) : null}
    </div>
  );
}

export default function OverviewPanel({
  forceBarClosed,
  entranceBannerText,
  bannerHistory,
  onlineUsers = [],
  recentlyOnlineUsers = [],
  onUserClick,
  onViewChats,
}) {
  const [onlineOpen, setOnlineOpen] = useState(true);
  const [recentlyOnlineOpen, setRecentlyOnlineOpen] = useState(false);

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

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Overview</h2>

      <div
        style={{
          ...styles.overviewGrid,
          ...(isMobile ? { gridTemplateColumns: "1fr" } : {}),
        }}
      >
        <div
          style={{
            ...styles.statCard,
            ...(isMobile ? { padding: "12px" } : {}),
          }}
        >
          <div style={styles.statLabel}>Force Bar Closed</div>

          <div style={styles.statValue}>
            {forceBarClosed
              ? forceBarClosed.enabled
                ? "Closed"
                : "Normal"
              : "Loading..."}
          </div>

          <div style={styles.statSubtext}>
            Maintenance override:{" "}
            {forceBarClosed ? String(forceBarClosed.enabled) : "-"}
          </div>
        </div>

        <div
          style={{
            ...styles.statCard,
            ...(isMobile ? { padding: "12px" } : {}),
          }}
        >
          <div style={styles.statLabel}>Entrance Banner</div>

          <div style={styles.statValueSmall}>
            {entranceBannerText || "(empty)"}
          </div>

          <div style={styles.statSubtext}>
            Saved history items: {bannerHistory.length}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          marginTop: 18,
        }}
      >
        <UserListCard
          title="Users currently in the bar"
          users={onlineUsers}
          emptyText="No users in the bar right now."
          onViewProfile={onUserClick}
          onViewChats={onViewChats}
          isOpen={onlineOpen}
          onToggle={() => setOnlineOpen((prev) => !prev)}
          isMobile={isMobile}
        />

        <UserListCard
          title="Recently online users"
          users={recentlyOnlineUsers}
          emptyText="No recently online users found."
          onViewProfile={onUserClick}
          onViewChats={onViewChats}
          isOpen={recentlyOnlineOpen}
          onToggle={() => setRecentlyOnlineOpen((prev) => !prev)}
          isMobile={isMobile}
        />
      </div>
    </div>
  );
}
