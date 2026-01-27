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

/**
 * Parse the GH_REPOSITORIES environment variable
 * Format: "owner1/repo1,owner2/repo2,owner3/repo3"
 * Returns an array of {owner, repo} objects
 */
export function getRepositories(): Array<{ owner: string; repo: string }> {
  const repoList = process.env.GH_REPOSITORIES || process.env.GH_REPOSITORY || "";
  
  if (!repoList) {
    throw new Error("❌ Missing GH_REPOSITORIES or GH_REPOSITORY environment variable.");
  }

  const repositories = repoList
    .split(",")
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
    .map((repoString) => {
      const [owner, repo] = repoString.split("/");
      if (!owner || !repo) {
        throw new Error(`❌ Invalid repository format: "${repoString}". Expected format: "owner/repo"`);
      }
      return { owner, repo };
    });

  if (repositories.length === 0) {
    throw new Error("❌ No valid repositories found in GH_REPOSITORIES.");
  }

  return repositories;
}
