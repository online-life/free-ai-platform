import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

function stripFencedCode(source) {
  let fence;
  return source.split("\n").map((line) => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (!fence && marker) {
      fence = { character: marker[1][0], length: marker[1].length };
      return "";
    }
    if (fence) {
      if (marker && marker[1][0] === fence.character && marker[1].length >= fence.length) {
        fence = undefined;
      }
      return "";
    }
    return line;
  }).join("\n");
}

function slugifyHeading(heading) {
  return heading
    .replace(/<[^>]*>/g, "")
    .replace(/[`*_~]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

function collectHeadingSlugs(markdown) {
  const slugs = new Set();
  const counts = new Map();
  for (const line of stripFencedCode(markdown).split("\n")) {
    const heading = line.match(/^ {0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!heading) continue;
    const base = slugifyHeading(heading[1]);
    if (!base) continue;
    const count = counts.get(base) ?? 0;
    const slug = count === 0 ? base : `${base}-${count}`;
    counts.set(base, count + 1);
    slugs.add(slug);
  }
  return slugs;
}

function resolveMarkdownTarget(root, sourcePath, destination) {
  const hashIndex = destination.indexOf("#");
  const rawHash = hashIndex < 0 ? "" : destination.slice(hashIndex + 1);
  const rawPath = (hashIndex < 0 ? destination : destination.slice(0, hashIndex)).split("?")[0];
  let decodedPath;
  let hash;
  try {
    decodedPath = decodeURIComponent(rawPath);
    hash = decodeURIComponent(rawHash);
  } catch {
    return { invalidEncoding: true };
  }
  const targetPath = decodedPath
    ? path.resolve(path.dirname(sourcePath), decodedPath)
    : sourcePath;
  let resolvedPath = targetPath;
  if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
    const readme = path.join(resolvedPath, "README.md");
    const index = path.join(resolvedPath, "index.md");
    resolvedPath = existsSync(readme) ? readme : index;
  }
  return {
    hash,
    path: resolvedPath,
    relativePath: path.relative(root, resolvedPath).split(path.sep).join("/"),
  };
}

function extractMarkdownLinks(markdown) {
  const source = stripFencedCode(markdown);
  const links = [];
  const pattern = /!?\[[^\]]*\]\(\s*(<[^>]*>|[^)\s]+)(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
  for (const match of source.matchAll(pattern)) {
    const destination = match[1].startsWith("<")
      ? match[1].slice(1, -1)
      : match[1];
    links.push({
      destination,
      line: source.slice(0, match.index).split("\n").length,
      index: match.index,
    });
  }
  const htmlPattern = /<(a|img)\b[^>]*?\b(href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi;
  for (const match of source.matchAll(htmlPattern)) {
    const tag = match[1].toLowerCase();
    const attribute = match[2].toLowerCase();
    if ((tag === "a" && attribute !== "href") || (tag === "img" && attribute !== "src")) continue;
    links.push({
      destination: match[3] ?? match[4] ?? match[5],
      line: source.slice(0, match.index).split("\n").length,
      index: match.index,
    });
  }
  return links.sort((left, right) => left.index - right.index);
}

export function checkMarkdownFiles(files, root = process.cwd()) {
  const absoluteRoot = path.resolve(root);
  const diagnostics = [];
  const externalLinks = [];

  for (const file of files) {
    const sourcePath = path.resolve(absoluteRoot, file);
    const relativeSourcePath = path.relative(absoluteRoot, sourcePath).split(path.sep).join("/");
    if (!existsSync(sourcePath) || !statSync(sourcePath).isFile()) {
      diagnostics.push({
        path: relativeSourcePath,
        line: 1,
        kind: "missing-source",
        target: relativeSourcePath,
      });
      continue;
    }

    const markdown = readFileSync(sourcePath, "utf8");
    for (const { destination, line } of extractMarkdownLinks(markdown)) {
      if (/^https?:\/\//i.test(destination) || destination.startsWith("//")) {
        externalLinks.push({ path: relativeSourcePath, line, url: destination });
        continue;
      }
      if (/^[a-z][a-z\d+.-]*:/i.test(destination)) continue;

      const target = resolveMarkdownTarget(absoluteRoot, sourcePath, destination);
      if (target.invalidEncoding) {
        diagnostics.push({
          path: relativeSourcePath,
          line,
          kind: "invalid-encoding",
          target: destination,
        });
        continue;
      }
      if (!existsSync(target.path) || !statSync(target.path).isFile()) {
        const targetPath = destination.split("#")[0].split("?")[0];
        diagnostics.push({
          path: relativeSourcePath,
          line,
          kind: "missing-file",
          target: targetPath || relativeSourcePath,
        });
        continue;
      }
      if (!target.hash || !/\.md$/i.test(target.path)) continue;

      const headings = collectHeadingSlugs(readFileSync(target.path, "utf8"));
      if (!headings.has(target.hash)) {
        diagnostics.push({
          path: relativeSourcePath,
          line,
          kind: "missing-anchor",
          target: `${target.relativePath}#${target.hash}`,
        });
      }
    }
  }

  return { diagnostics, externalLinks };
}

function main() {
  const files = process.argv.slice(2);
  if (files.length === 0) {
    console.error("Usage: node scripts/check-public-doc-links.mjs <markdown-file> [...]");
    process.exitCode = 2;
    return;
  }

  const { diagnostics, externalLinks } = checkMarkdownFiles(files);
  if (diagnostics.length > 0) {
    for (const diagnostic of diagnostics) {
      console.error(
        `${diagnostic.path}:${diagnostic.line}: ${diagnostic.kind}: ${diagnostic.target}`,
      );
    }
  } else {
    console.log("All local documentation links and image references resolve.");
  }
  if (externalLinks.length > 0) {
    console.log("External URLs requiring separate live verification:");
    for (const link of externalLinks) {
      console.log(`${link.path}:${link.line}: ${link.url}`);
    }
  }
  if (diagnostics.length > 0) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
