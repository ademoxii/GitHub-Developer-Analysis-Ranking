/**
 * POST /api/analyze
 *
 * Orchestrates the full analysis pipeline:
 *   validate input → fetch GitHub data → score → rank → respond.
 *
 * Request body:
 *   { usernames: string[], criteria: Criteria }
 *
 * Response body:
 *   { developers: Developer[], unavailable: string[], errors: string[] }
 */

import type { Criteria } from "@/lib/analysis";
import { enrichCandidate } from "@/lib/github";
import { rankCandidates } from "@/lib/scoring";

/** Maximum usernames per request to keep API usage reasonable. */
const MAX_USERNAMES = 20;

/** How many GitHub profiles to fetch at the same time. */
const CONCURRENCY = 5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run async tasks with bounded concurrency. */
async function mapSettled<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map(fn));
    results.push(...settled);
  }
  return results;
}

function isValidCriteria(c: unknown): c is Criteria {
  if (typeof c !== "object" || c === null) return false;
  const obj = c as Record<string, unknown>;
  return (
    typeof obj.name === "string" &&
    Array.isArray(obj.languages) &&
    typeof obj.minimumRepositories === "number" &&
    typeof obj.minimumStars === "number" &&
    typeof obj.recentDays === "number"
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // ---- parse body ----
  let body: { usernames: unknown; criteria: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { usernames, criteria } = body;

  if (
    !Array.isArray(usernames) ||
    usernames.length === 0 ||
    !usernames.every((u) => typeof u === "string")
  ) {
    return Response.json(
      { error: "Provide at least one username." },
      { status: 400 },
    );
  }

  if (!isValidCriteria(criteria)) {
    return Response.json(
      { error: "Provide valid project criteria." },
      { status: 400 },
    );
  }

  // Cap to avoid excessive API usage.
  const capped = (usernames as string[]).slice(0, MAX_USERNAMES);

  // ---- enrich candidates from GitHub ----
  const settled = await mapSettled(capped, enrichCandidate, CONCURRENCY);

  const enriched: Awaited<ReturnType<typeof enrichCandidate>>[] = [];
  const unavailable: string[] = [];
  const errors: string[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      enriched.push(result.value);
    } else {
      unavailable.push(capped[index]);
      const msg =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      if (msg.includes("rate limit")) {
        errors.push(msg);
      }
    }
  });

  // ---- score & rank ----
  const developers = rankCandidates(enriched, criteria);

  return Response.json({
    developers,
    unavailable,
    errors: [...new Set(errors)],
  });
}
