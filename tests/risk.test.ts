import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { RiskGuard, TradeProposal } from "../src/risk.js";

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
