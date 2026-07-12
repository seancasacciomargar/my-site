// api/reno-advice.js
// Takes the homeowner's selected renovations + home value and asks Claude to
// write a short personalized renovation strategy. Needs ANTHROPIC_API_KEY in Vercel.

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });

  const { baseValue, projects } = req.body || {};
  if (!baseValue || !projects || !projects.length) {
    return res.status(400).json({ error: "baseValue and projects required" });
  }

  const prompt = `You are writing a short renovation strategy for a homeowner on the website of Sean Casaccio, a Long Island real estate salesperson who is ALSO a licensed home improvement contractor (his crew does the work).

Home's estimated current value: $${Number(baseValue).toLocaleString()}
Renovations the homeowner selected (with estimated value-add % ranges): ${JSON.stringify(projects)}

Write 3-5 sentences, warm and plain-English, that:
1. Suggest a smart ORDER to tackle their selections (quick curb-appeal wins first vs. bigger projects).
2. Point out which single selection likely has the best bang-for-buck.
3. End with one sentence: since Sean both sells homes and runs the construction crew, a free walkthrough can turn these estimates into real quotes and a real plan.

No guarantees of value. No bullet points. Do not mention being an AI. Write only the paragraph.`;

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
    if (!r.ok) return res.status(502).json({ error: "AI service unavailable" });
    const data = await r.json();
    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return res.status(200).json({ advice: text });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}
