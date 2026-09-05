import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { RiskGuard, TradeProposal, calculatePosition, calculateExitTargets } from "../src/risk.js";

describe("RiskGuard Unit Tests", () => {
  test("allows trade within 5% position size", () => {
    const guard = new RiskGuard({ maxPositionPct: 5 });
    const proposal: TradeProposal = {
      symbol: "BTCUSDT",
      side: "BUY",
      product: "SPOT",
      orderType: "MARKET",
      quantity: 0.002,
      notionalUsd: 100,
    };
    const result = guard.validate(proposal, 3000); // 100 / 3000 = 3.33% <= 5%
    assert.equal(result.passed, true);
    assert.equal(result.violations.length, 0);
  });

  test("rejects trade exceeding 5% position size", () => {
    const guard = new RiskGuard({ maxPositionPct: 5 });
    const proposal: TradeProposal = {
      symbol: "BTCUSDT",
      side: "BUY",
      product: "SPOT",
      orderType: "MARKET",
      quantity: 0.01,
      notionalUsd: 500, // 500 / 3000 = 16.6% > 5%
    };
    const result = guard.validate(proposal, 3000);
    assert.equal(result.passed, false);
    assert.match(result.violations[0], /exceeds allowed limit/);
  });

  test("enforces maximum leverage limit and stop loss requirement", () => {
    const guard = new RiskGuard({ maxLeverage: 5, stopLossPct: 2 });
    
    // 5x with valid stop-loss is allowed
    const validProposal: TradeProposal = {
      symbol: "BTCUSDT",
      side: "BUY",
      product: "USDS-M FUTURES",
      orderType: "MARKET",
      price: 50000,
      stopLossPrice: 48500, // 3% stop loss distance
      quantity: 0.002,
      notionalUsd: 100,
      leverage: 5,
    };
    assert.equal(guard.validate(validProposal, 3000).passed, true);

    // 10x is rejected
    const invalidProposal: TradeProposal = {
      ...validProposal,
      leverage: 10,
    };
    const result = guard.validate(invalidProposal, 3000);
    assert.equal(result.passed, false);
    assert.match(result.violations[0], /exceeds maximum allowed leverage/);
  });

  test("enforces daily loss limit drawdown threshold", () => {
    const guard = new RiskGuard({ dailyLossLimitPct: 10 });
    guard.setStartingBalance(1000); // $100 max daily loss

    // Initial loss within bounds
    guard.recordPnl(-50);
    const proposal: TradeProposal = {
      symbol: "BTCUSDT",
      side: "BUY",
      product: "SPOT",
      orderType: "MARKET",
      quantity: 0.001,
      notionalUsd: 40,
    };
    assert.equal(guard.validate(proposal, 950).passed, true);

    // Additional loss triggers circuit breaker
    guard.recordPnl(-60); // Total -$110 > $100 limit
    const result = guard.validate(proposal, 890);
    assert.equal(result.passed, false);
    assert.match(result.violations[0], /Daily loss threshold reached/);
  });
});

describe("calculatePosition – leverage-aware sizing", () => {
  test("notional = allocatedMargin × leverage (2× example)", () => {
    const result = calculatePosition({
      availableMargin: 7.916,
      marginToUse: 7.916,
      leverage: 2,
      entryPrice: 80000,
    });
    assert.ok(Math.abs(result.notionalUsd - 15.832) < 0.001, "notional should be 15.832");
    assert.equal(result.leverage, 2);
    assert.equal(result.allocatedMargin, 7.916);
  });

  test("quantity = notionalUsd / entryPrice", () => {
    const result = calculatePosition({
      availableMargin: 7.916,
      marginToUse: 7.916,
      leverage: 2,
      entryPrice: 80000,
    });
    const expected = 15.832 / 80000; // ~0.00019790
    assert.ok(Math.abs(result.quantity - expected) < 1e-8, `qty should be ~${expected}`);
  });

  test("spot (1× leverage) notional equals margin", () => {
    const result = calculatePosition({
      availableMargin: 100,
      marginToUse: 100,
      leverage: 1,
      entryPrice: 50000,
    });
    assert.equal(result.notionalUsd, 100);
    assert.ok(Math.abs(result.quantity - 0.002) < 1e-8);
  });
});

describe("calculateExitTargets – SL/TP from entry price", () => {
  test("long: stopLoss below entry, takeProfit above entry", () => {
    const targets = calculateExitTargets(80000, "BUY", 2, 4);
    assert.ok(targets.stopLossPrice < 80000, "SL must be below entry for longs");
    assert.ok(targets.takeProfitPrice > 80000, "TP must be above entry for longs");
    assert.ok(Math.abs(targets.stopLossPrice - 78400) < 1, "SL ~78400 (2% below)");
    assert.ok(Math.abs(targets.takeProfitPrice - 83200) < 1, "TP ~83200 (4% above)");
  });

  test("short: stopLoss above entry, takeProfit below entry", () => {
    const targets = calculateExitTargets(80000, "SELL", 2, 4);
    assert.ok(targets.stopLossPrice > 80000, "SL must be above entry for shorts");
    assert.ok(targets.takeProfitPrice < 80000, "TP must be below entry for shorts");
    assert.ok(Math.abs(targets.stopLossPrice - 81600) < 1, "SL ~81600 (2% above)");
    assert.ok(Math.abs(targets.takeProfitPrice - 76800) < 1, "TP ~76800 (4% below)");
  });
});
