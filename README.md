# Slack & Google Chat PR Bump Bot

A TypeScript-based automation tool that fetches open pull requests from GitHub repositories and sends formatted notifications to Slack and Google Chat channels. The bot helps teams stay on top of pending code reviews by automatically notifying relevant team members about PRs that need attention.

## 🚀 Features

- **Multi-Platform Notifications**: Send PR updates to both Slack and Google Chat
- **Label-Based Routing**: Automatically route PRs to specific channels based on labels (e.g., `backend`, `frontend`)
- **Rich Formatting**: Beautifully formatted messages with PR details, author info, size metrics, and CI status
- **Automated Scheduling**: Runs daily at 8 AM on weekdays via GitHub Actions
- **Manual Triggers**: Can be run manually via GitHub Actions workflow dispatch
- **Smart Filtering**: Only shows non-draft PRs that match configured labels

## 📋 PR Information Displayed

Each notification includes:

- PR title and number with direct link
- Author and age (days since creation)
- Code size metrics (additions/deletions)
- CI build status with visual indicators
- Review state (pending, approved, changes requested)
- Requested reviewers (when pending review)

## 🛠️ Setup

### Prerequisites

- Node.js 20+
- A GitHub repository with open pull requests
- Slack webhook URL(s) or Google Chat webhook URL(s)
- GitHub Personal Access Token with repo permissions

### Installation

1. **Clone the repository:**

   ```bash
   git clone https://github.com/apikdech/slack-bot.git
   cd slack-bot
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Configure environment variables** in your GitHub repository secrets:

   **Required:**

   - `GH_TOKEN`: GitHub Personal Access Token with `repo` permissions
   - `GH_REPOSITORY`: Your repository in format `owner/repo`

   **For Slack notifications:**

   - `SLACK_WEBHOOK_BACKEND`: Slack webhook URL for backend team
   - `SLACK_WEBHOOK_FRONTEND`: Slack webhook URL for frontend team

   **For Google Chat notifications:**

   - `GOOGLE_CHAT_WEBHOOK_BACKEND`: Google Chat webhook URL for backend team
   - `GOOGLE_CHAT_WEBHOOK_FRONTEND`: Google Chat webhook URL for frontend team

### Configuration

Edit `scripts/common/config.ts` to customize:

- **Labels**: Modify the `label` field to match your PR labels
- **Channel Names**: Update `channelName` for display purposes
- **Webhook Environment Variables**: Change `webhookEnv` to match your GitHub secrets

```typescript
export const CONFIG = {
  rules: [
    {
      label: "backend", // PR label to match
      webhookEnv: "WEBHOOK_BACKEND", // Environment variable name
      channelName: "Backend Team", // Display name in notifications
    },
    {
      label: "frontend",
      webhookEnv: "WEBHOOK_FRONTEND",
      channelName: "Frontend Team",
    },
  ],
};
```

## 🚀 Usage

### Automated Execution

The bot runs automatically every weekday at 8 AM UTC+7 via GitHub Actions. No manual intervention required.

### Manual Execution

You can trigger the notifications manually:

1. Go to your repository's **Actions** tab
2. Select either **"Slack PR Bump"** or **"Google Chat PR Bump"** workflow
3. Click **"Run workflow"**

### Local Testing

Test the scripts locally with proper environment variables:

```bash
# Test Slack notifications
npm run slack-bump

# Test Google Chat notifications
npm run google-bump
```

Make sure to set the required environment variables in a `.env` file or your shell environment.

## 📝 PR Labeling

For PRs to be included in notifications, they must:

1. Be **open** (not merged or closed)
2. Not be **drafts**
3. Have **at least one label** that matches your configuration in `config.ts`

Example PR labels:

- `backend` → Routes to backend team channel
- `frontend` → Routes to frontend team channel

## 🎨 Message Format

### Slack Notifications

Uses Slack Block Kit for rich formatting:

- Header with channel name and notification type
- Individual PR cards with title, metadata, and status
- Visual indicators for CI status and review state
- Clickable PR links

### Google Chat Notifications

Uses Google Chat Cards V2 format:

- Card header with GitHub logo and PR count
- Sectioned layout with PR details
- Decorated text widgets for metadata
- Direct links to PRs

## 🔧 Development

### Project Structure

```
├── scripts/
│   ├── slack/main.ts       # Slack notification logic
│   ├── google/main.ts      # Google Chat notification logic
│   └── common/
│       ├── config.ts       # Configuration and routing rules
│       ├── github.ts       # GitHub API integration
│       └── helper.ts       # Utility functions
├── .github/workflows/      # GitHub Actions automation
│   ├── slack-bump.yaml
│   └── google-bump.yaml
└── package.json
```

### Adding New Platforms

To add support for another notification platform:

1. Create a new script in `scripts/{platform}/main.ts`
2. Implement the notification formatting logic
3. Add a new workflow file in `.github/workflows/`
4. Update `config.ts` with new webhook environment variables

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with proper environment variables
5. Submit a pull request

## 📄 License

This project is licensed under the ISC License - see the package.json file for details.

## 🐛 Troubleshooting

### No PRs being sent?

- Check that PRs have the correct labels matching your `config.ts`
- Verify PRs are not drafts
- Ensure webhook URLs are configured in GitHub secrets

### Authentication issues?

- Verify `GH_TOKEN` has `repo` permissions
- Check `GH_REPOSITORY` format is `owner/repo`

### Webhook failures?

- Confirm webhook URLs are valid and accessible
- Check webhook permissions in Slack/Google Chat
