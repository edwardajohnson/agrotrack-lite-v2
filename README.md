# AgroTrack-Lite v2.0 🌾

> SMS-based agricultural marketplace powered by autonomous AI agents on Hedera

[![Hedera](https://img.shields.io/badge/Hedera-Testnet-purple)](https://hedera.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

**AgroTrack-Lite v2.0** is a production-ready implementation of an SMS-first agricultural marketplace that uses **autonomous AI agents** to coordinate transactions on Hedera. Farmers can create offers, accept deals, and receive payments using only basic feature phones—no smartphone or crypto wallet required.


## 🎯 MVP Feature Selection

We built the minimum to prove farmers can transact via SMS with blockchain escrow.

**See detailed justification:** [docs/MVP_FEATURES.md](./docs/MVP_FEATURES.md)

**TL;DR:** Every feature solves a specific barrier:
- SMS → 70% accessibility (feature phones)
- AI parsing → Natural interaction (no training)
- Risk scoring → Trust & fraud prevention  
- HTS escrow → Financial inclusion (65% unbanked)
- Dashboard → Operator efficiency

---

## 🎯 Key Features

### Multi-Agent Architecture
- **5 Autonomous Agents** working in parallel
- **AUTONOMOUS** mode for safe operations (HCS logs, queries)
- **RETURN_BYTE** mode for value transfers (escrow, settlement)
- Real-time decision trees visible in dashboard

### Hedera Integration
- ✅ **HCS** - Immutable audit trail of all events
- ✅ **HTS** - Token-based escrow (lock/release)
- ✅ **Mirror Node** - Historical data for risk & pricing
- ✅ **JSON-RPC Ready** - Optional HSCS contract support

### SMS-First UX
- Works on basic feature phones
- No app installation required
- Natural language parsing (English/Swahili)
- Custodial wallet managed server-side

### Production Features
- Real-time dashboard with event stream
- Docker deployment ready
- Comprehensive testing suite
- Complete API documentation

---

## 🏗️ Architecture

```
┌─────────────┐
│   Farmer    │ SMS: "Maize 200kg Kisumu"
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────────┐
│         Agent Orchestrator              │
│  ┌───────────────────────────────────┐  │
│  │  IntentAgent (AUTONOMOUS)         │  │
│  │  Parses SMS → Structured JSON     │  │
│  └───────────────────────────────────┘  │
│                                         │
│  ┌──────────────┐  ┌──────────────┐   │
│  │ RiskAgent    │  │ MarketAgent  │   │  ← Parallel
│  │ (AUTONOMOUS) │  │ (AUTONOMOUS) │   │     Execution
│  └──────────────┘  └──────────────┘   │
│         │                  │           │
│         └─────────┬────────┘           │
│                   ▼                    │
│         Decision: approve/review        │
│                   │                    │
│  ┌────────────────▼─────────────────┐  │
│  │  EscrowAgent (RETURN_BYTE)       │  │
│  │  Locks HTS tokens after approval │  │
│  └──────────────────────────────────┘  │
│                                         │
│  ┌──────────────────────────────────┐  │
│  │  SettlementAgent (RETURN_BYTE)   │  │
│  │  Releases payment on delivery    │  │
│  └──────────────────────────────────┘  │
└─────────────────────────────────────────┘
       │
       ▼
┌─────────────────┐
│  Hedera Network │
│  • HCS Logs     │
│  • HTS Escrow   │
│  • Mirror Node  │
└─────────────────┘
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- Hedera testnet account ([portal.hedera.com](https://portal.hedera.com))
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/edwardajohnson/AgroTrack-Lite-v2.git
cd AgroTrack-Lite-v2

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials

# Run setup (creates HCS topic + token)
npm run setup

# Start development server
npm run dev
```

### Test with cURL

```bash
# Create offer
curl -X POST http://localhost:3000/webhook/sms \
  -d "from=+254700000001" \
  -d "text=Maize 200kg Kisumu"

# Accept offer (use OTP from response)
curl -X POST http://localhost:3000/webhook/sms \
  -d "from=+254700000001" \
  -d "text=YES 483920"

# Confirm delivery
curl -X POST http://localhost:3000/webhook/sms \
  -d "from=+254700000001" \
  -d "text=Delivered 198kg Grade B OTP 553904"
```

### View Dashboard

Open `dashboard.html` in a browser or run:
```bash
cd dashboard
npm install
npm run dev
```

---

## 📖 Agent Details

### 1. IntentAgent (AUTONOMOUS)
**Purpose:** Parse SMS into structured intents  
**Mode:** AUTONOMOUS (auto-executes)  
**Tech:** LangChain + OpenAI + Zod schemas  

**Supported Intents:**
- `OFFER_CREATE` - "Maize 200kg Kisumu"
- `OFFER_ACCEPT` - "YES 483920"
- `DELIVERY_CONFIRM` - "Delivered 198kg Grade B OTP 553904"
- `PRICE_QUERY` - "Price for beans Eldoret"
- `STATUS_CHECK` - "Status TX123"

### 2. RiskAgent (AUTONOMOUS)
**Purpose:** Assess transaction risk using historical data  
**Mode:** AUTONOMOUS  
**Data Source:** Mirror Node queries  

**Risk Factors:**
- Delivery success rate (< 70% triggers flag)
- Seasonal crop fit (off-season = higher risk)
- Quantity anomalies (> 50% variance from history)

**Output:** Risk score (0-1) + recommendation (approve/review/reject)

### 3. MarketAgent (AUTONOMOUS)
**Purpose:** Price discovery from market data  
**Mode:** AUTONOMOUS  
**Data Source:** Historical HCS messages  

**Pricing Logic:**
1. Query recent trades (location + crop)
2. If ≥5 local trades → use average
3. If ≥3 regional → use with lower confidence
4. Else → default pricing

### 4. EscrowAgent (RETURN_BYTE)
**Purpose:** Create token-based escrow  
**Mode:** RETURN_BYTE (requires approval)  
**Tech:** HTS token transfers  

**Flow:**
1. Verify OTP from offer acceptance
2. Prepare token lock transaction
3. Simulate 2-second approval delay (demo)
4. Execute HTS transfer (buyer → escrow account)
5. Log to HCS

### 5. SettlementAgent (RETURN_BYTE)
**Purpose:** Release payment on delivery  
**Mode:** RETURN_BYTE (requires approval)  
**Tech:** HTS + receipt generation  

**Flow:**
1. Validate delivery (weight, grade, OTP)
2. Prepare token release transaction
3. Simulate approval delay
4. Execute HTS transfer (escrow → farmer)
5. Generate receipt + hash
6. Log to HCS

---

## 🧪 Testing

### Run Demo Journey
```bash
npm run demo
```

This simulates a complete farmer journey:
1. Create offer → Risk & Market agents analyze
2. Accept offer → Escrow locks tokens
3. Deliver crop → Settlement releases payment
4. Check status → View full transaction history

### Agent Unit Tests
```bash
npm run test
```

Tests each agent independently with mock data.

---

## 🔧 Configuration

### Environment Variables

```bash
# Hedera
HEDERA_NETWORK=testnet
HEDERA_ACCOUNT_ID=0.0.xxxxx
HEDERA_PRIVATE_KEY=302e...
HCS_TOPIC_ID=0.0.xxxxx          # Auto-created if empty

# Custodial Accounts
ESCROW_ACCOUNT_ID=0.0.xxxxx
BUYER_ACCOUNT_ID=0.0.xxxxx
FARMER_ACCOUNT_ID=0.0.xxxxx

# Token
ESCROW_TOKEN_ID=0.0.xxxxx       # Auto-created if empty

# AI
OPENAI_API_KEY=sk-proj-...

# SMS Gateway
SMS_MODE=stub                   # or 'live'
AT_USERNAME=sandbox
AT_API_KEY=your_key
AT_SENDER=AgroTrack

# Server
PORT=3000
```

### SMS Gateway Setup (Africa's Talking) - NOW REPLACED by TWilio

1. Sign up at [africastalking.com](https://africastalking.com)
2. Create sandbox app
3. Get API key
4. Set webhook URL: `https://your-domain.com/webhook/sms`
5. Update `.env` with credentials

For testing, use ngrok:
```bash
ngrok http 3000
# Copy https URL to Africa's Talking webhook settings
```

---

## 📊 API Endpoints

### SMS Webhook
```
POST /webhook/sms
Body: { from: "+254700000001", text: "Maize 200kg Kisumu" }
```

### Proof API
```
GET /api/proof/:ref
Response: { ref, events[], timeline[] }
```

### Messages
```
GET /api/messages
Response: { messages[] }
```

### Health Check
```
GET /health
Response: { status: "ok", topicId: "0.0.xxxxx" }
```

---

## 🐳 Deployment

### Docker

```bash
# Build and run
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

### Railway / Render

1. Fork this repository
2. Connect to Railway/Render
3. Add environment variables
4. Deploy

**Important:** Run `npm run setup` once after first deployment to create HCS topic and token.

---

## 🎓 Judging Criteria Alignment

### Hedera Agent Kit Usage ⭐⭐⭐⭐⭐
- ✅ Uses 5 distinct agents with proper execution modes
- ✅ Demonstrates AUTONOMOUS vs RETURN_BYTE patterns
- ✅ Parallel agent execution (Risk + Market)
- ✅ Multi-agent decision trees
- ✅ Proper logging and observability

### Hedera Integration ⭐⭐⭐⭐⭐
- ✅ HCS for immutable audit trail
- ✅ HTS for token-based escrow
- ✅ Mirror Node for historical queries
- ✅ JSON-RPC Relay ready for HSCS

### Innovation ⭐⭐⭐⭐⭐
- ✅ SMS-first (no wallet app needed)
- ✅ Custodial design for accessibility
- ✅ Natural language processing
- ✅ Risk-based autonomous decisions
- ✅ Real-time dashboard visualization

### Technical Quality ⭐⭐⭐⭐⭐
- ✅ TypeScript with strict typing
- ✅ Modular agent architecture
- ✅ Comprehensive error handling
- ✅ Docker deployment ready
- ✅ Complete documentation

### Real-World Applicability ⭐⭐⭐⭐⭐
- ✅ Addresses actual farmer pain points
- ✅ Works with existing infrastructure (SMS)
- ✅ Scalable design (custodial → non-custodial path)
- ✅ Clear go-to-market strategy

---

## 🗺️ Roadmap

### Phase 1 (Current)
- [x] Multi-agent orchestration
- [x] HCS + HTS integration
- [x] SMS parsing and workflows
- [x] Basic dashboard

### Phase 2 (Next 3 months)
- [ ] M-Pesa integration for cash-out
- [ ] Multi-language support (full Swahili)
- [ ] Buyer portal (web/USSD)
- [ ] Advanced risk models (ML)

### Phase 3 (6 months)
- [ ] HSCS contracts for complex escrow
- [ ] Non-custodial wallet option
- [ ] Group buying cooperatives
- [ ] Weather/insurance integrations

### Phase 4 (12 months)
- [ ] Mainnet deployment
- [ ] Multi-country expansion
- [ ] Open API for third-party integrations
- [ ] Mobile USSD for feature phones

---

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

**Priority Areas:**
- Additional agent types (fraud detection, logistics)
- Multi-language NLP models
- Alternative SMS gateways
- Dashboard improvements

---

## 📜 License

MIT License - see [LICENSE](LICENSE) for details

---

## 👤 Author

**Edward Johnson**
- GitHub: [@edwardajohnson](https://github.com/edwardajohnson)
- Project: [AgroTrack-Lite](https://github.com/edwardajohnson/AgroTrack-Lite)

---

## 🙏 Acknowledgments

- **Hedera** for the Agent Kit and testnet infrastructure
- **OpenAI** for LangChain integration
- **Africa's Talking** for SMS gateway support
- **Hedera Africa Hackathon** community

---

## 📚 Resources

- [Hedera Documentation](https://docs.hedera.com)
- [Agent Kit Reference](https://docs.hedera.com/hedera/sdks-and-apis/sdks)
- [Mirror Node API](https://docs.hedera.com/hedera/sdks-and-apis/rest-api)
- [LangChain Docs](https://js.langchain.com/)

---

**Built with ❤️ for smallholder farmers across Africa**
