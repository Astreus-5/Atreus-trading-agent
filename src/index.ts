import "dotenv/config";
import chalk from "chalk";
import boxen from "boxen";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { RiskGuard } from "./risk.js";
import { getSystemPrompt } from "./prompt.js";
import { MultiLLMAdapter } from "./llm-provider.js";
import { formatTerminalResponse } from "./formatter.js";
import { setSharedReadline } from "./confirmation.js";

import { BinanceMCPAuth } from "./mcp-auth.js";
import { BinanceMCPClient } from "./mcp-client.js";

async function main() {
  console.clear();
  console.log(
    boxen(
      `${chalk.bold.yellow("BINANCE AGENT OS — ATREUS TRADING AGENT")}\n` +
        `${chalk.cyan("Track A Submission: Autonomous AI Trading Agent")}\n\n` +
        `${chalk.green("Isolated Sub-Account Security Perimeter • Zero-Withdrawal Safe")}\n` +
        `${chalk.dim("Pre-Execution Binance Skills Intelligence • 4-Stage Reasoning Engine")}`,
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: "round",
        borderColor: "yellow",
        textAlignment: "center",
      }
    )
  );

  const riskGuard = new RiskGuard();
  const systemPrompt = getSystemPrompt(riskGuard.getConfig());

  // ── Official Binance Agent OS MCP Adapter (Decoupled / Future-Ready) ───────
  let mcpClient: BinanceMCPClient | undefined;
  const mcpEnabled = process.env.ENABLE_BINANCE_MCP === "true";
  const existingToken = BinanceMCPAuth.getStoredToken();

  if (mcpEnabled || existingToken) {
    try {
      const token = existingToken || (await BinanceMCPAuth.authenticate());
      if (token) {
        mcpClient = new BinanceMCPClient(token);
        const tools = await mcpClient.init();
        console.log(chalk.green("[Binance MCP Engine] Connected to official Binance Agent OS Server ✓"));
        console.log(
          chalk.green(
            `[Binance MCP Engine] ${tools.length} dynamic official tools loaded (Spot • Futures • Wallet • Sub-Accounts) ✓`
          )
        );
      }
    } catch (err: any) {
      console.warn(chalk.yellow(`[Notice] MCP initialization skipped: ${err.message}`));
    }
  } else {
    console.log(
      chalk.dim(
        "[Binance MCP Engine] Adapter dormant (ready for future custom agent support) ✓"
      )
    );
  }

  let llmAdapter: MultiLLMAdapter;
  try {
    llmAdapter = new MultiLLMAdapter(systemPrompt, riskGuard, mcpClient);
  } catch (err: any) {
    console.error(chalk.bold.red(`\n❌ Configuration Error: ${err.message}\n`));
    process.exit(1);
  }

  const llmConfig = llmAdapter.getConfig();
  console.log(
    chalk.cyan(
      `[LLM Provider] Auto-detected: ${chalk.bold.green(
        `${llmConfig.provider.toUpperCase()} (${llmConfig.modelName})`
      )}`
    )
  );

  console.log(chalk.green("[Sub-Account Security] Zero-withdrawal trading perimeter active ✓"));
  console.log(chalk.green("[Binance Skills Hub] Pre-trade multi-chain intelligence & sentiment active ✓"));
  console.log(chalk.green("[Pre-Trade Guard] RiskGuard Engine Active (Max 5% Position, Max 5× Leverage) ✓"));
  console.log(chalk.green("[Safety Invariant] Human-in-the-Loop Confirmation Gate (CONFIRM Required) ✓"));
  console.log(chalk.green("[Post-Trade Synthesis] Institutional fill & slippage evaluation enabled ✓\n"));

  console.log(chalk.bold.green("✨ Atreus AI Trading Agent is online and ready for instructions.\n"));
  console.log(
    chalk.dim(
      "Try these commands:\n" +
        " • 'Analyze BTC momentum, smart money inflows, and order book depth'\n" +
        " • 'Research token intelligence on BNB across chains'\n" +
        " • 'What is my current sub-account balance?'\n" +
        " • 'Propose a 2x long position on ETHUSDT with 2% stop-loss'\n" +
        " • Type 'exit' or Ctrl+C to quit.\n"
    )
  );

  const rl = readline.createInterface({ input, output });
  setSharedReadline(rl);

  while (true) {
    try {
      const userPrompt = (await rl.question(chalk.bold.cyan("You > "))).trim();
      if (!userPrompt) continue;
      if (userPrompt.toLowerCase() === "exit" || userPrompt.toLowerCase() === "quit") {
        console.log(chalk.yellow("\nExiting session. Good luck with your trading!\n"));
        break;
      }

      console.log(chalk.dim("\nThinking & consulting Binance market tools..."));
      const reply = await llmAdapter.chat(userPrompt);

      if (reply) {
        const header = chalk.bold.bgHex("#F0B90B").black(" ⚡ ATREUS AI ") + " " + chalk.dim("Binance Agent OS");
        console.log(`\n${header}\n${chalk.dim("───────────────────────────────────────────────────")}\n${formatTerminalResponse(reply)}\n`);
      } else {
        console.log(chalk.yellow("\n[Notice] No response returned by model. Please retry.\n"));
      }
    } catch (err: any) {
      if (err?.code === "ERR_USE_AFTER_CLOSE" || err?.message?.includes("closed") || err?.message?.includes("EOF")) {
        break;
      }
      console.error(chalk.red(`\nError: ${err.message}\n`));
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
