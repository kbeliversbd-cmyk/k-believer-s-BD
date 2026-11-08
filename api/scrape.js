
export default async function handler(req, res) {
  const { url } = req.query;

  if (!url) {
    return res.status(400).json({ error: "Missing URL parameter" });
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    const html = await response.text();

    let price = null;
    let title = null;

    const jsonLdMatches = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
    if (jsonLdMatches) {
      for (const match of jsonLdMatches) {
        try {
          const cleanJson = match.replace(/<script[^>]*>/, "").replace(/<\/script>/, "");
          const data = JSON.parse(cleanJson);
          if (data.offers && data.offers.price) price = data.offers.price;
          if (data.name) title = data.name;
        } catch (e) {}
      }
    }

    if (!price) {
      const priceMeta = html.match(/meta\s+property=["']product:price:amount["']\s+content=["'](\d+)["']/i) ||
                        html.match(/meta\s+property=["']og:price:amount["']\s+content=["'](\d+)["']/i);
      if (priceMeta) price = priceMeta[1];
    }

    if (price) {
      return res.status(200).json({
        success: true,
        price: parseInt(price, 10),
        title: title || "Korean Import Product"
      });
    }

    return res.status(404).json({ success: false, error: "Price not detected automatically" });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
