import crypto from "node:crypto";
import { TechnicalAnalysis } from "./indicators.js";

/**
 * Represents 24-hour ticker statistics for a trading pair.
 */
export interface TickerData {
  symbol: string;
  price: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
}

/**
 * Represents the top bid and ask levels of an order book.
 */
export interface OrderBookData {
  bids: [string, string][];
  asks: [string, string][];
}

/**
 * Represents perpetual contract funding rate and mark price metrics.
 */
export interface FundingRateData {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
}

/**
 * Unified Binance Client providing real-time market data access and authenticated order routing.
 */
export class BinanceClient {
  private readonly apiKey: string;
  private readonly apiSecret: string;
  private readonly spotBaseUrl = "https://api.binance.com";
  private readonly futuresBaseUrl = "https://fapi.binance.com";
  private readonly coinFuturesBaseUrl = "https://dapi.binance.com";

  /**
   * Initializes the Binance Client.
   * @param apiKey Your Binance sub-account API key (trade-only, no withdrawal rights).
   * @param apiSecret Your Binance sub-account API secret.
   */
  constructor(apiKey = process.env.BINANCE_SUB_ACCOUNT_API_KEY ?? "", apiSecret = process.env.BINANCE_SUB_ACCOUNT_API_SECRET ?? "") {
    this.apiKey = apiKey.trim();
    this.apiSecret = apiSecret.trim();
  }

  /**
   * Checks whether valid API credentials have been configured.
   */
  public hasKeys(): boolean {
    return Boolean(this.apiKey && this.apiSecret);
  }

  private stepSizeCache = new Map<string, number>();

  /**
   * Dynamically retrieves the exchange LOT_SIZE stepSize filter for any trading pair from Binance.
   */
  public async getStepSize(symbol: string): Promise<number> {
    const sym = symbol.toUpperCase();
    if (this.stepSizeCache.has(sym)) return this.stepSizeCache.get(sym)!;

    try {
      const res = await fetch(`${this.spotBaseUrl}/api/v3/exchangeInfo?symbol=${sym}`);
      if (res.ok) {
        const data: any = await res.json();
        const lotFilter = data.symbols?.[0]?.filters?.find((f: any) => f.filterType === "LOT_SIZE");
        if (lotFilter?.stepSize) {
          const step = parseFloat(lotFilter.stepSize);
          this.stepSizeCache.set(sym, step);
          return step;
        }
      }
    } catch {}
    return 0.001;
  }

  /**
   * Formats any requested token quantity down to the exchange's required stepSize precision.
   */
  public formatQuantity(qty: number, stepSize: number): number {
    const precision = Math.max(0, Math.round(-Math.log10(stepSize)));
    const factor = Math.pow(10, precision);
    return Math.floor(qty * factor) / factor;
  }

  /**
   * Generates HMAC-SHA256 signature for Binance API requests.
   */
  private sign(queryString: string): string {
    return crypto.createHmac("sha256", this.apiSecret).update(queryString).digest("hex");
  }


  // ── Public Market Intelligence (100% Real-Time Live Feeds) ──────────────────

  /**
   * Fetches the 24-hour ticker price change statistics for a Spot symbol.
   * @param symbol Trading pair, e.g. "BTCUSDT".
   */
  async getSpotTicker(symbol: string): Promise<TickerData> {
    const res = await fetch(`${this.spotBaseUrl}/api/v3/ticker/24hr?symbol=${symbol.toUpperCase()}`);
    if (!res.ok) throw new Error(`Spot Ticker request failed (${res.status}): ${res.statusText}`);
    const data: any = await res.json();
    return {
      symbol: data.symbol,
      price: data.lastPrice,
      priceChangePercent: data.priceChangePercent,
      highPrice: data.highPrice,
      lowPrice: data.lowPrice,
      volume: data.volume,
    };
  }

