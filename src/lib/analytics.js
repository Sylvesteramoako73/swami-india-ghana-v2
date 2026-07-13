// Thin GA4 wrapper. No-ops safely if gtag isn't installed (no
// PUBLIC_GA4_ID configured yet), so every call site stays harmless
// until a real measurement ID is added.

export function trackEvent(name, params = {}) {
  if (typeof window !== "undefined" && typeof window.gtag === "function") {
    window.gtag("event", name, params);
  } else if (import.meta.env.DEV) {
    console.debug("[analytics]", name, params);
  }
}
