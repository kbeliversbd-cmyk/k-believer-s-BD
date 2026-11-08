import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://www.google.com/'
      },
      redirect: 'follow'
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    let price = null;
    let title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';

    // 1. Check JSON-LD structured data (Works for many sites)
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
      const pText = $('.product-numeric-price, .txt_price, .price, .product_price').first().text();
      const cleaned = pText.replace(/[^0-9]/g, '');
      if (cleaned) price = parseFloat(cleaned);
    }

    // 3. Olive Young Specific Parsing (Mobile & Web)
    if (!price && url.includes('oliveyoung')) {
      const pText = $('#totalPrice, .price-2, .price_option .price, .prd_price .tx_cur, .tx_num').first().text();
      const cleaned = pText.replace(/[^0-9]/g, '');
      if (cleaned) price = parseFloat(cleaned);
    }

    // 4. Zigzag Specific Parsing
    if (!price && url.includes('zigzag')) {
      const metaPrice = $('meta[property="product:price:amount"]').attr('content') || $('meta[property="og:price:amount"]').attr('content');
      if (metaPrice) {
        price = parseFloat(metaPrice);
      } else {
        const pText = $('.css-1107wt4, .price, span[class*="price"]').first().text();
        const cleaned = pText.replace(/[^0-9]/g, '');
        if (cleaned) price = parseFloat(cleaned);
      }
    }

    // 5. General Fallback
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
