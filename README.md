# GitHub Resume Builder

Turn a public GitHub profile into a shareable developer resume — curated work, language volume, and activity signals that a normal profile page does not explain.

Paste a username or profile link. The app reads public GitHub data and builds one dark charcoal sheet you can open, copy, or print. No signup.

### Live demo

**[https://github-resumer.netlify.app/](https://github-resumer.netlify.app/)**

Open a specific profile with a query, for example:

`https://github-resumer.netlify.app/?u=gaearon`

---

## What changed in this version

The old dark-green “GitHub mirror” (follower counts, a smoothed event line, a doughnut, star-sorted repo cards) is gone. This release is a full visual and analytics redesign:

- **Warm charcoal UI** — ground `#0C0B0A`, cards one step lighter, soft off-white text. Not GitHub cool-gray panels, not a pastel paper sheet, not a rainbow of section colors.
- **One quiet green accent** — thin lines, arcs, and beads (`#3DDC84`). Green is structure, not a language color.
- **Analytics GitHub does not surface clearly** — languages by code volume, then-vs-now stack, ranked selected work, follow-through, active days, outside-reach, and a honest build log.
- **Repo orrery** — one restrained 3D scene of featured projects (SVG still when WebGL is off, motion is reduced, or you print).
- **Shareable sheet** — `?u=username`, copy link, copy Markdown, pin projects in the URL hash, print / save PDF. A screen-only Coach drawer keeps polish notes off the page you send.

---

## Problems it solves

| Problem | How this platform helps |
| --- | --- |
| A GitHub profile is hard to send as a resume | Builds one readable sheet from public data |
| Language badges by “number of repos” misrepresent effort | Weighs languages by bytes (with estimated leftovers labeled) |
| Star-sorted repo lists bury real work | Ranks a small featured set by recency, substance, legibility, and community |
| Activity charts often invent trends from sparse events | Uses beads, heatmaps, and a mosaic when there is not enough public data |
| Static resumes go stale | Regenerates from the latest public GitHub data |

---

## What the platform offers

### Instant generation
- Username, `@user`, or a `github.com/...` link
- Sample profile and clear errors (not found, organization, rate limit with reset time)
- Progressive load: core sheet first, then language bytes and READMEs

### Identity & selected work
- Templated headline from facts only (no AI seniority score)
- Up to four featured originals with a real summary (description, README excerpt, or a fallback — never “No description provided”)
- Pin / unpin into the URL hash

### Stack & signals
- Language ribbon by volume, then-vs-now over the last 180 days
- Last shipped, follow-through, active days, outside reach, original-work share, years with projects
- Each metric has a plain caption and a “How?” disclosure

### Rhythm & method
- Event beads, weekday × hour grid (UTC), event-mix ribbon
- Sparse accounts get a year–month repo mosaic instead of a fake curve
- Visible build log: event window, repos analyzed, estimates, requests remaining

### Experience
- Warm charcoal theme, Instrument Sans + JetBrains Mono
- Framer Motion reveals with a motion toggle and `prefers-reduced-motion`
- Responsive layout; print hides the coach and live WebGL

---

## How it works

```
Username → GitHub REST (profile, repos, events, languages, READMEs) → analyze → charcoal resume sheet
```

Typical calls per generation (about 13):

1. `GET /users/{username}`
2. `GET /users/{username}/repos?type=owner&sort=pushed&per_page=100`
3. `GET /users/{username}/events/public?per_page=100`
4. `GET /repos/{owner}/{repo}/languages` for the top originals
5. `GET /repos/{owner}/{repo}/readme` for featured work

Language and README payloads are cached in `localStorage` by `full_name + pushed_at`. Optional local token: set `VITE_GITHUB_TOKEN` in `.env.local` (see `.env.example`). Never commit a real token — a client bundle would expose it.

> Public data only. Unauthenticated GitHub limits are low (~60 requests/hour per IP). Private and org-only work is not visible.

---

## Tech stack

| Layer | Tools |
| --- | --- |
| UI | React 18, TypeScript, Vite |
| Styling | Tailwind CSS, charcoal design tokens |
| 3D | three.js, @react-three/fiber, @react-three/drei |
| Animation | Framer Motion |
| Charts / graphics | Custom ribbons, beads, rings (Chart.js still available) |
| Icons | Lucide React |
| HTTP | Axios |
| Dates | date-fns |
| Fonts | Instrument Sans, JetBrains Mono |

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

Open the local URL printed by Vite (often `http://localhost:5173` or the next free port).

### Other scripts

```bash
npm run build    # production build → dist/
npm run preview  # preview the production build
npm run lint     # ESLint
```

---

## Usage

1. Open the app
2. Enter a GitHub username or paste a profile link
3. Click **Generate resume**, or open `?u=username`
4. Explore identity, selected work, stack, signals, and rhythm
5. Copy the link or Markdown, pin projects, or print / save as PDF
6. Use **Coach** for screen-only notes (missing READMEs, rate limits) — those stay off the shared sheet

---

## Project structure

```
src/
├── components/
│   ├── Resume.tsx          # State owner: loadResume, share, pins
│   ├── MotionToggle.tsx
│   ├── stage/              # Search / landing
│   ├── resume/             # Sheet sections, coach, toolbar
│   └── scene/              # Repo orrery + SVG still
├── lib/                    # GitHub client, analyze, languages, log, types
├── ui/                     # Tokens, motion, share helpers, hooks
├── utils/
│   └── parseGitHubUsername.ts
├── App.tsx
├── main.tsx
└── index.css
```

---

## Who is this for?

- **Developers** sharing a living portfolio link instead of a static PDF
- **Job seekers** showing what they build, with what, and how recently
- **Recruiters / mentors** scanning a candidate’s public footprint quickly
- **Students** turning coursework and side projects into one sendable page

---

## License

This project is available under the MIT License.

## Acknowledgments

- [GitHub REST API](https://docs.github.com/en/rest) for public profile data
- three.js / React Three Fiber, Framer Motion, Tailwind, and the React / Vite ecosystems
