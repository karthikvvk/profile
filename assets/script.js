// ---------------------------------------------------------------
// Live clock — small ambient touch, purely cosmetic
// ---------------------------------------------------------------
function tickClock() {
  const el = document.getElementById('clock');
  if (!el) return;
  const now = new Date();
  el.textContent = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}
tickClock();
setInterval(tickClock, 1000);

// ---------------------------------------------------------------
// Registry fetch + render
// ---------------------------------------------------------------
const LIST_EL = document.getElementById('registryList');
const META_EL = document.getElementById('syncMeta');

function statusDotClass(status) {
  if (status === 'live') return 'live';
  if (status === 'offline') return 'offline';
  return 'idle'; // "pending" / unknown
}

/**
 * Given a GitHub URL (https://github.com/owner/repo[.git]),
 * return { owner, repo } or null if not a valid GitHub URL.
 */
function parseGithubUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url.replace(/\.git$/, ''));
    if (u.hostname !== 'github.com') return null;
    const parts = u.pathname.replace(/^\//, '').split('/');
    if (parts.length < 2) return null;
    return { owner: parts[0], repo: parts[1] };
  } catch {
    return null;
  }
}

/**
 * Fetch the last commit timestamp for a GitHub repo via the public API.
 * Returns an ISO string or null on failure.
 */
