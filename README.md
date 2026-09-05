# Binance AI Trading Agent (TypeScript Edition) — Atreus
### 🏆 Binance Agent OS Hackathon — Track A: Autonomous AI Trading Agent ($20,000 Prize Pool)

An autonomous, institutional-grade AI Trading Agent built in **TypeScript** supporting **Claude (Anthropic)**, **GPT-4o (OpenAI)**, **Gemini 1.5 Pro (Google)**, and **DeepSeek (OpenRouter)**. Engineered for real-time Binance market intelligence, cross-chain token research via the **Binance Skills Hub**, strict pre-trade risk controls, an isolated zero-withdrawal **Sub-Account Security Perimeter**, and a mandatory **4-Stage Reasoning & Execution Cycle**.

---

## 🌟 Universal Architecture & Cognitive Pipeline

```
                               ┌────────────────────────────────────────────────────────┐
                               │             Universal AI Reasoning Brain               │
                               │  Claude 3.5 Sonnet • GPT-4o • Gemini 1.5 • DeepSeek    │
                               │  (Auto-detected from available environment API key)    │
                               └───────────────────────────┬────────────────────────────┘
                                                           │
                                                           ▼
                ┌──────────────────────────────────────────────────────────────────────────────┐
                │          STAGE 1: PRE-EXECUTION REASONING & SKILLS RESEARCH (MANDATORY)      │
                │  • research_token_intelligence: Cross-chain prices, 24h volume & liquidity   │
                │  • get_smart_money_inflows: Institutional & whale accumulation metrics       │
                │  • get_social_sentiment_hype: Community buzz & social volume rankings        │
                │  • get_market_technicals: Real-time RSI(14), SMA(7), SMA(25) momentum       │
                │  • get_spot_order_book & get_futures_funding_rate: Liquidity & funding bias  │
                │  ➔ Generates Institutional Market Thesis BEFORE proposing any trade          │
                └──────────────────────────────────────────┬───────────────────────────────────┘
                                                           │
                                                           ▼
                ┌──────────────────────────────────────────────────────────────────────────────┐
                │               STAGE 2: PRE-TRADE RISK AUDIT & HUMAN GATE                     │
                │  • RiskGuard Engine: Max 5% Position Size • Max 5× Leverage Ceiling          │
                │  • Mandatory Stop-Loss (≥2%) • 10% Daily Drawdown Circuit Breaker            │
                │  • Visual Double-Bordered Trade Card: Operator must type 'CONFIRM'           │
                └──────────────────────────────────────────┬───────────────────────────────────┘
                                                           │ Passed & Confirmed
                                                           ▼
                ┌──────────────────────────────────────────────────────────────────────────────┐
                │             STAGE 3: ISOLATED SUB-ACCOUNT EXECUTION (FAST-PATH)              │
                │  • Dedicated Sub-Account API Credentials (HMAC-SHA256 / Ed25519)             │
                │  • Zero-Withdrawal Security Perimeter (On-chain withdrawals physically blocked)│
                │  • Direct Binance Exchange Matching Engine (<50ms execution latency)         │
                │  • Spot & USDS-M Perpetual Futures order placement                           │
                └──────────────────────────────────────────┬───────────────────────────────────┘
                                                           │ Raw Fill Data
                                                           ▼
                ┌──────────────────────────────────────────────────────────────────────────────┐
                │           STAGE 4: POST-EXECUTION SYNTHESIS & ACTIVE MONITORING              │
                │  • Fill Efficiency & Slippage Analysis (Executed vs Proposed price)          │
                │  • Sub-Account Margin & Portfolio Allocation Update                          │
                │  • Active Stop-Loss, Take-Profit, and Invalidation Price Triggers            │
                │  • Continuous Risk Advisory                                                  │
                └──────────────────────────────────────────────────────────────────────────────┘
```

### Core Innovations & Security Pillars
1. **Isolated Sub-Account Security Perimeter**:
   - The agent operates strictly within a **dedicated Binance Sub-Account**.
   - **Zero-Withdrawal Risk**: On-chain withdrawals are physically blocked by Binance's matching engine for sub-accounts.
   - **Zero Master Account Exposure**: The agent cannot see or touch master spot savings, Simple Earn, or cold storage.
2. **Pre-Execution Binance Skills Hub Intelligence**:
   - Integrates official skills (`query-token-info`, `crypto-market-rank`, `binance-trading-signal`) directly into the LLM's cognitive loop.
   - The agent is structurally prohibited from placing blind orders without first synthesizing technical, smart-money, and orderbook data.
