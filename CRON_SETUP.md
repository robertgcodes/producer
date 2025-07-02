# Setting Up Cron Jobs for Automatic Feed Refresh

This guide explains how to set up the Firebase service account for cron jobs to work on Vercel.

## Why This Is Needed

The cron job runs without user authentication, so it needs a Firebase service account to access Firestore with admin privileges.

## Setup Steps

### 1. Create a Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Navigate to **Project Settings** (gear icon) > **Service Accounts**
4. Click **Generate new private key**
5. Save the downloaded JSON file securely

### 2. Add to Vercel Environment Variables

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** > **Environment Variables**
4. Add a new variable:
   - **Key**: `FIREBASE_SERVICE_ACCOUNT_KEY`
   - **Value**: The entire JSON content from the service account file (as a single line)
   
   To convert the JSON to a single line, you can use:
   ```bash
   cat service-account-key.json | jq -c '.'
   ```
   
   Or manually remove all line breaks and ensure it's valid JSON.

5. Also ensure `CRON_SECRET` is set (generate with `openssl rand -base64 32`)

### 3. Deploy

Once the environment variables are set, redeploy your application. The cron job should now have the necessary permissions to:
- Read all RSS feeds
- Update feed items
- Refresh bundle stories
- Write timestamps

## Verification

After deployment, you can check if the cron is working by:

1. Checking Vercel Functions logs for `/api/cron/refresh-feeds`
2. Looking for successful completion messages
3. Verifying that feed `lastRefreshed` timestamps are updating

## Security Notes

- **Never commit** the service account key to your repository
- Keep the service account key secure
- The service account only needs Firestore access, not other Firebase services
- Regularly rotate your service account keys

## Troubleshooting

If you see "Missing or insufficient permissions" errors:
1. Verify the service account JSON is correctly formatted
2. Check that the project ID matches your Firebase project
3. Ensure the service account has the necessary Firestore permissions