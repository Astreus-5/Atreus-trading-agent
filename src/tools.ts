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
      name: "get_account_info",
      description: "Retrieves live Binance account details: Account UID, account type, canTrade status, canWithdraw permissions, spot balances, and futures balances.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_account_balance",
      description: "Fetches live account data from the Binance sub-account: UID, account type, canTrade, canWithdraw, spot balances (asset, free, locked), futures balances (asset, walletBalance, availableBalance).",
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
      description: "PRIMARY TRADING TOOL: Submits an official exchange order on Binance Spot or Futures (for trades >= 5 USDT). Enforces RiskGuard pre-trade auditing and mandatory operator confirmation before sending.",
      parameters: {
        type: "object",
        properties: {
          product: { type: "string", enum: ["SPOT", "USDS-M FUTURES", "COIN-M FUTURES"], description: "Market product" },
          symbol: { type: "string", description: "Trading symbol, e.g. BTCUSDT, ETHUSDT, SOLUSDT" },
          side: { type: "string", enum: ["BUY", "SELL"], description: "Order direction" },
          orderType: { type: "string", enum: ["MARKET", "LIMIT"], description: "Order execution type" },
          quantity: { type: "number", description: "Asset quantity (calculated as notionalUsd / price)" },
          notionalUsd: { type: "number", description: "Total position notional value in USD (marginUsd * leverage)" },
          marginUsd: { type: "number", description: "Initial margin collateral allocated to the position (for Spot = notionalUsd; for Futures = notionalUsd / leverage)" },
          availableMargin: { type: "number", description: "Current available margin in wallet before trade" },
          price: { type: "number", description: "Estimated entry price or limit price" },
          leverage: { type: "number", description: "Futures leverage multiplier (1-5x, default 1 for Spot)" },
          stopLossPrice: { type: "number", description: "Mandatory stop loss price for leveraged positions" },
          takeProfitPrice: { type: "number", description: "Take profit price target" },
        },
        required: ["product", "symbol", "side", "orderType", "quantity", "notionalUsd"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_open_orders",
      description: "Retrieves active open limit orders across Spot markets on Binance.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Optional symbol, e.g. BNBUSDT" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_order",
      description: "Cancels an active open limit order on Binance.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Symbol of the order, e.g. BNBUSDT" },
          orderId: { type: "number", description: "Binance order ID to cancel" },
        },
        required: ["symbol"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "convert_tokens",
      description: "Binance Convert: Use ONLY for dust balances under 5 USDT, or when the user explicitly requests to 'convert' or 'swap' dust assets. For standard trades >= 5 USDT, use submit_trade_order.",
      parameters: {
        type: "object",
        properties: {
          fromAsset: { type: "string", description: "Asset to sell, e.g. BNB" },
          toAsset: { type: "string", description: "Asset to receive, e.g. USDT" },
          amount: { type: "number", description: "Amount of fromAsset to convert" },
        },
        required: ["fromAsset", "toAsset", "amount"],
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
      name: "transfer_wallet",
      description: "Transfers funds internally between your Spot wallet and USDS-M Futures wallet (e.g. move USDT from Futures to Spot, or from Spot to Futures).",
      parameters: {
        type: "object",
        properties: {
          asset: { type: "string", description: "Asset symbol to transfer, e.g. USDT" },
          amount: { type: "number", description: "Amount to transfer" },
          direction: {
            type: "string",
            enum: ["SPOT_TO_FUTURES", "FUTURES_TO_SPOT"],
            description: "Direction: 'SPOT_TO_FUTURES' (move from Spot to Futures) or 'FUTURES_TO_SPOT' (move from Futures to Spot)",
          },
        },
        required: ["asset", "amount", "direction"],
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
      name: "list_binance_skills",
      description: "Binance Skills Hub: Dynamically lists all 19 installed official Binance skills, their descriptions, execution types, and supported commands.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_binance_skill",
      description: "Binance Skills Hub Universal Executor: Executes ANY of the 19 installed Binance skills dynamically (e.g. meme-rush, query-token-audit, trading-signal, query-address-info, academy-skill, crypto-market-rank, query-token-info, binance-tokenized-securities-info).",
      parameters: {
        type: "object",
        properties: {
          skillName: {
            type: "string",
            description: "The name of the skill (e.g. 'meme-rush', 'query-token-audit', 'query-address-info', 'trading-signal', 'crypto-market-rank', 'query-token-info', 'academy-skill')",
          },
          command: {
            type: "string",
            description: "The subcommand to execute (e.g. 'search', 'audit', 'positions', 'meme-rush', 'social-hype', 'smart-money')",
          },
          params: {
            type: "object",
            description: "JSON parameters required by the skill command",
          },
        },
        required: ["skillName", "command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_futures_positions",
      description: "Binance Futures Tool: Inspects active USDS-M perpetual positions, entry price, liquidation price, mark price, leverage, and real-time unrealized PnL.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Optional trading pair (e.g. BTCUSDT, ETHUSDT). If omitted, returns all currently open active positions." },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_my_trades",
      description: "Binance Trade History & Journaling: Fetches historical executed trades, fill prices, quantities, and actual commission fees paid across Spot and USDS-M Futures. If symbol is omitted, returns recent trades across all markets.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Optional trading pair symbol (e.g. SOLUSDT, BNBUSDT). If omitted, returns recent trades across all pairs." },
          limit: { type: "number", description: "Maximum number of recent trades to fetch (default: 10, max: 100)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_futures_leverage",
      description: "Binance Futures Tool: Configures initial leverage (1x to 5x max, governed by RiskGuard) for a USDS-M perpetual pair directly on Binance's matching engine.",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string", description: "Perpetual trading pair symbol, e.g. BTCUSDT, ETHUSDT" },
          leverage: { type: "number", description: "Target leverage multiplier (integer from 1 to 5)" },
        },
        required: ["symbol", "leverage"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_token_ai_report",
      description: "Binance AI Token Intelligence: Generates an institutional-grade research dossier for a token combining 24h market stats, order book depth liquidity pressure, RSI/SMA technical momentum, and AI risk assessment.",
      parameters: {
        type: "object",
        properties: {
          token: { type: "string", description: "Token symbol to analyze, e.g. BTC, ETH, BNB, SOL" },
        },
        required: ["token"],
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

    case "get_account_info":
    case "get_account_balance":
      return await client.getAccountBalances();

    case "submit_trade_order": {
      const isFutures = args.product !== "SPOT";
      const leverage = isFutures ? (args.leverage ?? 1) : 1;
      const marginUsd = args.marginUsd ?? (isFutures && leverage > 1 ? args.notionalUsd / leverage : args.notionalUsd);

      const proposal: TradeProposal = {
        product: args.product,
        symbol: args.symbol,
        side: args.side,
        orderType: args.orderType,
        quantity: args.quantity,
        notionalUsd: args.notionalUsd,
        availableMargin: args.availableMargin,
        marginUsd: Number(marginUsd.toFixed(4)),
        price: args.price,
        leverage: args.leverage,
        stopLossPrice: args.stopLossPrice,
        takeProfitPrice: args.takeProfitPrice,
      };

      // Dynamically fetch or calculate current balance for risk evaluation
      let balanceToEvaluate = accountBalance;
      if (balanceToEvaluate === undefined && client.hasKeys()) {
        try {
          const balances = await client.getAccountBalances();
          if (isFutures) {
            const futUsdt = balances.futuresBalances?.find((b: any) => b.asset === "USDT");
            if (futUsdt) balanceToEvaluate = parseFloat(futUsdt.free);
          } else {
            const spotUsdt = balances.spotBalances?.find((b: any) => b.asset === "USDT");
            if (spotUsdt) balanceToEvaluate = parseFloat(spotUsdt.free);
          }
        } catch {}
      }
      if (balanceToEvaluate === undefined) {
        balanceToEvaluate = args.availableMargin ?? 1000;
      }
      if (proposal.availableMargin === undefined) {
        proposal.availableMargin = balanceToEvaluate;
      }

      // 1. Run Pre-trade Risk Audit
      const riskResult = riskGuard.validate(proposal, balanceToEvaluate ?? 1000);
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
        notionalUsd: proposal.notionalUsd,
        price: proposal.price,
      });
    }

    case "get_open_orders":
      return await client.getOpenOrders(args.symbol);

    case "cancel_order":
      return await client.cancelOrder(args.symbol, args.orderId);

    case "convert_tokens":
      return await client.convertTokens(args.fromAsset, args.toAsset, args.amount);

    case "redeem_simple_earn":
      return await client.redeemFlexibleEarn(args.asset, args.amount);

    case "transfer_to_subaccount":
      return await client.transferToSubAccount(args.asset, args.amount, args.subAccountEmail);

    case "transfer_wallet":
      return await client.transferWallet(args.asset, args.amount, args.direction);

    case "research_token_intelligence":
      return await BinanceSkillsRunner.searchToken(args.keyword, args.chainIds);

    case "get_smart_money_inflows":
      return await BinanceSkillsRunner.getSmartMoneyInflow(args.chainId ?? "56", args.period ?? "24h");

    case "get_social_sentiment_hype":
      return await BinanceSkillsRunner.getSocialHype(args.chainId ?? "56", args.timeRange ?? 1);

    case "list_binance_skills":
      return BinanceSkillsRunner.listInstalledSkills();

    case "execute_binance_skill":
      return await BinanceSkillsRunner.executeSkill(args.skillName, args.command, args.params ?? {});

    case "get_futures_positions":
      return await client.getFuturesPositions(args.symbol);

    case "get_my_trades":
      return await client.getMyTrades(args.symbol, args.limit ?? 10);

    case "set_futures_leverage": {
      const maxAllowed = riskGuard.getConfig().maxLeverage;
      if (args.leverage > maxAllowed) {
        return {
          status: "REJECTED_BY_RISK_GUARD",
          error: `Leverage ${args.leverage}x exceeds maximum allowed leverage of ${maxAllowed}x.`,
        };
      }
      return await client.setFuturesLeverage(args.symbol, args.leverage);
    }

    case "get_token_ai_report":
      return await client.getTokenAiReport(args.token);

    default:
      return { error: `Unknown tool: ${name}` };
  }
}