  /**
   * Fetches the live order book depth for a Spot symbol.
   * @param symbol Trading pair, e.g. "BTCUSDT".
   * @param limit Number of price levels to return (default: 10).
   */
  async getSpotOrderBook(symbol: string, limit = 10): Promise<OrderBookData> {
    const res = await fetch(`${this.spotBaseUrl}/api/v3/depth?symbol=${symbol.toUpperCase()}&limit=${limit}`);
    if (!res.ok) throw new Error(`Order Book request failed (${res.status}): ${res.statusText}`);
    const data: any = await res.json();
    return {
      bids: data.bids.slice(0, limit),
      asks: data.asks.slice(0, limit),
    };
  }

  /**
   * Fetches historical candlestick (kline) bars for technical analysis.
   * @param symbol Trading pair, e.g. "BTCUSDT".
   * @param interval Candlestick timeframe (default: "1h").
   * @param limit Number of historical bars to retrieve (default: 30).
   */
  async getKlines(symbol: string, interval = "1h", limit = 30): Promise<any[]> {
    const res = await fetch(
      `${this.spotBaseUrl}/api/v3/klines?symbol=${symbol.toUpperCase()}&interval=${interval}&limit=${limit}`
    );
    if (!res.ok) throw new Error(`Kline request failed (${res.status}): ${res.statusText}`);
    const data: any = await res.json();
    return data.map((k: any) => ({
      openTime: k[0],
      open: k[1],
      high: k[2],
      low: k[3],
      close: k[4],
      volume: k[5],
      closeTime: k[6],
    }));
  }

  /**
   * Fetches real-time funding rate and mark price for USDS-M Perpetual contracts.
   * @param symbol Futures pair, e.g. "BTCUSDT".
   */
  async getFuturesFundingRate(symbol: string): Promise<FundingRateData> {
    const res = await fetch(`${this.futuresBaseUrl}/fapi/v1/premiumIndex?symbol=${symbol.toUpperCase()}`);
    if (!res.ok) throw new Error(`Futures Funding request failed (${res.status}): ${res.statusText}`);
    const data: any = await res.json();
    return {
      symbol: data.symbol,
      markPrice: data.markPrice,
      indexPrice: data.indexPrice,
      lastFundingRate: (Number(data.lastFundingRate) * 100).toFixed(4) + "%",
      nextFundingTime: data.nextFundingTime,
    };
  }

  /**
   * Fetches 24-hour ticker statistics for USDS-M Perpetual contracts.
   * @param symbol Futures pair, e.g. "BTCUSDT".
   */
  async getFuturesTicker(symbol: string): Promise<TickerData> {
    const res = await fetch(`${this.futuresBaseUrl}/fapi/v1/ticker/24hr?symbol=${symbol.toUpperCase()}`);
    if (!res.ok) throw new Error(`Futures Ticker request failed (${res.status}): ${res.statusText}`);
    const data: any = await res.json();
    return {
      symbol: data.symbol,
      price: data.lastPrice,
      priceChangePercent: data.priceChangePercent,
      highPrice: data.highPrice,
      lowPrice: data.lowPrice,
      volume: data.volume,
    };
  }

  /**
   * Fetches funding rate and mark price for COIN-M Perpetual contracts.
   * @param symbol COIN-M pair, e.g. "BTCUSD_PERP".
   */
  async getCoinFuturesFundingRate(symbol: string): Promise<any> {
    const res = await fetch(`${this.coinFuturesBaseUrl}/dapi/v1/premiumIndex?symbol=${symbol.toUpperCase()}`);
    if (!res.ok) throw new Error(`COIN-M Funding request failed (${res.status}): ${res.statusText}`);
    const data: any = await res.json();
    const item = Array.isArray(data) ? data[0] : data;
    return {
      symbol: item?.symbol ?? symbol,
      markPrice: item?.markPrice ?? "0",
      lastFundingRate: item?.lastFundingRate ? (Number(item.lastFundingRate) * 100).toFixed(4) + "%" : "N/A",
    };
  }

  // ── Account & Execution (100% Live Production Mode) ─────────────────────────

