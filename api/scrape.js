import * as cheerio from 'cheerio';

export default async function handler(req, res) {
  const { url } = req.query;
  if (!url) {
    return res.status(400).json({ success: false, error: 'URL is required' });
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
    });

    const html = await response.text();
    const $ = cheerio.load(html);

    let price = null;
    let title = '';

    // 1. Try extracting product title from meta tags or page title
    title = $('meta[property="og:title"]').attr('content') || $('title').text() || '';

    // 2. Try extracting price from JSON-LD structured data or meta tags
    $('script[type="application/ld+json"]').each((_, elem) => {
      try {
        const json = JSON.parse($(elem).html());
        if (json.offers && json.offers.price) {
          price = parseFloat(json.offers.price);
        } else if (Array.isArray(json)) {
          const product = json.find(item => item['@type'] === 'Product');
          if (product && product.offers && product.offers.price) {
            price = parseFloat(product.offers.price);
          }
        }
      } catch (e) {
        // Ignore JSON parse errors
      }
    });

    // Fallback price selectors for Korean e-commerce platforms if JSON-LD is missing
    if (!price) {
      const priceText = $('.price_num, .cur_price, .sell_price, .product-price, em.price').first().text();
      const cleaned = priceText.replace(/[^0-9]/g, '');
      if (cleaned) price = parseFloat(cleaned);
    }

    return res.status(200).json({
      success: true,
      price: price || null,
      title: title
    });

  } catch (err) {
    console.error('Scraper error:', err);
    return res.status(500).json({ success: false, error: 'Failed to scrape URL' });
  }
}
