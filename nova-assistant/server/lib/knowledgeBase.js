const fs = require("fs");
const path = require("path");

const KNOWLEDGE_PATH = path.join(__dirname, "..", "data", "knowledge.json");

/**
 * Flattens the structured knowledge.json into small, retrievable "chunks".
 * Each chunk has a label (for citation/debugging) and searchable text.
 * This keeps the knowledge source swappable: replace knowledge.json with
 * a DB-backed loader later without touching the retrieval or chat route.
 */
function loadKnowledge() {
  const raw = fs.readFileSync(KNOWLEDGE_PATH, "utf-8");
  return JSON.parse(raw);
}

function flatten(obj, labelPrefix, chunks) {
  if (obj === null || obj === undefined) return;

  if (Array.isArray(obj)) {
    obj.forEach((item, i) => flatten(item, `${labelPrefix}[${i}]`, chunks));
    return;
  }

  if (typeof obj === "object") {
    const textParts = [];
    let hasNestedObject = false;

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === "object" && value !== null) {
        hasNestedObject = true;
        flatten(value, `${labelPrefix}.${key}`, chunks);
      } else {
        textParts.push(`${key}: ${value}`);
      }
    }

    if (textParts.length > 0) {
      chunks.push({
        label: labelPrefix,
        text: textParts.join(" | ")
      });
    }
    return;
  }

  chunks.push({ label: labelPrefix, text: String(obj) });
}

function buildChunks() {
  const data = loadKnowledge();
  const chunks = [];
  flatten(data, "knowledge", chunks);
  return chunks;
}

// Cache chunks in memory; rebuild if the file changes.
let cachedChunks = null;
let cachedMtime = 0;

function getChunks() {
  const stat = fs.statSync(KNOWLEDGE_PATH);
  if (!cachedChunks || stat.mtimeMs !== cachedMtime) {
    cachedChunks = buildChunks();
    cachedMtime = stat.mtimeMs;
  }
  return cachedChunks;
}

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "of", "to", "for", "and", "in", "on",
  "what", "where", "when", "how", "do", "does", "i", "my", "at", "it"
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !STOPWORDS.has(t));
}

/**
 * Very simple keyword-overlap retrieval. Good enough for a small,
 * structured knowledge base. Swap for embeddings-based RAG later if
 * the knowledge base grows large — the interface (retrieve(query, k))
 * stays the same either way.
 */
function retrieve(query, k = 5) {
  const chunks = getChunks();
  const queryTokens = new Set(tokenize(query));
  if (queryTokens.size === 0) return [];

  const scored = chunks.map((chunk) => {
    const chunkTokens = tokenize(chunk.text + " " + chunk.label);
    let score = 0;
    for (const t of chunkTokens) {
      if (queryTokens.has(t)) score += 1;
    }
    return { ...chunk, score };
  });

  return scored
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, k);
}

function hasAnyRealData() {
  // Helper so we can warn in logs if the knowledge base is still all placeholders.
  const raw = fs.readFileSync(KNOWLEDGE_PATH, "utf-8");
  return !raw.includes("REPLACE_ME");
}

module.exports = { retrieve, loadKnowledge, hasAnyRealData };
