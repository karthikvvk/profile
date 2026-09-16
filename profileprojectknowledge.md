# Profile — Project Knowledge

## Project Overview
Static personal portfolio website for **Karthik Venkatasubramanian**, a backend/distributed-systems engineer.
- **Goal:** Concise, credible, developer-centric portfolio — proof of work over prose.
- **Deployment:** Vercel, with a DuckDNS DNS record pointing to it.
- **Aesthetic:** Terminal/dashboard theme — monospace typography, orange accent, neutral gray background.

---

## Source Code Map
```
./                         ← project root (source of truth, no build step)
├── index.html             ← single-page markup, semantic HTML5
├── assets/
│   ├── style.css          ← all styles (vanilla CSS, design tokens via :root)
│   ├── script.js          ← main logic: registry fetch, render, expand toggle, PDF print
│   ├── graph.js           ← citation/knowledge-graph popup engine
│   └── popup.js           ← overlay UI for entity citations
└── data/
    ├── projects.json      ← content source: projects, certificates, extras/hobbies
    └── graph.json         ← knowledge graph: entities (projects, skills, certs, hobbies) + relations
```
> The root `./` IS the source. Served as-is on Vercel — no build tooling, no dependencies.

---

## Design System (style.css — CSS Custom Properties)

| Token              | Value            | Role                                         |
|--------------------|------------------|----------------------------------------------|
| `--bg`             | `#efefef`        | Page background                              |
| `--surface`        | `#efefef`        | Card/element surface (same as bg)            |
| `--surface-raised` | `#fff2e0`        | Hover/active elevated surface (warm cream)   |
| `--border`         | `#000000`        | All card and button borders                  |
| `--text`           | `#2c2c2c`        | Primary body text                            |
| `--muted`          | `#7a7a7a`        | Secondary/meta text, section labels          |
| `--muted-dim`      | `#4C5A72`        | Timestamps, subtle UI chrome                 |
| `--signal`         | `#e19b39`        | Accent — buttons, dots, cert icon, tags      |
| `--amber`          | `#d27b00`        | Cert issuer text, inline code color          |
| `--danger`         | `#E5697B`        | Offline status dot                           |
| `--font-mono`      | JetBrains Mono   | All headings, labels, tags, code, buttons    |
| `--font-body`      | Inter            | Body/description paragraphs                  |
| `--radius`         | `4px`            | Border-radius on cards and buttons           |
| `--max-w`          | `760px`          | Centered content column max-width            |

- **Skill pills** use blue-lavender: `#7C9EF8` text, `rgba(124,158,248,0.08)` bg, `99px` border-radius.
- **Hobbies section** background: `#ffe4bf` (peach/cream container block).

---

## Page Architecture (index.html)

### Sections (top → bottom)
1. **Header** — `<header class="header">` — Name H1 + nav links (Email, Github, LinkedIn, Resume, ⬇ Download as PDF)
2. **Projects** — `<section class="registry">` — dynamic list from `data/projects.json`
3. **Certificates** — `<section class="certs-section">` — dynamic list from `data/projects.json`
4. **Skills** — `<section class="skills-section">` — pill cloud from `data/graph.json` (type=`skill`)
5. **Extracurriculars & Hobbies** — `<section class="expand-section">` — collapsible, peach bg, 2-col grid, from `data/projects.json` (`extras`)
6. **Citation Overlay** — `<div id="citation-overlay">` — knowledge graph modal popup

### JavaScript Modules (load order)
1. `assets/graph.js` — loads and indexes `graph.json`; exposes `CitationPopup.attachGraph()`
2. `assets/popup.js` — renders the overlay modal (`CitationPopup.open(entityId, triggerEl)`)
3. `assets/script.js` — orchestrates all rendering; calls `loadRegistry()` on page load

---

## Data Model

### `data/projects.json`
```jsonc
{
  "updated_at": "ISO string",
  "projects": [
    {
      "name": "string",
      "path": "github URL",     // repo link — used as fallback action href
      "description": "string",
      "tags": ["string"],       // rendered as orange outlined pills
      "status": "pending | live | offline | Not Applicable",
      "url": ""                 // live deploy URL — preferred over path if non-empty
    }
  ],
  "certificates": [
    { "name": "string", "issuer": "string", "year": "string", "verify_url": "URL" }
  ],
  "extras": [
    { "name": "string", "desc": "string" }
  ]
}
```