  /**
   * Queries account balance information across Master and Sub-Accounts.
   * Returns live wallet balances (Spot, Simple Earn, Futures, and Agentic Sub-Accounts).
   */
  async getAccountBalances(): Promise<any> {
    if (!this.hasKeys()) {
      return {
        status: "AUTHENTICATION_REQUIRED",
        message:
          "Live Binance API credentials (BINANCE_SUB_ACCOUNT_API_KEY and BINANCE_SUB_ACCOUNT_API_SECRET) are required in .env to inspect private account balances. Public market data and technical indicators remain fully active.",
      };
    }

    const result: any = {
      mode: "LIVE_BINANCE_AUTHENTICATED",
      environment: "Isolated Sub-Account / Dedicated API Environment",
      timestamp: new Date().toISOString(),
      spotBalances: [],
      futuresBalances: [],
      masterSpotBalances: [],
      masterFuturesBalances: [],
      subAccounts: [],
    };

    // 1. Master Spot & Simple Earn Balances
    try {
      const timestamp = Date.now();
      const query = `timestamp=${timestamp}`;
      const signature = this.sign(query);
      const res = await fetch(`${this.spotBaseUrl}/api/v3/account?${query}&signature=${signature}`, {
        headers: { "X-MBX-APIKEY": this.apiKey },
      });

      if (res.ok) {
        const data: any = await res.json();
        result.uid = data.uid;
        result.accountType = data.accountType;
        result.canTrade = data.canTrade;
        result.canWithdraw = data.canWithdraw;
        result.masterSpotBalances = (data.balances || [])
          .filter((b: any) => Number(b.free) > 0 || Number(b.locked) > 0)
          .map((b: any) => {
            const isEarn = b.asset.startsWith("LD") && b.asset.length > 2;
            const realAsset = isEarn ? b.asset.slice(2) : b.asset;
            return {
              asset: realAsset,
              rawSymbol: b.asset,
              free: b.free,
              locked: b.locked,
              category: isEarn ? "Simple Earn (Flexible Savings)" : "Spot Available",
            };
          });
      }
    } catch (err: any) {
      console.warn("Notice: Spot balance fetch skipped:", err.message);
    }

    // 2. Master USDS-M Futures Balances
    try {
      const timestamp = Date.now();
      const query = `timestamp=${timestamp}`;
      const signature = this.sign(query);
      const res = await fetch(`${this.futuresBaseUrl}/fapi/v2/balance?${query}&signature=${signature}`, {
        headers: { "X-MBX-APIKEY": this.apiKey },
      });

      if (res.ok) {
        const data: any = await res.json();
        if (Array.isArray(data)) {
          result.masterFuturesBalances = data
            .filter((b: any) => Number(b.balance) > 0)
            .map((b: any) => ({
              asset: b.asset,
              walletBalance: b.balance,
              availableBalance: b.availableBalance,
            }));
        }
      }
    } catch (err: any) {
      // Non-blocking if futures account is not activated
    }

    // 3. Sub-Accounts & Agentic Sub-Account Inspection
    try {
      const timestamp = Date.now();
      const query = `timestamp=${timestamp}`;
      const signature = this.sign(query);
      const res = await fetch(`${this.spotBaseUrl}/sapi/v1/sub-account/list?${query}&signature=${signature}`, {
        headers: { "X-MBX-APIKEY": this.apiKey },
      });

      if (res.ok) {
        const data: any = await res.json();
        if (data.subAccounts && Array.isArray(data.subAccounts)) {
          for (const sub of data.subAccounts) {
            let subAssets: any[] = [];
            try {
              const qSub = `email=${encodeURIComponent(sub.email)}&timestamp=${Date.now()}`;
              const sigSub = this.sign(qSub);
              const rSub = await fetch(`${this.spotBaseUrl}/sapi/v3/sub-account/assets?${qSub}&signature=${sigSub}`, {
                headers: { "X-MBX-APIKEY": this.apiKey },
              });
              if (rSub.ok) {
                const dSub: any = await rSub.json();
                subAssets = (dSub.balances || []).filter(
                  (a: any) => Number(a.free) > 0 || Number(a.locked) > 0
                );
              }
            } catch {
              // Graceful if assets endpoint is restricted
            }

            result.subAccounts.push({
              email: sub.email,
              subUserId: sub.subUserId,
              isAgenticSubAccount: sub.email.toLowerCase().includes("agentic"),
              remark: sub.remark || "Agentic Autonomous Account",
              balances: subAssets,
            });
          }
        }
      }
    } catch (err: any) {
      // Non-blocking if sub-account permissions are not granted on this key
    }

    result.spotBalances = result.masterSpotBalances;
    result.futuresBalances = result.masterFuturesBalances;

    if (result.subAccounts.length > 0) {
      result.environment = "Master Account (With Sub-Accounts)";
    }

    return result;
  }

