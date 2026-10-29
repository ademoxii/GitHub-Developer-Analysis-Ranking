"use client";

import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import Image from "next/image";
import {
  activityLabel,
  defaultCriteria,
  defaultInput,
  famousLanguages,
  importAccountsCsv,
  languageOptions,
  parseAccounts,
  resultsCsv,
  stackColors,
  type Criteria,
  type Developer,
} from "@/lib/analysis";
import { parseProjectCriteria, validateLanguage } from "@/lib/modeling";

type IconName =
  | "users"
  | "sliders"
  | "upload"
  | "check"
  | "arrow"
  | "search"
  | "download"
  | "compare"
  | "close";

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, ReactNode> = {
    users: (
      <>
        <circle cx="9" cy="7" r="4" />
        <path d="M2 22v-3a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v3m3-9a5 5 0 0 1 3 5v4" />
      </>
    ),
    sliders: (
      <>
        <path d="M3 6h18M6 12h12M9 18h6" />
        <circle cx="8" cy="6" r="2" />
        <circle cx="16" cy="12" r="2" />
        <circle cx="12" cy="18" r="2" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V3m-6 6 6-6 6 6M4 15v6h16v-6" />
      </>
    ),
    check: <path d="m4 12 5 5L21 5" />,
    arrow: <path d="m9 5 7 7-7 7" />,
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="7.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    download: <path d="M12 3v14m-6-6 6 6 6-6M3 22h18" />,
    compare: <path d="M7 3H3v18h4m10-18h4v18h-4M8 8h8M8 15h8" />,
    close: <path d="m6 6 12 12M6 18 18 6" />,
  };
  return (
    <svg
      className="icon"
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function Language({ name }: { name: string }) {
  return (
    <span className="language">
      <i style={{ backgroundColor: stackColors[name] ?? "#59636e" }} />
      {name}
    </span>
  );
}

function PanelHeading({
  icon,
  step,
  children,
}: {
  icon: IconName;
  step: string;
  children: ReactNode;
}) {
  return (
    <div className="panel-heading">
      <span className="panel-icon">
        <Icon name={icon} />
      </span>
      <div>
        <span className="eyebrow">INPUT {step}</span>
        <h2>{children}</h2>
      </div>
    </div>
  );
}

function download(content: string, type: string, extension: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `shellscope-results.${extension}`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function App() {
  const [view, setView] = useState<"inputs" | "results">("inputs");
  const [input, setInput] = useState(defaultInput);
  const [criteria, setCriteria] = useState<Criteria>(defaultCriteria);
  const [analysis, setAnalysis] = useState<{
    developers: Developer[];
    unavailable: string[];
    criteria: Criteria;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [availableLanguages, setAvailableLanguages] =
    useState<string[]>(languageOptions);
  const [customLanguage, setCustomLanguage] = useState("");
  const [languageError, setLanguageError] = useState("");
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const accounts = parseAccounts(input);
  const visible =
    analysis?.developers.filter((developer) =>
      `${developer.name} ${developer.username} ${developer.stacks.join(" ")}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
    ) ?? [];
  const compared =
    analysis?.developers.filter((developer) =>
      selected.includes(developer.username),
    ) ?? [];

  function navigate(next: "inputs" | "results") {
    setView(next);
    window.scrollTo({ top: 0, behavior: "instant" });
    window.requestAnimationFrame(() =>
      heading.current?.focus({ preventScroll: true }),
    );
  }

  async function analyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (
      !accounts.usernames.length ||
      !criteria.name.trim() ||
      uploading ||
      loading
    )
      return;
    const snapshot = {
      ...criteria,
      name: criteria.name.trim(),
      languages: [...criteria.languages],
    };
    const parsedCriteria = parseProjectCriteria(snapshot);
    if (!parsedCriteria.criteria) return;

    setLoading(true);
    setApiError("");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          usernames: accounts.usernames,
          criteria: parsedCriteria.criteria,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || `Analysis failed (${res.status})`);
      }

      setAnalysis({
        developers: data.developers,
        unavailable: data.unavailable,
        criteria: parsedCriteria.criteria,
      });
      setSelected([]);
      setSearch("");
      navigate("results");

      if (data.errors?.length) {
        setApiError(data.errors.join(" "));
      }
    } catch (err) {
      setApiError(
        err instanceof Error
          ? err.message
          : "Analysis failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function uploadCsv(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploadError("");
    if (!/\.csv$/i.test(file.name)) {
      setUploadError(
        "Choose a CSV file containing usernames or GitHub profile URLs.",
      );
      return;
    }
    if (file.size > 1024 * 1024) {
      setUploadError("Choose a CSV file smaller than 1 MB.");
      return;
    }
    setUploading(true);
    try {
      const content = importAccountsCsv(await file.text());
      if (!parseAccounts(content).usernames.length) {
        setUploadError(
          "No valid accounts found. Use one username or profile URL per row.",
        );
        return;
      }
      setInput(content);
    } catch {
      setUploadError(
        "This file could not be read. Please try another CSV file.",
      );
    } finally {
      setUploading(false);
    }
  }

  function toggleLanguage(language: string) {
    setCriteria((current) => ({
      ...current,
      languages: current.languages.includes(language)
        ? current.languages.filter((item) => item !== language)
        : [...current.languages, language],
    }));
  }

  function addCustomLanguage() {
    setLanguageError("");
    const trimmed = customLanguage.trim();
    if (!trimmed) {
      setLanguageError("Enter a language name to add.");
      return;
    }

    const parsed = parseProjectCriteria({
      ...criteria,
      name: criteria.name.trim() || defaultCriteria.name,
      minimumRepositories: Number.isFinite(criteria.minimumRepositories)
        ? criteria.minimumRepositories
        : defaultCriteria.minimumRepositories,
      minimumStars: Number.isFinite(criteria.minimumStars)
        ? criteria.minimumStars
        : defaultCriteria.minimumStars,
      languages: [...criteria.languages, trimmed],
    });

    const languageIssue = parsed.issues.find(
      (issue) => issue.field === "languages",
    );
    const canonical = validateLanguage(trimmed);

    if (languageIssue || !canonical) {
      setLanguageError(
        languageIssue?.message ?? "Enter a recognized programming language.",
      );
      return;
    }

    setAvailableLanguages((current) =>
      current.includes(canonical) ? current : [...current, canonical],
    );
    setCriteria((current) => ({
      ...current,
      languages: current.languages.includes(canonical)
        ? current.languages
        : [...current.languages, canonical],
    }));
    setCustomLanguage("");
    setShowLanguageMenu(false);
  }

  const filteredLanguageSuggestions = famousLanguages.filter(
    (language) =>
      !availableLanguages.includes(language) &&
      language.toLowerCase().includes(customLanguage.trim().toLowerCase()),
  );

  function toggleCandidate(username: string) {
    setSelected((current) =>
      current.includes(username)
        ? current.filter((item) => item !== username)
        : current.length < 3
          ? [...current, username]
          : current,
    );
  }

  return (
    <div className="shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="site-header">
        <a
          className="brand"
          href="#inputs"
          onClick={(event) => {
            event.preventDefault();
            navigate("inputs");
          }}
          aria-label="ShellScope inputs"
        >
          <Image
            className="logo"
            src="/logo.svg"
            alt=""
            aria-hidden="true"
            width={64}
            height={64}
          />
          <strong>ShellScope</strong>
        </a>
        <nav className="steps" aria-label="Analysis steps">
          <button
            type="button"
            className={view === "inputs" ? "step active" : "step"}
            aria-current={view === "inputs" ? "step" : undefined}
            onClick={() => navigate("inputs")}
          >
            <span>1</span>Inputs
          </button>
          <span className="step-line" aria-hidden="true" />
          <button
            type="button"
            className={view === "results" ? "step active" : "step"}
            aria-current={view === "results" ? "step" : undefined}
            disabled={!analysis}
            onClick={() => navigate("results")}
          >
            <span>2</span>Results
          </button>
        </nav>
      </header>

      <main id="main" className="main-content">
        {view === "inputs" ? (
          <>
            <section className="intro">
              <h1 ref={heading} tabIndex={-1}>
                New analysis
              </h1>
              <p>
                Import GitHub accounts and define how candidates should be
                ranked.
              </p>
            </section>
            <form onSubmit={analyze}>
              <div className="input-grid">
                <section className="input-panel" aria-label="GitHub accounts">
                  <PanelHeading icon="users" step="A1">
                    GitHub accounts
                  </PanelHeading>
                  <label className="field-label" htmlFor="accounts">
                    Usernames or profile URLs
                  </label>
                  <textarea
                    id="accounts"
                    className="accounts-input"
                    value={input}
                    onChange={(event) => setInput(event.target.value)}
                    placeholder={"octocat\nhttps://github.com/username"}
                    spellCheck={false}
                    aria-describedby="account-help account-validation"
                    disabled={uploading}
                  />
                  <p className="field-help" id="account-help">
                    Paste one entry per line or separate entries with commas.
                  </p>
                  <label className="upload-zone">
                    <input
                      type="file"
                      accept=".csv,text/csv"
                      onChange={uploadCsv}
                      disabled={uploading}
                      aria-label="Upload CSV file"
                    />
                    <Icon name="upload" />
                    <span>
                      <strong>
                        {uploading ? "Reading CSV file…" : "Upload CSV file"}
                      </strong>
                      <span>GitHub usernames or profile URLs</span>
                    </span>
                  </label>
                  {uploadError && (
                    <p className="error-message" role="alert">
                      {uploadError}
                    </p>
                  )}
                  <div
                    className="validation"
                    id="account-validation"
                    role="status"
                  >
                    <span className="valid">
                      <Icon name="check" />
                      {accounts.usernames.length} valid
                    </span>
                    <span>{accounts.duplicates} duplicates</span>
                    <span className={accounts.invalid ? "invalid" : ""}>
                      {accounts.invalid} invalid
                    </span>
                  </div>
                  {accounts.invalid > 0 && (
                    <p className="field-help">
                      Invalid entries will be skipped. Use GitHub usernames or
                      profile URLs.
                    </p>
                  )}
                </section>

                <section
                  className="input-panel criteria-panel"
                  aria-label="Project criteria"
                >
                  <PanelHeading icon="sliders" step="A2">
                    Project criteria
                  </PanelHeading>
                  <div className="field">
                    <label className="field-label" htmlFor="project-name">
                      Project name
                    </label>
                    <input
                      id="project-name"
                      value={criteria.name}
                      required
                      pattern=".*\S.*"
                      maxLength={120}
                      title="Enter a project name."
                      onChange={(event) =>
                        setCriteria({ ...criteria, name: event.target.value })
                      }
                    />
                  </div>
                  <fieldset className="field">
                    <legend className="field-label">Required languages</legend>
                    <div className="language-options">
                      {availableLanguages.map((language) => (
                        <button
                          key={language}
                          type="button"
                          className="language-option"
                          aria-pressed={criteria.languages.includes(language)}
                          onClick={() => toggleLanguage(language)}
                        >
                          <Language name={language} />
                        </button>
                      ))}
                    </div>
                    <div className="custom-language-field">
                      <label className="field-label" htmlFor="custom-language">
                        Add custom language
                      </label>
                      <div className="custom-language-row">
                        <div
                          className="language-combobox"
                          onBlur={(event) => {
                            if (
                              !event.currentTarget.contains(
                                event.relatedTarget as Node | null,
                              )
                            ) {
                              setShowLanguageMenu(false);
                            }
                          }}
                        >
                          <input
                            id="custom-language"
                            className="language-select-input"
                            value={customLanguage}
                            placeholder="e.g. JavaScript, C++, Java"
                            maxLength={40}
                            autoComplete="off"
                            aria-expanded={
                              showLanguageMenu &&
                              filteredLanguageSuggestions.length > 0
                            }
                            aria-controls="famous-languages-menu"
                            aria-describedby={
                              languageError
                                ? "custom-language-error"
                                : undefined
                            }
                            onFocus={() => setShowLanguageMenu(true)}
                            onClick={() => setShowLanguageMenu(true)}
                            onChange={(event) => {
                              setCustomLanguage(event.target.value);
                              setShowLanguageMenu(true);
                              if (languageError) setLanguageError("");
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                addCustomLanguage();
                              } else if (event.key === "Escape") {
                                setShowLanguageMenu(false);
                              }
                            }}
                          />
                          {showLanguageMenu &&
                            filteredLanguageSuggestions.length > 0 && (
                              <ul
                                id="famous-languages-menu"
                                className="language-select-menu"
                                role="listbox"
                                aria-label="Famous programming languages"
                              >
                                {filteredLanguageSuggestions.map((language) => (
                                  <li key={language} role="option" aria-selected={customLanguage === language}>
                                    <button
                                      type="button"
                                      className="language-select-option"
                                      onMouseDown={(event) =>
                                        event.preventDefault()
                                      }
                                      onClick={() => {
                                        setCustomLanguage(language);
                                        setLanguageError("");
                                        setShowLanguageMenu(false);
                                      }}
                                    >
                                      <Language name={language} />
                                    </button>
                                  </li>
                                ))}
                              </ul>
                            )}
                        </div>
                        <button
                          type="button"
                          className="button"
                          onClick={addCustomLanguage}
                        >
                          Add
                        </button>
                      </div>
                      {languageError && (
                        <p
                          id="custom-language-error"
                          className="error-message"
                          role="alert"
                        >
                          {languageError}
                        </p>
                      )}
                    </div>
                  </fieldset>
                  <div className="number-fields field">
                    <div>
                      <label className="field-label" htmlFor="minimum-repos">
                        Minimum repositories
                      </label>
                      <input
                        id="minimum-repos"
                        type="number"
                        min="0"
                        max="1000000"
                        step="1"
                        required
                        value={
                          Number.isNaN(criteria.minimumRepositories)
                            ? ""
                            : criteria.minimumRepositories
                        }
                        onChange={(event) =>
                          setCriteria({
                            ...criteria,
                            minimumRepositories:
                              event.target.value === ""
                                ? Number.NaN
                                : Number(event.target.value),
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="field-label" htmlFor="minimum-stars">
                        Minimum stars
                      </label>
                      <input
                        id="minimum-stars"
                        type="number"
                        min="0"
                        max="1000000000"
                        step="1"
                        required
                        value={
                          Number.isNaN(criteria.minimumStars)
                            ? ""
                            : criteria.minimumStars
                        }
                        onChange={(event) =>
                          setCriteria({
                            ...criteria,
                            minimumStars:
                              event.target.value === ""
                                ? Number.NaN
                                : Number(event.target.value),
                          })
                        }
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="recent-activity">
                      Recent activity
                    </label>
                    <select
                      id="recent-activity"
                      value={criteria.recentDays}
                      onChange={(event) =>
                        setCriteria({
                          ...criteria,
                          recentDays: Number(event.target.value),
                        })
                      }
                    >
                      <option value={30}>Within 30 days</option>
                      <option value={90}>Within 90 days</option>
                      <option value={180}>Within 180 days</option>
                      <option value={365}>Within a year</option>
                      <option value={0}>Any time</option>
                    </select>
                  </div>
                  <div className="field weights-field">
                    <h3 className="field-label">Scoring weights</h3>
                    <dl className="weights">
                      <div>
                        <dt>Languages</dt>
                        <dd>40%</dd>
                      </div>
                      <div>
                        <dt>Repository relevance</dt>
                        <dd>35%</dd>
                      </div>
                      <div>
                        <dt>Recent activity</dt>
                        <dd>25%</dd>
                      </div>
                    </dl>
                  </div>
                </section>
              </div>
              <div className="run-bar">
                <div>
                  <strong>
                    {accounts.usernames.length}{" "}
                    {accounts.usernames.length === 1
                      ? "candidate"
                      : "candidates"}
                  </strong>
                  <p>
                    Profiles, repositories, languages, and activity will be
                    analyzed.
                  </p>
                </div>
                <button
                  className="button primary"
                  type="submit"
                  disabled={
                    !accounts.usernames.length ||
                    !criteria.name.trim() ||
                    uploading ||
                    loading
                  }
                >
                  <Icon name="arrow" />
                  {loading ? "Analyzing…" : "Run analysis"}
                </button>
              </div>
              {loading && (
                <div className="loading-bar" role="status">
                  <p>Fetching GitHub profiles and computing scores…</p>
                </div>
              )}
              {apiError && !loading && view === "inputs" && (
                <p className="error-message" role="alert" style={{ marginTop: 16 }}>
                  {apiError}
                </p>
              )}
            </form>
          </>
        ) : (
          analysis && (
            <>
              <section className="intro results-intro">
                <div>
                  <p className="complete-label">ANALYSIS COMPLETE</p>
                  <h1 ref={heading} tabIndex={-1}>
                    {analysis.criteria.name}
                  </h1>
                  <p>
                    {analysis.developers.length}{" "}
                    {analysis.developers.length === 1
                      ? "candidate"
                      : "candidates"}{" "}
                    ranked by project criteria.
                  </p>
                </div>
                <div className="result-actions">
                  <button
                    className="button"
                    disabled={!analysis.developers.length}
                    onClick={() =>
                      download(
                        resultsCsv(analysis.developers),
                        "text/csv;charset=utf-8",
                        "csv",
                      )
                    }
                  >
                    <Icon name="download" />
                    CSV
                  </button>
                  <button
                    className="button"
                    disabled={!analysis.developers.length}
                    onClick={() =>
                      download(
                        JSON.stringify(
                          { source: "design-preview", ...analysis },
                          null,
                          2,
                        ),
                        "application/json",
                        "json",
                      )
                    }
                  >
                    JSON
                  </button>
                  <button
                    className="button primary"
                    disabled={selected.length < 2}
                    onClick={() => dialog.current?.showModal()}
                  >
                    <Icon name="compare" />
                    Compare ({selected.length})
                  </button>
                </div>
              </section>
              <section
                className="criteria-summary"
                aria-label="Applied project criteria"
              >
                <div className="summary-group">
                  <strong>Languages</strong>
                  {analysis.criteria.languages.length ? (
                    analysis.criteria.languages.map((language) => (
                      <Language key={language} name={language} />
                    ))
                  ) : (
                    <span>Any language</span>
                  )}
                </div>
                <div className="summary-group">
                  <strong>Filters</strong>
                  <span className="filter-pill">
                    {analysis.criteria.minimumRepositories}+ repositories
                  </span>
                  <span className="filter-pill">
                    {analysis.criteria.minimumStars}+ stars
                  </span>
                  <span className="filter-pill">
                    {analysis.criteria.recentDays
                      ? `Active within ${analysis.criteria.recentDays} days`
                      : "Any activity"}
                  </span>
                </div>
              </section>
              <div className="results-search">
                <Icon name="search" />
                <input
                  type="search"
                  aria-label="Search results"
                  placeholder="Search results"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <section className="ranking" aria-labelledby="ranking-title">
                <div className="ranking-heading">
                  <h2 id="ranking-title">Ranked candidates</h2>
                  <p id="compare-help">
                    {selected.length === 3
                      ? "Three selected. Deselect a candidate to choose another."
                      : "Select two or three candidates to compare."}
                  </p>
                </div>
                <div
                  className="table-scroll"
                  role="region"
                  aria-label="Ranked candidates table"
                  tabIndex={0}
                >
                  <table>
                    <thead>
                      <tr>
                        <th scope="col">Rank</th>
                        <th scope="col">Candidate</th>
                        <th scope="col">Match</th>
                        <th scope="col">Languages</th>
                        <th scope="col">Repositories</th>
                        <th scope="col">Stars</th>
                        <th scope="col">Activity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visible.map((developer) => (
                        <tr
                          key={developer.username}
                          className={
                            selected.includes(developer.username)
                              ? "selected-row"
                              : ""
                          }
                        >
                          <td>
                            <label className="rank-cell">
                              <input
                                type="checkbox"
                                checked={selected.includes(developer.username)}
                                disabled={
                                  selected.length >= 3 &&
                                  !selected.includes(developer.username)
                                }
                                onChange={() =>
                                  toggleCandidate(developer.username)
                                }
                                aria-label={`Compare ${developer.name}`}
                                aria-describedby="compare-help"
                              />
                              <span>
                                #{analysis.developers.indexOf(developer) + 1}
                              </span>
                            </label>
                          </td>
                          <td>
                            <div className="candidate">
                              {developer.avatarUrl ? (
                                <img className="avatar" src={developer.avatarUrl} alt="" />
                              ) : (
                                <span className="avatar" aria-hidden="true" />
                              )}
                              <div>
                                <a
                                  href={`https://github.com/${developer.username}`}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  {developer.name}
                                </a>
                                <span className="username">
                                  @{developer.username}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="match">
                              <strong>{developer.match}%</strong>
                              <meter
                                min={0}
                                max={100}
                                value={developer.match}
                                aria-label={`${developer.name} match`}
                              >
                                {developer.match}%
                              </meter>
                            </div>
                          </td>
                          <td>
                            <div className="table-languages">
                              {developer.stacks.map((language) => (
                                <Language key={language} name={language} />
                              ))}
                            </div>
                          </td>
                          <td>{developer.repositoryCount}</td>
                          <td>{developer.stars.toLocaleString("en-US")}</td>
                          <td>{activityLabel(developer.activeDaysAgo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!visible.length && (
                    <div className="empty-state">
                      <Icon name="search" />
                      <h3>
                        {search
                          ? "No matching candidates"
                          : "No candidates to display"}
                      </h3>
                      <p>
                        {search
                          ? "Try another name, username, or language."
                          : "Return to Inputs and adjust your accounts or minimum requirements."}
                      </p>
                      <button
                        className="button"
                        onClick={() =>
                          search ? setSearch("") : navigate("inputs")
                        }
                      >
                        {search ? "Clear search" : "Edit inputs"}
                      </button>
                    </div>
                  )}
                </div>
              </section>
              {analysis.unavailable.length > 0 && (
                <p className="unavailable-note" role="status">
                  No preview data for:{" "}
                  {analysis.unavailable
                    .map((username) => `@${username}`)
                    .join(", ")}
                  . Live GitHub analysis is not connected.
                </p>
              )}
              <dialog
                ref={dialog}
                className="compare-dialog"
                aria-labelledby="comparison-title"
              >
                <div className="dialog-heading">
                  <div>
                    <p className="eyebrow">SIDE BY SIDE</p>
                    <h2 id="comparison-title">Compare candidates</h2>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Close comparison"
                    onClick={() => dialog.current?.close()}
                  >
                    <Icon name="close" />
                  </button>
                </div>
                <div className="comparison-grid">
                  {compared.map((developer) => (
                    <article
                      key={developer.username}
                      className="comparison-card"
                    >
                      <h3>{developer.name}</h3>
                      <p className="username">@{developer.username}</p>
                      <p>{developer.bio}</p>
                      <div className="table-languages">
                        {developer.stacks.map((language) => (
                          <Language key={language} name={language} />
                        ))}
                      </div>
                      <dl className="comparison-stats">
                        <div>
                          <dt>Match</dt>
                          <dd>{developer.match}%</dd>
                        </div>
                        <div>
                          <dt>Repositories</dt>
                          <dd>{developer.repositoryCount}</dd>
                        </div>
                        <div>
                          <dt>Stars</dt>
                          <dd>{developer.stars.toLocaleString("en-US")}</dd>
                        </div>
                        <div>
                          <dt>Activity</dt>
                          <dd>{activityLabel(developer.activeDaysAgo)}</dd>
                        </div>
                      </dl>
                      <h4>Top repositories</h4>
                      {developer.repositories.length ? (
                        developer.repositories.map((repo) => (
                          <div className="repo" key={repo.name}>
                            <strong>{repo.name}</strong>
                            <span>★ {repo.stars}</span>
                            <p>{repo.description}</p>
                          </div>
                        ))
                      ) : (
                        <p>No repository previews available.</p>
                      )}
                    </article>
                  ))}
                </div>
                <p className="preview-note">
                  Scores based on publicly available GitHub data.
                </p>
              </dialog>
            </>
          )
        )}
        {apiError && view === "results" && (
          <p className="error-message" role="alert" style={{ marginTop: 16 }}>
            {apiError}
          </p>
        )}
      </main>
    </div>
  );
}
