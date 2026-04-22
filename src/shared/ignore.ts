import { readFile } from "node:fs/promises";
import path from "node:path";

import { normalizeRepoRelativePath } from "./paths.js";

const DEFAULT_IGNORE_RULES = [
  ".git/",
  "node_modules/",
  ".next/",
  ".output/",
  "dist/",
  "coverage/",
  "work/",
  "work/runs/",
] as const;

type Rule = {
  readonly source: string;
  readonly negated: boolean;
  readonly directoryOnly: boolean;
  readonly basenameOnly: boolean;
  readonly anchoredToRoot: boolean;
  readonly matcher: RegExp;
};

export type IgnoreMatcher = {
  readonly rules: readonly string[];
  isIgnored(repoRelativePath: string, isDirectory: boolean): boolean;
};

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/gu, "\\$&");
}

function globToRegex(pattern: string, directoryOnly: boolean): RegExp {
  let expression = "";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    const nextCharacter = pattern[index + 1];

    if (character === undefined) {
      continue;
    }

    if (character === "*") {
      if (nextCharacter === "*") {
        expression += ".*";
        index += 1;
      } else {
        expression += "[^/]*";
      }

      continue;
    }

    if (character === "?") {
      expression += "[^/]";
      continue;
    }

    expression += escapeRegex(character);
  }

  const suffix = directoryOnly ? "(?:/.*)?$" : "$";

  return new RegExp(`^${expression}${suffix}`, "u");
}

function parseIgnoreRule(rawRule: string): Rule | null {
  const trimmed = rawRule.trim();

  if (trimmed === "" || trimmed.startsWith("#")) {
    return null;
  }

  const negated = trimmed.startsWith("!");
  const withoutNegation = negated ? trimmed.slice(1) : trimmed;

  if (withoutNegation === "") {
    return null;
  }

  const anchoredToRoot = withoutNegation.startsWith("/");
  const withoutRootAnchor = anchoredToRoot
    ? withoutNegation.slice(1)
    : withoutNegation;

  if (withoutRootAnchor === "") {
    return null;
  }

  const directoryOnly = withoutRootAnchor.endsWith("/");
  const normalizedSource = directoryOnly
    ? withoutRootAnchor.slice(0, -1)
    : withoutRootAnchor;

  const basenameOnly = !normalizedSource.includes("/");
  // Gitignore patterns use backslash for escaping (e.g. \# to match literal #),
  // not as path separators. Don't normalize them through normalizeRepoRelativePath.
  const normalizedPattern = normalizedSource;

  return {
    source: trimmed,
    negated,
    directoryOnly,
    basenameOnly: basenameOnly && !anchoredToRoot,
    anchoredToRoot,
    matcher: globToRegex(normalizedPattern, directoryOnly),
  };
}

function matchRule(rule: Rule, repoRelativePath: string, isDirectory: boolean): boolean {
  if (rule.directoryOnly && !isDirectory && !repoRelativePath.includes("/")) {
    return false;
  }

  if (rule.basenameOnly) {
    const parts = repoRelativePath.split("/");

    return parts.some((part) => rule.matcher.test(part));
  }

  return rule.matcher.test(repoRelativePath);
}

export async function loadIgnoreRules(
  repoRoot: string,
  explicitExcludes: readonly string[] = [],
): Promise<IgnoreMatcher> {
  const sources = [
    ...DEFAULT_IGNORE_RULES,
    ...explicitExcludes,
  ];

  const repoIgnoreFiles = [".gitignore", ".repo-compassignore"];

  for (const filename of repoIgnoreFiles) {
    const filePath = path.join(repoRoot, filename);

    try {
      const content = await readFile(filePath, "utf8");
      sources.push(...content.split(/\r?\n/u));
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;

      if (code !== "ENOENT") {
        throw error;
      }
    }
  }

  const compiledRules = sources
    .map((rule) => parseIgnoreRule(rule))
    .filter((rule): rule is Rule => rule !== null);

  return {
    rules: compiledRules.map((rule) => rule.source),
    isIgnored(repoRelativePath: string, isDirectory: boolean): boolean {
      const normalizedPath = normalizeRepoRelativePath(repoRelativePath);
      let ignored = false;

      for (const rule of compiledRules) {
        if (!matchRule(rule, normalizedPath, isDirectory)) {
          continue;
        }

        ignored = !rule.negated;
      }

      return ignored;
    },
  };
}

export { DEFAULT_IGNORE_RULES };
