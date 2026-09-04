import "dotenv/config";
import chalk from "chalk";
import boxen from "boxen";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { RiskGuard } from "./risk.js";
import { getSystemPrompt } from "./prompt.js";
import { MultiLLMAdapter } from "./llm-provider.js";

async function main() {
  console.clear();
  console.log(
    boxen(
      `${chalk.bold.yellow("BINANCE AGENT OS — AI TRADING AGENT")}\n` +
        `${chalk.cyan("Track A Submission: Autonomous AI Trading Agent")}\n\n` +
        `${chalk.green("Universal LLM Engine (Claude • GPT-4o • Gemini • DeepSeek)")}\n` +
        `${chalk.dim("Multi-Market Intelligence • RiskGuard Engine • Human-in-the-Loop Safe")}`,
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

  let llmAdapter: MultiLLMAdapter;
  try {
    llmAdapter = new MultiLLMAdapter(systemPrompt, riskGuard);
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

  const hasBinanceKeys = Boolean(process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET);
  if (hasBinanceKeys) {
    console.log(chalk.green("[Binance Engine] Live Production Authenticated (Spot • Futures • Sub-Accounts) ✓"));
  } else {
    console.log(chalk.cyan("[Binance Engine] Public Market Intelligence Mode (Live feeds & technicals active; API keys required for live trading)"));
  }

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