3. **Pre-Trade RiskGuard Engine**:
   - Hardcoded position limits (max 5% of sub-account balance), leverage ceiling (max 5×), mandatory stop-loss, and daily drawdown breaker.
4. **Human-in-the-Loop Confirmation Gate**:
   - No unilateral autonomous execution. The operator must review the visual proposal card and type `CONFIRM` in the terminal.
5. **Post-Execution Institutional Synthesis**:
   - Rather than dumping raw API JSON, the agent reasons through the fill, calculates slippage, updates margin allocations, and establishes monitoring triggers.
6. **Decoupled Future-Ready MCP Adapter**:
   - Includes a complete, dormant JSON-RPC 2.0 client (`src/mcp-client.ts`) and PKCE OAuth manager (`src/mcp-auth.ts`) for `https://agent.binance.com/mcp/agentic`. Toggling `ENABLE_BINANCE_MCP=true` instantly switches to MCP the moment Binance enables custom agent whitelisting.

---

## 📁 Project Structure

```
atreus-trading-agent/
├── package.json               # Node.js & TypeScript dependencies
├── tsconfig.json              # Strict ES2022 TypeScript settings
├── .env.example               # Universal environment configuration template
├── .gitignore                 # Safe exclusions (secrets, tokens, build files)
├── README.md                  # Comprehensive documentation & evaluation guide
├── RISK_DISCLAIMER.md         # Mandatory financial risk disclosure
│
├── .agents/skills/            # Official Binance Skills Hub (19 installed skills)
│   ├── query-token-info/      # Cross-chain DEX token lookup, OHLCV, metadata
│   ├── crypto-market-rank/    # Social hype, smart-money inflows, market caps
│   ├── binance-trading-signal/# Smart-money trading signals & strategy backtests
│   ├── binance-wallet-tracker/# Wallet monitoring, KOL tracking, anomaly orders
│   └── ... (15 more skills)
│
├── src/
│   ├── index.ts               # Interactive CLI application & startup lifecycle
│   ├── llm-provider.ts        # Universal Multi-LLM Adapter (Claude, GPT, Gemini, DeepSeek)
│   ├── skills-runner.ts       # Type-safe runner & bridge for Binance Skills Hub scripts
│   ├── binance-client.ts      # Unified Binance REST client (Sub-Account isolated)
│   ├── indicators.ts          # Technical indicators (RSI 14, SMA 7, SMA 25)
│   ├── tools.ts               # AI Agent function tool declarations & router
│   ├── prompt.ts              # 4-Stage Reasoning & Execution institutional system prompt
│   ├── risk.ts                # RiskGuard pre-trade auditing engine
│   ├── confirmation.ts        # Double-bordered visual human confirmation card
│   ├── mcp-client.ts          # Decoupled official Binance Agent OS MCP client (81 tools)
│   └── mcp-auth.ts            # Decoupled official Binance PKCE OAuth manager
│
├── tests/
│   ├── risk.test.ts           # RiskGuard unit test suite (position limits, leverage, SL)
│   ├── confirmation.test.ts   # Confirmation gate unit test suite
│   └── indicators.test.ts     # Technical analysis calculation unit tests
│
└── examples/
    └── demo_conversation.md   # Step-by-step example execution walkthrough
```

---

## 🚀 Quickstart Guide (Evaluation in Under 2 Minutes)

### Prerequisites
- **Node.js ≥ 20** (tested on Node v22)
- **ANY ONE of the following LLM API keys**:
  - `ANTHROPIC_API_KEY` (Claude 3.5 Sonnet)
  - `OPENAI_API_KEY` (GPT-4o)
  - `GOOGLE_API_KEY` (Gemini 1.5 Pro)
  - `OPENROUTER_API_KEY` (DeepSeek)

---

### Step 1: Clone & Install

```bash
git clone https://github.com/Astreus-5/Atreus-trading-agent.git
cd Atreus-trading-agent
npm install
```

---

### Step 2: Configure Environment

Copy the example environment file:
```bash
cp .env.example .env
```

Open `.env` and configure your API keys:

