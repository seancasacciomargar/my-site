// api/market.js
// Returns local market stats (median sale price, days on market) for a ZIP
// using RentCast's market-statistics endpoint. Only called when a visitor types
// a ZIP (never on page load), and cached 7 days per ZIP at the CDN.

export default async function handler(req, res) {
  const zip = (req.query.zip || "").toString().trim();
  // Only real New York ZIPs (10000-14999). Anything else never reaches RentCast.
  if (!/^1[0-4][0-9]{3}$/.test(zip)) {
    res.setHeader("Cache-Control", "s-maxage=2592000");
    return res.status(400).json({ error: "Enter a 5-digit New York ZIP" });
  }

  try {
    const r = await fetch(
      `https://api.rentcast.io/v1/markets?zipCode=${zip}&dataType=Sale&historyRange=6`,
      {
        headers: {
          "X-Api-Key": process.env.RENTCAST_API_KEY,
          Accept: "application/json",
        },
      }
    );
    if (!r.ok) return res.status(502).json({ error: "Market data unavailable" });

    const data = await r.json();
    const s = data.saleData || data;

    // Market stats move monthly, so cache each ZIP at the edge for 7 days.
    // Repeat lookups of the same ZIP cost nothing.
    res.setHeader("Cache-Control", "s-maxage=604800, stale-while-revalidate=86400");

    return res.status(200).json({
      zip,
      medianPrice: s.medianPrice || s.averagePrice || null,
      averageDaysOnMarket: s.averageDaysOnMarket || null,
      totalListings: s.totalListings || null,
    });
  } catch (e) {
    return res.status(500).json({ error: "Server error" });
  }
}
