# Binance AI Trading Agent (TypeScript Edition)
### 🏆 Binance Agent OS Mini Hackathon — Track A: AI Agent Development ($20,000 Prize Pool)

An autonomous, institutional-grade AI Trading Agent built in **TypeScript** supporting **Claude (Anthropic)**, **GPT-4o (OpenAI)**, **Gemini 1.5 Pro (Google)**, and **DeepSeek (OpenRouter)**. Engineered for real-time Binance market intelligence, quantitative technical analysis, strict pre-trade risk controls, and human-in-the-loop trade execution.

---

## 🌟 Universal LLM & Agent Architecture

```
                               ┌────────────────────────────────────────────────────────┐
                               │             Universal AI Reasoning Brain               │
                               │  Claude 3.5 Sonnet • GPT-4o • Gemini 1.5 • DeepSeek    │
                               │  (Auto-detected from available environment API key)    │
                               └───────────────────────────┬────────────────────────────┘
                                                           │ Tool Calls
                                                           ▼
                               ┌────────────────────────────────────────────────────────┐
                               │                  AI Agent Tool Router                  │
                               │           (src/tools.ts • src/indicators.ts)           │
                               └─────────────┬────────────────────────────┬─────────────┘
                                             │                            │
                        Live Data Feeds      ▼                            ▼     Trade Order Proposals
                      ┌─────────────────────────────┐              ┌─────────────────────────────────┐
                      │  Official Binance Endpoints │              │   Pre-Trade RiskGuard Engine    │
                      │  • Spot Ticker & 24h Stats  │              │   • Max 5% Position Size        │
                      │  • USDS-M Funding & Mark    │              │   • Max 5× Leverage Ceiling     │
                      │  • Live Order Book Depth    │              │   • Mandatory ≥2% Stop-Loss     │
                      │  • Real-time RSI(14) & SMAs │              │   • 10% Daily Drawdown Breaker  │
                      └─────────────────────────────┘              └────────────────┬────────────────┘
                                                                                    │ Passed Audit
                                                                                    ▼
                                                                  ┌──────────────────────────────────┐
                                                                  │ Human-in-the-Loop Confirmation   │
                                                                  │ Visual double-bordered box card  │
                                                                  │ Operator must type 'CONFIRM'     │
                                                                  └─────────────────┬────────────────┘
                                                                                    │ CONFIRM
                                                                                    ▼
                                                                  ┌──────────────────────────────────┐
                                                                  │   Live Binance Order Execution   │
                                                                  │   (Spot Matching Engine API)     │
                                                                  └──────────────────────────────────┘
```

1. **Universal Multi-LLM Engine**: Runs with **ANY** configured LLM API key (**Anthropic Claude**, **OpenAI GPT-4o**, **Google Gemini**, or **OpenRouter DeepSeek**). The engine auto-detects whichever key is provided.
2. **Native TypeScript Architecture**: Built on Node.js 20+ and TypeScript ES2022 with zero legacy dependencies for optimal speed and strict type safety.
3. **Multi-Market Intelligence & Account Engine**: Instantly pulls real-time Spot prices, 24h stats, USDS-M funding rates, mark prices, order book depth, and audits balances across Master Spot, Simple Earn, and Binance Agent OS Sub-Accounts.
4. **Quantitative Technical Indicator Engine**: Computes live **RSI (14)**, **SMA (7)**, and **SMA (25)** directly from Binance candlestick bars to assess overbought/oversold regimes.
5. **Pre-Trade RiskGuard Engine**: Audits every single trade proposal against strict risk invariants before human review.
6. **Human-in-the-Loop Safeguard**: The AI cannot unilaterally place orders. Every trade triggers a visual terminal card requiring the operator to explicitly type `CONFIRM`.

---

## 📁 Project Structure

```
atreus-trading-agent/
├── package.json               # Node.js & TypeScript dependencies
├── tsconfig.json              # Strict ES2022 TypeScript settings
├── .env.example               # Universal environment configuration template
├── .gitignore                 # Safe exclusions (secrets & tokens)
├── README.md                  # Comprehensive documentation & setup guide
├── RISK_DISCLAIMER.md         # Mandatory financial risk disclosure
│
├── src/
│   ├── index.ts               # Interactive CLI Application loop
│   ├── llm-provider.ts        # Universal LLM Adapter (Claude, GPT, Gemini, OpenRouter)
│   ├── binance-client.ts      # Unified Binance market & execution client
│   ├── indicators.ts          # Technical indicators (RSI 14, SMA 7, SMA 25)
│   ├── tools.ts               # AI Agent function tool declarations & router
│   ├── prompt.ts              # Institutional trading system prompt
│   ├── risk.ts                # RiskGuard pre-trade auditing engine
│   └── confirmation.ts        # Double-bordered visual human confirmation card
│
├── tests/
│   ├── risk.test.ts           # RiskGuard unit test suite
│   └── confirmation.test.ts   # Confirmation gate unit test suite
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

### Step 1: Clone & Install

```bash
git clone https://github.com/Astreus-5/atreus-trading-agent.git
cd atreus-trading-agent
npm install
```

> ✅ Expected: You'll see packages installing. No errors. Takes ~30 seconds.

---

### Step 2: Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Open `.env` in any text editor and add **just one** LLM API key — whichever you already have:

```dotenv
# ─── PICK ONE LLM KEY — only one is required ───────────────────

