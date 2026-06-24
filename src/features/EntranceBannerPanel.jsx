import { styles } from "../styles/adminStyles";
import { adminColors } from "../styles/adminColors";

export default function EntranceBannerPanel({
  entranceBannerText,
  bannerInput,
  setBannerInput,
  bannerSaving,
  saveEntranceBannerText,
  selectedHistoryValue,
  setSelectedHistoryValue,
  bannerHistory,
  restoreSelectedHistory,
  copySelectedHistory,
  copyMessage,
  error,
  setCopyMessage,
}) {
  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Entrance Banner</h2>

      <p style={styles.sectionLabel}>Current entranceBannerText</p>

      <div style={styles.previewBox}>{entranceBannerText || "(empty)"}</div>

      <p style={styles.sectionLabel}>Edit banner text</p>

      <input
        type="text"
        value={bannerInput}
        onChange={(e) => setBannerInput(e.target.value)}
        placeholder="Edit entrance banner text"
        style={styles.input}
      />

      <button
        onClick={saveEntranceBannerText}
        disabled={bannerSaving}
        style={{
          ...styles.primaryButton,
          marginTop: 16,
          background: adminColors.accentInfo,
        }}
      >
        {bannerSaving ? "Saving..." : "Save entranceBannerText"}
      </button>

      <div style={{ marginTop: 28 }}>
        <p style={styles.sectionLabel}>Banner history</p>

        <select
          value={selectedHistoryValue}
          onChange={(e) => {
            setSelectedHistoryValue(e.target.value);
            setCopyMessage("");
          }}
          style={styles.input}
        >
          <option value="">Select previous banner text</option>
          {bannerHistory.map((item, index) => (
            <option key={`${item}-${index}`} value={item}>
              {item.length > 100 ? `${item.slice(0, 100)}...` : item}
            </option>
          ))}
        </select>

        <div style={styles.buttonRow}>
          <button
            onClick={restoreSelectedHistory}
            disabled={!selectedHistoryValue}
            style={{
              ...styles.secondaryButton,
              opacity: selectedHistoryValue ? 1 : 0.5,
              cursor: selectedHistoryValue ? "pointer" : "not-allowed",
            }}
          >
            Put selected into input
          </button>

          <button
            onClick={copySelectedHistory}
            disabled={!selectedHistoryValue}
            style={{
              ...styles.secondaryButton,
              background: adminColors.accentSuccess,
              opacity: selectedHistoryValue ? 1 : 0.5,
              cursor: selectedHistoryValue ? "pointer" : "not-allowed",
            }}
          >
            Copy selected
          </button>
        </div>

        {copyMessage ? (
          <p style={{ ...styles.mutedText, marginTop: 10 }}>{copyMessage}</p>
        ) : null}
      </div>

      {error ? (
        <p style={{ ...styles.errorText, marginTop: 12 }}>{error}</p>
      ) : null}
    </div>
  );
}