```dotenv
# ─── PICK ONE LLM KEY — only one is required ───────────────────
ANTHROPIC_API_KEY=sk-ant-...        # Claude 3.5 Sonnet
# OPENAI_API_KEY=sk-proj-...        # GPT-4o
# GOOGLE_API_KEY=AIzaSy...          # Gemini 1.5 Pro
# OPENROUTER_API_KEY=sk-or-v1-...   # DeepSeek

# ─── DEDICATED SUB-ACCOUNT CREDENTIALS (Recommended) ────────────
# Isolated trading credentials with zero withdrawal authority:
BINANCE_SUB_ACCOUNT_API_KEY=your_subaccount_api_key
BINANCE_SUB_ACCOUNT_API_SECRET=your_subaccount_api_secret

# ─── RISK CONTROLS (Safe defaults pre-set) ─────────────────────
MAX_POSITION_PCT=5        # Max 5% of balance per trade
MAX_LEVERAGE=5            # Max 5× leverage for futures
STOP_LOSS_PCT=2           # Minimum 2% mandatory stop-loss
DAILY_LOSS_LIMIT_PCT=10   # 10% daily drawdown circuit breaker

# ─── BINANCE MCP ENGINE (Optional / Future-Ready) ───────────────
ENABLE_BINANCE_MCP=false  # Set to true when custom agents are whitelisted
```

---

### Step 3: Run the Agent

```bash
npm start
```

Expected startup output:
```text
╭───────────────────────────────────────────────────────────────────────────╮
│                                                                           │
│                    BINANCE AGENT OS — ATREUS TRADING AGENT                │
│              Track A Submission: Autonomous AI Trading Agent              │
│                                                                           │
│       Isolated Sub-Account Security Perimeter • Zero-Withdrawal Safe      │
│   Pre-Execution Binance Skills Intelligence • 4-Stage Reasoning Engine    │
│                                                                           │
╰───────────────────────────────────────────────────────────────────────────╯

[Binance MCP Engine] Adapter dormant (ready for future custom agent support) ✓
[LLM Provider] Auto-detected: OPENROUTER (deepseek/deepseek-chat)
[Sub-Account Security] Zero-withdrawal trading perimeter active ✓
[Binance Skills Hub] Pre-trade multi-chain intelligence & sentiment active ✓
[Pre-Trade Guard] RiskGuard Engine Active (Max 5% Position, Max 5× Leverage) ✓
[Safety Invariant] Human-in-the-Loop Confirmation Gate (CONFIRM Required) ✓
[Post-Trade Synthesis] Institutional fill & slippage evaluation enabled ✓

✨ Atreus AI Trading Agent is online and ready for instructions.
You > 
```

---

### Step 4: Try These Commands

At the `You >` prompt, test the multi-stage pipeline:

**1. Pre-Trade Skills Intelligence & Analysis:**
```text
Analyze BTC momentum, smart money inflows, and order book depth
```
*The agent calls `get_market_technicals`, `get_smart_money_inflows`, and `get_spot_order_book` to synthesize a thesis.*

**2. Cross-Chain Token Research via Skills Hub:**
```text
Research BNB token intelligence across chains
```
*The agent calls `research_token_intelligence` to pull cross-chain prices, liquidity, and DEX metrics.*

**3. Isolated Sub-Account Balance Inspection:**
```text
What is my current sub-account balance?
```
*The agent inspects isolated Spot and Futures balances.*

**4. RiskGuard Circuit Breaker Test:**
```text
Propose a $5,000 buy on BTC with a $500 balance
```
*Watch RiskGuard instantly reject the trade for exceeding the 5% position ceiling.*

**5. Authorized Trade Proposal & Confirmation Gate:**
```text
Propose a 2x long position on ETHUSDT with a 2% stop-loss
```
*The agent displays the visual confirmation card. Type `CONFIRM` to execute or press Enter to cancel.*

---

### Step 5: Run Automated Tests

```bash
npm test
```

Expected test suite output:
```text
▶ Confirmation Gate Logic
  ✔ validates CONFIRM case-insensitively
✔ Confirmation Gate Logic
▶ TechnicalAnalysis Indicators Unit Tests
  ✔ calculates RSI on upward trending series
  ✔ calculates RSI on downward trending series
  ✔ calculates Simple Moving Average (SMA) correctly
✔ TechnicalAnalysis Indicators Unit Tests
▶ RiskGuard Unit Tests
  ✔ allows trade within 5% position size
  ✔ rejects trade exceeding 5% position size
  ✔ enforces maximum leverage limit and stop loss requirement
  ✔ enforces daily loss limit drawdown threshold
✔ RiskGuard Unit Tests
ℹ tests 8 | pass 8 | fail 0
```

---

## ⚖️ Legal & Risk Disclaimer

Distributed under the MIT License. See [RISK_DISCLAIMER.md](./RISK_DISCLAIMER.md) for full risk details. Cryptocurrency trading involves substantial risk of loss. Never risk funds you cannot afford to lose.
