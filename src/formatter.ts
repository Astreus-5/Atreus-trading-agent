import chalk from "chalk";

/**
 * Formats Markdown text into clean, styled terminal output using Chalk ANSI colors.
 * Eliminates raw "#" headers, "**" bold tags, and "*" bullets for a polished CLI interface.
 */
export function formatTerminalResponse(markdown: string): string {
  if (!markdown) return "";

  const lines = markdown.split("\n");
  const formattedLines: string[] = [];
  let inCodeBlock = false;

  for (let line of lines) {
    // Code block toggle
    if (line.trim().startsWith("```")) {
      inCodeBlock = !inCodeBlock;
      formattedLines.push(chalk.dim("  ──────────────────────────────────────────"));
      continue;
    }

    if (inCodeBlock) {
      formattedLines.push(chalk.green("    " + line));
      continue;
    }

    // Horizontal Rule
    if (/^(\s*[-*_]){3,}\s*$/.test(line)) {
      formattedLines.push(chalk.dim("  ──────────────────────────────────────────"));
      continue;
    }

    // Headers
    if (/^#\s+(.+)$/.test(line)) {
      const title = line.replace(/^#\s+/, "").trim();
      formattedLines.push("\n" + chalk.bold.cyanBright("=== " + formatInline(title) + " ==="));
      continue;
    }

    if (/^##\s+(.+)$/.test(line)) {
      const title = line.replace(/^##\s+/, "").trim();
      formattedLines.push("\n" + chalk.bold.yellow("■ " + formatInline(title)));
      continue;
    }

    if (/^###\s+(.+)$/.test(line)) {
      const title = line.replace(/^###\s+/, "").trim();
      formattedLines.push("\n" + chalk.bold.white("  ▸ " + formatInline(title)));
      continue;
    }

    // Bullet points: convert "- " or "* " to clean bullet "  • "
    if (/^\s*[-*]\s+(.+)$/.test(line)) {
      const content = line.replace(/^\s*[-*]\s+/, "");
      formattedLines.push("  " + chalk.cyan("•") + " " + formatInline(content));
      continue;
    }

    // Numbered lists: "1. "
    if (/^\s*\d+\.\s+(.+)$/.test(line)) {
      const match = line.match(/^(\s*\d+\.)\s+(.+)$/);
      if (match) {
        formattedLines.push("  " + chalk.yellow(match[1]) + " " + formatInline(match[2]));
        continue;
      }
    }

    // Standard paragraph text
    formattedLines.push(formatInline(line));
  }

  return formattedLines.join("\n");
}

function formatInline(text: string): string {
  if (!text) return "";

  let result = text;

  // Inline code: `code`
  result = result.replace(/`([^`]+)`/g, (_, code) => chalk.cyan(code));

  // Bold text: **bold** or __bold__
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, bold) => chalk.bold(bold));
  result = result.replace(/__([^_]+)__/g, (_, bold) => chalk.bold(bold));

  // Italic text: *italic* or _italic_
  result = result.replace(/(^|[^\*])\*([^\*]+)\*([^\*]|$)/g, "$1" + chalk.dim("$2") + "$3");

  // Markdown links: [title](url) -> title (url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, title, url) => chalk.underline(title) + " " + chalk.dim("(" + url + ")"));

  return result;
}
