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
  leverage?: number;
  price?: number;
  stopLossPrice?: number;
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

    // 1. Check Position Size
    const maxAllowedNotional = (currentBalance * this.config.maxPositionPct) / 100;
    if (proposal.notionalUsd > maxAllowedNotional) {
      violations.push(
        `❌ Position size $${proposal.notionalUsd.toFixed(2)} exceeds allowed limit of $${maxAllowedNotional.toFixed(2)} (${this.config.maxPositionPct}% of $${currentBalance.toFixed(2)} balance).`
      );
    }

    // 2. Check Leverage & Mandatory Stop-Loss for Futures
    const leverage = proposal.leverage ?? 1;
    if (proposal.product !== "SPOT") {
      if (leverage > this.config.maxLeverage) {
        violations.push(
          `❌ Leverage ${leverage}× exceeds maximum allowed leverage of ${this.config.maxLeverage}×.`
        );
      }
      if (leverage < 1) {
        violations.push("❌ Leverage must be at least 1×.");
      }

      // Mandatory stop-loss validation on leveraged positions
      if (!proposal.stopLossPrice || proposal.stopLossPrice <= 0) {
        violations.push("❌ Leveraged futures positions strictly require a valid stop-loss price.");
      } else if (proposal.price && proposal.price > 0) {
        const slPct = Math.abs((proposal.price - proposal.stopLossPrice) / proposal.price) * 100;
        if (slPct < this.config.stopLossPct) {
          violations.push(
            `❌ Stop-loss distance (${slPct.toFixed(2)}%) is tighter than the required minimum threshold of ${this.config.stopLossPct}%.`
          );
        }
      }
    }

    // 3. Check Daily Loss Limit
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
