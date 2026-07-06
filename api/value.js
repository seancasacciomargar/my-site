// api/value.js
// This file runs ON A SERVER, never in the visitor's browser.
// That's the whole point: it keeps your secret RentCast key hidden.
// On Vercel, any file inside an "api" folder automatically becomes a live URL:
//   https://yourdomain.com/api/value?address=...

export default async function handler(req, res) {
  const address = req.query.address;
  if (!address) {
    return res.status(400).json({ error: "Address is required" });
  }

  try {
    // Calls RentCast's AVM value endpoint. Your key is read from a SECRET
    // environment variable you set in Vercel (RENTCAST_API_KEY) — it is
    // never written in this file and never sent to the browser.
    const url =
      "https://api.rentcast.io/v1/avm/value?address=" +
      encodeURIComponent(address);

    const apiResponse = await fetch(url, {
      headers: {
        "X-Api-Key": process.env.RENTCAST_API_KEY,
        Accept: "application/json",
      },
    });

    if (!apiResponse.ok) {
      return res
        .status(apiResponse.status)
        .json({ error: "Valuation lookup failed" });
    }

    const data = await apiResponse.json();

    // Send back only what the page needs.
    return res.status(200).json({
      price: data.price,
      priceRangeLow: data.priceRangeLow,
      priceRangeHigh: data.priceRangeHigh,
      comparables: data.comparables || [],
    });
  } catch (err) {
    return res.status(500).json({ error: "Server error" });
  }
}
