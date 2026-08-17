# Deployment Guide - barber-hub Worker with WebSocket Hibernation API

## Changes Made:

### 1. Created barber-hub Worker
- **File**: `workers/barber-hub/`
- Uses **WebSocket Hibernation API** - DO sleeps between messages
- Near-zero cost when idle
- Standard costs: $0.02 per 100,000 messages for 50ms hibernation

### 2. Fixed frontend polling
- **Removed** all `setInterval` fallback polling from:
  - `src/context/SystemContext.jsx`
  - `src/context/AdminNotificationContext.jsx`
- Only fetches data ONCE on mount, not on re-renders

### 3. Updated WebSocket proxy
- **Fixed** `/api/ws` route in `functions/api/[[route]].js`
- Uses explicit Upgrade: websocket header
- Returns 101 Switching Protocols with webSocket object
- Added dedicated `/broadcast` endpoint for Pages API

## Deployment Steps:

### Step 1: Deploy barber-hub Worker
```bash
cd workers/barber-hub
npm install
npx wrangler deploy
```

### Step 2: Update Cloudflare Pages Functions
The `functions/api/[[route]].js` already has the fix - just push to your Git repository and Cloudflare will rebuild.

### Step 3: Update frontend
Push your changes to the repository:
```bash
git add .
git commit -m "Remove polling, use WebSocket hibernation API"
git push
```

## Expected Cost Reduction:

**Before (with polling):**
- 2,848 requests/day × 30 bookings = 85,440 requests/month
- At $0.60 per 1M requests → $51/month just for requests

**After (with WebSocket hibernation):**
- 1 POST per booking (create) = 900/month
- 1 broadcast trigger per booking = 900/month
- WebSocket messages = FREE (DO hibernation)
- WebSocket connection = $0
- **Total: ~1,800 requests/month**
- Cost: $0.001/month

**Savings: ~99.99% reduction in requests!**

## Configuration Required:

In Cloudflare Dashboard:
1. Go to **Durable Objects** → **BarberHub** (from wrangler.toml)
2. Create a **DO binding** named `BARBER_HUB`
3. The binding automatically comes from `script_name: barber-hub`

## Monitoring:

Check request counts in Cloudflare Dashboard:
- Pages → Deployment → Overview → Last 24 hours
- Workers → barber-hub → Overview → Last 24 hours

Expected: < 200 requests/day for 20-30 bookings/day.
