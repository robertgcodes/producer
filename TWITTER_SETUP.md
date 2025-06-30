# Twitter/X API Setup Guide

To use Twitter/X feeds in the Producer app, you need to set up Twitter API credentials.

## Prerequisites

1. A Twitter/X Developer Account
2. An approved Twitter API project

## Setup Steps

### 1. Create a Twitter Developer Account

1. Go to [https://developer.twitter.com](https://developer.twitter.com)
2. Sign up for a developer account
3. Complete the application process

### 2. Create a Twitter App

1. Once approved, go to the Twitter Developer Portal
2. Create a new App
3. Choose the appropriate access level (Essential, Elevated, or Academic)

### 3. Generate API Credentials

1. In your app settings, go to "Keys and tokens"
2. Generate the following:
   - API Key
   - API Key Secret
   - Bearer Token (for app-only authentication)

### 4. Add Credentials to Your App

Add the following to your `.env.local` file:

```env
# Twitter API Configuration
TWITTER_API_KEY=your_api_key_here
TWITTER_API_SECRET=your_api_secret_here
TWITTER_BEARER_TOKEN=your_bearer_token_here
```

## API Limitations

### Essential Access (Free)
- 500,000 tweets per month read limit
- Rate limit: 300 requests per 15-minute window
- Can only read public tweets
- No access to streaming endpoints

### Elevated Access
- 2 million tweets per month read limit
- Higher rate limits
- Access to more endpoints

## Usage in the App

1. Click "Add RSS Feed" in the RSS Feeds tab
2. Select "X (Twitter)" as the feed type
3. Enter a display name for the feed
4. Enter the Twitter username (with or without @)
5. The app will fetch the latest tweets from that user

## Troubleshooting

### Rate Limit Errors
If you see "Rate limit exceeded" errors:
- Wait 15 minutes before trying again
- Consider upgrading to Elevated access
- Reduce the frequency of refresh operations

### Authentication Errors
If you see authentication errors:
- Double-check your Bearer Token in `.env.local`
- Ensure your app has the correct permissions
- Regenerate your Bearer Token if needed

### No Tweets Found
If no tweets are returned:
- Verify the username is correct
- Check if the account is public
- Ensure the account has recent tweets

## Alternative: Using RSS Bridges

If you don't want to set up Twitter API access, you can use third-party RSS bridges:

1. **Nitter Instances** (when available)
   - Example: `https://nitter.net/username/rss`

2. **RSS Bridge Services**
   - Various services convert Twitter feeds to RSS
   - Search for "Twitter RSS bridge" for current options

3. **Self-hosted Solutions**
   - RSS-Bridge: https://github.com/RSS-Bridge/rss-bridge
   - Can be deployed on your own server

Note: Third-party solutions may have their own limitations and reliability issues.