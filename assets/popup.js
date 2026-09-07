// ---------------------------------------------------------------
// popup.js — Citation Overlay & Focus Trap
// Depends on graph.js (window.GraphEngine) being loaded first.
// ---------------------------------------------------------------

(function () {
  'use strict';

  // ── State ───────────────────────────────────────────────────
  let _graph     = null;   // { entities, relations }
  let _backlinks = null;
  let _outlinks  = null;
  let _triggerEl = null;   // element that opened the popup (for focus restore)

  // ── Colour tokens per entity type ───────────────────────────
  const TYPE_META = {
    project:       { label: 'PROJECT',       accent: 'var(--amber)',   icon: '◉' },
    certification: { label: 'CERTIFICATION', accent: 'var(--signal)',  icon: '◈' },
    skill:         { label: 'SKILL',         accent: '#7C9EF8',        icon: '◆' },
    hobby:         { label: 'HOBBY',         accent: '#B47FEB',        icon: '◇' },
  };

  // ── Overlay DOM bootstrap (called once on DOMContentLoaded) ──
  function bootstrap() {
    const overlay = document.getElementById('citation-overlay');
    if (!overlay) return;

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay || e.target.classList.contains('popup-backdrop')) {
        closePopup();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !overlay.hidden) closePopup();
      if (e.key === 'Tab'    && !overlay.hidden) trapFocus(e);
    });
  }

  // ── Public API: attach the graph data ───────────────────────
  function attachGraph(graph) {
    _graph     = graph;
    _backlinks = GraphEngine.buildBacklinks(graph.relations);
    _outlinks  = GraphEngine.buildOutlinks(graph.relations);
  }

  // ── Open popup for a given entity ID ────────────────────────
  function openPopup(entityId, triggerElement) {
    if (!_graph) return;

    _triggerEl = triggerElement || document.activeElement || null;

    const tree = GraphEngine.resolveCitationTree(
      entityId,
      _graph.entities,
      _backlinks,
      _outlinks,
      2          // depth = 2 hops
    );
    if (!tree) return;

    const overlay = document.getElementById('citation-overlay');
    if (!overlay) return;

    overlay.innerHTML = buildPopupHTML(tree);
    overlay.hidden = false;
    document.body.style.overflow = 'hidden';

    // Focus the close button
    const closeBtn = overlay.querySelector('.popup-close');
    if (closeBtn) closeBtn.focus();

    // Wire inner node clicks (chained navigation)
    overlay.querySelectorAll('[data-popup-entity]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = el.getAttribute('data-popup-entity');
        openPopup(id, _triggerEl); // keep original trigger for final restore
      });
    });
  }

  // ── Close popup ─────────────────────────────────────────────
  function closePopup() {
    const overlay = document.getElementById('citation-overlay');
    if (!overlay) return;
    overlay.hidden = true;
    overlay.innerHTML = '';
    document.body.style.overflow = '';
    if (_triggerEl && typeof _triggerEl.focus === 'function') {
      _triggerEl.focus();
    }
    _triggerEl = null;
  }

  // ── Focus trap ──────────────────────────────────────────────
  function trapFocus(e) {
    const overlay = document.getElementById('citation-overlay');
    if (!overlay) return;
    const focusable = Array.from(
      overlay.querySelectorAll(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(el => !el.disabled && el.offsetParent !== null);

    if (focusable.length === 0) { e.preventDefault(); return; }
    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first.focus(); }
    }
  }

  // ── HTML builders ────────────────────────────────────────────

  function escHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildPopupHTML(tree) {
    const meta   = TYPE_META[tree.type] || { label: tree.type.toUpperCase(), accent: 'var(--muted)', icon: '○' };
    const titleLink = tree.url
      ? `<a href="${escHtml(tree.url)}" class="popup-title-link" target="_blank" rel="noopener">${escHtml(tree.title)} ↗</a>`
      : `<span class="popup-title-text">${escHtml(tree.title)}</span>`;

    const certMeta = (tree.issuer || tree.year)
      ? `<div class="popup-cert-meta">
           ${tree.issuer ? `<span class="popup-cert-issuer">${escHtml(tree.issuer)}</span>` : ''}
           ${tree.issuer && tree.year ? `<span class="popup-cert-dot">·</span>` : ''}
           ${tree.year   ? `<span class="popup-cert-year">${escHtml(tree.year)}</span>` : ''}
         </div>` : '';

    const citationsHTML = tree.citations.length > 0
      ? `<div class="popup-citations">
           <div class="popup-citations-label">
             <span class="popup-cit-icon">⟳</span> Citation Graph
             <span class="popup-cit-hint">click any node to explore</span>
           </div>
           ${buildCitationList(tree.citations, 0)}
         </div>`
      : `<div class="popup-citations popup-citations--empty">
           <span class="popup-cit-icon">○</span>
           No cross-references found for this entity.
         </div>`;

    return `
      <div class="popup-backdrop" aria-hidden="true"></div>
      <div class="popup-window"
           role="dialog"
           aria-modal="true"
           aria-labelledby="popup-title-heading">
        <div class="popup-header">
          <div class="popup-header-left">
            <span class="popup-entity-type" style="color:${meta.accent}">
              ${meta.icon} ${meta.label}
            </span>
            <h2 class="popup-title" id="popup-title-heading">${titleLink}</h2>
            ${certMeta}
          </div>
          <button class="popup-close" aria-label="Close citation panel" onclick="CitationPopup.close()">
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div class="popup-description">${escHtml(tree.description)}</div>

        ${citationsHTML}


      </div>
    `;
  }

  /**
   * Recursively render citation nodes as a nested list.
   * Each node shows: §ref · relation label · entity title
   */
  function buildCitationList(citations, depth) {
    if (!citations || citations.length === 0) return '';

    const items = citations.map((cit, idx) => {
      const meta     = TYPE_META[cit.type] || { label: cit.type, accent: 'var(--muted)', icon: '○' };
      const refLabel = '§' + (depth > 0 ? (depth + '.' + (idx + 1)) : (idx + 1));
      const hasChildren = cit.citations && cit.citations.length > 0;

      return `
        <li class="citation-node citation-node--depth-${depth}" data-depth="${depth}">
          <div class="citation-node-row">
            <span class="citation-relation">${escHtml(cit._relation || '')}</span>
            <button class="citation-entity-btn"
                    data-popup-entity="${escHtml(cit.id)}"
                    style="--entity-accent:${meta.accent}"
                    aria-label="Explore ${escHtml(cit.title)} citation graph">
              <span class="citation-entity-icon" aria-hidden="true">${meta.icon}</span>
              <span class="citation-entity-title">${escHtml(cit.title)}</span>
              <span class="citation-entity-type-badge">${meta.label}</span>
            </button>
          </div>
          ${hasChildren ? buildCitationList(cit.citations, depth + 1) : ''}
        </li>
      `;
    }).join('');

    return `<ul class="citation-list citation-list--depth-${depth}">${items}</ul>`;
  }

  // ── Register on DOMContentLoaded ─────────────────────────────
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }

  // ── Global API ───────────────────────────────────────────────
  window.CitationPopup = {
    attachGraph,
    open: openPopup,
    close: closePopup,
  };

})();
