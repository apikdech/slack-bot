import { Octokit } from "@octokit/rest";
import { CONFIG, RoutingRule } from "./config";

// --- Types ---
interface PullRequest {
  title: string;
  html_url: string;
  number: number;
  created_at: string;
  user: { login: string };
  labels: { name: string }[];
  requested_reviewers?: { login: string }[];
  draft?: boolean;
}

// --- Main ---
async function main() {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const [OWNER, REPO] = (process.env.GITHUB_REPOSITORY || "").split("/");

  if (!GITHUB_TOKEN || !OWNER || !REPO) {
    console.error("❌ Missing GITHUB_TOKEN or Repository context.");
    process.exit(1);
  }

  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  console.log(`🔍 Fetching PRs for ${OWNER}/${REPO}...`);

  // 1. Fetch Open PRs
  const { data: pulls } = await octokit.rest.pulls.list({
    owner: OWNER,
    repo: REPO,
    state: "open",
    per_page: 100,
  });

  // 2. Bucket PRs by Webhook URL
  // We use a Map to ensure unique PRs per channel
  const channelBuckets = new Map<
    string,
    { rule: RoutingRule; prs: PullRequest[] }
  >();

  for (const pr of pulls) {
    const typedPr = pr as unknown as PullRequest;
    if (typedPr.draft) continue;

    const prLabelNames = typedPr.labels.map((l) => l.name);

    CONFIG.rules.forEach((rule) => {
      // Check if PR has the label AND if the webhook is actually defined in secrets
      if (prLabelNames.includes(rule.label) && rule.webhookUrl) {
        if (!channelBuckets.has(rule.webhookUrl)) {
          channelBuckets.set(rule.webhookUrl, { rule, prs: [] });
        }

        const bucket = channelBuckets.get(rule.webhookUrl)!;

        // Prevent duplicates in the same channel
        if (!bucket.prs.find((p) => p.number === typedPr.number)) {
          bucket.prs.push(typedPr);
        }
      }
    });
  }

  // 3. Send Notifications
  if (channelBuckets.size === 0) {
    console.log("✅ No matching PRs found for configured rules.");
    return;
  }

  for (const [webhookUrl, data] of channelBuckets) {
    await sendToSlack(webhookUrl, data.prs, data.rule.channelName);
  }
}

// --- Slack Sender ---
async function sendToSlack(
  webhookUrl: string,
  prs: PullRequest[],
  channelTitle?: string
) {
  const title = channelTitle ? `${channelTitle} - PR Bump` : "🔔 Daily PR Bump";

  const blocks = [
    {
      type: "header",
      text: { type: "plain_text", text: title, emoji: true },
    },
    { type: "divider" },
  ];

  for (const pr of prs) {
    const daysOld = Math.floor(
      (new Date().getTime() - new Date(pr.created_at).getTime()) /
        (1000 * 3600 * 24)
    );
    const reviewers =
      pr.requested_reviewers?.map((r) => r.login).join(", ") || "_None_";

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text:
          `*<${pr.html_url}|${pr.title}>* (#${pr.number})\n` +
          `👤 *Author:* ${pr.user.login} | ⏳ *Age:* ${daysOld} days\n` +
          `👀 *Waiting on:* ${reviewers}`,
        emoji: true,
      },
    });
    blocks.push({ type: "divider" });
  }

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
    console.log(`✅ Sent ${prs.length} PRs to ${channelTitle || "Slack"}`);
  } catch (error) {
    console.error(`❌ Failed to send to ${channelTitle}:`, error);
  }
}

(async () => {
  try {
    await main();
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
})();
