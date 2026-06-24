import { adminColors } from "../styles/adminColors";
import { styles } from "../styles/adminStyles";

// ── Helpers ──────────────────────────────────────────────────────────────────

function NotifPermissionBadge({ permission }) {
  let label, color, bg;

  switch (permission) {
    case "granted":
      label = "Granted ✓";
      color = adminColors.accentSuccess;
      bg = "rgba(55,198,122,0.14)";
      break;
    case "denied":
      label = "Blocked ✗";
      color = adminColors.danger;
      bg = adminColors.dangerSoftBg;
      break;
    case "unsupported":
      label = "Not supported";
      color = adminColors.textMuted;
      bg = adminColors.overlaySoft;
      break;
    default: // "default"
      label = "Not set";
      color = adminColors.warning;
      bg = "rgba(255,209,102,0.14)";
  }

  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 10px",
        borderRadius: 99,
        fontSize: 12,
        fontWeight: 700,
        color,
        background: bg,
        letterSpacing: 0.3,
      }}
    >
      {label}
    </span>
  );
}

function ToastItem({ toast, onDismiss, onNavigateToMmChat }) {
  const isMm = toast.type === "mm-message";
  const accentColor = isMm
    ? adminColors.accentPrimary
    : adminColors.accentSuccess;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "12px 14px",
        borderRadius: 12,
        background: adminColors.surfaceRaised,
        border: `1px solid ${adminColors.borderSoft}`,
        borderLeft: `4px solid ${accentColor}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 700,
            fontSize: 13,
            color: adminColors.textPrimary,
            marginBottom: 2,
          }}
        >
          {toast.title}
        </div>
        <div
          style={{
            fontSize: 13,
            color: adminColors.textSecondary,
            wordBreak: "break-word",
          }}
        >
          {toast.body}
        </div>
        {isMm && onNavigateToMmChat ? (
          <button
            type="button"
            onClick={() => onNavigateToMmChat(toast.chatId)}
            style={{
              marginTop: 6,
              padding: "3px 10px",
              fontSize: 12,
              fontWeight: 600,
              background: adminColors.accentPrimarySoftBg,
              border: `1px solid ${adminColors.accentPrimarySoftBorder}`,
              borderRadius: 6,
              color: adminColors.accentPrimarySoftText,
              cursor: "pointer",
            }}
          >
            Open MM Chat →
          </button>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        title="Dismiss"
        style={{
          flexShrink: 0,
          background: "transparent",
          border: "none",
          color: adminColors.textMuted,
          cursor: "pointer",
          fontSize: 16,
          lineHeight: 1,
          padding: 2,
        }}
      >
        ✕
      </button>
    </div>
  );
}

// ── Toast overlay (fixed, always visible) ────────────────────────────────────

/**
 * Renders toasts in a fixed top-right overlay.
 * Render this in App.jsx so toasts appear on all panels.
 */
export function AdminAlertsToastOverlay({
  toasts,
  onDismiss,
  onNavigateToMmChat,
}) {
  if (!toasts || toasts.length === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 70,
        right: 20,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        width: 320,
        maxWidth: "calc(100vw - 40px)",
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={{ pointerEvents: "auto" }}>
          <ToastItem
            toast={toast}
            onDismiss={onDismiss}
            onNavigateToMmChat={onNavigateToMmChat}
          />
        </div>
      ))}
    </div>
  );
}

// ── Main panel ───────────────────────────────────────────────────────────────

/**
 * AdminAlertsPanel
 *
 * Props:
 *   alerts — return value of useAdminAlerts()
 *   onNavigateToMmChat — () => void  (navigates to the MM chat panel)
 */
export default function AdminAlertsPanel({ alerts, onNavigateToMmChat }) {
  const {
    enabled,
    setEnabled,
    notifPermission,
    toasts,
    dismissToast,
    triggerAdminAlert,
    requestNotifPermission,
  } = alerts;

  const handleTestOnline = async () => {
    await requestNotifPermission();
    triggerAdminAlert({
      title: "User came online",
      body: "Test user came online",
      type: "online",
    });
  };

  const handleTestMmMessage = async () => {
    await requestNotifPermission();
    triggerAdminAlert({
      title: "New MM message",
      body: "New MM message from Test User",
      type: "mm-message",
      chatId: null,
    });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          color: adminColors.textPrimary,
        }}
      >
        Admin Alerts
      </h2>

      {/* ── Status & Permission ────────────────────────────────────────────── */}
      <div
        style={{
          background: adminColors.surface,
          border: `1px solid ${adminColors.border}`,
          borderRadius: 14,
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: adminColors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          Settings
        </h3>

        {/* Notification permission row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: adminColors.textPrimary,
                marginBottom: 4,
              }}
            >
              Browser notifications
            </div>
            <NotifPermissionBadge permission={notifPermission} />
          </div>

          {notifPermission !== "granted" &&
          notifPermission !== "denied" &&
          notifPermission !== "unsupported" ? (
            <button
              type="button"
              onClick={requestNotifPermission}
              style={{
                ...styles.primaryButton,
                background: adminColors.accentInfo,
                fontSize: 13,
                padding: "7px 16px",
              }}
            >
              Enable notifications
            </button>
          ) : null}

          {notifPermission === "denied" ? (
            <span
              style={{
                fontSize: 12,
                color: adminColors.textMuted,
                maxWidth: 220,
                lineHeight: 1.4,
              }}
            >
              Unblock in browser site settings, then refresh.
            </span>
          ) : null}
        </div>

        {/* Enable toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              cursor: "pointer",
              userSelect: "none",
            }}
          >
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
              style={{
                width: 18,
                height: 18,
                accentColor: adminColors.accentPrimary,
                cursor: "pointer",
              }}
            />
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: adminColors.textPrimary,
              }}
            >
              Enable alerts
            </span>
          </label>
          <span
            style={{
              fontSize: 12,
              color: enabled
                ? adminColors.accentSuccess
                : adminColors.textMuted,
              fontWeight: 600,
            }}
          >
            {enabled ? "Active" : "Disabled"}
          </span>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: adminColors.textMuted,
            lineHeight: 1.5,
          }}
        >
          When enabled, you will receive a sound and notification when a real
          user comes online or sends MM a new message. Persisted per
          environment.
        </p>
      </div>

      {/* ── Test buttons ──────────────────────────────────────────────────── */}
      <div
        style={{
          background: adminColors.surface,
          border: `1px solid ${adminColors.border}`,
          borderRadius: 14,
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: 14,
            fontWeight: 700,
            color: adminColors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: 0.8,
          }}
        >
          Test alerts
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: adminColors.textMuted,
            lineHeight: 1.5,
          }}
        >
          Clicking these buttons requests notification permission (if needed),
          plays the alert sound, and shows a test notification. Use these to
          unlock browser audio and verify both sounds work.
        </p>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleTestOnline}
            style={{
              ...styles.primaryButton,
              background: adminColors.accentSuccess,
              color: "#fff",
              fontSize: 14,
              padding: "9px 18px",
            }}
          >
            🟢 Test: User online alert
          </button>
          <button
            type="button"
            onClick={handleTestMmMessage}
            style={{
              ...styles.primaryButton,
              background: adminColors.accentPrimary,
              fontSize: 14,
              padding: "9px 18px",
            }}
          >
            💬 Test: MM message alert
          </button>
        </div>
      </div>

      {/* ── Recent in-panel alerts ────────────────────────────────────────── */}
      <div
        style={{
          background: adminColors.surface,
          border: `1px solid ${adminColors.border}`,
          borderRadius: 14,
          padding: 18,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: adminColors.textSecondary,
              textTransform: "uppercase",
              letterSpacing: 0.8,
            }}
          >
            Recent alerts
          </h3>
          {toasts.length > 0 ? (
            <button
              type="button"
              onClick={() => toasts.forEach((t) => dismissToast(t.id))}
              style={{
                background: "transparent",
                border: `1px solid ${adminColors.borderSoft}`,
                borderRadius: 6,
                color: adminColors.textMuted,
                cursor: "pointer",
                fontSize: 12,
                padding: "3px 10px",
              }}
            >
              Clear all
            </button>
          ) : null}
        </div>

        {toasts.length === 0 ? (
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: adminColors.textMuted,
              fontStyle: "italic",
            }}
          >
            No alerts yet. They will appear here and as a toast overlay on all
            panels.
          </p>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {[...toasts].reverse().map((toast) => (
              <ToastItem
                key={toast.id}
                toast={toast}
                onDismiss={dismissToast}
                onNavigateToMmChat={onNavigateToMmChat}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
