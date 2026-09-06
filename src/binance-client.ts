import crypto from "node:crypto";
import chalk from "chalk";
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
  private _apiKey?: string;
  private _apiSecret?: string;
  private readonly spotBaseUrl = "https://api.binance.com";
  private readonly futuresBaseUrl = "https://fapi.binance.com";
  private readonly coinFuturesBaseUrl = "https://dapi.binance.com";

  /**
   * Initializes the Binance Client.
   * Dynamically retrieves the latest credentials from process.env if not explicitly passed.
   */
  constructor(apiKey?: string, apiSecret?: string) {
    this._apiKey = apiKey?.trim();
    this._apiSecret = apiSecret?.trim();
  }

  public get apiKey(): string {
    return (this._apiKey || process.env.BINANCE_SUB_ACCOUNT_API_KEY || "").trim();
  }

  public get apiSecret(): string {
    return (this._apiSecret || process.env.BINANCE_SUB_ACCOUNT_API_SECRET || "").trim();
  }

  /**
   * Checks whether valid API credentials have been configured.
   */
  public hasKeys(): boolean {
    return Boolean(this.apiKey && this.apiSecret);
  }

  private lotFilterCache = new Map<string, { stepSize: number; minQty: number; minNotional: number }>();

  /**
   * Dynamically retrieves exchange LOT_SIZE and MIN_NOTIONAL filters for Spot or Futures pairs.
   */
  public async getLotFilter(symbol: string, isFutures = false): Promise<{ stepSize: number; minQty: number; minNotional: number }> {
    const sym = symbol.toUpperCase();
    const cacheKey = `${isFutures ? "FUT_" : "SPOT_"}${sym}`;
    if (this.lotFilterCache.has(cacheKey)) return this.lotFilterCache.get(cacheKey)!;

    try {
      const url = isFutures
        ? `${this.futuresBaseUrl}/fapi/v1/exchangeInfo`
        : `${this.spotBaseUrl}/api/v3/exchangeInfo?symbol=${sym}`;
      const res = await fetch(url);
      if (res.ok) {
        const data: any = await res.json();
        const s = isFutures ? data.symbols?.find((x: any) => x.symbol === sym) : data.symbols?.[0];
        if (s) {
          const lotFilter = s.filters?.find((f: any) => f.filterType === "LOT_SIZE" || f.filterType === "MARKET_LOT_SIZE");
          const notionalFilter = s.filters?.find((f: any) => f.filterType === "MIN_NOTIONAL" || f.filterType === "NOTIONAL");
          const stepSize = lotFilter?.stepSize ? parseFloat(lotFilter.stepSize) : (isFutures ? 0.001 : 0.00001);
          const minQty = lotFilter?.minQty ? parseFloat(lotFilter.minQty) : stepSize;
          const minNotional = notionalFilter?.notional ? parseFloat(notionalFilter.notional) : (notionalFilter?.minNotional ? parseFloat(notionalFilter.minNotional) : 5);
          const result = { stepSize, minQty, minNotional };
          this.lotFilterCache.set(cacheKey, result);
          return result;
        }
      }
    } catch {}
    return { stepSize: isFutures ? 0.001 : 0.00001, minQty: isFutures ? 0.001 : 0.00001, minNotional: 5 };
  }

  /**
   * Dynamically retrieves the exchange LOT_SIZE stepSize filter for any trading pair from Binance.
   */
  public async getStepSize(symbol: string, isFutures = false): Promise<number> {
    const filter = await this.getLotFilter(symbol, isFutures);
    return filter.stepSize;
  }

  /**
   * Formats any requested token quantity down to the exchange's required stepSize precision.
   */
  public formatQuantity(qty: number, stepSize: number): number {
    const precision = Math.max(0, Math.round(-Math.log10(stepSize)));
    const factor = Math.pow(10, precision);
    return Math.floor(qty * factor) / factor;
  }

  private spotTimeOffset = 0;
  private futuresTimeOffset = 0;
  private timeSynced = false;

  /**
   * Synchronizes local clock with Binance atomic server time for both Spot and Futures.
   */
  public async syncServerTime(): Promise<number> {
    try {
      const [spotRes, futRes] = await Promise.allSettled([
        fetch(`${this.spotBaseUrl}/api/v3/time`),
        fetch(`${this.futuresBaseUrl}/fapi/v1/time`),
      ]);
      if (spotRes.status === "fulfilled" && spotRes.value.ok) {
        const d: any = await spotRes.value.json();
        if (d?.serverTime) this.spotTimeOffset = Number(d.serverTime) - Date.now();
      }
      if (futRes.status === "fulfilled" && futRes.value.ok) {
        const d: any = await futRes.value.json();
        if (d?.serverTime) this.futuresTimeOffset = Number(d.serverTime) - Date.now();
      }
      this.timeSynced = true;
      return this.spotTimeOffset;
    } catch {}
    return 0;
  }

  /**
   * Returns exchange-synchronized timestamp for Spot or Futures matching engine.
   */
  public async getSyncTimestamp(isFutures = false): Promise<number> {
    if (!this.timeSynced) {
      await this.syncServerTime();
    }
    const offset = isFutures ? this.futuresTimeOffset : this.spotTimeOffset;
    return Date.now() + offset;
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
      const timestamp = await this.getSyncTimestamp();
      const query = `recvWindow=60000&timestamp=${timestamp}`;
      const signature = this.sign(query);
      const res = await fetch(`${this.spotBaseUrl}/api/v3/account?${query}&signature=${signature}`, {
        headers: { "X-MBX-APIKEY": this.apiKey },
      });

      if (res.ok) {
        const data: any = await res.json();
        result.uid = data.uid;
        result.accountType = data.accountType;
        result.canTrade = data.canTrade;

        // Query actual API Key permissions directly from Binance
        try {
          const apiTimestamp = await this.getSyncTimestamp();
          const apiQuery = `recvWindow=60000&timestamp=${apiTimestamp}`;
          const apiSig = this.sign(apiQuery);
          const apiRes = await fetch(`${this.spotBaseUrl}/sapi/v1/account/apiRestrictions?${apiQuery}&signature=${apiSig}`, {
            headers: { "X-MBX-APIKEY": this.apiKey },
          });
          if (apiRes.ok) {
            const perms: any = await apiRes.json();
            result.canWithdraw = perms.enableWithdrawals ?? false;
            result.apiKeyWithdrawalsAllowed = perms.enableWithdrawals ?? false;
          } else {
            result.canWithdraw = false;
            result.apiKeyWithdrawalsAllowed = false;
          }
        } catch {
          result.canWithdraw = false;
          result.apiKeyWithdrawalsAllowed = false;
        }

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
      } else {
        const errJson: any = await res.json().catch(() => ({}));
        if (res.status === 401 || errJson?.code === -2015) {
          result.status = "AUTHENTICATION_FAILED";
          result.authError = errJson?.msg || "Invalid API-key, IP, or permissions for action.";
          result.errorCode = errJson?.code || -2015;
        }
      }
    } catch (err: any) {
      console.warn("Notice: Spot balance fetch skipped:", err.message);
    }

    // 2. Master USDS-M Futures Balances
    try {
      const timestamp = await this.getSyncTimestamp();
      const query = `recvWindow=60000&timestamp=${timestamp}`;
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

    if (result.authError) {
      result.error = `Binance Authentication / Permission Error (${result.errorCode}): ${result.authError}`;
      result.help = `Your Binance API key was rejected by Binance. Common causes:
1) IP Restriction: In your Binance API Key settings, either add your current public IP (shown in the error message above) to your trusted IP list or set IP access to 'Unrestricted'.
2) API Key Expired or Revoked: Check Binance API Management or create a fresh API key and update .env.
3) Permissions: Ensure 'Enable Reading' and trading permissions are enabled on this API key.`;
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
    const timestamp = await this.getSyncTimestamp();

    let query = `symbol=${params.symbol.toUpperCase()}&side=${params.side}&type=${params.orderType}`;

    // On Binance Spot MARKET BUY: use quoteOrderQty if user specified notional USD amount to spend exact requested capital
    if (!isFutures && params.orderType === "MARKET" && params.side === "BUY" && params.notionalUsd && params.notionalUsd > 0) {
      query += `&quoteOrderQty=${params.notionalUsd}`;
    } else {
      // Dynamically query symbol LOT_SIZE & MIN_NOTIONAL filters from Binance exchangeInfo
      const lotInfo = await this.getLotFilter(params.symbol, isFutures);
      const formattedQty = this.formatQuantity(params.quantity, lotInfo.stepSize);

      if (formattedQty < lotInfo.minQty) {
        if (isFutures) {
          throw new Error(
            `Binance ${params.symbol} Futures enforces a minimum order size of ${lotInfo.minQty} (${lotInfo.minNotional} USDT minimum notional). ` +
            `Your requested order of ${params.quantity} (~$${params.notionalUsd ?? 0}) rounds to ${formattedQty}, which is below the contract limit. ` +
            `For small balances ($5–$20), please trade micro-contract pairs like SOLUSDT, XRPUSDT, or DOGEUSDT which support $5 micro-orders.`
          );
        } else {
          throw new Error(
            `Order quantity ${params.quantity} for ${params.symbol} is below Binance minimum lot size of ${lotInfo.minQty}.`
          );
        }
      }

      query += `&quantity=${formattedQty}`;
    }

    if (params.orderType === "LIMIT" && params.price) {
      query += `&price=${params.price}&timeInForce=GTC`;
    }

    query += `&recvWindow=60000&timestamp=${timestamp}`;
    const signature = this.sign(query);

    let res = await fetch(`${baseUrl}${endpoint}?${query}&signature=${signature}`, {
      method: "POST",
      headers: { "X-MBX-APIKEY": this.apiKey },
    });

    if (!res.ok) {
      let err = await res.text();

      // If Binance returns error -1021 (Timestamp outside recvWindow), resync atomic time and auto-retry immediately!
      if (err.includes("-1021") || err.includes("recvWindow")) {
        console.log(chalk.yellow("[Binance Sync] Clock drift detected (-1021). Re-synchronizing exchange time and retrying..."));
        await this.syncServerTime();
        const retryTs = await this.getSyncTimestamp();
        const baseQuery = query.replace(/&recvWindow=\d+&timestamp=\d+/, "");
        const retryQuery = `${baseQuery}&recvWindow=60000&timestamp=${retryTs}`;
        const retrySig = this.sign(retryQuery);
        res = await fetch(`${baseUrl}${endpoint}?${retryQuery}&signature=${retrySig}`, {
          method: "POST",
          headers: { "X-MBX-APIKEY": this.apiKey },
        });
        if (!res.ok) {
          err = await res.text();
        }
      }

      if (!res.ok) {
        // If Spot sell order failed due to NOTIONAL filter (< 5 USDT), automatically execute via Binance Convert
        if (err.includes("NOTIONAL") && !isFutures && params.side === "SELL") {
          const fromAsset = params.symbol.replace(/USDT$/i, "").toUpperCase();
          const toAsset = "USDT";
          return await this.convertTokens(fromAsset, toAsset, params.quantity);
        }
        throw new Error(`Binance Order submission failed: ${err}`);
      }
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

    const ts1 = await this.getSyncTimestamp();
    const q1 = `fromAsset=${fromAsset.toUpperCase()}&toAsset=${toAsset.toUpperCase()}&fromAmount=${amount}&recvWindow=60000&timestamp=${ts1}`;
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

    const ts2 = await this.getSyncTimestamp();
    const q2 = `quoteId=${quoteId}&recvWindow=60000&timestamp=${ts2}`;
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
   * Transfers funds internally between Spot and USDS-M Futures wallets within the sub-account.
   */
  async transferWallet(asset: string, amount: number, direction: "SPOT_TO_FUTURES" | "FUTURES_TO_SPOT"): Promise<any> {
    if (!this.hasKeys()) throw new Error("API credentials required for wallet transfer");
    const ts = Date.now();
    const type = direction === "SPOT_TO_FUTURES" ? 1 : 2;
    const query = `asset=${asset.toUpperCase()}&amount=${amount}&type=${type}&recvWindow=60000&timestamp=${ts}`;
    const sig = this.sign(query);

    const res = await fetch(`${this.spotBaseUrl}/sapi/v1/futures/transfer?${query}&signature=${sig}`, {
      method: "POST",
      headers: { "X-MBX-APIKEY": this.apiKey },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Wallet transfer failed: ${err}`);
    }
    const data = (await res.json()) as any;
    return {
      status: "SUCCESS",
      action: "INTERNAL_WALLET_TRANSFER",
      asset: asset.toUpperCase(),
      amount,
      direction,
      transferId: data.tranId,
    };
  }

  /**
   * Retrieves active open limit orders across Spot markets.
   */
  async getOpenOrders(symbol?: string): Promise<any[]> {
    if (!this.hasKeys()) return [];
    const ts = await this.getSyncTimestamp();
    let query = `recvWindow=60000&timestamp=${ts}`;
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
    const ts = await this.getSyncTimestamp();
    let query = `symbol=${symbol.toUpperCase()}&recvWindow=60000&timestamp=${ts}`;
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
    const ts = await this.getSyncTimestamp();
    let query = `recvWindow=60000&timestamp=${ts}`;
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
    const spotTs = await this.getSyncTimestamp(false);
    const futTs = await this.getSyncTimestamp(true);
    const results: any[] = [];

    if (symbol) {
      const sym = symbol.toUpperCase();
      const qSpot = `symbol=${sym}&limit=${limit}&recvWindow=60000&timestamp=${spotTs}`;
      const sigSpot = this.sign(qSpot);

      const qFut = `symbol=${sym}&limit=${limit}&recvWindow=60000&timestamp=${futTs}`;
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
      // Query recent futures trades across common pairs (Binance requires symbol parameter)
      for (const futSym of ["SOLUSDT", "BTCUSDT", "ETHUSDT", "XRPUSDT", "DOGEUSDT"]) {
        try {
          const qFut = `symbol=${futSym}&limit=${limit}&recvWindow=60000&timestamp=${futTs}`;
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
        } catch { /* non-fatal */ }
      }

      // Query known traded Spot pairs
      for (const sp of ["BNBUSDT", "SOLUSDT", "ETHUSDT", "BTCUSDT"]) {
        try {
          const qSpot = `symbol=${sp}&limit=5&recvWindow=60000&timestamp=${spotTs}`;
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
        } catch { /* non-fatal */ }
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
    const ts = await this.getSyncTimestamp();
    const query = `symbol=${symbol.toUpperCase()}&leverage=${roundedLeverage}&recvWindow=60000&timestamp=${ts}`;
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

