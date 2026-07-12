// api/market.js
// Returns local market stats (median sale price, days on market) for a ZIP
// using RentCast's market-statistics endpoint. Cached for 24 hours at the CDN
// so it only spends ~1 RentCast request per day, not one per visitor.

export default async function handler(req, res) {
  const zip = (req.query.zip || "11713").toString().slice(0, 5);

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

    // Cache at the edge for 24h so repeat visitors don't burn API requests
    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=43200");

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
