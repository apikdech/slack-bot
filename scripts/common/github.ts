import { Octokit } from "@octokit/rest";
import { CONFIG, RoutingRule, getRepositories } from "./config";

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
  repository: string; // Added to track which repo the PR belongs to
}

export async function fetchEnrichedPRs() {
  const GITHUB_TOKEN = process.env.GH_TOKEN;
  
  if (!GITHUB_TOKEN) {
    throw new Error("❌ Missing GH_TOKEN.");
  }

  const repositories = getRepositories();
  console.log("📋 Repositories to monitor:", repositories.map(r => `${r.owner}/${r.repo}`).join(", "));
  console.log("GITHUB_TOKEN", GITHUB_TOKEN?.slice(0, 5) + "...");

  const octokit = new Octokit({ auth: GITHUB_TOKEN });

  // 1. Bucket and Enrich PRs (Aggregate from all repositories)
  const channelBuckets = new Map<
    string,
    { rule: RoutingRule; prs: PullRequestEnriched[] }
  >();

  // Iterate through each repository
  for (const { owner, repo } of repositories) {
    console.log(`🔍 Fetching PRs for ${owner}/${repo}...`);

    try {
      // Fetch Open PRs (Lightweight List)
      const { data: rawPulls } = await octokit.rest.pulls.list({
        owner,
        repo,
        state: "open",
        per_page: 100,
        sort: "created",
        direction: "desc", // "Age Ascending" means 0 days old (Newest) comes first
      });

      console.log(`  Found ${rawPulls.length} open PRs in ${owner}/${repo}`);

      // 2. Process each PR
      for (const pr of rawPulls) {
        const prLabelNames = pr.labels.map((l) => l.name);

        // Find matching rule
        const matchedRule = CONFIG.rules.find(
          (rule) => rule.webhookEnv && prLabelNames.includes(rule.label),
        );

        if (matchedRule) {
          console.log(`✨ Fetching details for PR #${pr.number} in ${owner}/${repo}...`);

          // FETCH DETAILS (Size, CI, Reviews)
          // We do this inside the loop only for matched PRs to save API rate limits
          const [details, status, reviews] = await Promise.all([
            octokit.rest.pulls.get({
              owner,
              repo,
              pull_number: pr.number,
            }),
            octokit.rest.repos.getCombinedStatusForRef({
              owner,
              repo,
              ref: pr.head.sha,
            }),
            octokit.rest.pulls.listReviews({
              owner,
              repo,
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
            repository: `${owner}/${repo}`, // Track which repo this PR belongs to
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
    } catch (error) {
      console.error(`❌ Failed to fetch PRs for ${owner}/${repo}:`, error);
      // Continue with other repositories even if one fails
    }
  }

  // 3. Send Notifications
  if (channelBuckets.size === 0) {
    console.log("✅ No matching PRs found.");
    return;
  }

  return channelBuckets;
}
