# 🗺️ Atreus — Roadmap & Architecture Vision

## What Atreus Is Today

A **terminal-first autonomous trading agent** with proven real-money execution on Binance mainnet.

```
User
 └─▶ Atreus CLI  (npm start)
       └─▶ LLM  (Claude / GPT-4o / Gemini / DeepSeek — auto-detected)
             └─▶ 22 Atreus Trading Tools
                   └─▶ Binance REST API
                         ├─▶ Spot Trading
                         ├─▶ USDS-M Futures
                         ├─▶ Convert
                         └─▶ Wallet & Sub-Account Management
```

**Proven with mainnet receipts:**

| Order | Pair | Type | Status |
|---|---|---|---|
| `#12536990887` | BNBUSDT | Spot BUY | ✅ Filled |
| `#239340355658` | SOLUSDT | Futures LONG | ✅ Filled |
| `#239340648944` | SOLUSDT | Futures CLOSE | ✅ Filled |
| BTC Spot | BTCUSDT | Spot BUY | ✅ Filled |
| `tranId: 408322819829` | USDT | Internal Transfer | ✅ Confirmed |

---

## Current Integration Architecture: Dual-Layer (REST + MCP)

Atreus is built with **two integration layers** — one live, one activation-ready:

### Layer 1 — Native REST API (Active Today)
- 22 purpose-built TypeScript tools covering the full Binance API surface
- Direct HMAC-SHA256 signed requests to Binance REST endpoints
- Sub-account isolated perimeter with zero-withdrawal security
- Battle-tested: every trade in this submission went through this layer

### Layer 2 — Official Binance Agent OS MCP (Built, Awaiting Authorization)
- Full JSON-RPC 2.0 client in `src/mcp-client.ts` targeting `https://agent.binance.com/mcp/agentic`
- RFC 7636 PKCE OAuth 2.0 manager in `src/mcp-auth.ts`
- RiskGuard + Human Confirmation Gate already wired to intercept every MCP order call
- Activates in one command: `npm start -- --mcp-auth`

> **Note on REST API fate:** The native REST API layer may be **retired or reduced** once Binance opens its Agent OS OAuth server to custom agents. At that point, Atreus will migrate fully to the MCP layer — which is architecturally cleaner, officially supported, and already built. The REST layer exists today because it works, not as a permanent design choice.

---

## What Atreus Becomes — Multi-Channel Agent Platform

The CLI is the **first interface** of a much larger agent platform:

```
                     ATREUS AGENT PLATFORM
                              │
           ┌──────────────────┼──────────────────┐
           ▼                  ▼                  ▼
        CLI              Telegram           WhatsApp
    (live today)         (roadmap)          (roadmap)
           │                  │                  │
           └──────────────────┼──────────────────┘
                              ▼
                       Atreus Core Agent
                    (LLM + RiskGuard + Tools)
                              │
                   ┌──────────┴──────────┐
                   ▼                     ▼
            Binance REST API     Binance Agent OS MCP
            (active fallback)   (primary when authorized)
                              │
                    User's Binance Sub-Account
                    (isolated, zero-withdrawal)
```

---

## Roadmap Phases

| Phase | Feature | Status |
|---|---|---|
| **v1 — Hackathon** | Terminal CLI with natural language trading | ✅ Live |
| **v1 — Hackathon** | 22 REST tools — Spot, Futures, Convert, Wallet | ✅ Live |
| **v1 — Hackathon** | RiskGuard engine + Human-in-the-Loop confirmation | ✅ Live |
| **v1 — Hackathon** | Button-style confirmation gate (1/Y to execute) | ✅ Live |
| **v1 — Hackathon** | Auto-retry on LLM empty response (2× with backoff) | ✅ Live |
| **v1 — Hackathon** | MCP JSON-RPC 2.0 client + PKCE OAuth — built & wired | ✅ Built |
| **v2** | Telegram bot interface | 🗺️ Roadmap |
| **v2** | WhatsApp integration | 🗺️ Roadmap |
| **v2** | Persistent trade journal & PnL dashboard | 🗺️ Roadmap |
| **v3** | Full Binance MCP activation (pending Binance OAuth whitelist) | 🗺️ Roadmap |
| **v3** | REST API layer retired → MCP becomes sole integration | 🗺️ Roadmap |
| **v3** | Multi-user account management | 🗺️ Roadmap |
| **v4** | On-chain DeFi execution (cross-chain via BNB Chain) | 🗺️ Roadmap |

---

## Hackathon Pitch Summary

> *Atreus is a terminal-based autonomous trading agent that lets users analyze markets and execute Spot and Futures trades through natural language. The architecture is designed to evolve into a multi-channel agent platform — Telegram, WhatsApp, and more — while securely connecting to Binance through the Agent OS MCP infrastructure once Binance authorizes custom agents. The hackathon submission is v1: credible, working, production-grade. The roadmap shows where this is headed.*
