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

function renderCert(cert) {
  return `
    <div class="cert-card">
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

function renderExtra(item) {
  return `
    <div class="extra-item">
      <div class="extra-body">
        <div class="extra-name">${escapeHtml(item.name)}</div>
        <div class="extra-desc">${escapeHtml(item.desc)}</div>
      </div>
    </div>
  `;
}

// ---------------------------------------------------------------
// Registry fetch + render (projects + certs + extras)
// ---------------------------------------------------------------
async function loadRegistry() {
  try {
    const res = await fetch('data/projects.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();

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
        CERTS_EL.innerHTML = certs.map(renderCert).join('');
      }
    }

    // ---- Extras ----
    if (EXTRAS_EL) {
      const extras = Array.isArray(data.extras) ? data.extras : [];
      if (extras.length === 0) {
        EXTRAS_EL.innerHTML = `<div class="empty-state">nothing listed yet</div>`;
      } else {
        EXTRAS_EL.innerHTML = extras.map(renderExtra).join('');
      }
    }

  } catch (err) {
    if (LIST_EL) LIST_EL.innerHTML = `<div class="empty-state">couldn't reach the registry — data/projects.json may be missing or unreachable</div>`;
    if (META_EL) META_EL.textContent = 'sync failed';
    if (CERTS_EL) CERTS_EL.innerHTML = `<div class="empty-state">failed to load</div>`;
    if (EXTRAS_EL) EXTRAS_EL.innerHTML = `<div class="empty-state">failed to load</div>`;
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
