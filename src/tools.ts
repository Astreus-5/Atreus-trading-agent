import "dotenv/config";
import OpenAI from "openai";
import { BinanceClient } from "./binance-client.js";
import { TechnicalAnalysis } from "./indicators.js";
import { RiskGuard, TradeProposal } from "./risk.js";
import { requireHumanConfirmation } from "./confirmation.js";
import { BinanceSkillsRunner } from "./skills-runner.js";

const client = new BinanceClient();

export const agentTools: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_spot_ticker",
      description: "Fetches real-time Binance Spot price, 24h high/low, price change percentage, and trading volume for a pair (e.g. BTCUSDT, ETHUSDT).",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading pair symbol, e.g. BTCUSDT" },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_market_technicals",
      description: "Fetches historical klines and computes real-time quantitative technical indicators: RSI (14), SMA (7), and SMA (25) to evaluate overbought/oversold levels.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading pair, e.g. BTCUSDT" },
          interval: { type: "string", enum: ["15m", "1h", "4h", "1d"], description: "Candlestick timeframe" },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_spot_order_book",
      description: "Fetches live order book depth (bids and asks) from Binance Spot market to evaluate liquidity support/resistance.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Trading pair, e.g. BTCUSDT" },
          limit: { type: "number", description: "Number of order levels (default: 10)" },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_futures_funding_rate",
      description: "Fetches real-time perpetual contract funding rates, mark price, and next funding settlement countdown for USDS-M Futures.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Futures trading pair, e.g. BTCUSDT" },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_futures_ticker",
      description: "Fetches 24-hour ticker statistics and last traded price for USDS-M Perpetual contracts.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Futures pair, e.g. BTCUSDT" },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_account_balance",
      description: "Inspects account balances and available capital across Master Spot, Simple Earn (Flexible Savings), Futures, and Binance Agent OS Agentic Sub-Accounts.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "submit_trade_order",
      description: "Submits a trade order (Spot, USDS-M Futures, or COIN-M Futures). Automatically enforces RiskGuard auditing and mandatory operator CONFIRM gate before sending.",
      parameters: {
        type: "object",
        properties: {
          product: { type: "string", enum: ["SPOT", "USDS-M FUTURES", "COIN-M FUTURES"], description: "Market product" },
          symbol: { type: "string", description: "Trading symbol, e.g. BTCUSDT" },
          side: { type: "string", enum: ["BUY", "SELL"], description: "Order direction" },
          orderType: { type: "string", enum: ["MARKET", "LIMIT"], description: "Order execution type" },
          quantity: { type: "number", description: "Asset quantity" },
          notionalUsd: { type: "number", description: "Estimated USD trade value" },
          price: { type: "number", description: "Limit price (if LIMIT order)" },
          leverage: { type: "number", description: "Futures leverage (1-5x)" },
          stopLossPrice: { type: "number", description: "Mandatory stop loss price for leveraged positions" },
        },
        required: ["product", "symbol", "side", "orderType", "quantity", "notionalUsd"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "redeem_simple_earn",
      description: "Redeems yield-bearing assets (e.g. USDT) from Binance Simple Earn (Flexible Savings) back to Master Spot Wallet so they can be traded or transferred.",
      parameters: {
        type: "object",
        properties: {
          asset: { type: "string", description: "Asset symbol, e.g. USDT" },
          amount: { type: "number", description: "Amount to redeem" },
        },
        required: ["asset", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "transfer_to_subaccount",
      description: "Transfers funds (e.g. USDT) from Master Spot Wallet directly to the Binance Agent OS Agentic Sub-Account.",
      parameters: {
        type: "object",
        properties: {
          asset: { type: "string", description: "Asset symbol to transfer, e.g. USDT" },
          amount: { type: "number", description: "Amount to transfer" },
          subAccountEmail: {
            type: "string",
            description: "Optional recipient sub-account email. Defaults to auto-discovered agentic sub-account.",
          },
        },
        required: ["asset", "amount"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "research_token_intelligence",
      description: "Binance Skill: Researches comprehensive token metadata, cross-chain pricing, 24h volume, and liquidity across BSC, Base, Solana, and Ethereum using the official Binance Skills Hub.",
      parameters: {
        type: "object",
        properties: {
          keyword: { type: "string", description: "Token symbol or name, e.g. BTC, ETH, BNB" },
          chainIds: { type: "string", description: "Optional comma-separated chain IDs (e.g. '56', '8453', 'CT_501', '1')" },
        },
        required: ["keyword"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_smart_money_inflows",
      description: "Binance Skill: Fetches real-time smart-money net inflow rankings from Binance Web3 Analytics to discover where institutions and smart traders are allocating capital.",
      parameters: {
        type: "object",
        properties: {
          chainId: { type: "string", description: "Target blockchain ID: '56' (BSC), '8453' (Base), or 'CT_501' (Solana). Default: '56'" },
          period: { type: "string", enum: ["24h", "7d"], description: "Time period window. Default: '24h'" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_social_sentiment_hype",
      description: "Binance Skill: Fetches live social buzz, community sentiment, and hype rankings from Binance Web3 Social Intelligence.",
      parameters: {
        type: "object",
        properties: {
          chainId: { type: "string", description: "Target blockchain ID: '56' (BSC), '8453' (Base), or 'CT_501' (Solana). Default: '56'" },
          timeRange: { type: "number", description: "Time range (1, 7, or 30 days). Default: 1" },
        },
      },
    },
  },
];

export async function executeAgentTool(
  name: string,
  args: any,
  riskGuard: RiskGuard,
  accountBalance?: number
): Promise<any> {
  switch (name) {
    case "get_spot_ticker":
      return await client.getSpotTicker(args.symbol);

    case "get_market_technicals": {
      const klines = await client.getKlines(args.symbol, args.interval ?? "1h", 30);
      const closes = klines.map((k) => Number(k.close));
      const rsi = TechnicalAnalysis.calculateRSI(closes, 14);
      const sma7 = TechnicalAnalysis.calculateSMA(closes, 7);
      const sma25 = TechnicalAnalysis.calculateSMA(closes, 25);
      const latestClose = closes[closes.length - 1];

      return {
        symbol: args.symbol.toUpperCase(),
        timeframe: args.interval ?? "1h",
        latestPrice: latestClose,
        indicators: {
          rsi14: rsi,
          sma7,
          sma25,
          bias: rsi > 70 ? "OVERBOUGHT" : rsi < 30 ? "OVERSOLD" : sma7 > sma25 ? "BULLISH_TREND" : "BEARISH_TREND",
        },
      };
    }

    case "get_spot_order_book":
      return await client.getSpotOrderBook(args.symbol, args.limit ?? 10);

    case "get_futures_funding_rate":
      return await client.getFuturesFundingRate(args.symbol);

    case "get_futures_ticker":
      return await client.getFuturesTicker(args.symbol);

    case "get_account_balance":
      return await client.getAccountBalances();

    case "submit_trade_order": {
      const proposal: TradeProposal = {
        product: args.product,
        symbol: args.symbol,
        side: args.side,
        orderType: args.orderType,
        quantity: args.quantity,
        notionalUsd: args.notionalUsd,
        price: args.price,
        leverage: args.leverage,
        stopLossPrice: args.stopLossPrice,
      };

      // Dynamically fetch or calculate current balance for risk evaluation
      const balanceToEvaluate = accountBalance ?? 1000;

      // 1. Run Pre-trade Risk Audit
      const riskResult = riskGuard.validate(proposal, balanceToEvaluate);
      if (!riskResult.passed) {
        return {
          status: "REJECTED_BY_RISK_GUARD",
          violations: riskResult.violations,
        };
      }

      // 2. Enforce Mandatory Human Confirmation Gate
      const confirmed = await requireHumanConfirmation(proposal);
      if (!confirmed) {
        return {
          status: "CANCELLED_BY_OPERATOR",
          message: "Operator cancelled or did not authorize trade.",
        };
      }

      // 3. Execution
      return await client.executeOrder({
        product: proposal.product,
        symbol: proposal.symbol,
        side: proposal.side,
        orderType: proposal.orderType,
        quantity: proposal.quantity,
        price: proposal.price,
      });
    }

    case "redeem_simple_earn":
      return await client.redeemFlexibleEarn(args.asset, args.amount);

    case "transfer_to_subaccount":
      return await client.transferToSubAccount(args.asset, args.amount, args.subAccountEmail);

    case "research_token_intelligence":
      return await BinanceSkillsRunner.searchToken(args.keyword, args.chainIds);

    case "get_smart_money_inflows":
      return await BinanceSkillsRunner.getSmartMoneyInflow(args.chainId ?? "56", args.period ?? "24h");

    case "get_social_sentiment_hype":
      return await BinanceSkillsRunner.getSocialHype(args.chainId ?? "56", args.timeRange ?? 1);

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
