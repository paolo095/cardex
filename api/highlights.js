const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5',
};

function extractCards(html, game) {
  const tagPattern = /<a[\s\S]*?data-gtm-id[\s\S]*?>/g;
  const tags = html.match(tagPattern) || [];
  function attr(tag, name) {
    const m = tag.match(new RegExp(name + '="([^"]*)"'));
    return m ? m[1] : '';
  }
  const cards = [];
  for (const tag of tags) {
    if (attr(tag, 'data-gtm-listname') !== 'trending') continue;
    const id    = attr(tag, 'data-gtm-id');
    const name  = attr(tag, 'data-gtm-name');
    const price = parseFloat(attr(tag, 'data-gtm-price')) || 0;
    const pos   = parseInt(attr(tag, 'data-gtm-position')) || 99;
    const href  = attr(tag, 'href');
    const slug  = href.split('/').pop() || '';
    if (!id || !name) continue;
    cards.push({
      id: parseInt(id), name, game, price, pos,
      href:  'https://www.cardtrader.com' + href,
      image: `https://www.cardtrader.com/uploads/blueprints/image/${id}/preview_${slug}.jpg`
    });
  }
  return cards.sort((a, b) => a.pos - b.pos);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const [rPok, rOP] = await Promise.all([
      fetch('https://www.cardtrader.com/it/highlights?game=pokemon',   { headers: HEADERS }),
      fetch('https://www.cardtrader.com/it/highlights?game=one-piece', { headers: HEADERS }),
    ]);
    if (!rPok.ok || !rOP.ok) throw new Error(`CardTrader ${rPok.status}/${rOP.status}`);
    const [htmlPok, htmlOP] = await Promise.all([rPok.text(), rOP.text()]);

    const cards = [
      ...extractCards(htmlPok, 'pokemon'),
      ...extractCards(htmlOP,  'onepiece'),
    ];
    res.status(200).json(cards);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
