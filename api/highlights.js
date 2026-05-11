const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'it-IT,it;q=0.9,en;q=0.5',
};

function extractCards(html, game) {
  const blocks = html.match(/<a[^>]*data-gtm-listname="trending"[\s\S]*?<\/a>/g) || [];

  function attr(block, name) {
    const m = block.match(new RegExp(name + '="([^"]*)"'));
    return m ? m[1] : '';
  }
  function findImg(id) {
    const m = html.match(new RegExp(`src="(/uploads/blueprints/image/${id}/preview_[^"]+)"`));
    return m ? 'https://www.cardtrader.com' + m[1] : '';
  }
  function trend(block) {
    const t = block.match(/title="(Prezzo[^"]+)"/);
    if (!t) return 'stable';
    if (t[1].includes('aumento')) return 'up';
    if (t[1].includes('calo'))    return 'down';
    return 'stable';
  }

  return blocks.map(block => ({
    id:    parseInt(attr(block, 'data-gtm-id')),
    name:  attr(block, 'data-gtm-name'),
    game,
    price: parseFloat(attr(block, 'data-gtm-price')) || 0,
    pos:   parseInt(attr(block, 'data-gtm-position')) || 99,
    href:  'https://www.cardtrader.com' + attr(block, 'href'),
    image: findImg(attr(block, 'data-gtm-id')),
    trend: trend(block),
  }))
  .filter(c => c.id && c.name)
  .sort((a, b) => a.pos - b.pos);
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=1800, stale-while-revalidate=3600');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 8000);
    const [rPok, rOP] = await Promise.all([
      fetch('https://www.cardtrader.com/it/highlights?game=pokemon',   { headers: HEADERS, signal: ctrl.signal }),
      fetch('https://www.cardtrader.com/it/highlights?game=one-piece', { headers: HEADERS, signal: ctrl.signal }),
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
