import "dotenv/config";
import OpenAI from "openai";
import { BinanceClient } from "./binance-client.js";
import { TechnicalAnalysis } from "./indicators.js";
import { RiskGuard, TradeProposal } from "./risk.js";
import { requireHumanConfirmation } from "./confirmation.js";

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
      description: "Inspects account balances and available capital (supports both simulated Agentic Sub-Account and live API key mode).",
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

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
