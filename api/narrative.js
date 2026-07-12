// api/narrative.js
// Takes the AVM result + comparable sales and asks Claude to write a short,
// personalized market analysis for the homeowner. Runs on YOUR server so your
// Anthropic API key stays secret (set ANTHROPIC_API_KEY in Vercel settings).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { address, price, priceRangeLow, priceRangeHigh, comparables } =
    req.body || {};

  if (!address || !price) {
    return res.status(400).json({ error: "address and price required" });
  }

  // Keep only what the model needs from the comps (max 6)
  const comps = (comparables || []).slice(0, 6).map((c) => ({
    address: c.formattedAddress || c.address,
    price: c.price,
    beds: c.bedrooms,
    baths: c.bathrooms,
    sqft: c.squareFootage,
    distance: c.distance,
  }));

  const prompt = `You are writing a short market analysis for a homeowner on a Long Island real estate agent's website. The agent is Sean Casaccio, a licensed real estate salesperson who is also a licensed home improvement contractor.

Property: ${address}
Automated value estimate: $${Number(price).toLocaleString()}
Estimated range: $${Number(priceRangeLow || price * 0.95).toLocaleString()} to $${Number(priceRangeHigh || price * 1.05).toLocaleString()}
Nearby comparable sales: ${JSON.stringify(comps)}

Write 3-5 sentences, warm and plain-English, that:
1. Put the estimate in context of the comparable sales (mention 1-2 specifics like "a similar 3-bedroom nearby sold for...").
2. Note one factor that could push their value toward the top of the range.
3. End with one sentence noting that targeted renovations could raise the number further, and a free consult can pin it down.

Do NOT guarantee any value. Do NOT use bullet points. Do not mention that you are an AI. Write only the paragraph, nothing else.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!r.ok) {
      return res.status(502).json({ error: "AI service unavailable" });
    }

    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return res.status(200).json({ narrative: text });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}
