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

export type CriterionWeights = Record<string, number>;

// This contains placeholder values, change it to actual project filters
export type ProjectFilters = {
  languages?: string[];
  minStars?: number;
  minForks?: number;
  updatedWithinDays?: number;
};

export type ProjectCriteria = {
  weights: CriterionWeights;
  filters: ProjectFilters;
};

export type ProjectCriteriaResult = {
  criteria?: ProjectCriteria;
  issues: ValidationIssue[];
};

const USERNAME_PATTERN = /^(?!-)(?!.*--)[a-z\d-]{1,39}(?<!-)$/i;
const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const DEFAULT_CRITERIA_KEYS = new Set([
  "languages",
  "minStars",
  "minForks",
  "updatedWithinDays",
]);

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
  const trimmed = value.trim();
  if (USERNAME_PATTERN.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (!GITHUB_HOSTS.has(url.hostname.toLowerCase())) {
      return undefined;
    }

    const segments = url.pathname.split("/").filter(Boolean);
    return segments.length === 1 && USERNAME_PATTERN.test(segments[0])
      ? segments[0]
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
      const parsedHeaders = parseCsvRow(rows[firstRowIndex] ?? "").map((header) =>
        header.toLowerCase().replace(/[\s_-]/g, ""),
      );
      if (
        parsedHeaders.some((header) =>
          ["username", "githubusername", "url", "githuburl"].includes(header),
        )
      ) {
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
        : fields[
            headers.findIndex((header) =>
              ["username", "githubusername", "url", "githuburl"].includes(header),
            )
          ] ?? "";
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
  const weightsInput = value.weights ?? {};
  if (!isRecord(weightsInput)) {
    issues.push({ field: "weights", message: "Expected an object", value: weightsInput });
  }

  const weights: CriterionWeights = {};
  if (isRecord(weightsInput)) {
    Object.entries(weightsInput).forEach(([name, weight]) => {
      if (validateNonNegativeNumber(weight, `weights.${name}`, issues)) {
        weights[name] = weight;
      }
    });
  }

  const filtersInput = value.filters ?? {};
  if (!isRecord(filtersInput)) {
    issues.push({ field: "filters", message: "Expected an object", value: filtersInput });
  }

  const filters: ProjectFilters = {};
  if (isRecord(filtersInput)) {
    const languages = filtersInput.languages;
    if (languages !== undefined) {
      if (
        !Array.isArray(languages) ||
        languages.some((language) => typeof language !== "string" || language.trim() === "")
      ) {
        issues.push({
          field: "filters.languages",
          message: "Expected an array of non-empty strings",
          value: languages,
        });
      } else {
        filters.languages = [...new Set(languages.map((language) => language.trim()))];
      }
    }

    (["minStars", "minForks", "updatedWithinDays"] as const).forEach((field) => {
      const fieldValue = filtersInput[field];
      if (fieldValue !== undefined && validateNonNegativeNumber(fieldValue, `filters.${field}`, issues)) {
        filters[field] = fieldValue;
      }
    });

    Object.keys(filtersInput)
      .filter((key) => !DEFAULT_CRITERIA_KEYS.has(key))
      .forEach((key) => {
        issues.push({ field: `filters.${key}`, message: "Unknown filter", value: filtersInput[key] });
      });
  }

  return issues.length > 0 ? { issues } : { criteria: { weights, filters }, issues: [] };
}
