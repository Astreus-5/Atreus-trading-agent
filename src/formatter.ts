import chalk from "chalk";

/**
 * Formats Markdown text into clean, styled terminal output using Chalk ANSI colors.
 * Eliminates raw markdown artifacts and renders rich tables, key-value highlights, and cards.
 */
export function formatTerminalResponse(markdown: string): string {
  if (!markdown) return "";

  const rawLines = markdown.split("\n");
  const formattedLines: string[] = [];
  let inCodeBlock = false;
  let tableBuffer: string[] = [];

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      formattedLines.push(renderMarkdownTable(tableBuffer));
      tableBuffer = [];
    }
  };

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];

    // Detect Markdown Table row
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      tableBuffer.push(line);
      continue;
    } else {
      flushTable();
    }

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
      formattedLines.push("\n" + chalk.bold.bgCyan.black(` ${title} `));
      continue;
    }

    if (/^##\s+(.+)$/.test(line)) {
      const title = line.replace(/^##\s+/, "").trim();
      formattedLines.push("\n" + chalk.bold.yellow("■ " + formatInline(title)));
      continue;
    }

    if (/^###\s+(.+)$/.test(line)) {
      const title = line.replace(/^###\s+/, "").trim();
      formattedLines.push("\n" + chalk.bold.cyan("  ▸ " + formatInline(title)));
      continue;
    }

    // Alerts and Callouts (> [!WARNING], > [!NOTE], etc.)
    if (/^>\s*\[!(WARNING|CAUTION|ERROR)\]/i.test(line)) {
      formattedLines.push("\n  " + chalk.bold.bgRed.white(" ⚠️ ACTION REQUIRED "));
      continue;
    }
    if (/^>\s*\[!(NOTE|TIP|IMPORTANT)\]/i.test(line)) {
      formattedLines.push("\n  " + chalk.bold.bgCyan.black(" ℹ SYSTEM NOTICE "));
      continue;
    }

    if (line.trim().startsWith(">") || /^\s*\(?(Note|Warning|Important|Advisory):/i.test(line)) {
      const cleanNote = line.replace(/^>\s*/, "").trim();
      const isAlert = /warning|caution|error|danger|rejected|failed|invalid/i.test(cleanNote);
      const barColor = isAlert ? chalk.bold.red("│ ") : chalk.bold.yellow("│ ");
      const textColor = isAlert ? chalk.bold.redBright(formatInline(cleanNote)) : chalk.yellow(formatInline(cleanNote));
      formattedLines.push("  " + barColor + textColor);
      continue;
    }

    // Nested bullet points (indented by 2+ spaces)
    if (/^\s{2,}[-*]\s+(.+)$/.test(line)) {
      const match = line.match(/^\s+/);
      const indent = match ? match[0] : "  ";
      const content = line.replace(/^\s*[-*]\s+/, "");
      formattedLines.push(indent + chalk.cyan("•") + " " + formatKeyValue(content));
      continue;
    }

    // Top-level bullet points: "- " or "* "
    if (/^\s*[-*]\s+(.+)$/.test(line)) {
      const content = line.replace(/^\s*[-*]\s+/, "");
      formattedLines.push("  " + chalk.cyan("•") + " " + formatKeyValue(content));
      continue;
    }

    // Numbered lists: "1. "
    if (/^\s*\d+\.\s+(.+)$/.test(line)) {
      const match = line.match(/^(\s*\d+\.)\s+(.+)$/);
      if (match) {
        formattedLines.push("  " + chalk.yellow(match[1]) + " " + formatKeyValue(match[2]));
        continue;
      }
    }

    // Standard paragraph text
    formattedLines.push(formatInline(line));
  }

  flushTable();
  return formattedLines.join("\n");
}

/**
 * Highlights key-value patterns (e.g. "Free: 7.92640413", "Status: SUCCESS")
 */
function formatKeyValue(text: string): string {
  // Strip outer bold markers from keys like **Spot Wallet: ** or **USDT: **
  const cleaned = text.replace(/\*\*/g, "").replace(/__/g, "").trim();
  const kvMatch = cleaned.match(/^([^:]+):\s*(.*)$/);
  if (kvMatch) {
    const key = kvMatch[1].trim();
    const val = kvMatch[2].trim();
    if (!val) {
      return chalk.bold.cyan(key + ":");
    }
    return chalk.bold.white(key + ": ") + colorizeValue(formatInline(val));
  }
  return formatInline(text);
}

/**
 * Colorizes numbers, statuses, and currency tags for enhanced UI beauty.
 */
function colorizeValue(val: string): string {
  // Status badges
  if (/^(SUCCESS|FILLED|NEW|COMPLETED|CONFIRMED|BUY|LONG)/i.test(val)) {
    return chalk.bold.green(val);
  }
  if (/^(REJECTED|FAILED|CANCELLED|CANCEL|SELL|SHORT|AUTHENTICATION_FAILED|UNAUTHORIZED|ERROR)/i.test(val)) {
    return chalk.bold.redBright(val);
  }
  if (/^(PENDING|WAITING|NEUTRAL)/i.test(val)) {
    return chalk.bold.yellow(val);
  }

  // Dim helper words like "(available)"
  let formatted = val.replace(/\((available|locked|free|total)\)/gi, (_, word) => chalk.dim(`(${word})`));

  // Currency & numbers highlight: e.g. 7.9264 USDT -> green amount, cyan currency
  formatted = formatted.replace(/\b(\d+(?:\.\d+)?)\s*(USDT|BNB|BTC|ETH|SOL|USD)?\b/gi, (match, amt, cur) => {
    if (cur) {
      return chalk.bold.green(amt) + " " + chalk.cyan(cur.toUpperCase());
    }
    return chalk.bold.green(amt);
  });

  return formatted;
}

/**
 * Renders a Markdown table into a clean unicode boxed table.
 */
function renderMarkdownTable(lines: string[]): string {
  if (lines.length < 2) return lines.join("\n");

  const rows = lines
    .map((l) =>
      l
        .split("|")
        .slice(1, -1)
        .map((c) => c.trim())
    )
    .filter((r) => r.length > 0);

  // Filter out divider row (e.g. |---|---|)
  const contentRows = rows.filter((r) => !r.every((c) => /^[-:]+$/.test(c)));
  if (contentRows.length === 0) return "";

  const colCount = Math.max(...contentRows.map((r) => r.length));
  const colWidths: number[] = Array(colCount).fill(0);

  for (const r of contentRows) {
    for (let c = 0; c < colCount; c++) {
      const len = (r[c] ?? "").length;
      if (len > colWidths[c]) colWidths[c] = len;
    }
  }

  const pad = (s: string, w: number) => s + " ".repeat(Math.max(0, w - s.length));

  const topBorder = "  ┌" + colWidths.map((w) => "─".repeat(w + 2)).join("┬") + "┐";
  const midBorder = "  ├" + colWidths.map((w) => "─".repeat(w + 2)).join("┼") + "┤";
  const botBorder = "  └" + colWidths.map((w) => "─".repeat(w + 2)).join("┴") + "┘";

  const out: string[] = [];
  out.push(chalk.cyan(topBorder));

  // Header row
  const header = contentRows[0];
  const headerStr =
    "  │ " +
    header.map((h, i) => chalk.bold.white(pad(h, colWidths[i]))).join(chalk.cyan(" │ ")) +
    chalk.cyan(" │");
  out.push(headerStr);
  out.push(chalk.cyan(midBorder));

  // Data rows
  for (let r = 1; r < contentRows.length; r++) {
    const row = contentRows[r];
    const rowStr =
      "  │ " +
      row.map((cell, i) => colorizeValue(pad(cell, colWidths[i]))).join(chalk.cyan(" │ ")) +
      chalk.cyan(" │");
    out.push(rowStr);
  }

  out.push(chalk.cyan(botBorder));
  return out.join("\n");
}

function formatInline(text: string): string {
  if (!text) return "";

  let result = text;

  // Inline code: `code`
  result = result.replace(/`([^`]+)`/g, (_, code) => chalk.cyan(code));

  // Bold text: **bold** or __bold__
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, bold) => chalk.bold(bold));
  result = result.replace(/__([^_]+)__/g, (_, bold) => chalk.bold(bold));
  result = result.replace(/\*\*/g, "").replace(/__/g, "");

  // Italic text: *italic* or _italic_
  result = result.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, "$1" + chalk.dim("$2") + "$3");

  // Markdown links: [title](url) -> title (url)
  result = result.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_, title, url) => chalk.underline(title) + " " + chalk.dim("(" + url + ")")
  );

  return result;
}
