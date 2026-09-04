# Example Conversation Flow: Binance AI Trading Agent

This document illustrates the expected multi-step reasoning, market analysis, risk validation, and human confirmation workflow when operating the Binance AI Trading Agent.

---

### Step 1: Market Intelligence & Query

**User Prompt:**
> "Analyze BTCUSDT across Spot and USDS-M Futures. Check funding rates, recent 24h momentum, and summarize the order book depth."

**Agent Internal Tool Invocations (via Official Binance Feeds):**
- `get_spot_ticker(symbol="BTCUSDT")`
- `get_spot_order_book(symbol="BTCUSDT", limit=10)`
- `get_futures_funding_rate(symbol="BTCUSDT")`
- `get_account_balance()`

**Agent Response:**
```markdown
### 📊 Binance Market Intelligence — BTCUSDT

| Metric | Spot (BTCUSDT) | USDS-M Perp (BTCUSDT) |
| :--- | :--- | :--- |
| **Current Price** | $81,248.32 | $81,208.00 |
| **24h High / Low** | $82,100.00 / $78,500.00 | $82,150.00 / $78,450.00 |
| **24h Price Change** | +4.25% (+$3,310.00) | +4.21% |
| **Order Book Depth** | Bids: 34.2 BTC / Asks: 38.5 BTC | Balanced liquidity |
| **Perp Funding Rate** | N/A | +0.0060% (Next settlement in 3h) |

#### Market Context & Analysis:
• **Bullish Momentum:** BTC is sustaining strong price action above short-term moving averages.
• **Neutral Funding:** +0.0060% funding rate indicates disciplined long positioning without leverage overheating.
• **Order Book Structure:** Strong bid liquidity around $80,500 provides near-term support.
• **Account Balance:** Sandbox Simulation Mode active (or Live Account if configured).

*Past performance does not guarantee future results. Cryptocurrency trading involves substantial risk of loss.*
```

---

### Step 2: Formulate Trade Proposal with Risk Controls

**User Prompt:**
> "Let's open a small long position on USDS-M Futures to capture continuation towards $83,000."

**Agent Response:**
```markdown
I have formulated a trade proposal adhering to all active risk parameters:

─────────────────────────────────────────────────────────────
⚠ TRADE PROPOSAL — HUMAN CONFIRMATION REQUIRED
─────────────────────────────────────────────────────────────
• Product:          USDS-M Futures Perpetual
• Symbol:           BTCUSDT
• Action / Side:    BUY (LONG)
• Order Type:       MARKET
• Quantity:         0.002 BTC (~$162.40 Notional)
• Leverage:         2× (Margin Required: ~$81.20 USDT)
• Entry Target:     ~$81,208.00
• Mandatory Stop:   $79,580.00 (~2.0% distance below entry)
• Take-Profit:      $83,000.00 (~2.2% target)
─────────────────────────────────────────────────────────────

### 🛡️ Pre-Trade Risk Audit:
[✓] Max Position Size: $162.40 is under 5.0% limit -> PASS
[✓] Leverage: 2× is below 5× ceiling -> PASS
[✓] Mandatory Stop-Loss: Set at $79,580.00 -> PASS
[✓] Daily Drawdown Limit: $0 current session loss -> PASS

To authorize and submit this order to Binance, please type:
  CONFIRM
or press Enter / type anything else to cancel.
```

---

### Step 3: Human Confirmation & Execution

**User Input:**
```text
CONFIRM
```

**Agent Internal Tool Invocation:**
- `submit_trade_order(product="USDS-M FUTURES", symbol="BTCUSDT", side="BUY", orderType="MARKET", quantity=0.002, notionalUsd=162.40, leverage=2, stopLossPrice=79580)`

**Agent Execution Output:**
```markdown
✓ Execution confirmed by operator. Submitting order to Binance...

### ✅ Order Execution Report
• **Status:** FILLED
• **Order ID:** AGNT-SIM-1725458920124
• **Symbol:** BTCUSDT
• **Side:** BUY (LONG)
• **Executed Quantity:** 0.002 BTC
• **Stop-Loss Target:** $79,580.00

Order successfully processed with full pre-trade RiskGuard audit and operator authorization.
```

---

### Step 4: Rejection / Cancellation Flow (Example)

If the user changes their mind or enters any other string:

**User Input:**
```text
cancel
```

**Agent Output:**
```markdown
✗ Order rejected or cancelled by operator.
No orders were submitted to Binance. Available balance remains completely intact.
```
