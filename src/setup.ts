import chalk from "chalk";
import boxen from "boxen";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import fs from "node:fs";
import path from "node:path";

const ENV_PATH = path.resolve(process.cwd(), ".env");

export function isConfiguredContent(content: string): boolean {
  return (
    content.includes("BINANCE_SUB_ACCOUNT_API_KEY=") &&
    !content.includes("BINANCE_SUB_ACCOUNT_API_KEY=your_subaccount_api_key") &&
    !content.includes("BINANCE_SUB_ACCOUNT_API_KEY=\"your_subaccount_api_key\"") &&
    !content.includes("BINANCE_SUB_ACCOUNT_API_KEY=''") &&
    !content.includes("BINANCE_SUB_ACCOUNT_API_KEY=\"\"")
  );
}

export function envExists(): boolean {
  // 1. If an official Binance MCP OAuth token is stored, check if any LLM key is configured
  const tokenPath = path.resolve(process.cwd(), ".binance-token.json");
  if (fs.existsSync(tokenPath) && fs.existsSync(ENV_PATH)) {
    const content = fs.readFileSync(ENV_PATH, "utf-8");
    const hasLLM =
      (content.includes("ANTHROPIC_API_KEY=") && !content.includes("sk-ant-...")) ||
      (content.includes("OPENAI_API_KEY=") && !content.includes("sk-proj-...")) ||
      (content.includes("GOOGLE_API_KEY=") && !content.includes("AIzaSy...")) ||
      (content.includes("OPENROUTER_API_KEY=") && !content.includes("sk-or-v1-..."));
    if (hasLLM) return true;
  }

  // 2. Standard check: ensure .env exists and has valid Binance REST subaccount keys
  if (!fs.existsSync(ENV_PATH)) return false;
  const content = fs.readFileSync(ENV_PATH, "utf-8");
  return isConfiguredContent(content);
}

