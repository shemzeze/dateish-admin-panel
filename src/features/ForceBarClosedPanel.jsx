import { styles } from "../styles/adminStyles";
import { adminColors } from "../styles/adminColors";

export default function ForceBarClosedPanel({
  forceBarClosed,
  error,
  loading,
  toggleForceBarClosed,
}) {
  const isClosed = forceBarClosed?.enabled === true;

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Force Bar Closed</h2>

      <p style={styles.mutedText}>
        Use this to manually close the bar for everyone, regardless of opening
        hours. This is for maintenance, testing, or emergencies.
      </p>

      {error ? (
        <p style={styles.errorText}>{error}</p>
      ) : forceBarClosed === null ? (
        <p style={styles.mutedText}>Loading...</p>
      ) : (
        <>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Bar Status</span>
            <span
              style={{
                ...styles.infoValue,
                color: isClosed
                  ? adminColors.danger
                  : adminColors.successStrong,
              }}
            >
              {isClosed ? "Forced Closed" : "Normal"}
            </span>
          </div>

          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Override Enabled</span>
            <span style={styles.infoValue}>
              {String(forceBarClosed.enabled)}
            </span>
          </div>

          {forceBarClosed.updatedAt ? (
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Last Updated</span>
              <span style={styles.infoValue}>
                {new Date(forceBarClosed.updatedAt).toLocaleString()}
              </span>
            </div>
          ) : null}

          <button
            onClick={toggleForceBarClosed}
            disabled={loading}
            style={{
              ...styles.primaryButton,
              marginTop: 20,
              background: isClosed
                ? adminColors.successStrong
                : adminColors.danger,
            }}
          >
            {loading
              ? "Updating..."
              : isClosed
                ? "Reopen Bar"
                : "Force Close Bar"}
          </button>
        </>
      )}
    </div>
  );
}