async function fetchLastCommitTime(owner, repo) {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`,
      { headers: { Accept: 'application/vnd.github+json' } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    return data[0]?.commit?.committer?.date ?? data[0]?.commit?.author?.date ?? null;
  } catch {
    return null;
  }
}

function formatCommitTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  return `last commit ${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

function renderRow(project, commitLabel) {
  const dotClass = statusDotClass(project.status);

  const tags = (project.tags || [])
    .map(t => `<span>${escapeHtml(t)}</span>`)
    .join('');

  // Prefer live deploy URL, fall back to GitHub repo path
  const primaryHref = (project.url && project.url.trim()) ? project.url : (project.path || '#');
  const actionLabel = (project.url && project.url.trim()) ? 'visit ↗' : (project.path ? 'view repo ↗' : '');

  const commitMeta = commitLabel
    ? `<span class="row-commit-time">${escapeHtml(commitLabel)}</span>`
    : `<span class="row-commit-time loading">fetching…</span>`;

  return `
    <a class="row row-link" href="${escapeAttr(primaryHref)}" target="_blank" rel="noopener" aria-label="${escapeAttr(project.name)}">
      <div class="pulse-dot ${dotClass}" aria-hidden="true"></div>
      <div class="row-body">
        <div class="row-top">
          <span class="row-name">${escapeHtml(project.name)}</span>
          ${commitMeta}
        </div>
        <p class="row-desc">${escapeHtml(project.description || '')}</p>
        <div class="tags">${tags}</div>
      </div>
      <div class="row-action${actionLabel ? '' : ' pending'}">
        <span>${actionLabel || 'no link'}</span>
      </div>
    </a>
  `;
}

// ---------------------------------------------------------------
// Certificates
// ---------------------------------------------------------------
const CERTS_EL = document.getElementById('certsList');

function renderCert(cert, entityId) {
  const clickAttrs = entityId
    ? ` data-entity-id="${escapeAttr(entityId)}" class="cert-card cert-clickable" tabindex="0" role="button" aria-label="View citation graph for ${escapeAttr(cert.name)}"`
    : ` class="cert-card"`;

  return `
    <div${clickAttrs}>
      <div class="cert-icon" aria-hidden="true">◈</div>
      <div class="cert-body">
        <div class="cert-name">${escapeHtml(cert.name)}</div>
        <div class="cert-meta">
          <span class="cert-issuer">${escapeHtml(cert.issuer)}</span>
          <span class="cert-dot">·</span>
          <span class="cert-date">${escapeHtml(cert.year)}</span>
        </div>
      </div>
      ${cert.verify_url
        ? `<a href="${escapeAttr(cert.verify_url)}" class="cert-badge" target="_blank" rel="noopener" aria-label="Verify ${escapeAttr(cert.name)}">verify ↗</a>`
        : '<span class="cert-badge" style="opacity:0.4;cursor:default">no link</span>'
      }
    </div>
  `;
}

// ---------------------------------------------------------------
// Extracurriculars / Hobbies
// ---------------------------------------------------------------
const EXTRAS_EL = document.getElementById('extrasGrid');

function renderExtra(item, entityId) {
  const clickAttrs = entityId
    ? ` data-entity-id="${escapeAttr(entityId)}" class="extra-item extra-clickable" tabindex="0" role="button" aria-label="View citation graph for ${escapeAttr(item.name)}"`
    : ` class="extra-item"`;

  return `
    <div${clickAttrs}>
      <div class="extra-body">
        <div class="extra-name">${escapeHtml(item.name)}</div>
        <div class="extra-desc">${escapeHtml(item.desc)}</div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------
// Skills section
// ---------------------------------------------------------------
const SKILLS_EL = document.getElementById('skillsList');

function renderSkills(entities) {
  if (!SKILLS_EL) return;
  const skills = Object.entries(entities)
    .filter(([, e]) => e.type === 'skill')
    .sort((a, b) => a[1].title.localeCompare(b[1].title));

  if (skills.length === 0) {
    SKILLS_EL.innerHTML = `<div class="empty-state">no skills indexed yet</div>`;
    return;
  }

  SKILLS_EL.innerHTML = skills.map(([id, skill]) => `
    <button class="skill-pill"
            data-entity-id="${escapeAttr(id)}"
            aria-label="Explore ${escapeAttr(skill.title)} citation graph">
      <span class="skill-pill-icon" aria-hidden="true">◆</span>
      ${escapeHtml(skill.title)}
    </button>
  `).join('');

  // Wire click handlers
  SKILLS_EL.querySelectorAll('.skill-pill[data-entity-id]').forEach(el => {
    el.addEventListener('click', () => {
      CitationPopup.open(el.getAttribute('data-entity-id'), el);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        CitationPopup.open(el.getAttribute('data-entity-id'), el);
      }
    });
  });
}

// ---------------------------------------------------------------
// Wire click handlers to an already-rendered container
// ---------------------------------------------------------------
function wireClickHandlers(container) {
  if (!container) return;
  container.querySelectorAll('[data-entity-id]').forEach(el => {
    el.addEventListener('click', (e) => {
      // Don't intercept clicks on the verify link inside cert cards
      if (e.target.closest('a')) return;
      CitationPopup.open(el.getAttribute('data-entity-id'), el);
    });
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        CitationPopup.open(el.getAttribute('data-entity-id'), el);
      }
    });
  });
}

// ---------------------------------------------------------------
// Build entity-id lookup from graph.json keyed by entity title
// ---------------------------------------------------------------
function buildTitleIndex(entities) {
  const idx = {};
  for (const [id, ent] of Object.entries(entities)) {
    if (ent.ref) idx[ent.ref] = id;
    idx[ent.title] = id;
  }
  return idx;
}

// ---------------------------------------------------------------
// Registry fetch + render (projects + certs + extras + skills)
// ---------------------------------------------------------------
async function loadRegistry() {
  try {
    // Fetch projects.json and graph.json in parallel
    const [projRes, graphRes] = await Promise.all([
      fetch('data/projects.json', { cache: 'no-store' }),
      fetch('data/graph.json',    { cache: 'no-store' }),
    ]);

    if (!projRes.ok) throw new Error(`projects.json status ${projRes.status}`);
    const data  = await projRes.json();

    // Graph may fail gracefully — features degrade but site still works
    let graphData = null;
    if (graphRes.ok) {
      graphData = await graphRes.json();
      CitationPopup.attachGraph(graphData);
    }

    const titleIdx = graphData ? buildTitleIndex(graphData.entities) : {};

    // ---- Projects ----
    const projects = Array.isArray(data.projects) ? data.projects : [];

    if (projects.length === 0) {
      LIST_EL.innerHTML = `<div class="empty-state">registry is empty — nothing indexed yet</div>`;
      META_EL.textContent = 'registry empty';
    } else {
      LIST_EL.innerHTML = projects.map(p => renderRow(p, null)).join('');
      META_EL.textContent = 'fetching commit times…';

      const commitTimes = await Promise.all(
        projects.map(async (project) => {
          const gh = parseGithubUrl(project.path);
          if (!gh) return null;
          const iso = await fetchLastCommitTime(gh.owner, gh.repo);
          return formatCommitTime(iso);
        })
      );

      LIST_EL.innerHTML = projects.map((p, i) => renderRow(p, commitTimes[i])).join('');
      const reached = commitTimes.filter(Boolean).length;
      META_EL.textContent = `synced · ${reached}/${projects.length} repos reached`;
    }

    // ---- Certificates ----
    if (CERTS_EL) {
      const certs = Array.isArray(data.certificates) ? data.certificates : [];
      if (certs.length === 0) {
        CERTS_EL.innerHTML = `<div class="empty-state">no certificates listed yet</div>`;
      } else {
        CERTS_EL.innerHTML = certs.map(cert => {
          const entityId = titleIdx[cert.name] || null;
          return renderCert(cert, entityId);
        }).join('');
        wireClickHandlers(CERTS_EL);
      }
    }

    // ---- Skills ----
    if (graphData) renderSkills(graphData.entities);

    // ---- Extras ----
    if (EXTRAS_EL) {
      const extras = Array.isArray(data.extras) ? data.extras : [];
      if (extras.length === 0) {
        EXTRAS_EL.innerHTML = `<div class="empty-state">nothing listed yet</div>`;
      } else {
        EXTRAS_EL.innerHTML = extras.map(item => {
          const entityId = titleIdx[item.name] || null;
          return renderExtra(item, entityId);
        }).join('');
        wireClickHandlers(EXTRAS_EL);
      }
    }

  } catch (err) {
    if (LIST_EL) LIST_EL.innerHTML = `<div class="empty-state">couldn't reach the registry — data/projects.json may be missing or unreachable</div>`;
    if (META_EL) META_EL.textContent = 'sync failed';
    if (CERTS_EL) CERTS_EL.innerHTML = `<div class="empty-state">failed to load</div>`;
    if (EXTRAS_EL) EXTRAS_EL.innerHTML = `<div class="empty-state">failed to load</div>`;
    console.error('[registry]', err);
  }
}

loadRegistry();

// ---------------------------------------------------------------
// Extracurriculars / Hobbies — expand toggle
// ---------------------------------------------------------------
(function () {
  const toggle = document.getElementById('extrasToggle');
  const panel  = document.getElementById('extrasPanel');
  if (!toggle || !panel) return;

  toggle.addEventListener('click', () => {
    const isExpanded = toggle.getAttribute('aria-expanded') === 'true';
    toggle.setAttribute('aria-expanded', String(!isExpanded));
    panel.hidden = isExpanded;
  });
})();

// ---------------------------------------------------------------
// Download PDF
// ---------------------------------------------------------------
(function () {
  const btn = document.getElementById('btnDownloadPdf');
  if (!btn) return;
  btn.addEventListener('click', () => {
    // Expand hobbies panel for print
    const panel = document.getElementById('extrasPanel');
    const toggle = document.getElementById('extrasToggle');
    const wasHidden = panel && panel.hidden;
    if (wasHidden) {
      panel.hidden = false;
      if (toggle) toggle.setAttribute('aria-expanded', 'true');
    }
    window.print();
    // Restore state after print dialog closes
    if (wasHidden) {
      setTimeout(() => {
        panel.hidden = true;
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      }, 500);
    }
  });
})();