  /**
   * Executes a live signed trade order on Binance Spot or Futures.
   */
  async executeOrder(params: {
    product: "SPOT" | "USDS-M FUTURES" | "COIN-M FUTURES";
    symbol: string;
    side: "BUY" | "SELL";
    orderType: "MARKET" | "LIMIT";
    quantity: number;
    notionalUsd?: number;
    price?: number;
  }): Promise<any> {
    if (!this.hasKeys()) {
      return {
        status: "AUTHENTICATION_REQUIRED",
        message:
          "Live Binance API credentials (BINANCE_SUB_ACCOUNT_API_KEY and BINANCE_SUB_ACCOUNT_API_SECRET) are required in .env to execute live orders on Binance. Public market data and technical indicators remain fully active.",
      };
    }

    const isFutures = params.product === "USDS-M FUTURES";
    const baseUrl = isFutures ? this.futuresBaseUrl : this.spotBaseUrl;
    const endpoint = isFutures ? "/fapi/v1/order" : "/api/v3/order";
    const timestamp = Date.now();

    let query = `symbol=${params.symbol.toUpperCase()}&side=${params.side}&type=${params.orderType}`;

    // On Binance Spot MARKET BUY: use quoteOrderQty if user specified notional USD amount to spend exact requested capital
    if (!isFutures && params.orderType === "MARKET" && params.side === "BUY" && params.notionalUsd && params.notionalUsd > 0) {
      query += `&quoteOrderQty=${params.notionalUsd}`;
    } else {
      // Dynamically query symbol stepSize filter from Binance exchangeInfo to ensure valid LOT_SIZE
      const stepSize = await this.getStepSize(params.symbol);
      const formattedQty = this.formatQuantity(params.quantity, stepSize);
      query += `&quantity=${formattedQty}`;
    }

    if (params.orderType === "LIMIT" && params.price) {
      query += `&price=${params.price}&timeInForce=GTC`;
    }

    query += `&timestamp=${timestamp}`;
    const signature = this.sign(query);

    const res = await fetch(`${baseUrl}${endpoint}?${query}&signature=${signature}`, {
      method: "POST",
      headers: { "X-MBX-APIKEY": this.apiKey },
    });

    if (!res.ok) {
      const err = await res.text();
      // If Spot sell order failed due to NOTIONAL filter (< 5 USDT), automatically execute via Binance Convert
      if (err.includes("NOTIONAL") && !isFutures && params.side === "SELL") {
        const fromAsset = params.symbol.replace(/USDT$/i, "").toUpperCase();
        const toAsset = "USDT";
        return await this.convertTokens(fromAsset, toAsset, params.quantity);
      }
      throw new Error(`Binance Order submission failed: ${err}`);
    }

    const data: any = await res.json();
    return {
      mode: "LIVE_BINANCE_AUTHENTICATED",
      status: data.status,
      orderId: data.orderId,
      symbol: data.symbol,
      executedQty: data.executedQty,
      cummulativeQuoteQty: data.cummulativeQuoteQty,
      fills: data.fills,
    };
  }

  /**
   * Instantly converts tokens via Binance Convert with zero fees and no 5 USDT minimum notional filter.
   */
  async convertTokens(fromAsset: string, toAsset: string, amount: number): Promise<any> {
    if (!this.hasKeys()) {
      throw new Error("Binance API credentials required for conversion.");
    }

    const ts1 = Date.now();
    const q1 = `fromAsset=${fromAsset.toUpperCase()}&toAsset=${toAsset.toUpperCase()}&fromAmount=${amount}&timestamp=${ts1}`;
    const sig1 = this.sign(q1);

    const r1 = await fetch(`${this.spotBaseUrl}/sapi/v1/convert/getQuote`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": this.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `${q1}&signature=${sig1}`,
    });

