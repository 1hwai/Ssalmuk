import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import JavaScriptObfuscator from "javascript-obfuscator";

const root = process.cwd();
const output = path.join(root, "dist");
const excludedDirectories = new Set([
  ".git",
  ".agents",
  "Docs",
  "dist",
  "node_modules",
  "scripts"
]);
const excludedFiles = new Set([
  ".gitignore",
  "package.json",
  "package-lock.json",
  "README.md",
  "LICENSE.md"
]);

async function copySite(source, destination, relative = "") {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });

  for (const entry of entries) {
    const childRelative = path.posix.join(relative.split(path.sep).join("/"), entry.name);
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);

    if (entry.isDirectory()) {
      if (excludedDirectories.has(entry.name)) continue;
      await copySite(sourcePath, destinationPath, childRelative);
      continue;
    }

    if (!entry.isFile() || excludedFiles.has(entry.name) || entry.name.endsWith(".md")) continue;
    await cp(sourcePath, destinationPath);
  }
}

const obfuscatedFiles = [
  "game.js",
  "baduk/game.js",
  "baduk/engine.js"
];

await rm(output, { recursive: true, force: true });
await copySite(root, output);

const options = {
  target: "browser",
  compact: true,
  simplify: true,
  identifierNamesGenerator: "hexadecimal",
  renameGlobals: false,
  renameProperties: false,
  stringArray: true,
  stringArrayThreshold: 0.5,
  stringArrayEncoding: ["base64"],
  rotateStringArray: true,
  shuffleStringArray: true,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  sourceMap: false,
  numbersToExpressions: false,
  unicodeEscapeSequence: false
};

for (const relativePath of obfuscatedFiles) {
  const sourcePath = path.join(root, relativePath);
  const outputPath = path.join(output, relativePath);

  try {
    await stat(sourcePath);
  } catch {
    throw new Error(`Required source file is missing: ${relativePath}`);
  }

  const source = await readFile(sourcePath, "utf8");
  const result = JavaScriptObfuscator.obfuscate(source, options);
  await writeFile(outputPath, result.getObfuscatedCode(), "utf8");
  console.log(`Obfuscated: ${relativePath}`);
}

console.log(`Build complete: ${path.relative(root, output)}`);
