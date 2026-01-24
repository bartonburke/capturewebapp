# ChoraGraph Capture - Vercel Deployment Guide

## Prerequisites

1. **GitHub Account** with access to `bartonburke/capturewebapp`
2. **Vercel Account** (free tier is fine) - Sign up at [vercel.com](https://vercel.com)
3. **API Keys**:
   - **OpenAI API Key** (for Whisper audio transcription) - Get at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - **Anthropic API Key** (for Claude Vision photo analysis) - Get at [console.anthropic.com/settings/keys](https://console.anthropic.com/settings/keys)

## Deployment Steps

### Step 1: Connect GitHub to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in (or create account)
2. Click **"Add New..."** → **"Project"**
3. Click **"Import Git Repository"**
4. Select **`bartonburke/capturewebapp`** repository
   - If you don't see it, click **"Adjust GitHub App Permissions"** and grant access

### Step 2: Configure Project Settings

Vercel will auto-detect Next.js. Review these settings:

**Framework Preset:** Next.js (auto-detected) ✓
**Root Directory:** `./ ` (leave default)
**Build Command:** `npm run build` (auto-detected) ✓
**Output Directory:** `.next` (auto-detected) ✓
**Node.js Version:** 20.x (auto-selected) ✓

### Step 3: Add Environment Variables

**CRITICAL:** Add these environment variables before deploying:

1. In the Vercel project configuration, scroll to **"Environment Variables"**
2. Add the following variables:

| Variable Name | Value | Notes |
|--------------|-------|-------|
| `OPENAI_API_KEY` | `sk-proj-...` | Your OpenAI API key (starts with sk-) |
| `CLAUDE_API_KEY` | `sk-ant-api03-...` | Your Anthropic API key (starts with sk-ant-) |

**Important:**
- Select **"Production"**, **"Preview"**, and **"Development"** for both variables
- Don't include quotes around the values
- Keep these keys secure and never commit them to git

### Step 4: Deploy

1. Click **"Deploy"**
2. Vercel will:
   - Clone your repository
   - Install dependencies (`npm install`)
   - Build the Next.js app (`npm run build`)
   - Deploy to a production URL

**Deployment takes 2-3 minutes.**

### Step 5: Access Your App

Once deployed, Vercel provides:

**Production URL:** `https://capturewebapp.vercel.app` (or similar)
**Custom Domain (Optional):** You can add your own domain later

### Step 6: Test on Mobile

1. **Open Safari on iPhone**
2. **Navigate to your Vercel URL** (e.g., `https://capturewebapp.vercel.app`)
3. **Grant camera and microphone permissions** when prompted
4. **Test the capture flow**:
   - Create a new project
   - Start recording
   - Take photos with GPS
   - End session
   - Process audio with Whisper AI

## Environment Variable Details

### OPENAI_API_KEY
- **Purpose:** Transcribes audio recordings using Whisper API
- **Used in:** `/api/transcribe-audio` route
- **Cost:** ~$0.006 per minute of audio ([pricing](https://openai.com/api/pricing/))
- **Rate Limits:** 50 requests/min on free tier

### CLAUDE_API_KEY
- **Purpose:** Analyzes photos for ESA-relevant features using Claude Vision
- **Used in:** `/api/analyze-photo` route
- **Model:** claude-sonnet-4-5-20250929
- **Cost:** ~$0.003 per image ([pricing](https://www.anthropic.com/pricing))
- **Rate Limits:** Varies by plan

## Automatic Deployments

**Every push to `main` branch automatically deploys to production.**

**Preview Deployments:**
- Every push to other branches creates a preview URL
- Perfect for testing before merging to main

## Troubleshooting

### Build Fails
**Check:**
- Node.js version is 20.x (Vercel auto-selects this)
- No TypeScript errors locally (`npm run build` succeeds)

### API Routes Return 500 Errors
**Check:**
- Environment variables are set correctly in Vercel dashboard
- API keys are valid and have credits/quota
- View logs: Vercel Dashboard → Your Project → Deployments → View Function Logs

### Camera Doesn't Work on iPhone
**Check:**
- Using **Safari** browser (Chrome/Firefox on iOS don't support camera API fully)
- HTTPS is enabled (Vercel provides this automatically) ✓
- Granted camera permissions in Safari settings

### GPS Not Working
**Check:**
- Location Services enabled for Safari in iOS Settings
- Granted location permission when prompted

## Monitoring & Logs

**View Logs:**
1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Select your project
3. Click **"Deployments"** → Select a deployment
4. Click **"Functions"** tab to see API route logs

**Usage Tracking:**
- Monitor API costs in OpenAI dashboard
- Monitor API costs in Anthropic console

## Advanced: Custom Domain

1. Go to Vercel Dashboard → Your Project → **Settings** → **Domains**
2. Add your custom domain (e.g., `capture.choragraph.com`)
3. Update DNS records as instructed by Vercel
4. SSL certificate auto-provisioned ✓

## Support

**Vercel Documentation:** [vercel.com/docs](https://vercel.com/docs)
**Next.js Deployment:** [nextjs.org/docs/deployment](https://nextjs.org/docs/deployment)
**Project Issues:** [github.com/bartonburke/capturewebapp/issues](https://github.com/bartonburke/capturewebapp/issues)

---

## Quick Reference Commands

```bash
# Test build locally before deploying
npm run build

# Run production build locally
npm run start

# Verify environment variables (create .env.local for local testing)
echo "OPENAI_API_KEY=sk-..." >> .env.local
echo "CLAUDE_API_KEY=sk-ant-..." >> .env.local
```

**Note:** `.env.local` is git-ignored for security. Never commit API keys to git.
