import { famousLanguages, type Criteria } from "./analysis";

export type Candidate = {
  username: string;
  source: string;
};

export type ValidationIssue = {
  row?: number;
  field?: string;
  message: string;
  value?: unknown;
};

export type CandidateParseResult = {
  candidates: Candidate[];
  issues: ValidationIssue[];
};

export type ProjectCriteria = Criteria;

export type ProjectCriteriaResult = {
  criteria?: ProjectCriteria;
  issues: ValidationIssue[];
};

const USERNAME_PATTERN = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const USERNAME_HEADERS = new Set([
  "username",
  "githubusername",
  "url",
  "githuburl",
]);
const CRITERIA_NUMBER_FIELDS = [
  "minimumRepositories",
  "minimumStars",
  "recentDays",
] as const;

const LANGUAGE_ALIASES: Record<string, string> = {
  js: "JavaScript",
  ts: "TypeScript",
  py: "Python",
  golang: "Go",
  cpp: "C++",
  cplusplus: "C++",
  csharp: "C#",
  cs: "C#",
  fsharp: "F#",
  sh: "Shell",
  bash: "Shell",
  zsh: "Shell",
  pwsh: "PowerShell",
  ps1: "PowerShell",
  objc: "Objective-C",
  "objective c": "Objective-C",
  objectivec: "Objective-C",
  rb: "Ruby",
  rs: "Rust",
  kt: "Kotlin",
  asm: "Assembly",
};

let famousLanguageMap: Map<string, string> | undefined;

function getFamousLanguageMap(): Map<string, string> {
  if (!famousLanguageMap) {
    famousLanguageMap = new Map<string, string>([
      ...famousLanguages.map((lang) => [lang.toLowerCase(), lang] as const),
      ...Object.entries(LANGUAGE_ALIASES),
    ]);
  }
  return famousLanguageMap;
}

function parseCsvRow(row: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < row.length; index += 1) {
    const character = row[index];

    if (character === '"') {
      if (quoted && row[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value.trim());
      value = "";
    } else {
      value += character;
    }
  }

  if (quoted) {
    throw new Error("Unclosed quoted field");
  }

  values.push(value.trim());
  return values;
}

function extractUsername(value: string): string | undefined {
  const trimmed = value.trim().replace(/^@/, "");
  if (USERNAME_PATTERN.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  try {
    const url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
    if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
      return undefined;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    return segments.length === 1 && USERNAME_PATTERN.test(segments[0])
      ? segments[0].toLowerCase()
      : undefined;
  } catch {
    return undefined;
  }
}

export function validateGitHubUsername(value: unknown): string | undefined {
  return typeof value === "string" ? extractUsername(value) : undefined;
}

export function parseCandidatesCsv(csv: string): CandidateParseResult {
  const candidates: Candidate[] = [];
  const issues: ValidationIssue[] = [];
  const rows = csv.replace(/^\uFEFF/, "").split(/\r?\n/);
  const firstRow = rows.find((row) => row.trim() !== "");
  const firstRowIndex = firstRow === undefined ? -1 : rows.indexOf(firstRow);
  let headers: string[] | undefined;

  if (firstRowIndex >= 0) {
    try {
      const parsedHeaders = parseCsvRow(rows[firstRowIndex] ?? "").map(
        (header) => header.toLowerCase().replace(/[\s_-]/g, ""),
      );
      if (parsedHeaders.some((header) => USERNAME_HEADERS.has(header))) {
        headers = parsedHeaders;
      }
    } catch (error) {
      issues.push({
        row: firstRowIndex + 1,
        message: error instanceof Error ? error.message : "Invalid CSV row",
      });
    }
  }

  rows.forEach((row, index) => {
    if (row.trim() === "" || (headers && index === firstRowIndex)) {
      return;
    }

    let fields: string[];
    try {
      fields = parseCsvRow(row);
    } catch (error) {
      issues.push({
        row: index + 1,
        message: error instanceof Error ? error.message : "Invalid CSV row",
      });
      return;
    }

    const source =
      headers === undefined
        ? (fields[0] ?? "")
        : (fields[
            headers.findIndex((header) => USERNAME_HEADERS.has(header))
          ] ?? "");
    const username = validateGitHubUsername(source);

    if (username === undefined) {
      issues.push({
        row: index + 1,
        field: "username",
        message: "Expected a GitHub username or profile URL",
        value: source,
      });
      return;
    }

    candidates.push({ username, source: source.trim() });
  });

  return { candidates, issues };
}

export function deduplicateCandidates(candidates: Candidate[]): Candidate[] {
  const seen = new Set<string>();

  return candidates.filter((candidate) => {
    const key = candidate.username.toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.trim() !== "")
  );
}

export function validateLanguage(value: unknown): string | undefined {
  if (!isNonEmptyStringArray([value])) {
    return undefined;
  }
  return getFamousLanguageMap().get((value as string).trim().toLowerCase());
}

function validateNonNegativeNumber(
  value: unknown,
  field: string,
  issues: ValidationIssue[],
): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    issues.push({
      field,
      message: "Expected a finite non-negative number",
      value,
    });
    return false;
  }
  return true;
}

export function parseProjectCriteria(input: unknown): ProjectCriteriaResult {
  let value = input;
  if (typeof input === "string") {
    try {
      value = JSON.parse(input) as unknown;
    } catch {
      return {
        issues: [{ message: "Criteria must be a valid JSON object" }],
      };
    }
  }

  if (!isRecord(value)) {
    return { issues: [{ message: "Criteria must be an object" }] };
  }

  const issues: ValidationIssue[] = [];
  const name = value.name;
  if (typeof name !== "string" || name.trim() === "") {
    issues.push({
      field: "name",
      message: "Expected a non-empty string",
      value: name,
    });
  }

  const languages = value.languages;
  if (!isNonEmptyStringArray(languages)) {
    issues.push({
      field: "languages",
      message: "Expected an array of non-empty strings",
      value: languages,
    });
  } else {
    const invalidLanguages = languages.filter(
      (language) => validateLanguage(language) === undefined,
    );
    if (invalidLanguages.length > 0) {
      issues.push({
        field: "languages",
        message: `Unrecognized programming language: ${invalidLanguages.map((l) => l.trim()).join(", ")}. Enter a common language such as JavaScript, C++, Java, C#, PHP, Ruby, Swift, or Kotlin.`,
        value: invalidLanguages,
      });
    }
  }

  CRITERIA_NUMBER_FIELDS.forEach((field) => {
    validateNonNegativeNumber(value[field], field, issues);
  });

  if (issues.length > 0) return { issues };

  const normalizedLanguages = isNonEmptyStringArray(languages)
    ? languages
        .map((language) => validateLanguage(language))
        .filter((language): language is string => language !== undefined)
    : [];
  return {
    criteria: {
      name: (name as string).trim(),
      languages: [...new Set(normalizedLanguages)],
      minimumRepositories: value.minimumRepositories as number,
      minimumStars: value.minimumStars as number,
      recentDays: value.recentDays as number,
    },
    issues: [],
  };
}
