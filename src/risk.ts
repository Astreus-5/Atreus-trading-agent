/**
 * Configuration parameters for the pre-trade RiskGuard engine.
 */
export interface RiskConfig {
  /** Maximum percentage of total account equity per single position (e.g. 5 = 5%). */
  maxPositionPct: number;
  /** Maximum allowed leverage multiplier for derivative positions (e.g. 5 = 5×). */
  maxLeverage: number;
  /** Minimum required stop-loss distance percentage (e.g. 2 = 2%). */
  stopLossPct: number;
  /** Maximum allowable daily drawdown percentage before circuit breaker halts trading. */
  dailyLossLimitPct: number;
  /** Minimum allowable order value in USD enforced by Binance (default: 5 USD). */
  minNotionalUsd: number;
}

/**
 * Parameters formulating a proposed trade.
 */
export interface TradeProposal {
  symbol: string;
  side: "BUY" | "SELL";
  product: "SPOT" | "USDS-M FUTURES" | "COIN-M FUTURES";
  orderType: "MARKET" | "LIMIT";
  quantity: number;
  notionalUsd: number;
  availableMargin?: number;
  marginUsd?: number;
  leverage?: number;
  price?: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
}

/**
 * Parameters for sizing a trade position.
 */
export interface PositionSizingInput {
  availableMargin: number;
  marginToUse?: number;
  notionalTargetUsd?: number;
  leverage?: number;
  entryPrice: number;
  isFutures?: boolean;
  maxPositionPct?: number;
}

/**
 * Calculated breakdown of margin, leverage, notional position, and asset quantity.
 */
export interface PositionSizingResult {
  availableMargin: number;
  allocatedMargin: number;
  leverage: number;
  notionalUsd: number;
  quantity: number;
  entryPrice: number;
}

/**
 * Calculates position sizing distinguishing available margin, allocated margin, leverage, notional value, and quantity.
 */
export function calculatePosition(params: PositionSizingInput): PositionSizingResult {
  const leverage = Math.max(1, params.leverage ?? 1);
  const availableMargin = Math.max(0, params.availableMargin);

  let allocatedMargin: number;

  if (params.marginToUse !== undefined && params.marginToUse > 0) {
    allocatedMargin = Math.min(params.marginToUse, availableMargin);
  } else if (params.notionalTargetUsd !== undefined && params.notionalTargetUsd > 0) {
    allocatedMargin = Math.min(params.notionalTargetUsd / leverage, availableMargin);
  } else if (params.maxPositionPct !== undefined && params.maxPositionPct > 0) {
    allocatedMargin = (availableMargin * params.maxPositionPct) / 100;
  } else {
    allocatedMargin = availableMargin;
  }

  const notionalUsd = Number((allocatedMargin * leverage).toFixed(4));
  const quantity = params.entryPrice > 0 ? Number((notionalUsd / params.entryPrice).toFixed(8)) : 0;

  return {
    availableMargin,
    allocatedMargin: Number(allocatedMargin.toFixed(4)),
    leverage,
    notionalUsd,
    quantity,
    entryPrice: params.entryPrice,
  };
}

/**
 * Target price levels for risk management and profit taking.
 */
export interface ExitTargets {
  stopLossPrice: number;
  takeProfitPrice: number;
  stopLossPct: number;
  takeProfitPct: number;
}

/**
 * Calculates stop-loss and take-profit prices strictly based on the actual entry price and order side.
 */
export function calculateExitTargets(
  entryPrice: number,
  side: "BUY" | "SELL" = "BUY",
  stopLossPct = 2,
  takeProfitPct = 4
): ExitTargets {
  if (entryPrice <= 0) {
    return { stopLossPrice: 0, takeProfitPrice: 0, stopLossPct, takeProfitPct };
  }

  if (side === "BUY") {
    const stopLossPrice = Number((entryPrice * (1 - stopLossPct / 100)).toFixed(2));
    const takeProfitPrice = Number((entryPrice * (1 + takeProfitPct / 100)).toFixed(2));
    return { stopLossPrice, takeProfitPrice, stopLossPct, takeProfitPct };
  } else {
    const stopLossPrice = Number((entryPrice * (1 + stopLossPct / 100)).toFixed(2));
    const takeProfitPrice = Number((entryPrice * (1 - takeProfitPct / 100)).toFixed(2));
    return { stopLossPrice, takeProfitPrice, stopLossPct, takeProfitPct };
  }
}

/**
 * Result of the pre-trade risk evaluation.
 */
export interface RiskValidationResult {
  passed: boolean;
  violations: string[];
}

/**
 * RiskGuard Engine: Enforces institutional risk management rules and capital preservation invariants.
 */
export class RiskGuard {
  private readonly config: RiskConfig;
  private dailyPnl = 0;
  private startingBalance: number | null = null;