export async function runSetupWizard(): Promise<void> {
  const rl = readline.createInterface({ input, output });

  console.clear();
  console.log(
    boxen(
      `${chalk.bold.yellow("⚡ ATREUS SETUP WIZARD")}\n` +
        `${chalk.cyan("Let's get you configured in under 2 minutes.")}\n\n` +
        `${chalk.dim("We'll ask a few questions and create your config file.")}`,
      {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: "round",
        borderColor: "yellow",
        textAlignment: "center",
      }
    )
  );

  // ── Step 1: LLM Provider ────────────────────────────────────────────────────
  console.log(chalk.bold.white("\n📡 Step 1 of 3 — Choose your AI Provider\n"));
  console.log(chalk.dim("  [ 1 ]  Anthropic Claude   → https://console.anthropic.com  (Recommended)"));
  console.log(chalk.dim("  [ 2 ]  OpenAI GPT-4o      → https://platform.openai.com"));
  console.log(chalk.dim("  [ 3 ]  Google Gemini      → https://aistudio.google.com"));
  console.log(chalk.dim("  [ 4 ]  OpenRouter DeepSeek → https://openrouter.ai  (Free tier available)\n"));

  const providerChoice = (await rl.question(chalk.bold.cyan("Your choice (1/2/3/4) > "))).trim();

  let llmEnvKey = "";
  let llmLabel = "";
  let llmPlaceholder = "";

  switch (providerChoice) {
    case "2":
      llmEnvKey = "OPENAI_API_KEY";
      llmLabel = "OpenAI";
      llmPlaceholder = "sk-proj-...";
      break;
    case "3":
      llmEnvKey = "GOOGLE_API_KEY";
      llmLabel = "Google Gemini";
      llmPlaceholder = "AIzaSy...";
      break;
    case "4":
      llmEnvKey = "OPENROUTER_API_KEY";
      llmLabel = "OpenRouter";
      llmPlaceholder = "sk-or-v1-...";
      break;
    default:
      llmEnvKey = "ANTHROPIC_API_KEY";
      llmLabel = "Anthropic Claude";
      llmPlaceholder = "sk-ant-...";
  }

  console.log(chalk.dim(`\n  Get your ${llmLabel} API key from their website, then paste it below.`));
  const llmKey = (await rl.question(chalk.bold.cyan(`\n${llmLabel} API Key > `))).trim();

  if (!llmKey || llmKey === llmPlaceholder) {
    console.log(chalk.red("\n❌ No API key entered. Please run 'npm start' again to retry setup.\n"));
    rl.close();
    process.exit(1);
  }

  // ── Step 2: Binance Connection Mode ───────────────────────────────────────
  console.log(chalk.bold.white("\n\n🔑 Step 2 of 3 — Choose your Binance Connection Mode\n"));
  console.log(chalk.dim("  [ 1 ]  Binance Sub-Account REST API  (Active today — Recommended)"));
  console.log(chalk.dim("  [ 2 ]  Binance Agent OS MCP Server   (OAuth 2.0 PKCE — Awaiting Binance custom agent whitelist)\n"));

  const modeChoice = (await rl.question(chalk.bold.cyan("Your choice (1/2) [default: 1] > "))).trim();

  if (modeChoice === "2") {
    console.log(
      boxen(
        `${chalk.bold.yellow("ℹ️  Binance Agent OS MCP Status (Future-Ready)")}\n\n` +
          `${chalk.white("Binance's OAuth server currently requires custom agent whitelisting.")}\n` +
          `${chalk.white("The full RFC 7636 PKCE OAuth client is built into Atreus and ready.")}\n\n` +
          `${chalk.cyan("To activate MCP:")} Run ${chalk.bold.green("npm start -- --mcp-auth")} anytime.\n\n` +
          `${chalk.dim("To trade immediately today, let's configure your Sub-Account API key below:")}`,
        { padding: 1, borderStyle: "round", borderColor: "yellow" }
      )
    );
  }

  console.log(
    boxen(
      `${chalk.bold.yellow("How to get your Binance Sub-Account API Key:")}\n\n` +
        `${chalk.white("1.")} Log in at ${chalk.cyan.underline("https://binance.com")}\n` +
        `${chalk.white("2.")} Go to ${chalk.bold("Profile → Sub-Accounts → Create Sub-Account")}\n` +
        `${chalk.white("3.")} Fund it with a small amount of USDT (min ~$10)\n` +
        `${chalk.white("4.")} Inside sub-account: ${chalk.bold("API Management → Create API")}\n` +
        `${chalk.white("5.")} Enable ${chalk.bold.green("Spot Trading")} + ${chalk.bold.green("Futures Trading")} only\n` +
        `${chalk.white("6.")} ${chalk.bold.red("Leave withdrawals DISABLED")} — this keeps your funds safe\n` +
        `${chalk.white("7.")} Copy the API Key and Secret Key below`,
      { padding: 1, borderStyle: "round", borderColor: "cyan" }
    )
  );

  const binanceKey = (await rl.question(chalk.bold.cyan("\nBinance Sub-Account API Key > "))).trim();
  const binanceSecret = (await rl.question(chalk.bold.cyan("Binance Sub-Account Secret  > "))).trim();

  if (!binanceKey || !binanceSecret) {
    console.log(chalk.red("\n❌ Binance keys are required. Please run 'npm start' again to retry setup.\n"));
    rl.close();
    process.exit(1);
  }

  // ── Step 3: Risk defaults ───────────────────────────────────────────────────
  console.log(chalk.bold.white("\n\n🛡️  Step 3 of 3 — Risk Controls\n"));
  console.log(chalk.dim("  Safe defaults are pre-filled. Press Enter to accept each one.\n"));

  const maxPos = (await rl.question(chalk.cyan("  Max % of balance per trade   [default: 5] > "))).trim() || "5";
  const maxLev = (await rl.question(chalk.cyan("  Max leverage for futures      [default: 5] > "))).trim() || "5";
  const slPct  = (await rl.question(chalk.cyan("  Min stop-loss % on buys       [default: 2] > "))).trim() || "2";
  const ddPct  = (await rl.question(chalk.cyan("  Daily drawdown circuit breaker [default: 10] > "))).trim() || "10";

  // ── Write .env ──────────────────────────────────────────────────────────────
  const envContent = `# Generated by Atreus Setup Wizard
# LLM Provider
${llmEnvKey}=${llmKey}

# Binance Sub-Account API Credentials
BINANCE_SUB_ACCOUNT_API_KEY=${binanceKey}
BINANCE_SUB_ACCOUNT_API_SECRET=${binanceSecret}

# Risk Controls
MAX_POSITION_PCT=${maxPos}
MAX_LEVERAGE=${maxLev}
STOP_LOSS_PCT=${slPct}
DAILY_LOSS_LIMIT_PCT=${ddPct}

# Binance MCP Engine (Optional — run with --mcp-auth to activate)
ENABLE_BINANCE_MCP=false
`;

  fs.writeFileSync(ENV_PATH, envContent, "utf-8");

  console.log(
    boxen(
      `${chalk.bold.green("✅ Setup complete! Your config has been saved.")}\n\n` +
        `${chalk.dim("Config saved to: .env")}\n` +
        `${chalk.white("Starting Atreus now...")}`,
      { padding: 1, borderStyle: "round", borderColor: "green", margin: { top: 1, bottom: 1 } }
    )
  );

  rl.close();
}
