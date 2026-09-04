import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import chalk from "chalk";
import boxen from "boxen";

export interface StoredToken {
  access_token: string;
  token_type: string;
  expiry?: string;
  expires_in?: number;
  obtained_at?: string;
}

export class BinanceMCPAuth {
  private static readonly CLIENT_METADATA_URL =
    "https://astreus-5.github.io/atreus-trading-agent/oauth/client-metadata.json";
  private static readonly REDIRECT_URI =
    "https://astreus-5.github.io/atreus-trading-agent/oauth/callback";
  private static readonly AUTH_ENDPOINT = "https://accounts.binance.com/agentic-oauth/authorize";
  private static readonly TOKEN_ENDPOINT = "https://accounts.binance.com/oauth-agentic/token";
  private static readonly TOKEN_FILE = path.resolve(process.cwd(), ".binance-token.json");

  private static base64Url(buf: Buffer): string {
    return buf
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");
  }

  public static generatePKCE(): { verifier: string; challenge: string; state: string } {
    const verifier = this.base64Url(crypto.randomBytes(32));
    const challenge = this.base64Url(
      crypto.createHash("sha256").update(verifier).digest()
    );
    const state = this.base64Url(crypto.randomBytes(16));
    return { verifier, challenge, state };
  }

  public static getStoredToken(): string | null {
    // 1. CI/automated use — set BINANCE_MCP_TOKEN env var explicitly
    if (process.env.BINANCE_MCP_TOKEN) {
      return process.env.BINANCE_MCP_TOKEN.trim();
    }

    // 2. Saved after user's own first-time login via the browser flow
    if (fs.existsSync(this.TOKEN_FILE)) {
      try {
        const raw = fs.readFileSync(this.TOKEN_FILE, "utf-8");
        const parsed: StoredToken = JSON.parse(raw);
        if (parsed.access_token) {
          return parsed.access_token;
        }
      } catch {}
    }

    // No token found — user must log in themselves
    return null;
  }

  public static saveToken(token: StoredToken): void {
    fs.writeFileSync(this.TOKEN_FILE, JSON.stringify(token, null, 2), "utf-8");
  }

  public static async exchangeCodeForToken(
    code: string,
    verifier: string
  ): Promise<StoredToken> {
    const params = new URLSearchParams({
      grant_type: "authorization_code",
      client_id: this.CLIENT_METADATA_URL,
      code: code.trim(),
      code_verifier: verifier,
      redirect_uri: this.REDIRECT_URI,
    });

    const res = await fetch(this.TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Binance OAuth token exchange failed (${res.status}): ${err}`);
    }

    const data: any = await res.json();
    const token: StoredToken = {
      access_token: data.access_token,
      token_type: data.token_type ?? "Bearer",
      expires_in: data.expires_in,
      obtained_at: new Date().toISOString(),
    };

    this.saveToken(token);
    return token;
  }

  public static async authenticate(): Promise<string> {
    const existing = this.getStoredToken();
    if (existing) {
      return existing;
    }

    const pkce = this.generatePKCE();
    const authUrl = `${this.AUTH_ENDPOINT}?response_type=code&client_id=${encodeURIComponent(
      this.CLIENT_METADATA_URL
    )}&redirect_uri=${encodeURIComponent(this.REDIRECT_URI)}&code_challenge=${
      pkce.challenge
    }&code_challenge_method=S256&state=${pkce.state}`;

    const instructions = `
${chalk.bold.yellow("🔗 Connect to Binance Agent OS (Official MCP Flow)")}

To authorize this AI Trading Agent with your Binance Agentic Sub-Account:

1. Open this official Binance authorization URL in your browser:
${chalk.cyan.underline(authUrl)}

2. Log in to Binance and select / create your ${chalk.bold.green("Agentic Sub-Account")}.
3. Review requested permissions and click ${chalk.bold.green("Authorize")}.
4. On the callback page, click the ${chalk.bold.yellow("[ Copy to Clipboard ]")} button to copy your code.
`.trim();

    console.log(
      boxen(instructions, {
        padding: 1,
        margin: { top: 1, bottom: 1 },
        borderStyle: "round",
        borderColor: "yellow",
      })
    );

    const rl = readline.createInterface({ input, output });
    const code = (
      await rl.question(chalk.bold.white("\nPaste your authorization code here > "))
    ).trim();
    rl.close();

    if (!code) {
      throw new Error("No authorization code provided. MCP authentication cancelled.");
    }

    console.log(chalk.cyan("\nExchanging authorization code with Binance OAuth server..."));
    const token = await this.exchangeCodeForToken(code, pkce.verifier);
    console.log(chalk.bold.green("✓ Authenticated successfully with Binance Agent OS! Token saved.\n"));

    return token.access_token;
  }
}
