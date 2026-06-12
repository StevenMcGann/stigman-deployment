// Generates docs/deployment-guide.md from build-install-guide.js.
// Runs the guide builder with a mocked "docx" module and renders the captured
// document tree as GitHub-flavored markdown, so the .docx and .md versions
// always come from the same source. Usage: node build-markdown-guide.js
const fs = require("fs");
const path = require("path");

// ── Mock docx classes (capture constructor args only) ──
class TextRun { constructor(o) { this.o = typeof o === "string" ? { text: o } : (o || {}); } }
class Paragraph { constructor(o) { this.o = typeof o === "string" ? { children: [new TextRun(o)] } : (o || {}); } }
class PageBreak {}
class TableOfContents {}
class Table { constructor(o) { this.o = o || {}; } }
class TableRow { constructor(o) { this.o = o || {}; } }
class TableCell { constructor(o) { this.o = o || {}; } }
class Header {} class Footer {}
class ExternalHyperlink { constructor(o) { this.o = o || {}; } }
class Document { constructor(o) { this.o = o || {}; } }

let captured = null;
const Packer = { toBuffer(doc) { captured = doc; return new Promise(() => {}); } };

const mock = {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, ExternalHyperlink, PageBreak, TableOfContents,
  HeadingLevel: { HEADING_1: "h1", HEADING_2: "h2", HEADING_3: "h3" },
  AlignmentType: { LEFT: "left", CENTER: "center", RIGHT: "right" },
  LevelFormat: { BULLET: "bullet", DECIMAL: "decimal" },
  BorderStyle: { SINGLE: "single" },
  WidthType: { DXA: "dxa" },
  ShadingType: { CLEAR: "clear" },
  PageNumber: { CURRENT: "PAGE", TOTAL_PAGES: "PAGES" },
};

require.cache[require.resolve("docx")] = { exports: mock };
require("./build-install-guide.js");
if (!captured) { console.error("Builder did not call Packer.toBuffer"); process.exit(1); }

// ── Inline run rendering ──
function escapeText(t) { return t.replace(/\*/g, "\\*").replace(/</g, "\\<"); }
function renderRuns(runs) {
  let out = "";
  for (const r of runs || []) {
    if (r instanceof PageBreak) continue;
    if (r instanceof ExternalHyperlink) { out += `[${renderRuns(r.o.children)}](${r.o.link})`; continue; }
    const o = r.o || {};
    let t = o.text != null ? String(o.text) : "";
    if (!t) continue;
    if (o.font === "Consolas") { out += "`" + t + "`"; continue; }
    t = escapeText(t);
    if (o.bold && o.italics) t = `***${t.trim()}***` + (/\s$/.test(o.text) ? " " : "");
    else if (o.bold) t = t.replace(/^(\s*)(.*?)(\s*)$/s, "$1**$2**$3");
    else if (o.italics) t = t.replace(/^(\s*)(.*?)(\s*)$/s, "$1*$2*$3");
    out += t;
  }
  return out;
}
function plainText(runs) {
  return (runs || []).map(r => (r instanceof ExternalHyperlink) ? plainText(r.o.children) : (r.o && r.o.text) || "").join("");
}

// ── GitHub-style anchor slugs ──
const slugCounts = new Map();
function slug(text) {
  let s = text.toLowerCase().replace(/[^\w\- ]/g, "").replace(/ +/g, "-");
  const n = slugCounts.get(s) || 0;
  slugCounts.set(s, n + 1);
  return n === 0 ? s : `${s}-${n}`;
}

// ── Walk the document ──
const children = captured.o.sections[0].children;
const blocks = [];          // rendered markdown blocks
const headings = [];        // { level, text, anchor } for TOC
let tocIndex = -1;          // where to insert the generated TOC
let titleParas = [];        // centered paragraphs before the first heading
let sawHeading = false;
let codeBuf = [];
const listCounters = new Map(); // numbering reference -> last emitted number

function flushCode() {
  if (codeBuf.length) { blocks.push("```\n" + codeBuf.join("\n") + "\n```"); codeBuf = []; }
}
function endList() {}

