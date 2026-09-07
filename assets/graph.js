// ---------------------------------------------------------------
// graph.js — Citation Graph Engine (pure functions, no DOM)
// Loaded before script.js and popup.js
// ---------------------------------------------------------------

/**
 * Build a reverse index (backlinks) from a flat relations array.
 * For every { from, type, to } relation, records:
 *   backlinks[to] = [..., { from, type }]
 * This means every entity automatically knows everywhere it is referenced,
 * without ever writing the inverse edge in the data.
 *
 * @param {Array<{from:string, type:string, to:string}>} relations
 * @returns {Object<string, Array<{from:string, type:string}>>}
 */
function buildBacklinks(relations) {
  const backlinks = {};
  for (const { from, type, to } of relations) {
    if (!backlinks[to]) backlinks[to] = [];
    backlinks[to].push({ from, type });
  }
  return backlinks;
}

/**
 * Build a forward index (outlinks) from a flat relations array.
 * For every { from, type, to } relation, records:
 *   outlinks[from] = [..., { to, type }]
 *
 * @param {Array<{from:string, type:string, to:string}>} relations
 * @returns {Object<string, Array<{to:string, type:string}>>}
 */
function buildOutlinks(relations) {
  const outlinks = {};
  for (const { from, type, to } of relations) {
    if (!outlinks[from]) outlinks[from] = [];
    outlinks[from].push({ to, type });
  }
  return outlinks;
}

/**
 * Human-readable label for a relation type.
 * direction: 'forward' (from→to) or 'backward' (to←from / backlink)
 *
 * @param {string} type
 * @param {'forward'|'backward'} direction
 * @returns {string}
 */
function formatRelationType(type, direction) {
  const map = {
    uses:         { forward: 'uses',             backward: 'used in' },
    applies:      { forward: 'applies',           backward: 'applied in' },
    validates:    { forward: 'validates',         backward: 'validated by' },
    demonstrates: { forward: 'demonstrates',      backward: 'demonstrated by' },
    motivated:    { forward: 'motivated',         backward: 'motivated' },
  };
  return (map[type] && map[type][direction]) || type;
}

/**
 * Resolve a depth-bounded citation tree rooted at `id`.
 * Traverses BOTH forward (outlinks) and backward (backlinks) edges so
 * the popup shows the full picture:
 *   - what this entity references
 *   - what references this entity
 *
 * Cycle protection: `visited` Set prevents infinite loops.
 * Depth cap: `depth` limits how many hops of "proof" are shown.
 *
 * @param {string}  id           Entity ID to start from
 * @param {Object}  entities     The full entities map from graph.json
 * @param {Object}  backlinks    Result of buildBacklinks()
 * @param {Object}  outlinks     Result of buildOutlinks()
 * @param {number}  [depth=2]    How many hops deep to traverse
 * @param {Set}     [visited]    (internal) Visited set for cycle prevention
 * @returns {{ id, type, title, description, citations: Array } | null}
 */
function resolveCitationTree(id, entities, backlinks, outlinks, depth, visited) {
  if (depth === undefined) depth = 2;
  if (!visited) visited = new Set();

  if (depth === 0 || visited.has(id)) return null;
  visited.add(id);

  const node = entities[id];
  if (!node) return null;

  const citations = [];

  // Forward edges (what this node points to)
  const fwd = outlinks[id] || [];
  for (const { to, type } of fwd) {
    const child = resolveCitationTree(to, entities, backlinks, outlinks, depth - 1, new Set(visited));
    if (child) {
      citations.push({ ...child, _relation: formatRelationType(type, 'forward'), _direction: 'forward' });
    }
  }

  // Backward edges (what points to this node)
  const bwd = backlinks[id] || [];
  for (const { from, type } of bwd) {
    const child = resolveCitationTree(from, entities, backlinks, outlinks, depth - 1, new Set(visited));
    if (child) {
      citations.push({ ...child, _relation: formatRelationType(type, 'backward'), _direction: 'backward' });
    }
  }

  return {
    id,
    type:        node.type,
    title:       node.title,
    description: node.description || '',
    url:         node.url || node.verify_url || null,
    issuer:      node.issuer || null,
    year:        node.year || null,
    citations,
  };
}

// ---------------------------------------------------------------
// Export to global scope (no module bundler needed)
// ---------------------------------------------------------------
window.GraphEngine = {
  buildBacklinks,
  buildOutlinks,
  resolveCitationTree,
  formatRelationType,
};
