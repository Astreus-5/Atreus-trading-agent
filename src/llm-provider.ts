import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import Anthropic from "@anthropic-ai/sdk";
import { agentTools, executeAgentTool } from "./tools.js";
import { BinanceMCPClient } from "./mcp-client.js";
import { RiskGuard } from "./risk.js";
import chalk from "chalk";

export interface LLMConfig {
  provider: "openai" | "google" | "openrouter" | "anthropic";
  modelName: string;
}

export class MultiLLMAdapter {
  private config: LLMConfig;
  private openaiClient: OpenAI | null = null;
  private googleClient: GoogleGenerativeAI | null = null;
  private anthropicClient: Anthropic | null = null;
  private geminiChat: any = null;
  private systemPrompt: string;
  private riskGuard: RiskGuard;
  private mcpClient?: BinanceMCPClient;
  private conversationHistory: OpenAI.ChatCompletionMessageParam[] = [];
  private anthropicMessages: Anthropic.MessageParam[] = [];

  constructor(systemPrompt: string, riskGuard: RiskGuard, mcpClient?: BinanceMCPClient) {
    this.systemPrompt = systemPrompt;
    this.riskGuard = riskGuard;
    this.mcpClient = mcpClient;

    // Detect available keys with clear precedence
    if (process.env.ANTHROPIC_API_KEY) {
      this.config = {
        provider: "anthropic",
        modelName: process.env.ANTHROPIC_MODEL ?? "claude-3-5-sonnet-20241022",
      };
      this.anthropicClient = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    } else if (process.env.OPENAI_API_KEY) {
      this.config = {
        provider: "openai",
        modelName: process.env.OPENAI_MODEL ?? "gpt-4o",
      };
      this.openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.conversationHistory.push({ role: "system", content: systemPrompt });
    } else if (process.env.OPENROUTER_API_KEY) {
      this.config = {
        provider: "openrouter",
        modelName: process.env.OPENROUTER_MODEL ?? "deepseek/deepseek-chat",
      };
      this.openaiClient = new OpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY,
      });
      this.conversationHistory.push({ role: "system", content: systemPrompt });
    } else if (process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY) {
      const googleKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY!;
      this.config = {
        provider: "google",
        modelName: process.env.GOOGLE_MODEL ?? "gemini-1.5-pro",
      };
      this.googleClient = new GoogleGenerativeAI(googleKey);
      const geminiFunctions: any[] = this.getActiveTools().map((t: any) => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      }));
      const model = this.googleClient.getGenerativeModel({
        model: this.config.modelName,
        systemInstruction: systemPrompt,
        tools: [{ functionDeclarations: geminiFunctions }],
      });
      this.geminiChat = model.startChat();
    } else {
      throw new Error(
        "No LLM API key detected. Please configure one of: ANTHROPIC_API_KEY, OPENAI_API_KEY, GOOGLE_API_KEY, or OPENROUTER_API_KEY in your .env file."
      );
    }
  }

  public getActiveTools(): OpenAI.ChatCompletionTool[] {
    if (this.mcpClient) {
      return this.mcpClient.toLLMTools();
    }
    return agentTools;
  }

  public getConfig(): LLMConfig {
    return this.config;
  }

  public async chat(userPrompt: string): Promise<string> {
    switch (this.config.provider) {
      case "openai":
      case "openrouter":
        return this.chatOpenAI(userPrompt);
      case "google":
        return this.chatGemini(userPrompt);
      case "anthropic":
        return this.chatAnthropic(userPrompt);
      default:
        throw new Error(`Unsupported provider: ${this.config.provider}`);
    }
  }

  /**
   * Resilient execution engine: automatically retries on 429 rate limits,
   * temporary upstream server congestion, and transient network errors.
   */
  private async executeWithRetry<T>(
    action: () => Promise<T>,
    retries = 3,
    delayMs = 2000
  ): Promise<T> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await action();
      } catch (err: any) {
        const isTransient =
          err?.status === 429 ||
          err?.statusCode === 429 ||
          err?.status === 500 ||
          err?.status === 502 ||
          err?.status === 503 ||
          err?.status === 504 ||
          err?.message?.includes("429") ||
          err?.message?.includes("rate-limit") ||
          err?.message?.includes("rate limit") ||
          err?.message?.includes("Provider returned error") ||
          err?.message?.includes("temporarily") ||
          err?.message?.includes("overloaded") ||
          err?.message?.includes("Connection error") ||
          err?.message?.includes("ECONNRESET") ||
          err?.message?.includes("ETIMEDOUT") ||
          err?.message?.includes("fetch failed") ||
          err?.message?.includes("socket hang up") ||
          err?.message?.includes("timeout");

        if (isTransient && attempt < retries) {
          const waitSec = (delayMs * attempt) / 1000;
          console.log(
            chalk.yellow(
              `\n[Resilience Engine] Network or upstream provider hiccup (${err?.message?.slice(0, 60) || "Connection error"}). Auto-retrying attempt ${attempt + 1}/${retries} in ${waitSec}s...`
            )
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Execution failed after ${retries} attempts`);
  }

  private async chatOpenAI(userPrompt: string): Promise<string> {
    if (!this.openaiClient) throw new Error("OpenAI client uninitialized");
    this.conversationHistory.push({ role: "user", content: userPrompt });

    const tools = this.getActiveTools();

    let completion = await this.executeWithRetry(() =>
      this.openaiClient!.chat.completions.create({
        model: this.config.modelName,
        messages: this.conversationHistory,
        tools,
      })
    );

    if (!completion.choices || completion.choices.length === 0) {
      throw new Error("No response choices returned by LLM provider.");
    }

    let assistantMessage = completion.choices[0].message;

    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      this.conversationHistory.push(assistantMessage);

      for (const toolCall of assistantMessage.tool_calls) {
        if (toolCall.type !== "function") continue;
        const fnName = toolCall.function.name;
        const fnArgs = JSON.parse(toolCall.function.arguments || "{}");

        console.log(chalk.cyan(`[Binance Agent Tool] Invoking ${chalk.bold(fnName)} with ${JSON.stringify(fnArgs)}`));
        const toolResult = this.mcpClient
          ? await this.mcpClient.executeTool(fnName, fnArgs, this.riskGuard)
          : await executeAgentTool(fnName, fnArgs, this.riskGuard);

        this.conversationHistory.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      completion = await this.executeWithRetry(() =>
        this.openaiClient!.chat.completions.create({
          model: this.config.modelName,
          messages: this.conversationHistory,
          tools,
        })
      );

      if (!completion.choices || completion.choices.length === 0) {
        throw new Error("No response choices returned by LLM provider after tool execution.");
      }

      assistantMessage = completion.choices[0].message;
    }

    if (assistantMessage?.content) {
      this.conversationHistory.push(assistantMessage);
      return assistantMessage.content;
    }
    return "";
  }

  private async chatGemini(userPrompt: string): Promise<string> {
    if (!this.geminiChat) throw new Error("Gemini chat uninitialized");

    let response = await this.geminiChat.sendMessage(userPrompt);
    let calls = response.response.functionCalls();

    while (calls && calls.length > 0) {
      const functionResponses: any[] = [];

      for (const call of calls) {
        console.log(chalk.cyan(`[Binance Agent Tool] Invoking ${chalk.bold(call.name)} with ${JSON.stringify(call.args)}`));
        const toolResult = this.mcpClient
          ? await this.mcpClient.executeTool(call.name, call.args, this.riskGuard)
          : await executeAgentTool(call.name, call.args, this.riskGuard);

        functionResponses.push({
          functionResponse: {
            name: call.name,
            response: { result: toolResult },
          },
        });
      }

      response = await this.geminiChat.sendMessage(functionResponses);
      calls = response.response.functionCalls();
    }

    return response.response.text();
  }

  private async chatAnthropic(userPrompt: string): Promise<string> {
    if (!this.anthropicClient) throw new Error("Anthropic client uninitialized");
    this.anthropicMessages.push({ role: "user", content: userPrompt });

    const anthropicTools: Anthropic.Tool[] = this.getActiveTools().map((t: any) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));

    let response = await this.anthropicClient.messages.create({
      model: this.config.modelName,
      max_tokens: 4096,
      system: this.systemPrompt,
      messages: this.anthropicMessages,
      tools: anthropicTools,
    });

    while (response.stop_reason === "tool_use") {
      const toolUseBlocks = response.content.filter((b) => b.type === "tool_use") as Anthropic.ToolUseBlock[];

      this.anthropicMessages.push({
        role: "assistant",
        content: response.content,
      });

      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const toolUse of toolUseBlocks) {
        console.log(chalk.cyan(`[Binance Agent Tool] Invoking ${chalk.bold(toolUse.name)} with ${JSON.stringify(toolUse.input)}`));
        const toolOutput = this.mcpClient
          ? await this.mcpClient.executeTool(toolUse.name, toolUse.input, this.riskGuard)
          : await executeAgentTool(toolUse.name, toolUse.input, this.riskGuard);

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolUse.id,
          content: JSON.stringify(toolOutput),
        });
      }

      this.anthropicMessages.push({
        role: "user",
        content: toolResults,
      });

      response = await this.anthropicClient.messages.create({
        model: this.config.modelName,
        max_tokens: 4096,
        system: this.systemPrompt,
        messages: this.anthropicMessages,
        tools: anthropicTools,
      });
    }

    const finalTexts = response.content.filter((b) => b.type === "text") as Anthropic.TextBlock[];
    const resultText = finalTexts.map((t) => t.text).join("\n");
    this.anthropicMessages.push({ role: "assistant", content: resultText });
    return resultText;
  }
}
