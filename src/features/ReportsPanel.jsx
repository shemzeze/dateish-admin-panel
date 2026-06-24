import { useEffect, useMemo, useState } from "react";
import { styles } from "../styles/adminStyles";
import { adminColors } from "../styles/adminColors";
import {
  dismissReport,
  markReportReviewed,
  reopenReport,
  saveReportResolutionNote,
  subscribeToModerationReports,
} from "../services/moderationReports";

const STATUS_FILTERS = ["all", "open", "reviewed", "dismissed"];
const EMAIL_STATUS_FILTERS = ["all", "pending", "sent", "failed"];

function toDisplayString(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  return String(value);
}

function formatTimestamp(value) {
  if (!value) return "—";

  try {
    if (typeof value?.toDate === "function") {
      return value.toDate().toLocaleString();
    }

    if (typeof value === "object" && value.seconds) {
      return new Date(value.seconds * 1000).toLocaleString();
    }

    return new Date(value).toLocaleString();
  } catch {
    return "—";
  }
}

function getMessagePreview(message) {
  const safe = typeof message === "string" ? message : "";

  if (safe.length <= 160) {
    return safe || "—";
  }

  return `${safe.slice(0, 157)}...`;
}

function reportMatchesSearch(report, normalizedSearch) {
  if (!normalizedSearch) return true;

  const searchFields = [
    report.id,
    report.reporterUid,
    report.reporterName,
    report.reporterEmail,
    report.reportedUid,
    report.reportedName,
    report.reportedChatId,
    report.category,
    report.message,
  ];

  return searchFields.some((field) =>
    String(field || "")
      .toLowerCase()
      .includes(normalizedSearch),
  );
}

function getStatusBadgeStyle(status) {
  if (status === "open") {
    return {
      background: adminColors.warning,
      color: adminColors.warningText,
      border: `1px solid ${adminColors.warning}`,
    };
  }

  if (status === "reviewed") {
    return {
      background: adminColors.accentSuccess,
      color: adminColors.textPrimary,
      border: `1px solid ${adminColors.accentSuccess}`,
    };
  }

  if (status === "dismissed") {
    return {
      background: adminColors.overlayMedium,
      color: adminColors.textPrimary,
      border: `1px solid ${adminColors.border}`,
    };
  }

  return {
    background: adminColors.overlayMedium,
    color: adminColors.textPrimary,
    border: `1px solid ${adminColors.border}`,
  };
}

function DetailRow({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "170px 1fr",
        gap: 12,
        alignItems: "start",
        padding: "10px 0",
        borderBottom: `1px solid ${adminColors.borderSoft}`,
      }}
    >
      <div style={{ color: adminColors.textMuted, fontSize: 13 }}>{label}</div>
      <div style={{ wordBreak: "break-word", whiteSpace: "pre-wrap" }}>
        {toDisplayString(value)}
      </div>
    </div>
  );
}

