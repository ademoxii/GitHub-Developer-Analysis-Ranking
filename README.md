# GitHub-Developer-Analysis-Ranking
ShellScope is a web-based tool developed for Shellmates, the cybersecurity club, to analyze and compare multiple GitHub accounts using publicly available data. It provides statistics about developer profiles, repositories, programming languages, stars, and recent activity.



# ShellScope 🔎

**GitHub Developer Analysis & Ranking for Shellmates**

ShellScope is a lightweight web application designed to analyze and compare multiple GitHub accounts using publicly available data. It helps Shellmates identify developers whose technical interests, programming languages, repository activity, and contributions best match the requirements of a project.

The goal is to turn a list of GitHub profiles into useful insights through a simple dashboard and transparent developer rankings.

## ✨ Features

- **Bulk account import** — Import multiple GitHub usernames or profile URLs at once.
- **Profile analysis** — Retrieve public profile information, repository counts, followers, and other available statistics.
- **Repository insights** — Explore public repositories, descriptions, programming languages, stars, forks, and last-updated dates.
- **Language analysis** — Identify the main programming languages associated with each account.
- **Activity analysis** — Examine available public activity signals and repository update dates.
- **Global developer ranking** — Compare accounts using a configurable combination of public GitHub signals.
- **Project-based ranking** — Define project requirements and identify developers whose public work best matches them.
- **Interactive dashboard** — Search, filter, sort, and compare analyzed accounts.
- **Transparent scoring** — Understand which criteria and available evidence contribute to each score.

> ShellScope is designed to evaluate project relevance using public GitHub evidence. Scores are indicators, not definitive measurements of a developer's skills or abilities.

## 🎯 Use Cases

ShellScope can help Shellmates members:

- Find developers for programming and cybersecurity projects.
- Identify accounts working with specific programming languages.
- Discover contributors with relevant public repositories.
- Compare developers according to project-specific requirements.
- Explore technical interests and publicly visible activity.

## 🖥️ Interface

The application follows a minimal, GitHub-inspired design with clean tables, subtle borders, compact statistics, and a simple navigation system.

Planned main screens:

- **Accounts** — Import and analyze GitHub profiles.
- **Projects** — Define requirements and manage project analyses.
- **Project Results** — View ranked developers and inspect matching evidence.
- **Developer Details** — Explore profile statistics and relevant repositories.

## ⚙️ How It Works

1. Import GitHub usernames or profile URLs.
2. Validate the accounts and remove duplicates.
3. Retrieve available public GitHub data.
4. Calculate profile statistics and ranking scores.
5. Create a project and define its requirements.
6. Filter and rank developers according to their relevance.
7. Inspect the evidence behind each result.

## 🛠️ Planned Technology Stack

The final stack may be adjusted during implementation.

- **Frontend:** Next.js and TypeScript
- **Backend:** Next.js server-side routes or equivalent API endpoints
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Data source:** GitHub REST API
- **UI:** GitHub-inspired design system

## 🔐 Data & Limitations

- ShellScope focuses on publicly available GitHub information.
- Private repositories and private account activity are not accessible without appropriate authorization.
- Public activity feeds do not provide a complete history of developer activity.
- Repository languages and metadata are useful indicators but do not independently establish expertise.
- Public email addresses may be unavailable.
- GitHub API rate limits can affect large batches of accounts.
- Data freshness, missing information, and incomplete analyses should be clearly indicated.

The application should use caching and controlled API requests to reduce unnecessary calls. Any GitHub token used by the backend must be stored securely and never exposed in client-side code.

## 🚀 Getting Started

Setup instructions will be added once the initial implementation and repository structure are established.

The expected setup will include:

1. Cloning the repository.
2. Installing project dependencies.
3. Configuring environment variables.
4. Setting up the PostgreSQL database.
5. Running database migrations.
6. Starting the development server.

## 🗺️ Roadmap

- [ ] Build the initial dashboard and navigation.
- [ ] Implement bulk GitHub account import.
- [ ] Integrate GitHub public profile and repository data.
- [ ] Implement account statistics and language analysis.
- [ ] Build search, filters, and sortable account tables.
- [ ] Implement global developer scoring.
- [ ] Add project creation and configurable criteria.
- [ ] Implement project-specific developer rankings.
- [ ] Add developer details and score explanations.
- [ ] Improve caching, error handling, and API rate-limit management.
- [ ] Test with large batches of GitHub accounts.

## 🤝 About

ShellScope is an integration project developed for **Shellmates**, the cybersecurity club, with the aim of making GitHub account analysis and project-based developer discovery easier.

## 📄 License

The license will be defined by the project maintainers.