    if (!r1.ok) {
      const err = await r1.text();
      throw new Error(`Binance Convert quote failed: ${err}`);
    }

    const quoteData: any = await r1.json();
    const quoteId = quoteData.quoteId;

    const ts2 = Date.now();
    const q2 = `quoteId=${quoteId}&timestamp=${ts2}`;
    const sig2 = this.sign(q2);

    const r2 = await fetch(`${this.spotBaseUrl}/sapi/v1/convert/acceptQuote`, {
      method: "POST",
      headers: {
        "X-MBX-APIKEY": this.apiKey,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: `${q2}&signature=${sig2}`,
    });

    if (!r2.ok) {
      const err = await r2.text();
      throw new Error(`Binance Convert accept failed: ${err}`);
    }

    const acceptData: any = await r2.json();
    return {
      mode: "LIVE_BINANCE_AUTHENTICATED",
      status: "FILLED (BINANCE CONVERT)",
      orderId: acceptData.orderId || quoteId,
      symbol: `${fromAsset.toUpperCase()}${toAsset.toUpperCase()}`,
      executedQty: quoteData.fromAmount,
      cummulativeQuoteQty: quoteData.toAmount,
      ratio: quoteData.ratio,
      type: "CONVERT_ZERO_FEE",
    };
  }

  /**
   * Redeems yield-bearing assets from Simple Earn (Flexible Savings) to Spot Wallet.
   */
  async redeemFlexibleEarn(asset: string, amount: number): Promise<any> {
    if (!this.hasKeys()) {
      return {
        status: "AUTHENTICATION_REQUIRED",
        message: "Binance API keys required in .env for Simple Earn redemption.",
      };
    }

    const posQuery = `asset=${asset.toUpperCase()}&timestamp=${Date.now()}`;
    const posSig = this.sign(posQuery);
    const posRes = await fetch(
      `${this.spotBaseUrl}/sapi/v1/simple-earn/flexible/position?${posQuery}&signature=${posSig}`,
      { headers: { "X-MBX-APIKEY": this.apiKey } }
    );

    if (!posRes.ok) {
      const err = await posRes.text();
      throw new Error(`Failed to query Simple Earn position for ${asset}: ${err}`);
    }

    const posData: any = await posRes.json();
    const row = posData.rows?.find((r: any) => r.asset.toUpperCase() === asset.toUpperCase());
    if (!row || !row.productId) {
      throw new Error(`No active Simple Earn flexible position found for asset ${asset}.`);
    }

    const query = `productId=${row.productId}&amount=${amount}&type=FAST&timestamp=${Date.now()}`;
    const signature = this.sign(query);
    const res = await fetch(
      `${this.spotBaseUrl}/sapi/v1/simple-earn/flexible/redeem?${query}&signature=${signature}`,
      {
        method: "POST",
        headers: { "X-MBX-APIKEY": this.apiKey },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Simple Earn redemption failed: ${err}`);
    }

    const data: any = await res.json();
    return {
      status: "SUCCESS",
      action: "REDEEM_FLEXIBLE_EARN",
      asset: asset.toUpperCase(),
      amount,
      redeemId: data.redeemId,
      success: data.success,
    };
  }

  /**
   * Transfers assets from Master Spot Wallet to a designated Agentic Sub-Account.
   */
  async transferToSubAccount(asset: string, amount: number, subAccountEmail?: string): Promise<any> {
    if (!this.hasKeys()) {
      return {
        status: "AUTHENTICATION_REQUIRED",
        message: "Binance API keys required in .env for Sub-Account transfers.",
      };
    }

    let targetEmail = subAccountEmail;
    if (!targetEmail) {
      const q = `timestamp=${Date.now()}`;
      const sig = this.sign(q);
      const res = await fetch(`${this.spotBaseUrl}/sapi/v1/sub-account/list?${q}&signature=${sig}`, {
        headers: { "X-MBX-APIKEY": this.apiKey },
      });
      if (res.ok) {
        const d: any = await res.json();
        const agentic = d.subAccounts?.find((s: any) => s.email.toLowerCase().includes("agentic"));
        if (agentic) targetEmail = agentic.email;
      }
    }

    if (!targetEmail) {
      throw new Error("No Agentic sub-account found to transfer funds to.");
    }

    const query = `toEmail=${encodeURIComponent(
      targetEmail
    )}&fromAccountType=SPOT&toAccountType=SPOT&asset=${asset.toUpperCase()}&amount=${amount}&timestamp=${Date.now()}`;
    const signature = this.sign(query);
    const res = await fetch(
      `${this.spotBaseUrl}/sapi/v1/sub-account/universalTransfer?${query}&signature=${signature}`,
      {
        method: "POST",
        headers: { "X-MBX-APIKEY": this.apiKey },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Sub-Account transfer failed: ${err}`);
    }

    const data: any = await res.json();
    return {
      status: "SUCCESS",
      action: "SUB_ACCOUNT_TRANSFER",
      asset: asset.toUpperCase(),
      amount,
      targetSubAccount: targetEmail,
      transferId: data.tranId,
    };
  }

