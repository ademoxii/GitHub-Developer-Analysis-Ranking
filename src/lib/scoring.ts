import type { Criteria, Developer } from "./analysis";
import type { EnrichedCandidate } from "./github";


const W_LANGUAGE = 0.4;
const W_REPOS = 0.35;
const W_ACTIVITY = 0.25;


/** Returns `true` when the candidate passes every minimum threshold. */
export function passesHardFilters(
  candidate: EnrichedCandidate,
  criteria: Criteria,
): boolean {
  if (candidate.publicRepos < criteria.minimumRepositories) return false;
  if (candidate.stars < criteria.minimumStars) return false;
  if (
    criteria.recentDays > 0 &&
    candidate.activeDaysAgo > criteria.recentDays
  ) {
    return false;
  }
  return true;
}


function languageScore(
  candidateLangs: string[],
  requiredLangs: string[],
): number {
  if (requiredLangs.length === 0) return 100;
  const owned = new Set(candidateLangs.map((l) => l.toLowerCase()));
  const hits = requiredLangs.filter((l) => owned.has(l.toLowerCase())).length;
  return Math.round((hits / requiredLangs.length) * 100);
}


function repoScore(stars: number, repoCount: number): number {

  const starPart = Math.min(100, (Math.log10(stars + 1) / 3) * 100);

  const repoPart = Math.min(100, (repoCount / 50) * 100);
  return Math.round(starPart * 0.6 + repoPart * 0.4);
}

/**
 * Activity recency (0–100).
 */
function activityScore(daysAgo: number): number {
  if (daysAgo <= 1) return 100;
  if (daysAgo <= 7) return 90;
  if (daysAgo <= 30) return 75;
  if (daysAgo <= 90) return 55;
  if (daysAgo <= 180) return 35;
  if (daysAgo <= 365) return 15;
  return 5;
}


/** Compute the composite match score for a single candidate. */
export function computeMatchScore(
  candidate: EnrichedCandidate,
  criteria: Criteria,
): number {
  const lang = languageScore(candidate.languages, criteria.languages);
  const repo = repoScore(candidate.stars, candidate.publicRepos);
  const act = activityScore(candidate.activeDaysAgo);
  return Math.round(lang * W_LANGUAGE + repo * W_REPOS + act * W_ACTIVITY);
}

/** Map an enriched candidate to the UI-facing Developer shape. */
export function toDeveloper(
  candidate: EnrichedCandidate,
  criteria: Criteria,
): Developer {
  return {
    username: candidate.username,
    name: candidate.name,
    bio: candidate.bio,
    avatarUrl: candidate.avatarUrl,
    stars: candidate.stars,
    stacks: candidate.languages.slice(0, 6),
    repositoryCount: candidate.publicRepos,
    match: computeMatchScore(candidate, criteria),
    activeDaysAgo: candidate.activeDaysAgo,
    repositories: candidate.topRepositories,
  };
}

/** Filter, score, and rank candidates highest-match-first. */
export function rankCandidates(
  candidates: EnrichedCandidate[],
  criteria: Criteria,
): Developer[] {
  return candidates
    .filter((c) => passesHardFilters(c, criteria))
    .map((c) => toDeveloper(c, criteria))
    .sort((a, b) => b.match - a.match);
}