for (const el of children) {
  if (el instanceof TableOfContents) { flushCode(); endList(); tocIndex = blocks.length; blocks.push(""); continue; }
  if (el instanceof Table) {
    flushCode(); endList();
    const rows = el.o.rows.map(row => row.o.children.map(cell => {
      const para = cell.o.children[0];
      const runs = para && para.o.children || [];
      const o = runs[0] && runs[0].o || {};
      let t = (o.text || "").replace(/\|/g, "\\|");
      if (o.font === "Consolas") t = t.trim() ? "`" + t + "`" : "";
      return t;
    }));
    const width = rows[0].length;
    const md = ["| " + rows[0].join(" | ") + " |", "|" + Array(width).fill("----").join("|") + "|"]
      .concat(rows.slice(1).map(r => "| " + r.join(" | ") + " |")).join("\n");
    blocks.push(md);
    continue;
  }
  if (!(el instanceof Paragraph)) continue;
  const o = el.o;
  const runs = o.children || [];

  // page break / blank
  if (runs.some(r => r instanceof PageBreak)) { flushCode(); endList(); continue; }
  if (!runs.length || !plainText(runs).trim()) { flushCode(); endList(); continue; }

  // headings
  if (o.heading) {
    flushCode(); endList();
    sawHeading = true;
    const text = plainText(runs);
    if (text === "Table of Contents") continue; // replaced by generated TOC
    const level = o.heading === "h1" ? 2 : 3;
    headings.push({ level, text, anchor: slug(text) });
    blocks.push("#".repeat(level) + " " + text);
    continue;
  }

  // title page (centered paragraphs before any heading)
  if (!sawHeading && o.alignment === "center") { titleParas.push(plainText(runs)); continue; }

  // code block lines (gray shading + Consolas)
  if (o.shading && o.shading.fill === "F5F5F5") { endList(); codeBuf.push(plainText(runs)); continue; }
  flushCode();

  // Important callout (red-tinted shading)
  if (o.shading && o.shading.fill === "FFF2F2") {
    endList();
    blocks.push("> **Important:** " + escapeText(plainText(runs).replace(/^Important:\s*/, "")));
    continue;
  }
  // Note callout (indented italic paragraph starting "Note: ")
  if (plainText(runs).startsWith("Note: ")) {
    endList();
    blocks.push("> **Note:** " + escapeText(plainText(runs).replace(/^Note:\s*/, "")));
    continue;
  }

  // list items
  if (o.numbering) {
    const ref = o.numbering.reference, lvl = o.numbering.level || 0;
    const indent = "  ".repeat(lvl);
    let line;
    if (ref === "bullets") line = indent + "- " + renderRuns(runs);
    else if (ref === "checklist") line = "- [ ] " + renderRuns(runs);
    else {
      const n = (listCounters.get(ref) || 0) + 1;
      listCounters.set(ref, n);
      line = indent + n + ". " + renderRuns(runs);
    }
    // append to previous block if it is the same list, else start new block
    const prev = blocks[blocks.length - 1];
    if (prev !== undefined && /^(\s*(-|\d+\.|\- \[ \]) )/.test(prev) && prevList === ref) blocks[blocks.length - 1] += "\n" + line;
    else blocks.push(line);
    prevList = ref;
    continue;
  }
  endList();

  // Part II divider (centered, bordered)
  if (o.alignment === "center" && o.border) { blocks.push("---\n\n## " + plainText(runs)); continue; }
  if (o.alignment === "center") { blocks.push("*" + escapeText(plainText(runs)) + "*"); continue; }

  blocks.push(renderRuns(runs));
}
var prevList = null;
flushCode();

// ── Title block ──
const titleMd = [];
if (titleParas.length >= 2) titleMd.push("# " + titleParas[0] + " — " + titleParas[1]);
else if (titleParas.length) titleMd.push("# " + titleParas[0]);
for (const t of titleParas.slice(2)) titleMd.push("*" + t + "*  ");

// ── Generated TOC ──
const tocMd = ["## Table of Contents", ""].concat(headings.map(h =>
  (h.level === 2 ? "- " : "  - ") + `[${h.text}](#${h.anchor})`)).join("\n");
if (tocIndex >= 0) blocks[tocIndex] = tocMd;

const banner = "<!-- Generated from build-install-guide.js — do not edit directly." +
  " Regenerate with: node build-markdown-guide.js -->";
const out = [banner, ...titleMd, ...blocks].join("\n\n").replace(/\n{3,}/g, "\n\n") + "\n";

const outPath = path.join(__dirname, "docs", "deployment-guide.md");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, out);
console.log("Created: " + outPath + " (" + out.length + " chars, " + headings.length + " headings)");