  /**
   * Retrieves active open limit orders across Spot markets.
   */
  async getOpenOrders(symbol?: string): Promise<any[]> {
    if (!this.hasKeys()) return [];
    const ts = Date.now();
    let query = `timestamp=${ts}`;
    if (symbol) query = `symbol=${symbol.toUpperCase()}&${query}`;
    const sig = this.sign(query);

    const res = await fetch(`${this.spotBaseUrl}/api/v3/openOrders?${query}&signature=${sig}`, {
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    if (!res.ok) return [];
    return (await res.json()) as any[];
  }

  /**
   * Cancels an active open order on Binance.
   */
  async cancelOrder(symbol: string, orderId?: number): Promise<any> {
    if (!this.hasKeys()) throw new Error("API credentials required to cancel order");
    const ts = Date.now();
    let query = `symbol=${symbol.toUpperCase()}&timestamp=${ts}`;
    if (orderId) query += `&orderId=${orderId}`;
    const sig = this.sign(query);

    const res = await fetch(`${this.spotBaseUrl}/api/v3/order?${query}&signature=${sig}`, {
      method: "DELETE",
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Order cancellation failed: ${err}`);
    }
    return await res.json();
  }

  /**
   * Retrieves active position risk & liquidation information for USDS-M Futures.
   * If symbol is omitted, returns all positions with non-zero positionAmt.
   */
  async getFuturesPositions(symbol?: string): Promise<any[]> {
    if (!this.hasKeys()) return [];
    const ts = Date.now();
    let query = `timestamp=${ts}`;
    if (symbol) query = `symbol=${symbol.toUpperCase()}&${query}`;
    const sig = this.sign(query);

    const res = await fetch(`${this.futuresBaseUrl}/fapi/v2/positionRisk?${query}&signature=${sig}`, {
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to fetch futures positions: ${err}`);
    }
    const data = (await res.json()) as any[];
    if (!Array.isArray(data)) return [];

    if (symbol) {
      return data;
    }
    const active = data.filter((p: any) => parseFloat(p.positionAmt) !== 0);
    return active;
  }

  /**
   * Retrieves recent trade execution fills, fees, and realized transactions across Spot and USDS-M Futures.
   * If symbol is omitted, queries all recent trades across the account.
   */
  async getMyTrades(symbol?: string, limit = 10): Promise<any[]> {
    if (!this.hasKeys()) return [];
    const ts = Date.now();
    const results: any[] = [];

    if (symbol) {
      const sym = symbol.toUpperCase();
      const qSpot = `symbol=${sym}&limit=${limit}&timestamp=${ts}`;
      const sigSpot = this.sign(qSpot);

      const qFut = `symbol=${sym}&limit=${limit}&recvWindow=60000&timestamp=${ts}`;
      const sigFut = this.sign(qFut);

      const [spotRes, futRes] = await Promise.allSettled([
        fetch(`${this.spotBaseUrl}/api/v3/myTrades?${qSpot}&signature=${sigSpot}`, {
          headers: { "X-MBX-APIKEY": this.apiKey },
        }),
        fetch(`${this.futuresBaseUrl}/fapi/v1/userTrades?${qFut}&signature=${sigFut}`, {
          headers: { "X-MBX-APIKEY": this.apiKey },
        }),
      ]);

      if (spotRes.status === "fulfilled" && spotRes.value.ok) {
        const spotTrades = (await spotRes.value.json()) as any[];
        if (Array.isArray(spotTrades)) {
          for (const t of spotTrades) {
            results.push({
              market: "SPOT",
              symbol: t.symbol,
              orderId: t.orderId,
              tradeId: t.id,
              side: t.isBuyer ? "BUY" : "SELL",
              price: t.price,
              quantity: t.qty,
              notional: t.quoteQty,
              commission: t.commission,
              commissionAsset: t.commissionAsset,
              isMaker: t.isMaker,
              time: new Date(t.time).toISOString(),
            });
          }
        }
      }

      if (futRes.status === "fulfilled" && futRes.value.ok) {
        const futTrades = (await futRes.value.json()) as any[];
        if (Array.isArray(futTrades)) {
          for (const t of futTrades) {
            results.push({
              market: "USDS-M FUTURES",
              symbol: t.symbol,
              orderId: t.orderId,
              tradeId: t.id,
              side: t.side,
              price: t.price,
              quantity: t.qty,
              notional: t.quoteQty,
              realizedPnl: t.realizedPnl,
              commission: t.commission,
              commissionAsset: t.commissionAsset,
              isMaker: t.maker,
              time: new Date(t.time).toISOString(),
            });
          }
        }
      }
    } else {
      // Query all recent futures trades across all pairs
      try {
        const qFut = `limit=${limit}&recvWindow=60000&timestamp=${ts}`;
        const sigFut = this.sign(qFut);
        const futRes = await fetch(`${this.futuresBaseUrl}/fapi/v1/userTrades?${qFut}&signature=${sigFut}`, {
          headers: { "X-MBX-APIKEY": this.apiKey },
        });
        if (futRes.ok) {
          const futTrades = (await futRes.json()) as any[];
          if (Array.isArray(futTrades)) {
            for (const t of futTrades) {
              results.push({
                market: "USDS-M FUTURES",
                symbol: t.symbol,
                orderId: t.orderId,
                tradeId: t.id,
                side: t.side,
                price: t.price,
                quantity: t.qty,
                notional: t.quoteQty,
                realizedPnl: t.realizedPnl,
                commission: t.commission,
                commissionAsset: t.commissionAsset,
                isMaker: t.maker,
                time: new Date(t.time).toISOString(),
              });
            }
          }
        }
      } catch {}

      // Query known traded Spot pairs
      for (const sp of ["BNBUSDT", "SOLUSDT", "ETHUSDT", "BTCUSDT"]) {
        try {
          const qSpot = `symbol=${sp}&limit=5&timestamp=${Date.now()}`;
          const sigSpot = this.sign(qSpot);
          const sRes = await fetch(`${this.spotBaseUrl}/api/v3/myTrades?${qSpot}&signature=${sigSpot}`, {
            headers: { "X-MBX-APIKEY": this.apiKey },
          });
          if (sRes.ok) {
            const st = (await sRes.json()) as any[];
            if (Array.isArray(st)) {
              for (const t of st) {
                results.push({
                  market: "SPOT",
                  symbol: t.symbol,
                  orderId: t.orderId,
                  tradeId: t.id,
                  side: t.isBuyer ? "BUY" : "SELL",
                  price: t.price,
                  quantity: t.qty,
                  notional: t.quoteQty,
                  commission: t.commission,
                  commissionAsset: t.commissionAsset,
                  isMaker: t.isMaker,
                  time: new Date(t.time).toISOString(),
                });
              }
            }
          }
        } catch {}
      }
    }

    // Sort newest first
    results.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
    return results.slice(0, limit);
  }

  /**
   * Configures matching-engine initial leverage for a USDS-M perpetual contract (1x-5x).
   */
  async setFuturesLeverage(symbol: string, leverage: number): Promise<any> {
    if (!this.hasKeys()) throw new Error("API credentials required to set leverage");
    const roundedLeverage = Math.max(1, Math.min(5, Math.floor(leverage)));
    const ts = Date.now();
    const query = `symbol=${symbol.toUpperCase()}&leverage=${roundedLeverage}&timestamp=${ts}`;
    const sig = this.sign(query);

    const res = await fetch(`${this.futuresBaseUrl}/fapi/v1/leverage?${query}&signature=${sig}`, {
      method: "POST",
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to set leverage on Binance: ${err}`);
    }
    return await res.json();
  }

  /**
   * Generates a comprehensive token AI intelligence dossier combining Binance market metrics,
   * 24h stats, order book depth liquidity, and technical indicators.
   */
  async getTokenAiReport(token: string): Promise<any> {
    const asset = token.toUpperCase().replace(/USDT$/, "");
    const symbol = `${asset}USDT`;

    const [tickerRes, depthRes, klinesRes] = await Promise.allSettled([
      this.getSpotTicker(symbol),
      this.getSpotOrderBook(symbol, 10),
      this.getKlines(symbol, "1h", 30),
    ]);

    const ticker = tickerRes.status === "fulfilled" ? tickerRes.value : null;
    const depth = depthRes.status === "fulfilled" ? depthRes.value : null;
    const klines = klinesRes.status === "fulfilled" ? klinesRes.value : [];

    let technicals: any = null;
    if (klines.length >= 14) {
      const closePrices = klines.map((k: any) => parseFloat(k.close));
      const rsi = TechnicalAnalysis.calculateRSI(closePrices, 14);
      const sma7 = TechnicalAnalysis.calculateSMA(closePrices, 7);
      const sma25 = TechnicalAnalysis.calculateSMA(closePrices, 25);

      technicals = {
        timeframe: "1h",
        rsi14: rsi,
        rsiCondition: rsi > 70 ? "OVERBOUGHT" : rsi < 30 ? "OVERSOLD" : "NEUTRAL",
        trend: sma7 > sma25 ? "BULLISH_CROSS (SMA7 > SMA25)" : "BEARISH_CROSS (SMA7 < SMA25)",
        sma7,
        sma25,
      };
    }

    let liquidityProfile: any = null;
    if (depth && depth.bids && depth.asks) {
      const bidVol = depth.bids.reduce((sum: number, b: any) => sum + parseFloat(b[1]), 0);
      const askVol = depth.asks.reduce((sum: number, a: any) => sum + parseFloat(a[1]), 0);
      const totalVol = bidVol + askVol;
      const bidRatio = totalVol > 0 ? (bidVol / totalVol) * 100 : 50;
      liquidityProfile = {
        top10BidVolume: parseFloat(bidVol.toFixed(4)),
        top10AskVolume: parseFloat(askVol.toFixed(4)),
        bidPressurePct: `${bidRatio.toFixed(1)}%`,
        orderBookBias: bidRatio > 55 ? "BUY_DOMINANT" : bidRatio < 45 ? "SELL_DOMINANT" : "BALANCED",
      };
    }

    return {
      token: asset,
      tradingPair: symbol,
      timestamp: new Date().toISOString(),
      marketSnapshot: ticker ? {
        price: ticker.price,
        priceChange24h: `${ticker.priceChangePercent}%`,
        high24h: ticker.highPrice,
        low24h: ticker.lowPrice,
        volume24hUsd: ticker.volume,
      } : "Not available",
      liquidityProfile,
      technicals,
      aiAnalysis: {
        momentumSentiment: technicals ? (technicals.trend.includes("BULLISH") ? "BULLISH" : "BEARISH") : "NEUTRAL",
        riskAssessment: technicals && technicals.rsiCondition === "OVERSOLD"
          ? "RSI oversold. Potential mean-reversion bounce opportunity."
          : technicals && technicals.rsiCondition === "OVERBOUGHT"
          ? "RSI overbought. Elevated risk of near-term pullback."
          : "Momentum indicators in healthy equilibrium range.",
      },
    };
  }
}

