
const GITHUB_API = "https://api.github.com";

/** Maximum repo pages to fetch per user (100 repos / page). */
const MAX_REPO_PAGES = 3;


export type GitHubUser = {
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  public_repos: number;
  followers: number;
  following: number;
  created_at: string;
  updated_at: string;
};

export type GitHubRepo = {
  name: string;
  description: string | null;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  updated_at: string;
  pushed_at: string;
  fork: boolean;
};

// ---------------------------------------------------------------------------
// Enriched candidate — the intermediate shape between raw GitHub data and
// the UI-facing Developer type.
// ---------------------------------------------------------------------------

export type EnrichedCandidate = {
  username: string;
  name: string;
  bio: string;
  avatarUrl: string;
  publicRepos: number;
  followers: number;
  stars: number;
  forks: number;
  languages: string[];
  activeDaysAgo: number;
  topRepositories: { name: string; description: string; stars: number }[];
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function authHeaders(): HeadersInit {
  const h: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (process.env.GITHUB_TOKEN) {
    h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  return h;
}

async function githubFetch<T>(path: string): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: authHeaders(),
    // Disable Next.js fetch caching so every analysis is fresh.
    cache: "no-store",
  });

  if (res.status === 404) {
    throw new Error(`GitHub user not found: ${path}`);
  }

  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      const reset = res.headers.get("x-ratelimit-reset");
      const resetAt = reset
        ? new Date(Number(reset) * 1000).toLocaleTimeString()
        : "soon";
      throw new Error(
        `GitHub API rate limit exceeded. Resets at ${resetAt}. Add a GITHUB_TOKEN to .env.local for a higher limit.`,
      );
    }
    throw new Error(`GitHub API access forbidden (${res.status}).`);
  }

  if (!res.ok) {
    throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchUserProfile(
  username: string,
): Promise<GitHubUser> {
  return githubFetch<GitHubUser>(`/users/${encodeURIComponent(username)}`);
}

export async function fetchUserRepos(
  username: string,
): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;

  while (page <= MAX_REPO_PAGES) {
    const batch = await githubFetch<GitHubRepo[]>(
      `/users/${encodeURIComponent(username)}/repos?sort=pushed&per_page=${perPage}&page=${page}&type=owner`,
    );
    repos.push(...batch);
    if (batch.length < perPage) break;
    page += 1;
  }

  return repos;
}

/**
 * Fetch a user's profile and repos, then derive language / activity stats.
 */
export async function enrichCandidate(
  username: string,
): Promise<EnrichedCandidate> {
  const [profile, repos] = await Promise.all([
    fetchUserProfile(username),
    fetchUserRepos(username),
  ]);

  // ---- aggregate stars & forks ----
  const totalStars = repos.reduce((s, r) => s + r.stargazers_count, 0);
  const totalForks = repos.reduce((s, r) => s + r.forks_count, 0);

  // ---- build language list ordered by frequency ----
  const langCounts = new Map<string, number>();
  for (const repo of repos) {
    if (repo.language) {
      langCounts.set(repo.language, (langCounts.get(repo.language) ?? 0) + 1);
    }
  }
  const languages = [...langCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([lang]) => lang);

  // ---- most recent push ----
  const now = Date.now();
  let latestPush = 0;
  for (const repo of repos) {
    if (repo.pushed_at) {
      const ts = new Date(repo.pushed_at).getTime();
      if (ts > latestPush) latestPush = ts;
    }
  }
  const activeDaysAgo = latestPush
    ? Math.max(0, Math.floor((now - latestPush) / (1000 * 60 * 60 * 24)))
    : 9999;

  // ---- top repos by stars ----
  const topRepos = [...repos]
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 5)
    .map((r) => ({
      name: r.name,
      description: r.description ?? "",
      stars: r.stargazers_count,
    }));

  return {
    username: profile.login.toLowerCase(),
    name: profile.name ?? profile.login,
    bio: profile.bio ?? "",
    avatarUrl: profile.avatar_url,
    publicRepos: profile.public_repos,
    followers: profile.followers,
    stars: totalStars,
    forks: totalForks,
    languages,
    activeDaysAgo,
    topRepositories: topRepos,
  };
}
