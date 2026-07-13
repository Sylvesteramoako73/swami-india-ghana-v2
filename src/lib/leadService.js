// Swappable lead-delivery layer.
//
// No email/CRM/WhatsApp Business API credentials exist yet. Real secret keys
// must NEVER be read client-side in a static site (they'd ship in the public
// JS bundle) - wiring a real email/CRM provider means adding a server
// endpoint (Vercel serverless function or similar) and pointing
// PUBLIC_LEAD_WEBHOOK_URL at it. Until that exists, submissions are logged
// locally and handed off to WhatsApp via a pre-filled wa.me link, which is
// the safe fallback this system is designed around.

import { site } from "../data/site";

const WEBHOOK_URL = import.meta.env.PUBLIC_LEAD_WEBHOOK_URL || "";

function buildWhatsAppMessage(payload) {
  const lines = [`Hi ${site.shortName}, I'd like more information.`];
  if (payload.project) lines.push(`Project: ${payload.project}`);
  if (payload.tier) lines.push(`Interested in: ${tierLabel(payload.tier)}`);
  if (payload.name) lines.push(`Name: ${payload.name}`);
  if (payload.location) lines.push(`Based in: ${payload.location}`);
  if (payload.visitType) lines.push(`Preferred visit: ${payload.visitType}`);
  if (payload.date) lines.push(`Preferred date: ${payload.date}`);
  if (payload.tier === "cold" && typeof window !== "undefined") {
    lines.push(`Guide: ${window.location.origin}/guides/diaspora-buyer-checklist`);
  }
  return lines.join("\n");
}

function tierLabel(tier) {
  if (tier === "hot") return "booking a site visit";
  if (tier === "warm") return "a payment plan";
  return "the diaspora buyer's guide";
}

function openWhatsAppFallback(payload) {
  const phone = site.phone.replace(/\D/g, "");
  const message = buildWhatsAppMessage(payload);
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank", "noopener");
}

/**
 * Submit a captured lead.
 * payload: { tier, name, email, whatsapp, location?, project?, unit?, date?, visitType?, source }
 * Returns { ok: boolean, error?: unknown }
 */
export async function submitLead(payload) {
  try {
    if (WEBHOOK_URL) {
      const res = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`Webhook responded ${res.status}`);
    } else {
      console.info("[leadService] PUBLIC_LEAD_WEBHOOK_URL not configured — lead captured locally only:", payload);
    }
    openWhatsAppFallback(payload);
    return { ok: true };
  } catch (error) {
    console.error("[leadService] submission failed, lead was not lost:", payload, error);
    return { ok: false, error };
  }
}
