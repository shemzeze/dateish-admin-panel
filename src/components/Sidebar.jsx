import { SIDEBAR_ITEMS } from "../constants/adminSections";
import { adminColors } from "../styles/adminColors";
import { styles } from "../styles/adminStyles";

export default function Sidebar({
  user,
  activeSection,
  setActiveSection,
  handleLogout,
  loading,
  sectionBadges = {},
  isMobile = false,
  isOpen = false,
  onToggle,
}) {
  const activeSectionLabel =
    SIDEBAR_ITEMS.find((item) => item.key === activeSection)?.label || "Menu";

  if (isMobile) {
    return (
      <div
        style={{
          width: "100%",
          background: adminColors.surfaceAlt,
          borderBottom: `1px solid ${adminColors.border}`,
          boxSizing: "border-box",
          position: "sticky",
          top: 0,
          zIndex: 50,
        }}
      >
        {/* Mobile top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px",
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontWeight: 800,
                fontSize: 16,
                color: adminColors.textPrimary,
                lineHeight: 1.2,
              }}
            >
              Dateish Admin
            </div>
            <div
              style={{
                fontSize: 13,
                color: adminColors.textMuted,
                marginTop: 2,
              }}
            >
              {activeSectionLabel}
            </div>
          </div>

          <button
            onClick={onToggle}
            style={{
              background: isOpen ? adminColors.accentPrimary : "transparent",
              border: `1px solid ${isOpen ? adminColors.accentPrimary : adminColors.border}`,
              borderRadius: 10,
              color: adminColors.textPrimary,
              fontSize: 20,
              lineHeight: 1,
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
            aria-label="Toggle menu"
          >
            {isOpen ? "✕" : "☰"}
          </button>
        </div>

        {/* Collapsible nav */}
        {isOpen && (
          <div
            style={{
              borderTop: `1px solid ${adminColors.border}`,
              padding: "12px 16px 16px",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div style={styles.navList}>
              {SIDEBAR_ITEMS.map((item) => {
                const isActive = activeSection === item.key;
                const badgeCount = sectionBadges[item.key] || 0;

                return (
                  <button
                    key={item.key}
                    onClick={() => setActiveSection(item.key)}
                    style={{
                      ...styles.navButton,
                      background: isActive
                        ? adminColors.accentPrimary
                        : "transparent",
                      borderColor: isActive
                        ? adminColors.accentPrimary
                        : "#2d2d2d",
                      color: isActive ? "#fff" : "#d3d3d3",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      width: "100%",
                    }}
                  >
                    <span>{item.label}</span>
                    {badgeCount > 0 ? (
                      <span
                        style={{
                          minWidth: 24,
                          height: 24,
                          padding: "0 8px",
                          borderRadius: 999,
                          background: "#ffd166",
                          color: "#111",
                          fontSize: 12,
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          lineHeight: 1,
                          flexShrink: 0,
                        }}
                      >
                        {badgeCount}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div
              style={{
                marginTop: 8,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={styles.userBox}>
                <div style={styles.userBoxLabel}>Signed in as</div>
                <div style={{ ...styles.userBoxValue, wordBreak: "break-all" }}>
                  {user.email}
                </div>
              </div>
              <button
                onClick={handleLogout}
                disabled={loading}
                style={{ ...styles.secondaryButton, width: "100%" }}
              >
                Log Out
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Desktop sidebar (unchanged)
  return (
    <aside style={styles.sidebar}>
      <div>
        <h1 style={styles.sidebarTitle}>Dateish Admin</h1>
        <p style={styles.sidebarSubtext}>{user.email}</p>
      </div>

      <div style={styles.navList}>
        {SIDEBAR_ITEMS.map((item) => {
          const isActive = activeSection === item.key;
          const badgeCount = sectionBadges[item.key] || 0;

          return (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              style={{
                ...styles.navButton,
                background: isActive
                  ? adminColors.accentPrimary
                  : "transparent",
                borderColor: isActive ? adminColors.accentPrimary : "#2d2d2d",
                color: isActive ? "#fff" : "#d3d3d3",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <span>{item.label}</span>

              {badgeCount > 0 ? (
                <span
                  style={{
                    minWidth: 24,
                    height: 24,
                    padding: "0 8px",
                    borderRadius: 999,
                    background: "#ffd166",
                    color: "#111",
                    fontSize: 12,
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  {badgeCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div style={styles.sidebarFooter}>
        <div style={styles.userBox}>
          <div style={styles.userBoxLabel}>UID</div>
          <div style={styles.userBoxValue}>{user.uid}</div>
        </div>

        <button
          onClick={handleLogout}
          disabled={loading}
          style={{ ...styles.secondaryButton, width: "100%" }}
        >
          Log Out
        </button>
      </div>
    </aside>
  );
}
