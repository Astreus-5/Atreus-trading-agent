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
 * Renders the proposed trade into an unmistakable, high-visibility box
 * and prompts the human operator to type 'CONFIRM'.
 *
 * @param proposal The trade parameters formulated by the agent.
 * @returns true if the operator typed 'CONFIRM', false otherwise.
 */
export async function requireHumanConfirmation(proposal: TradeProposal): Promise<boolean> {
  const sideColor = proposal.side === "BUY" ? chalk.bold.green : chalk.bold.red;
  const isFutures = proposal.product !== "SPOT";

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
${chalk.bold.red("To authorize and execute this order on Binance, type  CONFIRM .\nPress Enter or type anything else to CANCEL.")}
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
  const answer = (await rl.question(chalk.bold.white("Your Decision > "))).trim();

  // Normalize input (case-insensitive)
  const normalized = answer.toUpperCase().replace(/\s+/g, "");

  if (normalized === "CONFIRM") {
    console.log(chalk.bold.green("\n✓ Execution confirmed by operator. Submitting order to Binance...\n"));
    return true;
  } else {
    console.log(chalk.bold.red("\n✗ Order cancelled by operator. No order was submitted.\n"));
    return false;
  }
}
