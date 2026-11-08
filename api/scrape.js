import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
      },
      redirect: 'follow'
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    let price = null;
    let title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';

    // 1. Check JSON-LD structured data
    $('script[type="application/ld+json"]').each((_, elem) => {
      try {
        const json = JSON.parse($(elem).html());
        if (json.offers && json.offers.price) {
          price = parseFloat(json.offers.price);
        } else if (Array.isArray(json)) {
          const item = json.find(i => i.offers && i.offers.price);
          if (item) price = parseFloat(item.offers.price);
        }
      } catch (e) {}
    });

    // 2. Musinsa Specific Parsing
    if (!price && url.includes('musinsa')) {
      const musinsaPrice = $('.product-numeric-price, .txt_price, .price, .product_price').first().text();
      const cleaned = musinsaPrice.replace(/[^0-9]/g, '');
      if (cleaned) price = parseFloat(cleaned);
    }

    // 3. Olive Young Specific Parsing
    if (!price && url.includes('oliveyoung')) {
      const oyPrice = $('#totalPrice, .price-2, .price_option .price, .prd_price .tx_cur').first().text();
      const cleaned = oyPrice.replace(/[^0-9]/g, '');
      if (cleaned) price = parseFloat(cleaned);
    }

    // 4. Zigzag Specific Parsing
    if (!price && url.includes('zigzag')) {
      const metaPrice = $('meta[property="product:price:amount"]').attr('content');
      if (metaPrice) price = parseFloat(metaPrice);
    }

    // 5. Generic Fallback
    if (!price) {
      const metaPrice = $('meta[property="og:price:amount"]').attr('content');
      if (metaPrice) price = parseFloat(metaPrice);
    }

    return res.status(200).json({
      success: true,
      price: price || null,
      title: title.trim()
    });

  } catch (err) {
    console.error('Scraper Error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
