// --- Helper: Status Emojis ---
export function getCiIcon(state: string) {
  if (state === "success") return "✅";
  if (state === "failure" || state === "error") return "❌";
  return "🟡"; // Pending/Running
}

export function getReviewIcon(state: string) {
  if (state === "APPROVED") return "🟢";
  if (state === "CHANGES_REQUESTED") return "🔴";
  return "🟡";
}
