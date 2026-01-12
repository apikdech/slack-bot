import * as dotenv from "dotenv";
dotenv.config();

export interface RoutingRule {
  label: string;
  webhookEnv: string; // The ENV variable name (e.g., "SLACK_BACKEND" or "GOOGLE_BACKEND")
  channelName: string;
}

// You can define separate rule sets if you want, or share them.
export const CONFIG = {
  rules: [
    {
      label: "backend",
      webhookEnv: "WEBHOOK_BACKEND",
      channelName: "Backend Team",
    },
    {
      label: "frontend",
      webhookEnv: "WEBHOOK_FRONTEND",
      channelName: "Frontend Team",
    },
  ],
};
