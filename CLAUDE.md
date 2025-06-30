# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Story Bundler** is a news aggregation and show production tool for livestreamers. It helps organize news stories into segments by bundling related content (articles, videos, tweets) together for easy show preparation.

## Current State

- **Language/Framework**: Next.js 15 with TypeScript
- **Project Type**: Web application
- **Database**: Firebase Firestore
- **Authentication**: Firebase Auth
- **Styling**: Tailwind CSS
- **Deployment**: Vercel-ready

## Development Commands

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint
```

## Architecture Overview

### Key Components

1. **Authentication System** (`/contexts/AuthContext.tsx`)
   - Firebase Auth integration
   - Email/password and Google sign-in
   - Protected routes

2. **Database Schema** (`/types/index.ts`)
   - **Projects**: Show/livestream containers
   - **Bundles**: Story groupings with themes
   - **ContentItems**: Individual articles/videos/tweets
   - **Sources**: RSS feeds and API configurations

3. **Core Pages**
   - `/` - Redirects based on auth status
   - `/login` - Authentication page
   - `/dashboard` - Main bundle management interface

### Firebase Setup

1. Create a Firebase project
2. Enable Authentication (Email/Password + Google)
3. Create Firestore database
4. Copy config to `.env.local` (see `.env.local.example`)

## Development Notes

- The repository has been initialized with Git (current branch: main)
- Uses App Router (Next.js 13+ pattern)
- TypeScript strict mode enabled
- Responsive design with Tailwind CSS

## Background Feed Refresh

The app includes automatic background feed refreshing:
- **Interval**: Every 30 minutes
- **Feeds**: All RSS, YouTube, and Google News feeds (Twitter/X excluded)
- **Implementation**: Vercel Cron Jobs (configured in vercel.json)
- **Smart Refresh**: Skips feeds refreshed within last 25 minutes
- **Bundle Stories**: Automatically updated when source feeds refresh

To enable in production:
1. Set `CRON_SECRET` in Vercel environment variables
2. Deploy to Vercel (cron jobs only work in production)
3. Monitor cron job execution in Vercel dashboard

## Feed and Bundle Refresh Architecture

The system uses a two-stage refresh approach:

1. **Feed Refresh** (Background/Manual):
   - Cron job refreshes feeds every 30 minutes
   - Stores new items in the `feedItems` collection
   - RSS feeds maintain persistent indexes

2. **Bundle Story Refresh** (User-triggered):
   - Searches the indexed `feedItems` collection
   - Does NOT refresh feeds themselves
   - Much faster than re-fetching from sources
   - "Refresh from feeds" button in Stories tab

## Future Features (from brainstorming)

- AI-powered story clustering
- RSS feed monitoring
- Social media API integration
- Title and thumbnail generation
- Source credibility scoring
- Show analytics and performance tracking

Here are my brainstorm notes from the app conversation with Claude:

are there any apps that use AI or other solutions to act as a 'show producer' or a tool to help people assemble and come up with segments for a show, sort of like news anchors would.

i do a livestream and I need stories to talk about like "bundles" of stories
So if Trump says something, the democrats and others will respond, and I want to bundle videos and clips and news stories and stuff like that into a full 10-15 minutes video clip.

Currently, I have stuff and tabs and different feeds etc.

But, I would like to think about creating an app a web app or something, I am familiar with claude code, that could interface with AI, claude, perplexity, to continuously scour my links and run certain prompts and keep the information organized in a way that interfaces with AI and the latest news and RSS feeds and that stuff. /Are there solutions like that and if not can I build something like that

Edit
There are some existing solutions that touch on this, but nothing that perfectly matches your specific workflow needs:

Existing tools with some relevant features:

Descript - Has AI-powered editing and can help organize clips, but lacks the news aggregation piece
Riverside.fm - Good for show production but minimal AI story bundling
Newswhip - Tracks trending stories and social responses, used by newsrooms
BuzzSumo - Content discovery and trend tracking, but not video-focused
Trint - AI transcription and content organization, but limited bundling features
News aggregation tools:

AllSides - Shows multiple perspectives on stories
Ground News - Aggregates coverage from different political angles
MediaCloud - Academic tool for tracking news narratives
The gap: None of these specifically bundle related stories/responses into ready-to-use show segments with video clips organized by topic and timeline.

Building your own solution: This is absolutely buildable and would be a great use case for Claude Code. You could create something that:

Monitors RSS feeds, social media APIs, and news sources
Uses AI to identify story clusters and responses
Automatically groups related content (original story + reactions + follow-ups)
Organizes video clips, articles, and social posts by topic
Generates segment outlines and talking points
Interfaces with streaming/editing software
The technical stack would involve web scraping, API integrations, AI for content analysis and clustering, and a dashboard for organizing your show prep. This could be a really valuable tool not just for you but for other independent news creators.

Want me to help you think through the technical architecture?




yes let's flesh this out

Edit
Let's break this down into a comprehensive system architecture:

Core Components
1. Data Ingestion Layer

RSS feed monitors (major news outlets, legal blogs, political sites)
Social media APIs (X/Twitter, YouTube, TikTok for trending clips)
News APIs (NewsAPI, Google News, Reuters, AP)
Reddit API (for grassroots reactions and discussion trends)
Webhook listeners for breaking news alerts
2. AI Processing Engine

Story clustering AI (groups related content by topic/event)
Sentiment analysis (tracks how stories evolve and public reaction)
Entity extraction (identifies key people, organizations, legal concepts)
Timeline construction (orders events chronologically)
Clip relevance scoring (ranks video content by importance/engagement)
3. Content Organization System

Story bundles with auto-generated folders
Metadata tagging (legal implications, political angles, viral potential)
Source credibility scoring
Duplicate detection and merging
Archive system for reference material
4. Show Production Interface

Dashboard showing active story bundles
Drag-and-drop segment builder
AI-generated talking points and questions
Timer estimates for each segment
Notes section for your legal analysis angles
Technical Architecture
Backend:

Python/FastAPI for the main application
PostgreSQL for structured data storage
Redis for caching and real-time updates
Celery for background processing
Claude/OpenAI APIs for content analysis
Frontend:

React/Next.js for the dashboard
Real-time updates via WebSockets
Video preview capabilities
Export features for streaming software
Integrations:

OBS Studio integration (scene switching, source management)
Streamlabs/Restream API connections
Google Drive/Dropbox for clip storage
Calendar integration for show scheduling
AI Workflow Example
When Trump makes a statement:

System detects the story via multiple sources
AI identifies it as a "political statement" with legal implications
Begins monitoring for responses from Democrats, legal experts, media
Groups all related content into a bundle
Ranks content by relevance and engagement
Generates talking points highlighting legal angles (your expertise)
Suggests segment structure and timing
Updates in real-time as story develops
Key Features for Your Use Case
Legal Focus:

Flags stories with legal implications
Pulls in expert legal commentary
Suggests constitutional/procedural angles
Tracks court filings and legal responses
Show Format Optimization:

Suggests optimal segment order
Balances serious/lighter content
Tracks audience engagement patterns
Generates transition suggestions
Content Safety:

Source verification
Fact-checking integration
Bias detection and balance suggestions
Copyright compliance for clips
Would you like me to dive deeper into any specific component, or should we start mapping out the MVP features to build first?




how would we add sources and maintain sources and stuff like that, and how would we display this do you think to the user, so they can get rid of irrelvant stuff, highlight and double down on good stories, and allow the user me to process this organically and get rid of stuff and save stuff and maybe even organize by day or by livestream or we could call it a project or something so one batch of bundles could be saved historically.

as a note, i am familiar so far with claude code, github and vercel for deployments and localhost, i also have firebase and stripe apis and that stuff. It would be GREAT if this tool could help me write killer titles for the bundles and even generate thumbnails and samples that I could choose from to turn this into a content machine.

Edit
Source Management System
Source Configuration:

Sources Dashboard:
├── RSS Feeds (add/remove/test feeds)
├── Social Media Accounts (track specific users/hashtags)
├── News APIs (configure keywords and outlets)
├── Custom Sources (manual URL monitoring)
└── Source Health Monitor (uptime, rate limits, quality scores)
Source Types & Setup:

Tier 1: Primary news (AP, Reuters, NPR, BBC) - high credibility weight
Tier 2: Political sources (Politico, The Hill, Fox, CNN, MSNBC) - marked with bias indicators
Tier 3: Social/Viral (Twitter accounts, YouTube channels, TikTok creators)
Tier 4: Specialized (legal blogs, court filings, regulatory announcements)
Custom: User-added sources with manual credibility scoring
User Interface Design
Main Dashboard:

Today's Stories (Active Project)
├── Bundle 1: "Trump Legal Filing Response" [12 items] [🔥 Hot]
│   ├── Original Story (CNN, 2 hours ago)
│   ├── Legal Responses (3 expert tweets)
│   ├── Political Reactions (5 videos)
│   └── [Edit Bundle] [Save to Archive] [Delete]
├── Bundle 2: "Economic Policy Debate" [7 items] [📈 Growing]
└── Bundle 3: "Supreme Court Leak" [4 items] [❄️ Cooling]

Quick Actions:
[+ Manual Add] [🎯 AI Suggest New Bundles] [📊 Analytics]
Bundle Detail View:

Bundle: "Trump Legal Filing Response"
Generated Title Suggestions:
🎯 "BREAKING: Trump's Legal Team Fires Back - Democrats PANIC!"
🎯 "The Legal Battle That Could Change Everything"
🎯 "Trump vs. The System: Latest Court Filings Explained"
[Generate More Titles] [Custom Title]

Thumbnail Options:
[Thumbnail A] [Thumbnail B] [Thumbnail C] [Generate New]

Content Items:
├── 📰 Original CNN Article [Keep] [Archive] [❌]
├── 🎥 Legal Expert Analysis (YouTube) [⭐ Priority] [Edit Notes]
├── 🐦 AOC Response Tweet [Keep] [❌]
├── 🎥 Tucker Carlson Clip [⭐ Priority] [Legal Angle: Constitutional]
└── 📊 Poll Data [Archive] [❌]

Your Notes: "Focus on constitutional implications, procedural questions..."
Estimated Segment Time: 12-15 minutes
Legal Angle Suggestions: Constitutional law, Due process, Political prosecution
Project/Archive System
Project Structure:

Projects (Livestreams/Episodes)
├── "June 26 Evening Show" [Active]
├── "June 25 Morning Briefing" [Archived]
│   ├── Bundle: "Immigration Court Ruling"
│   ├── Bundle: "Political Primary Updates"  
│   └── Show Notes, Analytics, Performance
└── "Weekly Legal Roundup" [Template]
Bundle Lifecycle:

Discovery - AI finds related content
Curation - You review, edit, prioritize
Production - Generate titles, thumbnails, talking points
Archive - Save for reference, analytics, reuse
Content Machine Features
AI Title Generator:

Analyzes bundle content for key themes
Tests different styles: Breaking news, Educational, Controversial
A/B tests previous performance data
Suggests clickbait vs. professional versions
Legal angle emphasis: "LAWYER REACTS:" "Legal Analysis:" "Constitutional Crisis:"
Thumbnail Generator:

Auto-extracts key faces/images from content
Generates text overlays with drama/urgency
Your branding/logo placement
Multiple style templates (news, reaction, analysis)
Compliance checking (fair use, copyright)
Content Optimization:

Suggests optimal posting times
Tracks which bundle types perform best
Identifies trending keywords for SEO
Generates video descriptions and tags
Creates social media promotion posts
Technical Implementation
Database Schema:

javascript
Projects: {id, name, date, status, analytics}
Bundles: {id, project_id, title, theme, priority, estimated_time}
ContentItems: {id, bundle_id, source_type, url, title, priority, user_action}
Sources: {id, type, url, credibility_score, active, rate_limit}
AIGeneratedContent: {id, bundle_id, type (title/thumbnail/notes), content, selected}
Firebase Integration:

Real-time updates across devices
User preferences and source configurations
Performance analytics and A/B testing data
Content archives and search
Vercel Deployment:

Next.js frontend with server-side rendering
API routes for AI processing
Edge functions for real-time source monitoring
Static optimization for archived content
Would you like me to start building out the MVP version focusing on the source management and bundle creation interface first?




no i'd like to get this info into claude code and start coding what's the best way to do this

Edit
The best way to get this into Claude Code and start building is:

Step 1: Export This Conversation
Copy our entire conversation (or the key technical details) and save it as a reference document that you can share with Claude Code.

Step 2: Claude Code Command Structure
Open your terminal and use Claude Code like this:

bash
# Start a new project
claude-code "Create a new Next.js project called 'story-bundler' with the following requirements: [paste our technical specs]"

# Or work iteratively
claude-code "I want to build a news story bundling app for livestreamers. Let's start with the database schema and basic Next.js setup. Here are the requirements: [paste relevant sections]"
Step 3: Structured Approach for Claude Code
I'd recommend breaking this into phases for Claude Code:

Phase 1: Basic Setup

bash
claude-code "Set up a Next.js app with Firebase, create the database schema for Projects, Bundles, ContentItems, and Sources tables. Include basic authentication."
Phase 2: Source Management

bash
claude-code "Build the source management system - dashboard to add RSS feeds, social media monitoring, and source health monitoring."
Phase 3: AI Integration

bash
claude-code "Integrate Claude API for story clustering and content analysis. Create the bundle generation system."
Step 4: Information to Give Claude Code
Create a brief that includes:

Your tech stack preferences (Next.js, Firebase, Vercel)
The core user flow (source monitoring → AI bundling → user curation → content generation)
Key features priority (start with manual bundle creation, then add AI automation)
Your experience level and existing integrations
Step 5: Start Simple
I'd suggest starting with:

bash
claude-code "Help me build an MVP news story bundling app. I'm a livestreamer who needs to organize news stories into segments. Start with: 1) Next.js setup with Firebase, 2) Manual story addition interface, 3) Basic bundle organization. I'll add AI features later."