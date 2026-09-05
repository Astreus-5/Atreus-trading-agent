import { test, describe } from "node:test";
import assert from "node:assert";
import { envExists, isConfiguredContent } from "../src/setup.js";

describe("Setup Wizard & Env Check Tests", () => {
  test("isConfiguredContent detects unconfigured templates", () => {
    assert.strictEqual(isConfiguredContent("BINANCE_SUB_ACCOUNT_API_KEY=your_subaccount_api_key"), false);
    assert.strictEqual(isConfiguredContent("BINANCE_SUB_ACCOUNT_API_KEY=\"your_subaccount_api_key\""), false);
    assert.strictEqual(isConfiguredContent("BINANCE_SUB_ACCOUNT_API_KEY=''"), false);
    assert.strictEqual(isConfiguredContent("BINANCE_SUB_ACCOUNT_API_KEY=\"\""), false);
    assert.strictEqual(isConfiguredContent("OTHER_KEY=something"), false);
  });

  test("isConfiguredContent detects valid configured credentials", () => {
    const valid = `
ANTHROPIC_API_KEY=sk-ant-test
BINANCE_SUB_ACCOUNT_API_KEY=live_subaccount_api_key_12345
BINANCE_SUB_ACCOUNT_API_SECRET=live_subaccount_secret_67890
`;
    assert.strictEqual(isConfiguredContent(valid), true);
  });

  test("isConfiguredContent detects valid MCP mode with LLM key", () => {
    const validMcp = `
OPENROUTER_API_KEY=sk-or-v1-validkey
ENABLE_BINANCE_MCP=true
`;
    assert.strictEqual(isConfiguredContent(validMcp), true);
  });

  test("envExists returns true when current real .env is active", () => {
    assert.strictEqual(envExists(), true);
  });
});
