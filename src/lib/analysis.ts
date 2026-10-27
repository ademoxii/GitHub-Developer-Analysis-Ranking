import { deduplicateCandidates, parseCandidatesCsv } from "./modeling";

export type Developer = {
  username: string;
  name: string;
  bio: string;
  avatarUrl?: string;
  stars: number;
  stacks: string[];
  repositoryCount: number;
  match: number;
  activeDaysAgo: number;
  repositories: { name: string; description: string; stars: number }[];
};

// Design fixtures supplied with the frontend. These are not live GitHub profiles.
export const sampleDevelopers: Developer[] = [
  {
    username: "sarah-chen",
    name: "Sarah Chen",
    bio: "Security engineer building open-source tools for cloud infrastructure.",
    stars: 1247,
    stacks: ["Python", "Rust"],
    repositoryCount: 48,
    match: 96,
    activeDaysAgo: 2,
    repositories: [
      {
        name: "cloudguard",
        description: "Scanner for common cloud misconfigurations.",
        stars: 302,
      },
      {
        name: "rust-sentinel",
        description: "Fast host monitoring and event collection agent.",
        stars: 184,
      },
    ],
  },
  {
    username: "omar-sec",
    name: "Omar El Idrissi",
    bio: "Application security, fuzzing, and offensive tooling.",
    stars: 892,
    stacks: ["Python", "Go"],
    repositoryCount: 31,
    match: 91,
    activeDaysAgo: 1,
    repositories: [
      {
        name: "api-fuzzer",
        description: "Small toolkit for testing REST API security.",
        stars: 267,
      },
      {
        name: "go-audit",
        description: "CLI for repeatable security audits.",
        stars: 156,
      },
    ],
  },
  {
    username: "linhcodes",
    name: "Linh Nguyen",
    bio: "Full-stack developer interested in secure systems and developer tools.",
    stars: 624,
    stacks: ["TypeScript", "Rust"],
    repositoryCount: 64,
    match: 87,
    activeDaysAgo: 3,
    repositories: [
      {
        name: "secure-edge",
        description: "Security-focused edge service toolkit.",
        stars: 198,
      },
      {
        name: "dev-vault",
        description: "Local secrets workflow for development teams.",
        stars: 121,
      },
    ],
  },
  {
    username: "dev-null-lab",
    name: "Alex Rivera",
    bio: "Systems developer working on low-level security tools.",
    stars: 506,
    stacks: ["C", "C++"],
    repositoryCount: 27,
    match: 83,
    activeDaysAgo: 5,
    repositories: [],
  },
  {
    username: "maya-k",
    name: "Maya Khan",
    bio: "Cloud platform engineer and maintainer of practical security utilities.",
    stars: 341,
    stacks: ["Go", "TypeScript"],
    repositoryCount: 39,
    match: 78,
    activeDaysAgo: 1,
    repositories: [
      {
        name: "cluster-check",
        description: "Kubernetes security configuration checks.",
        stars: 146,
      },
      {
        name: "ops-toolbox",
        description: "Portable infrastructure helper scripts.",
        stars: 88,
      },
    ],
  },
];

export const defaultInput =
  "sarah-chen\nhttps://github.com/omar-sec\nlinhcodes\ndev-null-lab\nmaya-k";
export const languageOptions = ["Python", "Go", "Rust", "TypeScript"];
export const stackColors: Record<string, string> = {
  Python: "#3572a5",
  Rust: "#dea584",
  Go: "#00add8",
  C: "#555555",
  "C++": "#f34b7d",
  TypeScript: "#3178c6",
};
export type Criteria = {
  name: string;
  languages: string[];
  minimumRepositories: number;
  minimumStars: number;
  recentDays: number;
};
export const defaultCriteria: Criteria = {
  name: "Cloud Security Scanner",
  languages: ["Python", "Go"],
  minimumRepositories: 5,
  minimumStars: 10,
  recentDays: 90,
};

export function parseAccounts(input: string) {
  const parsed = parseCandidatesCsv(input);
  const candidates = deduplicateCandidates(parsed.candidates);
  return {
    usernames: candidates.map((candidate) => candidate.username),
    duplicates: parsed.candidates.length - candidates.length,
    invalid: parsed.issues.length,
  };
}

export function importAccountsCsv(content: string) {
  const lines = content.replace(/^\uFEFF/, "").split(/\r?\n/);
  if (
    /^"?(?:username|usernames|github_username|profile_url|url)"?$/i.test(
      lines[0]?.trim(),
    )
  )
    lines.shift();
  return lines.join("\n");
}

export function previewAnalysis(usernames: string[], criteria: Criteria) {
  const requested = new Set(usernames);
  const developers = sampleDevelopers
    .filter(
      (developer) =>
        requested.has(developer.username) &&
        developer.repositoryCount >= criteria.minimumRepositories &&
        developer.stars >= criteria.minimumStars &&
        (!criteria.recentDays ||
          developer.activeDaysAgo <= criteria.recentDays),
    )
    .sort((a, b) => b.match - a.match);
  const known = new Set(
    sampleDevelopers.map((developer) => developer.username),
  );
  return {
    developers,
    unavailable: usernames.filter((username) => !known.has(username)),
  };
}

export function activityLabel(days: number) {
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function resultsCsv(developers: Developer[]) {
  const rows = [
    [
      "Rank",
      "Candidate",
      "Username",
      "Match (%)",
      "Languages",
      "Repositories",
      "Stars",
      "Activity",
    ],
    ...developers.map((developer, index) => [
      index + 1,
      developer.name,
      developer.username,
      developer.match,
      developer.stacks.join(", "),
      developer.repositoryCount,
      developer.stars,
      activityLabel(developer.activeDaysAgo),
    ]),
  ];
  return rows
    .map((row) =>
      row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(","),
    )
    .join("\r\n");
}