export default function ReportsPanel({ firebase, onOpenUserLookup }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [statusFilter, setStatusFilter] = useState("all");
  const [emailStatusFilter, setEmailStatusFilter] = useState("all");
  const [searchText, setSearchText] = useState("");

  const [selectedReport, setSelectedReport] = useState(null);
  const [resolutionNoteDraft, setResolutionNoteDraft] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError("");

    const unsubscribe = subscribeToModerationReports(
      firebase,
      (nextReports) => {
        setReports(nextReports);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to subscribe to moderationReports:", err);
        setLoading(false);

        const isPermissionError =
          err?.code === "permission-denied" ||
          String(err?.message || "")
            .toLowerCase()
            .includes("permission");

        if (isPermissionError) {
          setError(
            "Permission denied loading reports. Make sure moderationReports rules are deployed and you are signed in as admin.",
          );
          return;
        }

        setError(err?.message || "Failed to load reports.");
      },
    );

    return () => {
      unsubscribe();
    };
  }, [firebase]);

  useEffect(() => {
    if (!selectedReport?.id) return;

    const refreshed = reports.find((report) => report.id === selectedReport.id);

    if (!refreshed) {
      setSelectedReport(null);
      return;
    }

    setSelectedReport(refreshed);
  }, [reports, selectedReport?.id]);

  useEffect(() => {
    setResolutionNoteDraft(selectedReport?.resolutionNote || "");
  }, [selectedReport?.id, selectedReport?.resolutionNote]);

  const filteredReports = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();

    return reports
      .filter((report) => {
        if (statusFilter !== "all" && report.status !== statusFilter) {
          return false;
        }

        if (
          emailStatusFilter !== "all" &&
          (report.emailStatus || "") !== emailStatusFilter
        ) {
          return false;
        }

        return reportMatchesSearch(report, normalizedSearch);
      })
      .sort((a, b) => {
        const aTime =
          typeof a.createdAt?.toMillis === "function"
            ? a.createdAt.toMillis()
            : 0;
        const bTime =
          typeof b.createdAt?.toMillis === "function"
            ? b.createdAt.toMillis()
            : 0;
        return bTime - aTime;
      });
  }, [reports, statusFilter, emailStatusFilter, searchText]);

  const openCount = useMemo(
    () => reports.filter((report) => report.status === "open").length,
    [reports],
  );

  const selectedStatusStyle = getStatusBadgeStyle(selectedReport?.status);

  const handleMarkReviewed = async () => {
    if (!selectedReport?.id) return;
    setActionLoading(true);
    setError("");

    try {
      await markReportReviewed(
        firebase,
        selectedReport.id,
        resolutionNoteDraft || selectedReport.resolutionNote || "",
      );
    } catch (err) {
      console.error("Mark reviewed failed:", err);
      setError(err?.message || "Failed to mark report reviewed.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDismiss = async () => {
    if (!selectedReport?.id) return;
    setActionLoading(true);
    setError("");

    try {
      await dismissReport(
        firebase,
        selectedReport.id,
        resolutionNoteDraft || selectedReport.resolutionNote || "",
      );
    } catch (err) {
      console.error("Dismiss report failed:", err);
      setError(err?.message || "Failed to dismiss report.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReopen = async () => {
    if (!selectedReport?.id) return;
    setActionLoading(true);
    setError("");

    try {
      await reopenReport(firebase, selectedReport.id);
    } catch (err) {
      console.error("Reopen report failed:", err);
      setError(err?.message || "Failed to reopen report.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedReport?.id) return;
    setActionLoading(true);
    setError("");

    try {
      await saveReportResolutionNote(
        firebase,
        selectedReport.id,
        resolutionNoteDraft,
      );
    } catch (err) {
      console.error("Save resolution note failed:", err);
      setError(err?.message || "Failed to save resolution note.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={styles.card}>
      <h2 style={styles.cardTitle}>Reports</h2>

      <div
        style={{
          marginBottom: 16,
          padding: 12,
          borderRadius: 12,
          background:
            openCount > 0 ? adminColors.warning : adminColors.overlaySoft,
          color:
            openCount > 0 ? adminColors.warningText : adminColors.textSecondary,
          fontWeight: 700,
        }}
      >
        {openCount > 0
          ? `${openCount} open report${openCount === 1 ? "" : "s"} needs review.`
          : "No open reports needing review."}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <div>
          <p style={{ ...styles.sectionLabel, marginBottom: 6 }}>Status</p>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={styles.input}
          >
            {STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <p style={{ ...styles.sectionLabel, marginBottom: 6 }}>
            Email Status
          </p>
          <select
            value={emailStatusFilter}
            onChange={(e) => setEmailStatusFilter(e.target.value)}
            style={styles.input}
          >
            {EMAIL_STATUS_FILTERS.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <p style={{ ...styles.sectionLabel, marginBottom: 6 }}>Search</p>
          <input
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="Search id, reporter/reported info, category, or message"
            style={styles.input}
          />
        </div>
      </div>

      {error ? (
        <p style={{ ...styles.errorText, marginBottom: 14 }}>{error}</p>
      ) : null}

      {loading ? <p style={styles.mutedText}>Loading reports...</p> : null}

      {!loading && filteredReports.length === 0 ? (
        <p style={styles.mutedText}>No reports found.</p>
      ) : null}

      {!loading && filteredReports.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredReports.map((report) => {
            const statusStyle = getStatusBadgeStyle(report.status);
            const needsReview = report.status === "open";

            return (
              <button
                key={report.id}
                type="button"
                onClick={() => setSelectedReport(report)}
                style={{
                  border: needsReview
                    ? `2px solid ${adminColors.warning}`
                    : `1px solid ${adminColors.border}`,
                  background: needsReview
                    ? adminColors.overlayMedium
                    : adminColors.overlaySoft,
                  borderRadius: 12,
                  padding: 14,
                  textAlign: "left",
                  color: adminColors.textPrimary,
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <span
                      style={{
                        ...statusStyle,
                        borderRadius: 999,
                        padding: "5px 10px",
                        fontSize: 12,
                        textTransform: "uppercase",
                        fontWeight: 800,
                      }}
                    >
                      {toDisplayString(report.status)}
                    </span>

                    {needsReview ? (
                      <span
                        style={{
                          borderRadius: 999,
                          padding: "5px 10px",
                          fontSize: 12,
                          fontWeight: 800,
                          background: adminColors.warning,
                          color: adminColors.warningText,
                        }}
                      >
                        NEEDS REVIEW
                      </span>
                    ) : null}
                  </div>

                  <div style={{ color: adminColors.textMuted, fontSize: 13 }}>
                    {formatTimestamp(report.createdAt)}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                    gap: 8,
                  }}
                >
                  <div>Category: {toDisplayString(report.category)}</div>
                  <div>Reported: {toDisplayString(report.reportedName)}</div>
                  <div>Reported UID: {toDisplayString(report.reportedUid)}</div>
                  <div>Reporter: {toDisplayString(report.reporterName)}</div>
                  <div>Reporter UID: {toDisplayString(report.reporterUid)}</div>
                  <div>Chat ID: {toDisplayString(report.reportedChatId)}</div>
                  <div>Platform: {toDisplayString(report.platform)}</div>
                  <div>App Version: {toDisplayString(report.appVersion)}</div>
                  <div>Email: {toDisplayString(report.emailStatus)}</div>
                </div>

                <div
                  style={{ marginTop: 10, color: adminColors.textSecondary }}
                >
                  {getMessagePreview(report.message)}
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {selectedReport ? (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            background: "rgba(0,0,0,0.55)",
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
              maxWidth: 900,
              maxHeight: "90vh",
              overflow: "auto",
              background: adminColors.surface,
              borderRadius: 16,
              border: `1px solid ${adminColors.border}`,
              padding: 18,
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 10,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 24 }}>Report Detail</h3>
              <button
                type="button"
                onClick={() => setSelectedReport(null)}
                style={styles.secondaryButton}
              >
                Close
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <span
                style={{
                  ...selectedStatusStyle,
                  borderRadius: 999,
                  padding: "5px 10px",
                  fontSize: 12,
                  textTransform: "uppercase",
                  fontWeight: 800,
                }}
              >
                {toDisplayString(selectedReport.status)}
              </span>
            </div>

            <DetailRow label="id" value={selectedReport.id} />
            <DetailRow label="status" value={selectedReport.status} />
            <DetailRow label="category" value={selectedReport.category} />
            <DetailRow label="message" value={selectedReport.message} />
            <DetailRow label="reporterUid" value={selectedReport.reporterUid} />
            <DetailRow
              label="reporterName"
              value={selectedReport.reporterName}
            />
            <DetailRow
              label="reporterEmail"
              value={selectedReport.reporterEmail}
            />
            <DetailRow label="reportedUid" value={selectedReport.reportedUid} />
            <DetailRow
              label="reportedName"
              value={selectedReport.reportedName}
            />
            <DetailRow
              label="reportedChatId"
              value={selectedReport.reportedChatId}
            />
            <DetailRow label="appVersion" value={selectedReport.appVersion} />
            <DetailRow label="platform" value={selectedReport.platform} />
            <DetailRow
              label="createdAt"
              value={formatTimestamp(selectedReport.createdAt)}
            />
            <DetailRow
              label="updatedAt"
              value={formatTimestamp(selectedReport.updatedAt)}
            />
            <DetailRow
              label="reviewedByUid"
              value={selectedReport.reviewedByUid}
            />
            <DetailRow
              label="reviewedByEmail"
              value={selectedReport.reviewedByEmail}
            />
            <DetailRow
              label="reviewedAt"
              value={formatTimestamp(selectedReport.reviewedAt)}
            />
            <DetailRow
              label="resolutionNote"
              value={selectedReport.resolutionNote}
            />
            <DetailRow label="emailStatus" value={selectedReport.emailStatus} />
            <DetailRow
              label="emailSentAt"
              value={formatTimestamp(selectedReport.emailSentAt)}
            />
            <DetailRow label="emailError" value={selectedReport.emailError} />

            <div style={{ marginTop: 14 }}>
              <p style={{ ...styles.sectionLabel, marginBottom: 8 }}>
                Resolution note
              </p>
              <textarea
                value={resolutionNoteDraft}
                onChange={(e) => setResolutionNoteDraft(e.target.value)}
                rows={4}
                style={{
                  ...styles.input,
                  resize: "vertical",
                  minHeight: 110,
                }}
              />
            </div>

            {typeof onOpenUserLookup === "function" ? (
              <div style={{ ...styles.buttonRow, marginTop: 12 }}>
                <button
                  type="button"
                  onClick={() => onOpenUserLookup(selectedReport.reporterUid)}
                  style={{
                    ...styles.secondaryButton,
                    border: `1px solid ${adminColors.border}`,
                  }}
                >
                  Open reporter
                </button>

                <button
                  type="button"
                  onClick={() => onOpenUserLookup(selectedReport.reportedUid)}
                  style={{
                    ...styles.secondaryButton,
                    border: `1px solid ${adminColors.border}`,
                  }}
                >
                  Open reported user
                </button>
              </div>
            ) : null}

            <div style={{ ...styles.buttonRow, marginTop: 12 }}>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleMarkReviewed}
                style={{
                  ...styles.primaryButton,
                  background: adminColors.accentSuccess,
                }}
              >
                {actionLoading ? "Saving..." : "Mark reviewed"}
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={handleDismiss}
                style={{
                  ...styles.primaryButton,
                  background: adminColors.danger,
                }}
              >
                {actionLoading ? "Saving..." : "Dismiss"}
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={handleReopen}
                style={{
                  ...styles.primaryButton,
                  background: adminColors.accentInfo,
                }}
              >
                {actionLoading ? "Saving..." : "Reopen"}
              </button>

              <button
                type="button"
                disabled={actionLoading}
                onClick={handleSaveNote}
                style={{
                  ...styles.secondaryButton,
                  border: `1px solid ${adminColors.border}`,
                }}
              >
                {actionLoading ? "Saving..." : "Save resolution note"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
