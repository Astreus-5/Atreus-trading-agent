import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { TechnicalAnalysis } from "../src/indicators.js";

describe("TechnicalAnalysis Indicators Unit Tests", () => {
  test("calculates RSI on upward trending series", () => {
    const upwardCloses = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25];
    const rsi = TechnicalAnalysis.calculateRSI(upwardCloses, 14);
    assert.equal(rsi > 70, true, "RSI on continuous uptrend should be > 70 (Overbought)");
  });

  test("calculates RSI on downward trending series", () => {
    const downwardCloses = [25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10];
    const rsi = TechnicalAnalysis.calculateRSI(downwardCloses, 14);
    assert.equal(rsi < 30, true, "RSI on continuous downtrend should be < 30 (Oversold)");
  });

  test("calculates Simple Moving Average (SMA) correctly", () => {
    const data = [10, 20, 30, 40, 50];
    const sma3 = TechnicalAnalysis.calculateSMA(data, 3); // (30+40+50)/3 = 40
    assert.equal(sma3, 40.0);
  });
});
