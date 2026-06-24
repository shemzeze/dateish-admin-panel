import { adminColors } from "./adminColors";

export const styles = {
  page: {
    minHeight: "100vh",
    background: adminColors.pageBg,
    color: adminColors.textPrimary,
    fontFamily: "Arial, sans-serif",
  },

  centerWrap: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "24px",
  },

  loadingCard: {
    width: "100%",
    maxWidth: "420px",
    background: adminColors.surface,
    border: `1px solid ${adminColors.border}`,
    borderRadius: "18px",
    padding: "28px",
    boxSizing: "border-box",
  },

  loginCard: {
    width: "100%",
    maxWidth: "420px",
    background: adminColors.surface,
    border: `1px solid ${adminColors.border}`,
    borderRadius: "18px",
    padding: "28px",
    boxSizing: "border-box",
  },

  appShell: {
    width: "100%",
    maxWidth: "1280px",
    margin: "0 auto",
    padding: "24px",
    boxSizing: "border-box",
    display: "grid",
    gridTemplateColumns: "260px 1fr",
    gap: "24px",
    alignItems: "start",
  },

  sidebar: {
    position: "sticky",
    top: "24px",
    background: adminColors.surfaceAlt,
    border: `1px solid ${adminColors.border}`,
    borderRadius: "18px",
    padding: "20px",
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: "20px",
  },

  sidebarTitle: {
    margin: 0,
    fontSize: "28px",
    lineHeight: 1.2,
  },

  sidebarSubtext: {
    margin: "8px 0 0 0",
    color: adminColors.textMuted,
    fontSize: "14px",
    wordBreak: "break-word",
  },

  navList: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  navButton: {
    textAlign: "left",
    padding: "12px 14px",
    fontSize: "15px",
    borderRadius: "12px",
    border: `1px solid ${adminColors.border}`,
    cursor: "pointer",
    transition: "0.15s ease",
  },

  sidebarFooter: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginTop: "auto",
  },

  userBox: {
    background: adminColors.surfaceRaised,
    border: `1px solid ${adminColors.border}`,
    borderRadius: "12px",
    padding: "12px",
  },

  userBoxLabel: {
    fontSize: "12px",
    color: adminColors.textMuted,
    marginBottom: "6px",
  },

  userBoxValue: {
    fontSize: "12px",
    color: adminColors.textPrimary,
    wordBreak: "break-all",
  },

  mainContent: {
    display: "flex",
    flexDirection: "column",
    gap: "24px",
    minWidth: 0,
  },

  card: {
    width: "100%",
    background: adminColors.surface,
    border: `1px solid ${adminColors.border}`,
    borderRadius: "18px",
    padding: "24px",
    boxSizing: "border-box",
  },

  cardTitle: {
    margin: "0 0 20px 0",
    fontSize: "24px",
  },

  title: {
    margin: 0,
    fontSize: "32px",
    lineHeight: 1.2,
  },

  subtitle: {
    margin: "10px 0 0 0",
    color: adminColors.textSecondary,
    fontSize: "15px",
  },

  form: {
    marginTop: "22px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "12px",
    borderRadius: "10px",
    border: `1px solid ${adminColors.border}`,
    background: adminColors.inputBg,
    color: adminColors.textPrimary,
    fontSize: "16px",
    outline: "none",
  },

  primaryButton: {
    padding: "12px 18px",
    fontSize: "15px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    color: adminColors.textPrimary,
  },

  secondaryButton: {
    padding: "10px 16px",
    fontSize: "14px",
    borderRadius: "10px",
    border: "none",
    cursor: "pointer",
    background: adminColors.disabledBg,
    color: adminColors.textPrimary,
  },

  buttonRow: {
    display: "flex",
    gap: "12px",
    marginTop: "12px",
    flexWrap: "wrap",
  },

  previewBox: {
    marginBottom: "16px",
    padding: "12px",
    borderRadius: "10px",
    background: adminColors.inputBg,
    border: `1px solid ${adminColors.border}`,
    minHeight: "24px",
    whiteSpace: "pre-wrap",
  },

  sectionLabel: {
    margin: "0 0 10px 0",
    fontWeight: "bold",
    color: adminColors.textPrimary,
  },

  overviewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
    gap: "16px",
  },

  statCard: {
    background: adminColors.surfaceRaised,
    border: `1px solid ${adminColors.border}`,
    borderRadius: "14px",
    padding: "18px",
  },

  statLabel: {
    color: adminColors.textMuted,
    fontSize: "13px",
    marginBottom: "8px",
  },

  statValue: {
    fontSize: "28px",
    fontWeight: "bold",
    marginBottom: "8px",
  },

  statValueSmall: {
    fontSize: "18px",
    fontWeight: "bold",
    marginBottom: "8px",
    lineHeight: 1.4,
    wordBreak: "break-word",
  },

  statSubtext: {
    color: adminColors.textMuted,
    fontSize: "13px",
  },

  infoRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "12px",
    padding: "14px 0",
    borderBottom: `1px solid ${adminColors.border}`,
  },

  infoLabel: {
    color: adminColors.textMuted,
    fontSize: "14px",
  },

  infoValue: {
    fontSize: "16px",
    fontWeight: "bold",
  },

  lookupRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "10px",
  },

  profileCard: {
    marginTop: "22px",
    background: adminColors.surfaceRaised,
    border: `1px solid ${adminColors.border}`,
    borderRadius: "16px",
    padding: "20px",
  },

  profileTop: {
    display: "flex",
    gap: "18px",
    alignItems: "flex-start",
    flexWrap: "wrap",
  },

  avatarWrap: {
    width: "120px",
    height: "120px",
    borderRadius: "18px",
    overflow: "hidden",
    background: adminColors.surfaceMuted,
    border: `1px solid ${adminColors.border}`,
    flexShrink: 0,
  },

  avatarImage: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  },

  avatarFallback: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: adminColors.textMuted,
    fontSize: "14px",
  },

  profileMainInfo: {
    flex: 1,
    minWidth: "240px",
  },

  profileNameRow: {
    display: "flex",
    gap: "12px",
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: "12px",
  },

  profileName: {
    margin: 0,
    fontSize: "28px",
    lineHeight: 1.2,
  },

  statusBadge: {
    padding: "6px 10px",
    borderRadius: "999px",
    fontSize: "13px",
    fontWeight: "bold",
  },

  profileMeta: {
    margin: "8px 0",
    color: adminColors.textSecondary,
    lineHeight: 1.5,
  },

  mutedText: {
    color: adminColors.textMuted,
    margin: 0,
  },

  errorText: {
    color: adminColors.danger,
    margin: 0,
  },
};
