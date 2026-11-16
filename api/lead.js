// api/lead.js
// Website contact form. Emails each new lead to Sean through Resend.
// Real estate leads go to his Margar email, construction leads to his Gmail.
// Needs RESEND_API_KEY in Vercel (send-only key for nxt-gencontracting.com).

const TO_REAL_ESTATE = "seancasaccio@margarrealty.com";
const TO_CONSTRUCTION = "seancasaccio@gmail.com";
const FROM = "Website Leads <leads@nxt-gencontracting.com>";

const TYPES = {
  selling: { label: "Selling a home", group: "Real Estate" },
  buying: { label: "Buying a home", group: "Real Estate" },
  investing: { label: "Investing", group: "Real Estate" },
  construction: { label: "Renovation / construction", group: "Construction" },
  other: { label: "Something else", group: "Real Estate" },
};

const clean = (v, max = 500) => (v == null ? "" : String(v)).replace(/[<>]/g, "").trim().slice(0, max);
const esc = (s) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  const b = req.body || {};

  // Spam traps: hidden field filled in, or form sent faster than a person can type.
  if (b.website || (Number(b.t) && Number(b.t) < 2500)) return res.status(200).json({ ok: true });

  const name = clean(b.name, 120);
  const phone = clean(b.phone, 40);
  const email = clean(b.email, 160);
  const address = clean(b.address, 200);
  const message = clean(b.message, 2000);
  const source = clean(b.source, 200);
  const page = clean(b.page, 60);
  const type = TYPES[b.type] ? b.type : "other";

  if (!name) return res.status(400).json({ error: "Please add your name." });
  if (!phone && !email) return res.status(400).json({ error: "Please add a phone number or email so Sean can reach you." });
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "That email doesn't look right." });

  const t = TYPES[type];
  const to = t.group === "Construction" ? TO_CONSTRUCTION : TO_REAL_ESTATE;
  const rows = [
    ["Name", name], ["Phone", phone], ["Email", email], ["Property address", address],
    ["Looking for", t.label], ["Message", message], ["Came from", source || "direct"], ["Page", page],
  ].filter(([, v]) => v);

  const text = rows.map(([k, v]) => `${k}: ${v}`).join("\n");
  const html =
    `<div style="font-family:Arial,sans-serif;font-size:15px;color:#111">` +
    `<h2 style="margin:0 0 12px">New ${t.group.toLowerCase()} lead from seancasaccio.com</h2>` +
    `<table cellpadding="6" style="border-collapse:collapse">` +
    rows.map(([k, v]) => `<tr><td style="color:#666;vertical-align:top">${k}</td><td><b>${esc(v).replace(/\n/g, "<br>")}</b></td></tr>`).join("") +
    `</table>` +
    (phone ? `<p style="margin-top:16px"><a href="tel:${esc(phone)}">Call ${esc(name)}</a> &middot; <a href="sms:${esc(phone)}">Text ${esc(name)}</a></p>` : "") +
    `</div>`;

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [to],
        reply_to: email || undefined,
        subject: `[${t.group}] New lead: ${name} (${t.label})`,
        text,
        html,
      }),
    });
    if (!r.ok) return res.status(502).json({ error: "Couldn't send right now. Please call or text (631) 316-7922." });
    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ error: "Couldn't send right now. Please call or text (631) 316-7922." });
  }
}
