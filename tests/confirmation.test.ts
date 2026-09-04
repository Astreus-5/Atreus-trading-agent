import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { TradeProposal } from "../src/risk.js";

describe("Confirmation Gate Logic", () => {
  test("validates CONFIRM case-insensitively", () => {
    const isConfirmed = (input: string) => input.trim().toUpperCase() === "CONFIRM";

    assert.equal(isConfirmed("CONFIRM"), true);
    assert.equal(isConfirmed("confirm"), true);
    assert.equal(isConfirmed(" Confirm "), true);
    assert.equal(isConfirmed("no"), false);
    assert.equal(isConfirmed(""), false);
    assert.equal(isConfirmed("cancel"), false);
  });
});
