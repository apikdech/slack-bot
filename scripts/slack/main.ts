import { fetchEnrichedPRs, PullRequestEnriched } from "../common/github";
import { getCiIcon, getReviewIcon } from "../common/helper";

async function main() {
  // 1. Get Data
  const channelBuckets = await fetchEnrichedPRs();

  // 2. Group by Slack Config
  for (const [webhookEnv, data] of channelBuckets!) {
    const webhookUrl = process.env[webhookEnv]!;
    if (!webhookUrl) continue;
    await sendToSlack(webhookUrl, data.prs, data.rule.channelName);
  }
}

// --- Slack Sender (Table/Grid Layout) ---
async function sendToSlack(
  webhookUrl: string,
  prs: PullRequestEnriched[],
  channelTitle?: string
) {
  const title = channelTitle
    ? `${channelTitle}: Pending Reviews`
    : "🔔 Daily PR Bump";

  const blocks: any[] = [
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

    const size = `+${pr.additions} / -${pr.deletions}`;

    // Determine the bottom "Status" row content
    let statusText = "";
    if (pr.review_state === "PENDING") {
      const names =
        pr.requested_reviewers?.map((r) => r.login).join(", ") || "_None_";
      statusText = `👀 *Waiting on:* ${names}`;
    } else {
      statusText = `⚖️ *State:* ${getReviewIcon(pr.review_state)} ${
        pr.review_state
      }`;
    }

    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        // The Main "Header" for the row (Title + Link)
        text: `👉 *<${pr.html_url}|${pr.title}>* (#${pr.number})`,
      },
      // "fields" creates the 2-column table effect
      fields: [
        {
          type: "mrkdwn",
          text: `👤 *Author:* ${pr.user.login}\n⏳ *Age:* ${daysOld} days`,
        },
        {
          type: "mrkdwn",
          text: `📊 *Size:* \`${size}\`\n🏗 *Build:* ${getCiIcon(pr.ci_status)}`,
        },
      ],
    });

    // We add the "Waiting on" status as a Context block for a subtle footer look
    // OR we can keep it as a section. Let's use Context for a "footer" feel.
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: statusText,
        },
      ],
    });

    blocks.push({ type: "divider" });
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blocks }),
    });
    if (!response.ok) throw new Error(response.statusText);
    console.log(`✅ Sent ${prs.length} PRs to ${channelTitle}`);
  } catch (error) {
    console.error(`❌ Failed to send to ${channelTitle}:`, error);
  }
}

(async () => {
  await main();
})();
