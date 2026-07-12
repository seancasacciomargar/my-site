// api/invest.js
// Investor quick underwrite. Pulls value + rent from RentCast, computes the
// classic screens (70% rule, gross cap rate), and asks Claude for a verdict
// paragraph. Needs RENTCAST_API_KEY and ANTHROPIC_API_KEY in Vercel.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { address, purchasePrice, rehabBudget } = req.body || {};
  if (!address || !purchasePrice) {
    return res.status(400).json({ error: "address and purchasePrice required" });
  }

  const rc = { "X-Api-Key": process.env.RENTCAST_API_KEY, Accept: "application/json" };

  try {
    const [vRes, rRes] = await Promise.all([
      fetch("https://api.rentcast.io/v1/avm/value?address=" + encodeURIComponent(address), { headers: rc }),
      fetch("https://api.rentcast.io/v1/avm/rent/long-term?address=" + encodeURIComponent(address), { headers: rc }),
    ]);

    const v = vRes.ok ? await vRes.json() : null;
    const r = rRes.ok ? await rRes.json() : null;

    if (!v || !v.price) {
      return res.status(404).json({ error: "No valuation available for that address" });
    }

    const arv = v.price; // current AVM used as the ARV baseline (see disclaimer on site)
    const rent = r && r.rent ? r.rent : null;
    const rehab = Number(rehabBudget) || 0;
    const price = Number(purchasePrice);

    // Classic screens
    const mao = Math.round(arv * 0.7 - rehab); // 70% rule max allowable offer
    const allIn = price + rehab;
    const grossSpread = arv - allIn;
    const grossCap = rent ? ((rent * 12) / allIn) * 100 : null;

    const prompt = `You are writing a short investor deal screen for the website of Sean Casaccio, a Long Island real estate salesperson and licensed contractor who works with fix-and-flip and rental investors.

Property: ${address}
Current automated value estimate (used as ARV baseline): $${arv.toLocaleString()}
Investor's intended purchase price: $${price.toLocaleString()}
Planned rehab budget: $${rehab.toLocaleString()}
All-in cost: $${allIn.toLocaleString()}
Gross spread vs value estimate: $${grossSpread.toLocaleString()}
70%-rule max allowable offer at this rehab budget: $${mao.toLocaleString()}
${rent ? `Estimated monthly rent: $${rent.toLocaleString()} (gross cap rate on all-in: ${grossCap.toFixed(1)}%)` : "No rent estimate available."}

Write 4-6 sentences, direct investor-speak but plain English:
1. Give the honest verdict: does this pencil as a flip (compare purchase price to the 70%-rule number and the spread) and/or as a rental (cap rate context)?
2. Flag the biggest caveat: the value estimate is the AS-IS automated value, not a true after-repair value - a renovated ARV could be meaningfully higher, which is exactly what Sean prices on a walkthrough.
3. End with one sentence: Sean both finds off-market deals and runs the construction crew, so he can verify the rehab number and the real ARV in one visit.

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

    return res.status(200).json({
      analysis: text,
      arv,
      rent,
      mao,
      allIn,
      grossSpread,
      grossCap: grossCap ? +grossCap.toFixed(1) : null,
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}
