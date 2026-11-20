# GitHub Resume Builder

Turn any GitHub profile into a polished, shareable developer resume — instantly.

GitHub Resume Builder is a web app that fetches public GitHub data and transforms it into a visual resume: profile overview, contribution charts, language skills, and top repositories. No signup, no resume template hunting — enter a username and generate.

---

## Problems it solves

| Problem | How this platform helps |
| --- | --- |
| GitHub profiles are hard to present in interviews or applications | Converts raw profile data into a clean, resume-style layout |
| Manually listing repos, stars, and languages is tedious | Auto-pulls top starred repos, languages, and stats from the GitHub API |
| Contribution activity is buried in the GitHub UI | Surfaces recent activity as timeline and type-breakdown charts |
| Building a portfolio site from scratch takes time | One search field → full interactive resume in seconds |
| Static resumes go stale | Always reflects the latest public GitHub data when regenerated |

---

## What the platform offers

### 1. Instant resume generation
- Enter any public GitHub username
- Generate with a click or by pressing **Enter**
- Loading state and clear error handling for invalid/missing users

### 2. Profile summary
- Avatar, display name, and bio
- Location, followers / following, public repo count
- Account age (years on GitHub)
- Quick link: **Visit GitHub Profile**

### 3. Activity & contribution insights
- **Contribution timeline** — line chart of daily activity over the past month
- **Contribution types** — doughnut chart of pushes, pull requests, issues, and create events
- Data sourced from recent public events (up to 100)

### 4. Skills from real projects
- Languages inferred from the user’s repositories
- Interactive skill badges with usage counts
- Hover animations for a more engaging feel

### 5. Top repositories showcase
- Top 10 public repos sorted by stars
- Description, stars, forks, and primary language
- Created / updated dates
- Direct links to each repository on GitHub

### 6. Modern, responsive experience
- Dark, GitHub-inspired theme
- Smooth Framer Motion animations
- Layouts that adapt from desktop to mobile

---

## How it works

```
Username → GitHub API (profile + repos + events) → Process & visualize → Interactive resume
```

1. **Profile** — `GET /users/{username}`
2. **Repositories** — `GET /users/{username}/repos?sort=stars&per_page=10`
3. **Events** — `GET /users/{username}/events?per_page=100`
4. Events from the last month are aggregated into daily counts and event-type totals
5. Languages are counted across returned repos and shown as skill badges

> Uses the public GitHub REST API. No authentication is required for typical public profiles. Heavy use may hit unauthenticated rate limits (~60 requests/hour per IP).

---

## Tech stack

| Layer | Tools |
| --- | --- |
| UI | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, custom CSS (dark theme) |
| Charts | Chart.js + react-chartjs-2 |
| Animation | Framer Motion |
| Icons | Lucide React |
| HTTP | Axios |
| Dates | date-fns |

---

## Getting started

### Prerequisites

- Node.js 18+ (recommended)
- npm

### Install & run

```bash
git clone https://github.com/tushar2k19/github-resume-builder.git
cd github-resume-builder
npm install
npm run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

### Other scripts

```bash
npm run build    # production build → dist/
npm run preview  # preview the production build
npm run lint     # ESLint
```

---

## Usage

1. Open the app
2. Type a GitHub username (e.g. `octocat`)
3. Click **Generate Resume** or press **Enter**
4. Explore the profile, charts, skills, and repositories
5. Use **Visit GitHub Profile** or repo links for the original sources

---

## Project structure

```
src/
├── components/
│   ├── Resume.tsx       # Search UI + GitHub API fetching
│   ├── ResumeBox.tsx    # Resume layout, charts, skills, repos
│   ├── Resume.css
│   └── ResumeBox.css
├── App.tsx              # App shell
├── main.tsx             # Entry point
└── index.css            # Global styles & theme tokens
```

---

## Who is this for?

- **Developers** sharing a living portfolio link instead of a static PDF
- **Job seekers** showcasing real open-source work and activity
- **Recruiters / mentors** quickly scanning a candidate’s GitHub footprint
- **Students** turning coursework and side projects into a visual resume

---

## License

This project is available under the MIT License.

## Acknowledgments

- [GitHub REST API](https://docs.github.com/en/rest) for public profile data
- Chart.js, Framer Motion, and the React / Vite ecosystems
