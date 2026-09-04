import chalk from "chalk";
import { RiskGuard, TradeProposal } from "./risk.js";
import { requireHumanConfirmation } from "./confirmation.js";

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export class BinanceMCPClient {
  private endpoint = "https://agent.binance.com/mcp/agentic";
  private accessToken: string;
  private tools: MCPToolDefinition[] = [];

  constructor(accessToken: string) {
    this.accessToken = accessToken.trim();
  }

  /**
   * Sends a JSON-RPC 2.0 request to the official Binance Agent OS MCP server.
   */
  private async rpc(method: string, params: Record<string, any> = {}): Promise<any> {
    const id = Date.now();
    const res = await fetch(this.endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id,
        method,
        params,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Binance MCP Error (${res.status}): ${err}`);
    }

    const data: any = await res.json();
    if (data.error) {
      throw new Error(`Binance MCP RPC Error [${data.error.code}]: ${data.error.message}`);
    }

    return data.result;
  }

  /**
   * Initializes the session and loads all available tools dynamically.
   */
  public async init(): Promise<MCPToolDefinition[]> {
    this.tools = await this.listAllTools();
    return this.tools;
  }

  /**
   * Paginates through the official tools/list endpoint to retrieve all official tools.
   */
  public async listAllTools(): Promise<MCPToolDefinition[]> {
    const collected: MCPToolDefinition[] = [];
    let cursor: string | undefined = undefined;

    for (let page = 0; page < 10; page++) {
      const result = await this.rpc("tools/list", cursor ? { cursor } : {});
      if (result && Array.isArray(result.tools)) {
        collected.push(...result.tools);
        cursor = result.nextCursor;
        if (!cursor) break;
      } else {
        break;
      }
    }

    this.tools = collected;
    return collected;
  }

  public getLoadedTools(): MCPToolDefinition[] {
    return this.tools;
  }

  /**
   * Calls an official Binance Agent OS tool via MCP.
   * Intercepts order creation to enforce institutional RiskGuard and Human Confirmation.
   */
  public async executeTool(
    name: string,
    args: any,
    riskGuard: RiskGuard
  ): Promise<any> {
    // ── Institutional Pre-Trade Interceptor ────────────────────────────────────
    const isOrderTool =
      name.includes("newOrder") ||
      name.includes("placeLimitOrder") ||
      name.includes("marginAccountNewOrder");

    if (isOrderTool) {
      const notional =
        Number(args.quantity || 0) * Number(args.price || 0) ||
        Number(args.quoteOrderQty || 0) ||
        100;

      const proposal: TradeProposal = {
        product: name.includes("futures") ? "USDS-M FUTURES" : "SPOT",
        symbol: args.symbol ?? "BTCUSDT",
        side: args.side?.toUpperCase() ?? "BUY",
        orderType: args.type ?? "MARKET",
        quantity: Number(args.quantity || 0),
        notionalUsd: notional,
        price: args.price ? Number(args.price) : undefined,
        leverage: args.leverage ? Number(args.leverage) : 1,
        stopLossPrice: args.stopLossPrice ? Number(args.stopLossPrice) : undefined,
      };

      // 1. Audit against Pre-Trade RiskGuard
      const riskResult = riskGuard.validate(proposal, 1000);
      if (!riskResult.passed) {
        return {
          status: "REJECTED_BY_RISK_GUARD",
          violations: riskResult.violations,
          message: "Pre-trade risk audit failed. Order was not submitted.",
        };
      }

      // 2. Enforce Mandatory Human Confirmation Gate
      const confirmed = await requireHumanConfirmation(proposal);
      if (!confirmed) {
        return {
          status: "CANCELLED_BY_OPERATOR",
          message: "Operator cancelled or did not authorize trade.",
        };
      }
    }

    // ── Execute via official Binance MCP Server ────────────────────────────────
    console.log(chalk.cyan(`[Binance MCP Server] Calling ${chalk.bold(name)} via JSON-RPC 2.0...`));
    const result = await this.rpc("tools/call", {
      name,
      arguments: args || {},
    });

    if (result && Array.isArray(result.content)) {
      const textBlock = result.content.find((c: any) => c.type === "text");
      if (textBlock?.text) {
        try {
          return JSON.parse(textBlock.text);
        } catch {
          return textBlock.text;
        }
      }
    }

    return result;
  }

  /**
   * Converts official MCP tool definitions into OpenAI/LLM function calling schemas.
   */
  public toLLMTools(): any[] {
    return this.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema || { type: "object", properties: {} },
      },
    }));
  }
}
