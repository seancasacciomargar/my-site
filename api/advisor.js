// api/advisor.js
// The "Sell vs. Rent vs. Renovate" advisor. Pulls the home's sale value AND
// long-term rent estimate from RentCast, then asks Claude to write a
// personalized comparison. Needs RENTCAST_API_KEY and ANTHROPIC_API_KEY in Vercel.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { address, mortgageBalance, timeline, goal } = req.body || {};
  if (!address) return res.status(400).json({ error: "address required" });

  const rc = { "X-Api-Key": process.env.RENTCAST_API_KEY, Accept: "application/json" };

  try {
    // Pull sale value and rent estimate in parallel (2 RentCast requests)
    const [vRes, rRes] = await Promise.all([
      fetch("https://api.rentcast.io/v1/avm/value?address=" + encodeURIComponent(address), { headers: rc }),
      fetch("https://api.rentcast.io/v1/avm/rent/long-term?address=" + encodeURIComponent(address), { headers: rc }),
    ]);

    const v = vRes.ok ? await vRes.json() : null;
    const r = rRes.ok ? await rRes.json() : null;

    if (!v || !v.price) {
      return res.status(404).json({ error: "No valuation available for that address" });
    }

    const value = v.price;
    const rent = r && r.rent ? r.rent : null;
    const equityLine = mortgageBalance
      ? `Approximate remaining mortgage: $${Number(mortgageBalance).toLocaleString()} (estimated equity ~$${Number(value - mortgageBalance).toLocaleString()}).`
      : "Mortgage balance not provided.";

    const prompt = `You are writing a short "sell vs. rent vs. renovate" comparison for a homeowner on the website of Sean Casaccio, a Long Island real estate salesperson who is ALSO a licensed home improvement contractor.

Property: ${address}
Estimated sale value today: $${Number(value).toLocaleString()}
${rent ? `Estimated long-term monthly rent: $${Number(rent).toLocaleString()}` : "No rent estimate available."}
${equityLine}
Owner's timeline: ${timeline || "not specified"}
Owner's main goal: ${goal || "not specified"}

Write 4-6 sentences, warm and plain-English, that:
1. Frame the three paths with their real numbers: sell now (rough proceeds), hold and rent (monthly income vs value tied up), or renovate first (Sean's crew can add value before listing).
2. Lean toward whichever path best fits their stated timeline and goal, but present it as "the numbers suggest" not a command.
3. End with one sentence: the real answer takes a 20-minute walkthrough, and since Sean both sells homes and runs the construction crew, he can price every path in one visit.

No guarantees. No bullet points. Do not mention being an AI. Write only the paragraph.`;

    const ai = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!ai.ok) return res.status(502).json({ error: "AI service unavailable" });
    const data = await ai.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return res.status(200).json({ analysis: text, value, rent });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}