### `data/graph.json`
```jsonc
{
  "entities": {
    "<id>": {
      "type": "project | skill | certification | hobby",
      "title": "string",
      "ref": "string",      // optional — cross-referenced to projects.json names for popup wiring
      "description": "string",
      "url": "optional"
    }
  },
  "relations": [
    { "from": "<entity-id>", "type": "uses | applies | validates | demonstrates | motivated", "to": "<entity-id>" }
  ]
}
```

---

## Current Content Inventory

### Projects (6)
| Name                 | Stack                                           | GitHub                                        |
|----------------------|-------------------------------------------------|-----------------------------------------------|
| GPSTracker           | Flutter, Flask, Socket.IO                       | karthikvvk/GPSTrackerBackend                  |
| MultiLangTranscriber | FastAPI, RAG, STT, LLM, Visual-Context          | karthikvvk/Multi-Lang-Transcriber             |
| TRACE                | MCP, Browser-Agent, FastAPI, SQLite             | magizhanj/TRACE                               |
| LANFXplorer          | QUIC, P2P, Networking                           | karthikvvk/LANFXplorer                        |
| sndcpy               | OSS Contribution (GUI + wireless audio)         | karthikvvk/sndcpy                             |
| okular               | OSS Contribution (KDE async printing)           | karthikvvk/okular                             |

### Certificates (1)
- **AWS Certified Cloud Architect – Practitioner** · Amazon Web Services · 2024
- Verify: `cp.certmetrics.com/amazon/…/69df09101a284277a22a1b1a4bc3626c`

### Skills (13 — sourced from graph.json, type=`skill`, rendered alphabetically)
Cloud Architecture, FastAPI, Flask, Flutter, LLM Integration, Linux Systems,
MCP (Model Context Protocol), Open Source Contribution, P2P Networking,
QUIC Protocol, RAG (Retrieval-Augmented Generation), Socket.IO, SQLite

### Hobbies / Extras (3)
| Name                      | Description summary                                                     |
|---------------------------|-------------------------------------------------------------------------|
| Open Source Contributions | Bug fixes, docs, small features across multiple repos                   |
| Home Labing               | Self-hosting daily-use apps not freely available in market              |
| Driving                   | Long drives as travel; motivated the GPS tracking project               |

---

## Key Rendering Behaviors (script.js)

| Behavior                  | Detail                                                                                     |
|---------------------------|--------------------------------------------------------------------------------------------|
| Last commit timestamp     | Live-fetched from GitHub public API per repo; shown as `last commit YYYY-MM-DD HH:MM UTC` |
| Status dot                | `live` → orange pulsing; `idle/pending` → gray; `offline` → red                           |
| Action button label       | `visit ↗` if `url` set, `view repo ↗` if only `path` set, `no link` otherwise             |
| Skills rendering          | Filtered from graph entities where `type === "skill"`, sorted A→Z                         |
| Skill pill click          | Opens citation popup: `CitationPopup.open(entityId, triggerEl)`                           |
| Cert / extras click       | Also opens popup if a matching entity `ref` exists in graph.json                           |
| Download as PDF           | Expands hobbies panel → `window.print()` → restores panel state after 500ms               |
| Parallel data fetch       | `projects.json` and `graph.json` fetched in parallel with `Promise.all`                   |
| Graceful graph failure    | If graph.json fails, site still renders — click-to-popup features are silently disabled   |

---

## Interaction & UX Patterns

- **Scanline overlay**: Fixed `repeating-linear-gradient` CRT texture (z-index 1, `pointer-events: none`).
- **Skeleton loading**: Shimmer placeholder cards while fetch resolves.
- **Collapsible section**: Uses `aria-expanded`, `hidden` attribute, and `slideDown` CSS keyframe animation.
- **Micro-animations**: Skill pills lift on hover (`translateY(-1px)`); download button has brightness/scale effect.
- **Focus management**: All interactive elements have `focus-visible` outlines using `--signal` color.
- **Responsive**: At ≤560px, project rows collapse to single column and cert badge spans full width.

---

## Guidelines Alignment

| Guideline                        | How it's met                                                                                        |
|----------------------------------|-----------------------------------------------------------------------------------------------------|
| Concise & structured             | Single page, data-driven sections, no decorative prose                                              |
| Content accuracy & credibility   | All repo URLs, cert verify link, and issuer names are real and linkable                             |
| Proof of work + tech interest    | Live commit timestamps, citation graph, AWS cert verify link, OSS contribution projects             |
| Clear UI/UX communication        | Monospace terminal aesthetic with consistent spacing, color hierarchy, ARIA labels, accessible focus |
