import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const STYLES_DIR = join(ROOT, "src", "styles");
const SRC_DIR = join(ROOT, "src");

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

const styleFiles = walk(STYLES_DIR).filter((file) => file.endsWith(".scss"));
const sourceFiles = walk(SRC_DIR).filter((file) => /\.(tsx?|jsx?)$/.test(file));

const styles = styleFiles
  .map((file) =>
    readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/@include[^;]+;/g, ""),
  )
  .join("\n");
const componentStyles = styleFiles
  .filter((file) => !file.endsWith("_tokens.scss"))
  .map((file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, ""))
  .join("\n");
const source = sourceFiles.map((file) => readFileSync(file, "utf8")).join("\n");

const classes = new Set();
for (const match of styles.matchAll(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g)) classes.add(match[1]);

const DYNAMIC = new Set([
  "is-on",
  "is-active",
  "is-current",
  "is-selected",
  "is-running",
  "toast-info",
  "toast-success",
  "toast-error",
  "align-guide-vertical",
  "align-guide-horizontal",
]);

const unused = [...classes]
  .filter(
    (name) =>
      !source.includes(name) &&
      !DYNAMIC.has(name) &&
      !name.startsWith("react-flow__") &&
      !name.startsWith("btn--") &&
      name !== "selectable",
  )
  .sort();

const duplicated = [];
const stack = [];
let buffer = "";
for (let index = 0; index < styles.length; index += 1) {
  const char = styles[index];
  if (char === "{") {
    const selector = buffer.trim().replace(/\s+/g, " ");
    if (stack.length === 0 && selector && !selector.startsWith("@")) duplicated.push(selector);
    stack.push(char);
    buffer = "";
  } else if (char === "}") {
    stack.pop();
    buffer = "";
  } else {
    buffer += char;
  }
}
const duplicateCounts = new Map();
for (const selector of duplicated) {
  duplicateCounts.set(selector, (duplicateCounts.get(selector) ?? 0) + 1);
}
const duplicateSelectors = [...duplicateCounts]
  .filter(([, count]) => count > 1)
  .sort((a, b) => b[1] - a[1]);

const hexColors = new Map();
for (const match of componentStyles.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
  hexColors.set(match[0], (hexColors.get(match[0]) ?? 0) + 1);
}
const fontSizes = new Set();
for (const match of styles.matchAll(/font-size:\s*([^;]+);/g)) fontSizes.add(match[1].trim());
const rawZIndex = [...styles.matchAll(/z-index:\s*(\d+)/g)].map((match) => match[1]);
const report = {
  files: styleFiles.map((file) => relative(ROOT, file)),
  classes: classes.size,
  unusedClasses: unused,
  duplicateSelectors,
  hardcodedColors: [...hexColors].sort((a, b) => b[1] - a[1]).slice(0, 10),
  fontSizes: [...fontSizes],
  rawZIndex,
};

console.log(JSON.stringify(report, null, 2));
