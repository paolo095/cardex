export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const r = await fetch('https://www.cardtrader.com/it/highlights', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5',
      }
    });
    if (!r.ok) throw new Error('CardTrader status: ' + r.status);
    const html = await r.text();

    // Estrai sezione "Più vendute" (fino a "Migliori Affari")
    const secStart = html.indexOf('Più vendute');
    const secEnd   = html.indexOf('Migliori Affari', secStart);
    const section  = secStart > -1
      ? html.slice(secStart, secEnd > -1 ? secEnd : secStart + 25000)
      : html.slice(0, 25000);

    // Estrai tag <a> con data-gtm-id (multilinea)
    const tagPattern = /<a[\s\S]*?data-gtm-id[\s\S]*?>/g;
    const tags = section.match(tagPattern) || [];

    function attr(tag, name) {
      const m = tag.match(new RegExp(name + '="([^"]*)"'));
      return m ? m[1] : '';
    }

    const cards = [];
    for (const tag of tags) {
      const brand = attr(tag, 'data-gtm-brand');
      if (brand !== 'Pokemon' && brand !== 'One Piece') continue;
      const id    = attr(tag, 'data-gtm-id');
      const name  = attr(tag, 'data-gtm-name');
      const price = parseFloat(attr(tag, 'data-gtm-price')) || 0;
      const href  = attr(tag, 'href');
      const slug  = href.split('/').pop() || '';
      cards.push({
        id:    parseInt(id),
        name,
        game:  brand === 'Pokemon' ? 'pokemon' : 'onepiece',
        price,
        href:  'https://www.cardtrader.com' + href,
        image: `https://www.cardtrader.com/uploads/blueprints/image/${id}/preview_${slug}.jpg`
      });
    }

    res.status(200).json(cards);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