  constructor(config?: Partial<RiskConfig>) {
    this.config = {
      maxPositionPct: Number(process.env.MAX_POSITION_PCT ?? 5),
      maxLeverage: Number(process.env.MAX_LEVERAGE ?? 5),
      stopLossPct: Number(process.env.STOP_LOSS_PCT ?? 2),
      dailyLossLimitPct: Number(process.env.DAILY_LOSS_LIMIT_PCT ?? 10),
      minNotionalUsd: Number(process.env.MIN_NOTIONAL_USD ?? 5),
      ...config,
    };
  }

  public getConfig(): RiskConfig {
    return { ...this.config };
  }

  public setStartingBalance(balance: number): void {
    this.startingBalance = balance;
  }

  public recordPnl(pnl: number): void {
    this.dailyPnl += pnl;
  }

  /**
   * Evaluates a trade proposal against position size, leverage bounds, stop-loss requirements, and daily loss limits.
   * @param proposal Trade parameters to validate.
   * @param currentBalance Available account balance.
   */
  public validate(proposal: TradeProposal, currentBalance: number): RiskValidationResult {
    const violations: string[] = [];

    if (currentBalance <= 0) {
      violations.push("❌ Sub-account balance is zero or negative.");
      return { passed: false, violations };
    }

    if (!proposal.notionalUsd || proposal.notionalUsd <= 0) {
      violations.push("❌ Invalid notional USD value.");
    }

    if (!proposal.quantity || proposal.quantity <= 0) {
      violations.push("❌ Invalid asset quantity.");
    }

    const isFutures = proposal.product !== "SPOT";
    const leverage = isFutures ? (proposal.leverage ?? 1) : 1;
    const allocatedMargin = proposal.marginUsd ?? (isFutures && leverage > 1 ? proposal.notionalUsd / leverage : proposal.notionalUsd);

    // 0. Margin Balance Invariant: Allocated margin cannot exceed available balance
    if (allocatedMargin > currentBalance) {
      violations.push(
        `❌ Allocated margin $${allocatedMargin.toFixed(2)} exceeds available balance of $${currentBalance.toFixed(2)} USDT.`
      );
    }

    // 1. Binance Minimum Order Size Check (5 USDT minimum to open positions)
    if (proposal.side === "BUY" && proposal.notionalUsd < this.config.minNotionalUsd) {
      violations.push(
        `❌ Binance enforces a minimum trade value of $${this.config.minNotionalUsd.toFixed(2)} USDT for opening positions. Please increase your order amount or top up your account balance.`
      );
    }

    // 2. Check Position Size limit
    const standardMaxNotional = (currentBalance * this.config.maxPositionPct) / 100;
    // For small accounts where balance * maxPositionPct < minNotional, allow up to minNotional if within balance
    const maxAllowedNotional = Math.max(
      standardMaxNotional,
      currentBalance <= this.config.minNotionalUsd * 2 ? this.config.minNotionalUsd * leverage : standardMaxNotional
    );

    if (proposal.notionalUsd > maxAllowedNotional) {
      violations.push(
        `❌ Position size $${proposal.notionalUsd.toFixed(2)} exceeds allowed limit of $${standardMaxNotional.toFixed(2)} (${this.config.maxPositionPct}% of $${currentBalance.toFixed(2)} balance).`
      );
    }

    // 3. Check Leverage & Mandatory Stop-Loss for Futures
    if (isFutures) {
      if (leverage > this.config.maxLeverage) {
        violations.push(
          `❌ Leverage ${leverage}× exceeds maximum allowed leverage of ${this.config.maxLeverage}×.`
        );
      }
      if (leverage < 1) {
        violations.push("❌ Leverage must be at least 1×.");
      }

      // Mandatory stop-loss validation on leveraged positions (opening orders only)
      if (proposal.side === "BUY") {
        if (!proposal.stopLossPrice || proposal.stopLossPrice <= 0) {
          violations.push("❌ Leveraged futures opening positions strictly require a valid stop-loss price.");
        } else if (proposal.price && proposal.price > 0) {
          const slPct = Math.abs((proposal.price - proposal.stopLossPrice) / proposal.price) * 100;
          if (slPct < this.config.stopLossPct) {
            violations.push(
              `❌ Stop-loss distance (${slPct.toFixed(2)}%) is tighter than the required minimum threshold of ${this.config.stopLossPct}%.`
            );
          }
        }
      }
    }

    // 4. Check Daily Loss Limit
    if (this.startingBalance && this.startingBalance > 0) {
      const maxDailyLoss = (this.startingBalance * this.config.dailyLossLimitPct) / 100;
      if (this.dailyPnl < -maxDailyLoss) {
        violations.push(
          `❌ Daily loss threshold reached: current loss -$${Math.abs(this.dailyPnl).toFixed(2)} exceeds $${maxDailyLoss.toFixed(2)} limit (${this.config.dailyLossLimitPct}%).`
        );
      }
    }

    return {
      passed: violations.length === 0,
      violations,
    };
  }
}
