export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
 
  const token = process.env.CARDTRADER_TOKEN;
  if (!token) { res.status(500).json({ error: 'Token non configurato.' }); return; }
 
  const path = req.query.path;
  if (!path) { res.status(400).json({ error: 'Parametro path mancante.' }); return; }
 
  try {
    const url = 'https://api.cardtrader.com/api/v2' + path;
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await response.json();
 
    // Debug mode: /api/proxy?path=/marketplace/products?blueprint_id=376050&debug=1
    if (req.query.debug === '1') {
      const bpId = path.match(/blueprint_id=(\d+)/)?.[1];
      const products = bpId ? (data[bpId] || []) : [];
      const allPropKeys = new Set();
      products.forEach(p => Object.keys(p.properties_hash || {}).forEach(k => allPropKeys.add(k)));
      const langFields = [...allPropKeys].filter(k => k.toLowerCase().includes('lang'));
      const groups = {};
      for (const p of products) {
        const langVal = langFields.map(f => p.properties_hash?.[f]).find(v => v) || 'NO_LANG_FIELD';
        if (!groups[langVal]) groups[langVal] = { total:0, it:0, minAll:Infinity, minIT:Infinity };
        groups[langVal].total++;
        if (p.price?.cents < groups[langVal].minAll) groups[langVal].minAll = p.price.cents;
        if (p.user?.country_code === 'IT') {
          groups[langVal].it++;
          if (p.price?.cents < groups[langVal].minIT) groups[langVal].minIT = p.price.cents;
        }
      }
      return res.status(200).json({
        total_products: products.length,
        all_properties_hash_keys: [...allPropKeys],
        language_fields_found: langFields,
        sample_properties_hash: products[0]?.properties_hash || {},
        first_IT_product_props: products.find(p=>p.user?.country_code==='IT')?.properties_hash || null,
        groups_by_language: Object.entries(groups).map(([lang,info])=>({
          language: lang,
          total: info.total,
          it_sellers: info.it,
          min_price_global: info.minAll!==Infinity ? (info.minAll/100).toFixed(2) : null,
          min_price_IT: info.minIT!==Infinity ? (info.minIT/100).toFixed(2) : null,
        }))
      });
    }
 
    res.status(response.status).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
