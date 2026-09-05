import chalk from "chalk";
import boxen from "boxen";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { TradeProposal } from "./risk.js";

let sharedRl: readline.Interface | null = null;

export function setSharedReadline(rl: readline.Interface): void {
  sharedRl = rl;
}

export function getSharedReadline(): readline.Interface {
  if (!sharedRl || (sharedRl as any).closed) {
    sharedRl = readline.createInterface({ input, output });
  }
  return sharedRl;
}

/**
 * Renders the proposed trade as a high-visibility card with visual button choices.
 * Operator presses 1 / Y / Enter to confirm, or 2 / N to cancel.
 *
 * @param proposal The trade parameters formulated by the agent.
 * @returns true if the operator confirmed, false otherwise.
 */
export async function requireHumanConfirmation(proposal: TradeProposal): Promise<boolean> {
  const sideColor = proposal.side === "BUY" ? chalk.bold.green : chalk.bold.red;
  const isFutures = proposal.product !== "SPOT";

  const confirmBtn = chalk.bgGreen.black.bold(" [ 1 ]  ✅  CONFIRM & EXECUTE ");
  const cancelBtn  = chalk.bgRed.white.bold(" [ 2 ]  ❌  CANCEL & ABORT    ");

  const content = `
${chalk.bold.yellow("⚠ TRADE PROPOSAL — HUMAN AUTHORIZATION REQUIRED")}

${chalk.cyan("Product / Market :")} ${chalk.bold.white(proposal.product)}
${chalk.cyan("Trading Pair     :")} ${chalk.bold.white(proposal.symbol)}
${chalk.cyan("Action / Side    :")} ${sideColor(proposal.side)}
${chalk.cyan("Order Type       :")} ${proposal.orderType} ${proposal.price ? `(@ $${proposal.price})` : "(MARKET)"}
${chalk.cyan("Quantity         :")} ${proposal.quantity}
${chalk.cyan("Notional Value   :")} ~$${proposal.notionalUsd.toFixed(2)} USD
${isFutures ? `${chalk.cyan("Leverage         :")} ${proposal.leverage ?? 1}×\n` : ""}${
    proposal.stopLossPrice ? `${chalk.cyan("Stop-Loss Target :")} $${proposal.stopLossPrice}\n` : ""
  }
${confirmBtn}   ${chalk.dim("press  1  or  Y")}
${cancelBtn}   ${chalk.dim("press  2  or  N")}
`.trim();

  console.log(
    boxen(content, {
      padding: 1,
      margin: { top: 1, bottom: 1 },
      borderStyle: "double",
      borderColor: "yellow",
    })
  );

  const rl = getSharedReadline();
  const answer = (await rl.question(chalk.bold.white("Your Choice (1/Y = Execute, 2/N = Cancel) > "))).trim();

  const normalized = answer.toUpperCase().replace(/\s+/g, "");

  const confirmed =
    normalized === "1" ||
    normalized === "Y" ||
    normalized === "YES" ||
    normalized === "CONFIRM" ||
    normalized === "" ; // Enter defaults to confirm when the card is shown

  if (confirmed) {
    console.log(chalk.bold.green("\n✅ Execution confirmed. Submitting order to Binance...\n"));
    return true;
  } else {
    console.log(chalk.bold.red("\n❌ Order cancelled. No order was submitted.\n"));
    return false;
  }
}
