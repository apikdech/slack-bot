import { fetchEnrichedPRs, PullRequestEnriched } from "../common/github";
import { getCiIcon, getReviewIcon } from "../common/helper";

async function main() {
  // 1. Get Data
  const channelBuckets = await fetchEnrichedPRs();

  // 2. Group by Google Config
  for (const [webhookEnv, data] of channelBuckets!) {
    const webhookUrl = process.env[webhookEnv]!;
    if (!webhookUrl) continue;
    await sendToGoogleChat(webhookUrl, data.prs, data.rule.channelName);
  }
}

// --- Google Chat Sender (Cards V2) ---
async function sendToGoogleChat(
  webhookUrl: string,
  prs: PullRequestEnriched[],
  channelTitle?: string
) {
  const title = channelTitle
    ? `${channelTitle}: Pending Reviews`
    : "🔔 Daily PR Bump";

  // We build ONE card with MULTIPLE sections (one section per PR)
  const sections: any[] = [];

  for (const pr of prs) {
    const now = new Date().getTime();
    const created = new Date(pr.created_at).getTime();
    const diffMs = now - created;

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor(
      (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)
    );
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    const ageString = `${days}d ${hours}h ${minutes}m`;
    const size = `+${pr.additions} / -${pr.deletions}`;

    // Status text
    let statusText = "";
    if (pr.review_state === "PENDING") {
      const names =
        pr.requested_reviewers?.map((r) => r.login).join(", ") || "None";
      statusText = `Waiting on: ${names}`;
    } else {
      statusText = `State: ${pr.review_state}`;
    }

    sections.push({
      // A section header handles the clickable title
      header: `PR #${pr.number}: ${pr.title}`,
      widgets: [
        {
          // Text Paragraph for the Link
          textParagraph: {
            text: `<a href="${pr.html_url}">🔗 Open Pull Request</a>`,
          },
        },
        {
          // Columns Widget (The Table Look)
          columns: {
            columnItems: [
              {
                // Column 1: Author & Age
                widgets: [
                  {
                    decoratedText: {
                      startIcon: { knownIcon: "PERSON" },
                      text: pr.user.login,
                      bottomLabel: "Author",
                    },
                  },
                  {
                    decoratedText: {
                      startIcon: { knownIcon: "CLOCK" },
                      text: ageString,
                      bottomLabel: "Age",
                    },
                  },
                ],
              },
              {
                // Column 2: Size & Status
                widgets: [
                  {
                    decoratedText: {
                      startIcon: { knownIcon: "DESCRIPTION" },
                      text: size,
                      bottomLabel: "Size",
                    },
                  },
                  {
                    decoratedText: {
                      // Custom icons aren't easy in decoratedText, so we use text
                      text: `${getCiIcon(pr.ci_status)} Build`,
                      bottomLabel: "CI Status",
                    },
                  },
                ],
              },
            ],
          },
        },
        {
          // Footer for this PR
          textParagraph: {
            text: `<b>${getReviewIcon(pr.review_state)} ${statusText}</b>`,
          },
        },
        {
          divider: {}, // Visual separator between PRs
        },
      ],
    });
  }

  const payload = {
    cardsV2: [
      {
        cardId: "daily-pr-bump",
        card: {
          header: {
            title: title,
            subtitle: `${prs.length} PRs pending attention`,
            imageUrl:
              "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
            imageType: "CIRCLE",
          },
          sections: sections,
        },
      },
    ],
  };

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const txt = await response.text();
      throw new Error(`${response.status} - ${txt}`);
    }
    console.log(`✅ Sent ${prs.length} PRs to Google Chat (${channelTitle})`);
  } catch (error) {
    console.error(`❌ Failed to send to Google Chat:`, error);
  }
}

(async () => {
  await main();
})();
