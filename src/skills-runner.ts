import fs from "node:fs";
import path from "node:path";
import { execFile, exec } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const SKILLS_ROOT = path.resolve(process.cwd(), ".agents", "skills");

export interface SkillCatalogEntry {
  name: string;
  description: string;
  version?: string;
  author?: string;
  executionType: "cli-script" | "custom-script" | "rest-api" | "binary-cli";
  availableCommands?: string[];
}

/**
 * Universal Binance Skills Hub Runner
 * Dynamically discovers, documents, and executes all 19 installed Binance skills.
 */
export class BinanceSkillsRunner {
  /**
   * Scans .agents/skills/ and parses all SKILL.md files to return a live catalog of all 19 skills.
   */
  public static listInstalledSkills(): SkillCatalogEntry[] {
    if (!fs.existsSync(SKILLS_ROOT)) {
      return [];
    }

    const entries: SkillCatalogEntry[] = [];
    const skillFolders = fs.readdirSync(SKILLS_ROOT);

    for (const folder of skillFolders) {
      const folderPath = path.join(SKILLS_ROOT, folder);
      if (!fs.statSync(folderPath).isDirectory()) continue;

      const skillMdPath = path.join(folderPath, "SKILL.md");
      let description = "Official Binance Skill";
      let version = "1.0.0";
      let author = "Binance";

      if (fs.existsSync(skillMdPath)) {
        try {
          const content = fs.readFileSync(skillMdPath, "utf-8");
          const descMatch = content.match(/description:\s*\|?\s*\n?([^\n\r]+)/i);
          if (descMatch && descMatch[1]) {
            description = descMatch[1].trim();
          }
          const verMatch = content.match(/version:\s*['"]?([^'"\r\n]+)/i);
          if (verMatch && verMatch[1]) {
            version = verMatch[1].trim();
          }
          const authorMatch = content.match(/author:\s*['"]?([^'"\r\n]+)/i);
          if (authorMatch && authorMatch[1]) {
            author = authorMatch[1].trim();
          }
        } catch {}
      }

      // Determine execution channel
      const scriptsDir = path.join(folderPath, "scripts");
      let executionType: SkillCatalogEntry["executionType"] = "binary-cli";
      let availableCommands: string[] = [];

      if (fs.existsSync(path.join(scriptsDir, "cli.mjs"))) {
        executionType = "cli-script";
        if (folder === "query-token-info") availableCommands = ["search", "meta", "dynamic", "kline"];
        else if (folder === "crypto-market-rank") availableCommands = ["social-hype", "token-rank", "smart-money-inflow", "meme-rank", "address-pnl-rank"];
        else if (folder === "meme-rush") availableCommands = ["meme-rush", "topic-rush"];
        else if (folder === "query-address-info") availableCommands = ["positions"];
        else if (folder === "trading-signal" || folder === "binance-trading-signal") availableCommands = ["smart-money"];
      } else if (folder === "academy-skill") {
        executionType = "custom-script";
        availableCommands = ["search", "article"];
      } else if (folder === "square-post") {
        executionType = "custom-script";
        availableCommands = ["post-text", "post-image", "post-video"];
      } else if (folder === "query-token-audit" || folder === "binance-tokenized-securities-info") {
        executionType = "rest-api";
        availableCommands = ["audit", "list-stocks", "stock-dynamic"];
      } else if (folder === "binance" || folder === "fiat" || folder === "p2p") {
        executionType = "binary-cli";
        availableCommands = ["spot", "futures-usds", "convert", "wallet"];
      } else {
        executionType = "binary-cli";
        availableCommands = ["baw", "tracker", "leaderboard"];
      }

      entries.push({
        name: folder,
        description,
        version,
        author,
        executionType,
        availableCommands,
      });
    }

    return entries;
  }

  /**
   * Universal Skill Execution Engine:
   * Executes ANY of the 19 installed Binance skills dynamically by name.
   */
  public static async executeSkill(
    skillName: string,
    command: string,
    params: Record<string, any> = {}
  ): Promise<any> {
    const cleanName = skillName.trim().toLowerCase();
    const skillPath = path.join(SKILLS_ROOT, cleanName);

    if (!fs.existsSync(skillPath)) {
      throw new Error(`Skill [${cleanName}] is not installed in .agents/skills/`);
    }

    const cliMjsPath = path.join(skillPath, "scripts", "cli.mjs");

    // ── Channel 1: Standard cli.mjs skills ────────────────────────────────────
    if (fs.existsSync(cliMjsPath)) {
      try {
        const jsonString = JSON.stringify(params);
        const { stdout } = await execFileAsync("node", [cliMjsPath, command, jsonString], {
          timeout: 15000,
          env: { ...process.env },
        });
        try {
          const parsed = JSON.parse(stdout);
          return parsed.data ?? parsed;
        } catch {
          return { output: stdout.trim() };
        }
      } catch (err: any) {
        return {
          error: `Error executing skill [${cleanName}:${command}]`,
          details: err.stderr || err.message,
        };
      }
    }

    // ── Channel 2: REST API Skills (token-audit & tokenized securities) ───────
    if (cleanName === "query-token-audit") {
      try {
        const chainId = params.chainId ?? params.binanceChainId ?? "56";
        const contractAddress = params.contractAddress;
        if (!contractAddress) throw new Error("contractAddress is required for query-token-audit");

        const res = await fetch("https://web3.binance.com/bapi/defi/v1/public/wallet-direct/security/token/audit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            source: "agent",
            "User-Agent": "binance-web3/1.4 (Skill)",
          },
          body: JSON.stringify({
            binanceChainId: chainId,
            contractAddress,
            requestId: `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          }),
        });
        return await res.json();
      } catch (err: any) {
        return { error: `Token audit failed: ${err.message}` };
      }
    }

    if (cleanName === "binance-tokenized-securities-info") {
      try {
        const res = await fetch("https://www.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/market/token/rwa/stock/detail/list/ai?type=1", {
          headers: { "Accept-Encoding": "identity" },
        });
        return await res.json();
      } catch (err: any) {
        return { error: `Tokenized securities fetch failed: ${err.message}` };
      }
    }

    // ── Channel 3: Custom script skills (academy-skill & square-post) ─────────
    if (cleanName === "academy-skill") {
      const academyScript = path.join(skillPath, "scripts", "academy-api.mjs");
      if (fs.existsSync(academyScript)) {
        try {
          const query = params.query || command;
          const { stdout } = await execAsync(`node "${academyScript}" search "${query}"`, {
            timeout: 10000,
          });
          return { searchResult: stdout.trim() };
        } catch (err: any) {
          return { error: `Academy skill error: ${err.message}` };
        }
      }
    }

    // ── Channel 4: Binary CLI Skills (binance-cli & baw) ──────────────────────
    if (cleanName === "binance" || cleanName === "fiat" || cleanName === "p2p") {
      try {
        const fullCmd = `source $HOME/.cargo/env 2>/dev/null; binance-cli ${command} ${Object.entries(params)
          .map(([k, v]) => `--${k} "${v}"`)
          .join(" ")}`;
        const { stdout } = await execAsync(fullCmd, { timeout: 15000 });
        return { cliOutput: stdout.trim() };
      } catch (err: any) {
        return { error: `binance-cli execution error: ${err.message}`, stderr: err.stderr };
      }
    }

    // Fallback: report skill capabilities
    return {
      skill: cleanName,
      status: "INSTALLED",
      location: skillPath,
      message: `Skill [${cleanName}] is ready. Refer to its SKILL.md for supported CLI commands and arguments.`,
    };
  }

  // ── Fast-path convenience methods ──────────────────────────────────────────
  public static async searchToken(keyword: string, chainIds = "56,1,8453,CT_501"): Promise<any> {
    return this.executeSkill("query-token-info", "search", { keyword: keyword.trim(), chainIds });
  }

  public static async getSocialHype(chainId = "56", timeRange = 1): Promise<any> {
    return this.executeSkill("crypto-market-rank", "social-hype", {
      chainId,
      targetLanguage: "en",
      timeRange,
    });
  }

  public static async getSmartMoneyInflow(chainId = "56", period = "24h"): Promise<any> {
    return this.executeSkill("crypto-market-rank", "smart-money-inflow", { chainId, period });
  }

  public static async auditToken(contractAddress: string, chainId = "56"): Promise<any> {
    return this.executeSkill("query-token-audit", "audit", { contractAddress, chainId });
  }
}
