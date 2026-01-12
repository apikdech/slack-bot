import * as dotenv from "dotenv";
dotenv.config(); // Ensures env vars are loaded if running locally

export interface RoutingRule {
  /** The GitHub label to look for (case-sensitive) */
  label: string;
  /** The specific Slack Webhook URL for this label */
  webhookUrl?: string;
  /** Optional: Custom title for the Slack message */
  channelName?: string;
}

export const CONFIG = {
  // If no rules match, you can enable a fallback (optional)
  enableFallback: false,

  // Define your mapping here
  rules: [
    {
      label: "team: backend",
      webhookUrl: process.env.SLACK_WEBHOOK_BACKEND,
      channelName: "Backend Team",
    },
    {
      label: "team: frontend",
      webhookUrl: process.env.SLACK_WEBHOOK_FRONTEND,
      channelName: "Frontend Team",
    },
    {
      label: "priority: high",
      webhookUrl: process.env.SLACK_WEBHOOK_URGENT,
      channelName: "🚨 Incidents Channel",
    },
  ] as RoutingRule[],
};
