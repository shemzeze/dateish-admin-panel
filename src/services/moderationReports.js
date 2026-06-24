import {
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

const REPORT_STATUSES = new Set(["open", "reviewed", "dismissed"]);
const EMAIL_STATUSES = new Set(["pending", "sent", "failed"]);

/**
 * @typedef {"open" | "reviewed" | "dismissed"} ModerationReportStatus
 */

/**
 * @typedef {"pending" | "sent" | "failed"} ModerationReportEmailStatus
 */

/**
 * @typedef {Object} ModerationReport
 * @property {string} id
 * @property {ModerationReportStatus} status
 * @property {string} category
 * @property {string} message
 * @property {string} reporterUid
 * @property {string} reporterName
 * @property {string} reporterEmail
 * @property {string} reportedUid
 * @property {string} reportedName
 * @property {string} reportedChatId
 * @property {string} appVersion
 * @property {string} platform
 * @property {any} createdAt
 * @property {any} updatedAt
 * @property {string | null} reviewedByUid
 * @property {string | null} reviewedByEmail
 * @property {any | null} reviewedAt
 * @property {string} resolutionNote
 * @property {ModerationReportEmailStatus | undefined} emailStatus
 * @property {any | undefined} emailSentAt
 * @property {string | undefined} emailError
 */

function toStringOrEmpty(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value === null || value === undefined) {
    return "";
  }

  return String(value);
}

function toNullableString(value) {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function normalizeReport(docSnap) {
  const data = docSnap.data() || {};
  const status = REPORT_STATUSES.has(data.status) ? data.status : "open";
  const emailStatus = EMAIL_STATUSES.has(data.emailStatus)
    ? data.emailStatus
    : undefined;

  return {
    id: docSnap.id,
    status,
    category: toStringOrEmpty(data.category),
    message: toStringOrEmpty(data.message),
    reporterUid: toStringOrEmpty(data.reporterUid),
    reporterName: toStringOrEmpty(data.reporterName),
    reporterEmail: toStringOrEmpty(data.reporterEmail),
    reportedUid: toStringOrEmpty(data.reportedUid),
    reportedName: toStringOrEmpty(data.reportedName),
    reportedChatId: toStringOrEmpty(data.reportedChatId),
    appVersion: toStringOrEmpty(data.appVersion),
    platform: toStringOrEmpty(data.platform),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt ?? null,
    reviewedByUid: toNullableString(data.reviewedByUid),
    reviewedByEmail: toNullableString(data.reviewedByEmail),
    reviewedAt: data.reviewedAt ?? null,
    resolutionNote: toStringOrEmpty(data.resolutionNote),
    emailStatus,
    emailSentAt: data.emailSentAt,
    emailError: data.emailError ? String(data.emailError) : undefined,
  };
}

export function subscribeToModerationReports(firebase, callback, onError) {
  const reportsRef = collection(firebase.firestore, "moderationReports");
  const reportsQuery = query(
    reportsRef,
    orderBy("createdAt", "desc"),
    limit(100),
  );

  return onSnapshot(
    reportsQuery,
    (snapshot) => {
      const reports = snapshot.docs.map((docSnap) => normalizeReport(docSnap));
      callback(reports);
    },
    (error) => {
      if (typeof onError === "function") {
        onError(error);
      }
    },
  );
}

async function getResolutionNote(firestore, reportId, note) {
  if (typeof note === "string") {
    return note;
  }

  const reportRef = doc(firestore, "moderationReports", reportId);
  const reportSnap = await getDoc(reportRef);

  if (!reportSnap.exists()) {
    return "";
  }

  const existing = reportSnap.data()?.resolutionNote;
  return typeof existing === "string" ? existing : "";
}

export async function markReportReviewed(firebase, reportId, note) {
  const reportRef = doc(firebase.firestore, "moderationReports", reportId);
  const currentUser = firebase.auth.currentUser;
  const resolutionNote = await getResolutionNote(
    firebase.firestore,
    reportId,
    note,
  );

  await updateDoc(reportRef, {
    status: "reviewed",
    reviewedByUid: currentUser?.uid || "",
    reviewedByEmail: currentUser?.email || null,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    resolutionNote,
  });
}

export async function dismissReport(firebase, reportId, note) {
  const reportRef = doc(firebase.firestore, "moderationReports", reportId);
  const currentUser = firebase.auth.currentUser;
  const resolutionNote = await getResolutionNote(
    firebase.firestore,
    reportId,
    note,
  );

  await updateDoc(reportRef, {
    status: "dismissed",
    reviewedByUid: currentUser?.uid || "",
    reviewedByEmail: currentUser?.email || null,
    reviewedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    resolutionNote,
  });
}

export async function reopenReport(firebase, reportId) {
  const reportRef = doc(firebase.firestore, "moderationReports", reportId);

  await updateDoc(reportRef, {
    status: "open",
    updatedAt: serverTimestamp(),
  });
}

export async function saveReportResolutionNote(firebase, reportId, note) {
  const reportRef = doc(firebase.firestore, "moderationReports", reportId);

  await updateDoc(reportRef, {
    resolutionNote: typeof note === "string" ? note : "",
    updatedAt: serverTimestamp(),
  });
}
