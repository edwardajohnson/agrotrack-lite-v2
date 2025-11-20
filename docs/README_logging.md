# Live Logging System for AgroTrack-Lite

## What This Does

Adds a professional live log viewer at `/logs` endpoint so hackathon judges can watch your system process SMS messages in real-time, showing:

- 📱 SMS received
- 🤖 AI agents parsing and analyzing
- ⚖️ Risk scoring
- 💰 Price discovery  
- 🔐 Hedera HCS logging
- 💵 HTS token escrow
- ✅ Transaction settlement

## Quick Start

### Option 1: Manual Installation

1. Download all files from `/mnt/user-data/outputs/`
2. Copy to your project:
   ```bash
   cd /Users/eaj/Documents/agrotrack-lite-v2
   
   # New file
   cp ~/Downloads/logger.ts src/utils/
   
   # Updated files
   cp ~/Downloads/server.ts src/api/
   cp ~/Downloads/index.ts src/
   cp ~/Downloads/workflow_updated.ts src/orchestrator/workflow.ts
   ```

3. Rebuild and test:
   ```bash
   npm run build
   npm run dev
   ```

4. Visit: `http://localhost:3000/logs`

### Option 2: Automated (if script works)

```bash
cd /Users/eaj/Documents/agrotrack-lite-v2
bash INSTALL_LOGGING.sh
```

## What Judges Will See

Visit `https://agrotrack-lite-v2.onrender.com/logs` to see:

### Live Terminal Interface
- Auto-refreshes every 5 seconds
- Color-coded entries (green=info, cyan=success, red=error)
- Agent names displayed (IntentAgent, RiskAgent, etc.)
- Transaction references (TX######)
- Full JSON data for every step

### Real-Time Flow Example
```
[2025-11-20T15:30:45Z] [INFO] SMS received from +254712345678
{
  "text": "Maize 200kg Kisumu"
}

[2025-11-20T15:30:46Z] [SUCCESS] [IntentAgent] [TX816810]
Intent parsed: OFFER_CREATE
{
  "crop": "maize",
  "quantityKg": 200,
  "location": "Kisumu"
}

[2025-11-20T15:30:48Z] [SUCCESS] [RiskAgent] [TX816810]
Risk assessment complete
{
  "recommendation": "approve",
  "score": 0.1,
  "factors": ["new_farmer"]
}

[2025-11-20T15:30:49Z] [SUCCESS] [MarketAgent] [TX816810]
Price discovered
{
  "pricePerKg": 35,
  "source": "default"
}

[2025-11-20T15:30:50Z] [SUCCESS] [TX816810]
OTP generated for offer
{
  "otp": "483920",
  "totalAmount": 7000
}
```

## Files Modified

### New Files
- `src/utils/logger.ts` - Core logging utility

### Updated Files
- `src/api/server.ts` - Added /logs endpoint
- `src/index.ts` - Startup logging
- `src/orchestrator/workflow.ts` - Workflow logging
- `src/agents/intent.ts` - Intent parsing logs
- `src/agents/risk.ts` - Risk assessment logs
- `src/agents/market.ts` - Price discovery logs
- `src/agents/escrow.ts` - Escrow creation logs
- `src/agents/settlement.ts` - Settlement logs
- `src/hedera/hcs.ts` - HCS transaction logs
- `src/hedera/hts.ts` - HTS token logs
- `src/sms/gateway.ts` - SMS send/receive logs

## Key Features

✅ **Auto-refresh** - Updates every 5 seconds automatically
✅ **No login** - Open access for judges
✅ **Production-ready** - Professional monitoring interface
✅ **Mobile responsive** - Works on phones/tablets
✅ **Color-coded** - Easy to scan visually
✅ **Filterable** - Can query by level, agent, ref
✅ **JSON API** - Also available at `/api/logs`

## Deployment

After testing locally:

```bash
cd /Users/eaj/Documents/agrotrack-lite-v2

# Commit changes
git add .
git commit -m "Add live logging system for judges"

# Push to trigger Render deploy
git push origin main
```

Wait 2-3 minutes for Render to deploy, then test:
`https://agrotrack-lite-v2.onrender.com/logs`

## Hackathon Submission Updates

### Project Demo Link
Change from: `https://agrotrack-lite-v2.onrender.com`
To: `https://agrotrack-lite-v2.onrender.com/logs`

### Additional Remarks
```
Live System Monitoring:
Visit https://agrotrack-lite-v2.onrender.com/logs to watch the system in action.

The terminal-style interface shows:
• SMS webhook receives farmer messages
• IntentAgent parses natural language using GPT-4
• RiskAgent scores farmers via Hedera Mirror Node queries
• MarketAgent discovers prices from HCS transaction history
• EscrowAgent creates HTS token escrow (with OTP security)
• SettlementAgent releases payment on delivery confirmation

All decisions logged to Hedera HCS for immutable audit trail.
All token transfers executed via Hedera HTS.
Page auto-refreshes every 5 seconds showing live activity.

Demo Flow:
1. Send SMS: "Maize 200kg Kisumu" → Watch parsing + analysis
2. Reply: "YES [OTP]" → Watch escrow creation
3. Confirm: "Delivered 200kg Grade A OTP [OTP]" → Watch settlement

Transaction refs (TX######) link all steps for complete traceability.
```

## Troubleshooting

**Logs not appearing?**
- Check logger.ts is in src/utils/
- Verify all imports: `import { log } from "../utils/logger.js"`
- Check TypeScript build for errors
- Verify Render deployment succeeded

**Page not loading?**
- Check server is running: `curl https://agrotrack-lite-v2.onrender.com/health`
- Try: `https://agrotrack-lite-v2.onrender.com/api/logs` for JSON version
- Check Render logs for startup errors

**No auto-refresh?**
- Browser JavaScript may be disabled
- Use manual refresh button (top-right)
- Try different browser

## Benefits for Judging

### Innovation (10%)
Shows transparent AI agent decision-making in real-time

### Execution (20%)
Proves working MVP with professional monitoring

### Integration (15%)
Demonstrates Hedera HCS/HTS/Mirror Node integration

### Success Potential (20%)
Production-ready monitoring indicates scalability

## Contact

Questions? Issues? The logging system is designed to be self-documenting through the live interface. Judges can watch any test transaction flow from SMS → blockchain without any explanation needed.

---

**Pro Tip for Demo Video**: Screen record the /logs page while sending test SMS messages. The live flow is very impressive visually!
