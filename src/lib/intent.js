// Behaviour-based intent tracking: tiers, triggers, and suppression state.
// All state lives in localStorage under a single namespaced key.

const STORAGE_KEY = "sigl-intent-v1";
const SESSION_GAP_MS = 30 * 60 * 1000; // 30 min of inactivity = new session
const SUPPRESS_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const TIER_RANK = { cold: 0, warm: 1, hot: 2 };

function defaultState() {
  return {
    projectPagesViewed: [],
    sessionCount: 0,
    estimatorOpened: false,
    estimatorCompleted: false,
    whatsappClicked: false,
    hasConverted: false,
    convertedAtTier: null,
    lastPromptAt: null,
    dismissCount: 0,
    suppressedUntil: null,
    tier: "cold",
    lastSessionAt: null,
    location: null,
  };
}

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...defaultState(), ...JSON.parse(raw) };
  } catch (e) {}
  return defaultState();
}

function writeState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {}
  return state;
}

function computeTier(state) {
  const isHot =
    state.projectPagesViewed.length >= 3 ||
    state.estimatorCompleted ||
    state.sessionCount >= 2 ||
    state.whatsappClicked;
  if (isHot) return "hot";
  const isWarm = state.projectPagesViewed.length >= 2 || state.estimatorOpened;
  if (isWarm) return "warm";
  return "cold";
}

function bumpTier(state) {
  const next = computeTier(state);
  if (TIER_RANK[next] > TIER_RANK[state.tier || "cold"]) {
    state.tier = next;
  }
  return state;
}

/** Call once per page load. Increments session count if the last visit was >30 min ago. */
export function initSession() {
  const state = readState();
  const now = Date.now();
  if (!state.lastSessionAt || now - state.lastSessionAt > SESSION_GAP_MS) {
    state.sessionCount = (state.sessionCount || 0) + 1;
  }
  state.lastSessionAt = now;
  bumpTier(state);
  return writeState(state);
}

export function trackProjectView(slug) {
  const state = readState();
  if (slug && !state.projectPagesViewed.includes(slug)) {
    state.projectPagesViewed = [...state.projectPagesViewed, slug];
  }
  bumpTier(state);
  return writeState(state);
}

export function trackEstimatorOpened() {
  const state = readState();
  state.estimatorOpened = true;
  bumpTier(state);
  return writeState(state);
}

export function trackEstimatorCompleted() {
  const state = readState();
  state.estimatorOpened = true;
  state.estimatorCompleted = true;
  bumpTier(state);
  return writeState(state);
}

export function trackWhatsappClicked() {
  const state = readState();
  state.whatsappClicked = true;
  bumpTier(state);
  return writeState(state);
}

/** Mark a successful form submission. Records the tier they converted at
 *  so future prompts only show if their behaviour later escalates further. */
export function recordConversion(tier) {
  const state = readState();
  state.hasConverted = true;
  state.convertedAtTier = tier;
  return writeState(state);
}

/** Persisted so a later hot-tier form can default its visit-type toggle
 *  (diaspora buyers default to virtual). */
export function recordLocation(location) {
  const state = readState();
  state.location = location;
  return writeState(state);
}

export function recordPromptShown() {
  const state = readState();
  state.lastPromptAt = Date.now();
  return writeState(state);
}

export function recordDismiss() {
  const state = readState();
  state.dismissCount = (state.dismissCount || 0) + 1;
  state.suppressedUntil = Date.now() + SUPPRESS_DAYS_MS;
  return writeState(state);
}

export function getState() {
  return readState();
}

export function getTier() {
  return readState().tier || "cold";
}

/** Decide whether ANY prompt may show right now (suppression + one-per-session
 *  is enforced by the caller via a session flag; this only covers persistent rules). */
export function canShowPrompt() {
  const state = readState();
  const now = Date.now();
  if (state.dismissCount >= 2) return false;
  if (state.suppressedUntil && now < state.suppressedUntil) return false;
  if (state.hasConverted) {
    // Only show again if behaviour has escalated past the tier they already converted at.
    const rankNow = TIER_RANK[state.tier || "cold"];
    const rankConverted = TIER_RANK[state.convertedAtTier || "cold"];
    return rankNow > rankConverted;
  }
  return true;
}

/** The offer to show if hasConverted is true and behaviour escalated further. */
export function getEscalatedTier() {
  const state = readState();
  return state.tier || "cold";
}
