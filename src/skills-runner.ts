import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SKILLS_ROOT = path.resolve(process.cwd(), ".agents", "skills");

/**
 * Executes a skill CLI script with the provided command and JSON parameters.
 */
async function runSkillCli(skillName: string, command: string, params: Record<string, any>): Promise<any> {
  const cliPath = path.join(SKILLS_ROOT, skillName, "scripts", "cli.mjs");
  const jsonParam = JSON.stringify(params);

  try {
    const { stdout } = await execFileAsync("node", [cliPath, command, jsonParam], {
      timeout: 10000,
      env: { ...process.env },
    });

    try {
      const parsed = JSON.parse(stdout);
      return parsed.data ?? parsed;
    } catch {
      return { raw: stdout.trim() };
    }
  } catch (err: any) {
    return {
      error: `Failed to execute skill [${skillName}:${command}]: ${err.message}`,
      details: err.stderr || err.stdout || null,
    };
  }
}

export class BinanceSkillsRunner {
  /**
   * Search for token metadata, real-time prices, and market data across chains.
   * Utilizes query-token-info skill.
   */
  public static async searchToken(keyword: string, chainIds = "56,1,8453,CT_501"): Promise<any> {
    const res = await runSkillCli("query-token-info", "search", {
      keyword: keyword.trim(),
      chainIds,
    });
    return res;
  }

  /**
   * Fetches real-time social buzz, sentiment, and trend summaries for tokens.
   * Utilizes crypto-market-rank skill.
   */
  public static async getSocialHype(chainId = "56", timeRange = 1): Promise<any> {
    const res = await runSkillCli("crypto-market-rank", "social-hype", {
      chainId,
      targetLanguage: "en",
      timeRange,
    });
    return res;
  }

  /**
   * Fetches tokens currently receiving the highest smart-money net inflow.
   * Utilizes crypto-market-rank skill.
   */
  public static async getSmartMoneyInflow(chainId = "56", period = "24h"): Promise<any> {
    const res = await runSkillCli("crypto-market-rank", "smart-money-inflow", {
      chainId,
      period,
    });
    return res;
  }

  /**
   * Fetches the top-ranked trending / top-search / Alpha tokens.
   * Utilizes crypto-market-rank skill.
   */
  public static async getTokenLeaderboard(rankType = 10, chainId = "56", size = 10): Promise<any> {
    const res = await runSkillCli("crypto-market-rank", "token-rank", {
      rankType,
      chainId,
      page: 1,
      size,
    });
    return res;
  }
}
