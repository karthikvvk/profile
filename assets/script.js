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

function renderRow(project) {
  const dotClass = statusDotClass(project.status);
  const isLive = project.status === 'live' && project.url;

  const tags = (project.tags || [])
    .map(t => `<span>${escapeHtml(t)}</span>`)
    .join('');

  const action = isLive
    ? `<div class="row-action">
         <a href="${escapeAttr(project.url)}" target="_blank" rel="noopener">visit ↗</a>
       </div>`
    : `<div class="row-action pending"><span>not yet deployed</span></div>`;

  return `
    <div class="row">
      <div class="pulse-dot ${dotClass}" aria-hidden="true"></div>
      <div class="row-body">
        <div class="row-top">
          <span class="row-name">${escapeHtml(project.name)}</span>
          ${project.path ? `<span class="row-path">${escapeHtml(project.path)}</span>` : ''}
        </div>
        <p class="row-desc">${escapeHtml(project.description || '')}</p>
        <div class="tags">${tags}</div>
      </div>
      ${action}
    </div>
  `;
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

async function loadRegistry() {
  try {
    const res = await fetch('data/projects.json', { cache: 'no-store' });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();

    const projects = Array.isArray(data.projects) ? data.projects : [];

    if (projects.length === 0) {
      LIST_EL.innerHTML = `<div class="empty-state">registry is empty — nothing indexed yet</div>`;
    } else {
      LIST_EL.innerHTML = projects.map(renderRow).join('');
    }

    if (data.updated_at) {
      const d = new Date(data.updated_at);
      META_EL.textContent = `last synced ${d.toISOString().slice(0, 16).replace('T', ' ')} UTC`;
    } else {
      META_EL.textContent = 'synced';
    }
  } catch (err) {
    LIST_EL.innerHTML = `<div class="empty-state">couldn't reach the registry — data/projects.json may be missing or unreachable</div>`;
    META_EL.textContent = 'sync failed';
  }
}

loadRegistry();
