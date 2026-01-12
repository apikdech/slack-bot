import { Octokit } from "@octokit/rest";
import { CONFIG, RoutingRule } from "./config";

// --- Shared Types ---
export interface PullRequestEnriched {
  number: number;
  title: string;
  html_url: string;
  created_at: string;
  user: { login: string };
  labels: { name: string }[];
  draft?: boolean;
  additions: number;
  deletions: number;
  review_state: string;
  ci_status: string;
  requested_reviewers?: { login: string }[];
}

export async function fetchEnrichedPRs() {
  const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
  const [OWNER, REPO] = (process.env.GITHUB_REPOSITORY || "").split("/");
  if (!GITHUB_TOKEN || !OWNER || !REPO) {
    throw new Error("❌ Missing GITHUB_TOKEN or Repository context.");
  }

  const octokit = new Octokit({ auth: GITHUB_TOKEN });
  console.log(`🔍 Fetching PRs for ${OWNER}/${REPO}...`);

  // 1. Fetch Open PRs (Lightweight List)
  const { data: rawPulls } = await octokit.rest.pulls.list({
    owner: OWNER,
    repo: REPO,
    state: "open",
    per_page: 100,
    sort: "created",
    direction: "desc", // "Age Ascending" means 0 days old (Newest) comes first
  });

  // 2. Bucket and Enrich PRs
  const channelBuckets = new Map<
    string,
    { rule: RoutingRule; prs: PullRequestEnriched[] }
  >();

  for (const pr of rawPulls) {
    if (pr.draft) continue;

    const prLabelNames = pr.labels.map((l) => l.name);

    // Find matching rule
    const matchedRule = CONFIG.rules.find(
      (rule) => rule.webhookEnv && prLabelNames.includes(rule.label)
    );

    if (matchedRule) {
      console.log(`✨ Fetching details for PR #${pr.number}...`);

      // FETCH DETAILS (Size, CI, Reviews)
      // We do this inside the loop only for matched PRs to save API rate limits
      const [details, status, reviews] = await Promise.all([
        octokit.rest.pulls.get({
          owner: OWNER,
          repo: REPO,
          pull_number: pr.number,
        }),
        octokit.rest.repos.getCombinedStatusForRef({
          owner: OWNER,
          repo: REPO,
          ref: pr.head.sha,
        }),
        octokit.rest.pulls.listReviews({
          owner: OWNER,
          repo: REPO,
          pull_number: pr.number,
        }),
      ]);

      // Determine Review State
      // Logic: If any review is "CHANGES_REQUESTED", that wins. Otherwise "APPROVED".
      const latestReviews = new Map<string, string>();
      reviews.data.forEach((r) => {
        if (r.user) latestReviews.set(r.user.login, r.state);
      });

      let reviewState = "PENDING";
      const states = Array.from(latestReviews.values());
      if (states.includes("CHANGES_REQUESTED"))
        reviewState = "CHANGES_REQUESTED";
      else if (states.includes("APPROVED")) reviewState = "APPROVED";

      const enrichedPr: PullRequestEnriched = {
        ...pr,
        user: pr.user || { login: "deleted-user" },
        additions: details.data.additions,
        deletions: details.data.deletions,
        ci_status: status.data.state, // failure, pending, success
        review_state: reviewState,
        requested_reviewers: details.data.requested_reviewers as {
          login: string;
        }[],
      };

      // Add to bucket
      if (!channelBuckets.has(matchedRule.webhookEnv)) {
        channelBuckets.set(matchedRule.webhookEnv, {
          rule: matchedRule,
          prs: [],
        });
      }
      channelBuckets.get(matchedRule.webhookEnv)!.prs.push(enrichedPr);
    }
  }

  // 3. Send Notifications
  if (channelBuckets.size === 0) {
    console.log("✅ No matching PRs found.");
    return;
  }

  return channelBuckets;
}