ANTHROPIC_API_KEY=sk-ant-...        # Claude 3.5 Sonnet  → get at console.anthropic.com
# OPENAI_API_KEY=sk-proj-...        # GPT-4o             → get at platform.openai.com
# GOOGLE_API_KEY=AIzaSy...          # Gemini 1.5 Pro     → get at aistudio.google.com
# OPENROUTER_API_KEY=sk-or-v1-...   # DeepSeek           → get at openrouter.ai/keys

# ─── RISK CONTROLS (optional — safe defaults pre-set) ───────────
MAX_POSITION_PCT=5        # Max 5% of balance per trade
MAX_LEVERAGE=5            # Max 5× leverage for futures
STOP_LOSS_PCT=2           # Minimum 2% mandatory stop-loss
DAILY_LOSS_LIMIT_PCT=10   # 10% daily drawdown circuit breaker

# ─── BINANCE LIVE API CREDENTIALS (Required) ───────────────────
# Connects the agent directly to Binance live market and order execution engines
BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
```

---

### Step 3: Run the Agent

```bash
npm start
```

> ✅ Expected output:
> ```
> [LLM Provider] Auto-detected: OPENROUTER (deepseek/deepseek-chat)
> [Binance Engine] Live Production Authenticated (Spot • Futures • Sub-Accounts) ✓
> [Market Data] Connected directly to official Binance real-time feeds ✓
> [Pre-Trade Guard] RiskGuard Engine Active (Max 5% Position, Max 5× Leverage) ✓
> [Safety Invariant] Human-in-the-Loop Confirmation Gate (CONFIRM Required) ✓
>
> ✨ Binance AI Trading Agent is online and ready for instructions.
> You >
> ```

The agent auto-detects your LLM key and validates your Binance live production connection.

---

### Step 4: Give the Agent Its First Prompt

At the `You >` prompt, type any of these to see the agent in action:

**🔎 Live Market Intelligence:**
```
Check live BTCUSDT price and funding rate
```

**📊 Technical Analysis:**
```
Analyze ETHUSDT RSI and momentum
```

**⚠️ Risk Rejection (watch RiskGuard block this):**
```
Propose a $5000 buy on BTCUSDT with a $3500 balance
```

**✅ Valid Trade Proposal (triggers CONFIRM gate):**
```
Propose a 2x long position on ETHUSDT with a 2% stop-loss
```

> 💡 For the trade proposal: the agent will show a visual authorization card.
> Type `CONFIRM` to submit the live order to Binance, or press Enter to cancel.

---

### Step 5: Run Automated Tests (Optional)

```bash
npm test
```

Expected output:
```text
▶ Confirmation Gate Logic
  ✔ validates CONFIRM case-insensitively
▶ RiskGuard Unit Tests
  ✔ allows trade within 5% position size
  ✔ rejects trade exceeding 5% position size
  ✔ enforces maximum leverage limit and stop loss requirement
  ✔ enforces daily loss limit drawdown threshold
ℹ tests 5 | pass 5 | fail 0
```

---

## 🧪 Interactive Demo & Example Prompts

### 1. Market Intelligence & Technicals
> **Prompt:** `Analyze live BTCUSDT price, funding rates, and RSI indicators.`

```markdown
📊 Binance Market Intelligence — BTCUSDT
• Spot Price: $81,248.32 (+4.24% 24h)
• USDS-M Funding Rate: +0.0060% (Mark: $81,208.00)
• Technicals (1h timeframe): RSI(14) = 68.35 | SMA(7) = $81,011.85 | SMA(25) = $80,784.37
• Analysis: Bullish momentum above short-term moving averages with healthy funding.
```

### 2. Risk Rejection Test (Circuit Breaker)
> **Prompt:** `Propose a $2,000 Spot buy on BTCUSDT with a $3,500 balance.`

```markdown
❌ Trade Rejected by RiskGuard:
Position size $2,000.00 exceeds allowed limit of $175.00 (5.0% of $3,500.00 balance).
```

### 3. Authorized Trade Formulation & Confirmation Gate
> **Prompt:** `Propose a 2x long position on ETHUSDT with a 2% stop-loss.`

```text
╔══════════════════════════════════════════════════════════════╗
║        ⚠ TRADE PROPOSAL — HUMAN AUTHORIZATION REQUIRED       ║
║                                                              ║
║ Product / Market : USDS-M FUTURES                            ║
║ Trading Pair     : ETHUSDT                                   ║
║ Action / Side    : BUY (LONG)                                ║
║ Order Type       : MARKET                                    ║
║ Quantity         : 0.05 ETH (~$125.00 Notional)              ║
║ Leverage         : 2×                                        ║
║ Stop-Loss Target : $2,450.00 (2.0% below entry)              ║
║                                                              ║
║ To authorize and execute this order on Binance, type CONFIRM ║
║ Press Enter or type anything else to CANCEL.                 ║
╚══════════════════════════════════════════════════════════════╝
Your Decision > CONFIRM

✓ Execution confirmed by operator. Submitting order to Binance...
Order #789210381 FILLED @ $2,500.20
```

---

## ⚖️ Legal & Risk Disclaimer

Distributed under the MIT License. See [RISK_DISCLAIMER.md](./RISK_DISCLAIMER.md) for full risk details. Cryptocurrency trading involves substantial risk of loss.
