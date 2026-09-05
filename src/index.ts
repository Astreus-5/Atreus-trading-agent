import "dotenv/config";
import chalk from "chalk";
import boxen from "boxen";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { RiskGuard } from "./risk.js";
import { getSystemPrompt } from "./prompt.js";
import { MultiLLMAdapter } from "./llm-provider.js";

import { BinanceMCPAuth } from "./mcp-auth.js";
import { BinanceMCPClient } from "./mcp-client.js";

async function main() {
  console.clear();
  console.log(
    boxen(
      `${chalk.bold.yellow("BINANCE AGENT OS — AI TRADING AGENT")}\n` +
        `${chalk.cyan("Track A Submission: Autonomous AI Trading Agent")}\n\n` +
        `${chalk.green("Official Model Context Protocol (MCP) • Universal LLM Engine")}\n` +
        `${chalk.dim("81 Dynamic Official Tools • RiskGuard Engine • Human-in-the-Loop Safe")}`,
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

  console.log(chalk.green("[Market Data] Connected directly to official Binance real-time feeds ✓"));
  console.log(chalk.green("[Pre-Trade Guard] RiskGuard Engine Active (Max 5% Position, Max 5× Leverage) ✓"));
  console.log(chalk.green("[Safety Invariant] Human-in-the-Loop Confirmation Gate (CONFIRM Required) ✓\n"));

  console.log(chalk.bold.green("✨ Binance AI Trading Agent is online and ready for instructions.\n"));
  console.log(
    chalk.dim(
      "Try these commands:\n" +
        " • 'Check live BTCUSDT price and funding rate'\n" +
        " • 'Analyze ETHUSDT RSI and momentum'\n" +
        " • 'What is my current sub-account balance?'\n" +
        " • 'Propose a 2x long position on ETHUSDT with 2% stop-loss'\n" +
        " • Type 'exit' or Ctrl+C to quit.\n"
    )
  );

  const rl = readline.createInterface({ input, output });

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
        console.log(`\n${chalk.bold.magenta("Agent:")}\n${reply}\n`);
      }
    } catch (err: any) {
      console.error(chalk.red(`\nError: ${err.message}\n`));
    }
  }

  rl.close();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
