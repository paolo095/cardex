// /api/scan.js — Vercel Serverless Function
// Riceve un frame base64 dalla fotocamera, lo invia a Gemini 2.5 Flash Vision,
// restituisce { name, collector_number, game } per la ricerca su CardTrader.

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { image, mimeType = 'image/jpeg' } = req.body || {};
  if (!image) return res.status(400).json({ error: 'No image provided' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GEMINI_API_KEY not configured' });

  const prompt = `You are analyzing a photo of a physical trading card game (TCG) card.

Extract the following information:
1. Card name in English (e.g. "Charizard", "Pikachu", "Monkey D. Luffy", "Roronoa Zoro")
2. Collector number exactly as printed (e.g. "4/165", "025/165", "OP01-060", "EB04-007"). Use null if unreadable.
3. Game: "pokemon" for Pokémon TCG, "onepiece" for One Piece TCG.

Pokémon cards: HP in top-right, energy symbols, "Pokémon" branding.
One Piece cards: character code like "OP01-060" or "EB04-007", "ONE PIECE CARD GAME" branding.

Be generous — do your best even if the image is slightly angled or not perfectly sharp.

Return ONLY a raw JSON object, no markdown, no explanation:
{"name":"card name","collector_number":"number or null","game":"pokemon or onepiece"}

Only return {"error":"not_found"} if there is truly no TCG card visible in the image.`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: image } }
            ]
          }],
          generationConfig: {
            temperature: 0,
            maxOutputTokens: 512,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[scan] Gemini error:', geminiRes.status, errText);
      return res.status(502).json({ error: 'gemini_api_error' });
    }

    const geminiData = await geminiRes.json();
    const raw = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Rimuove eventuali markdown code fences
    const clean = raw.replace(/```(?:json)?\n?|\n?```/g, '').trim();

    let result;
    try {
      result = JSON.parse(clean);
    } catch (e) {
      console.error('[scan] Parse error — raw output:', raw);
      return res.status(200).json({ error: 'parse_error' });
    }

    // Normalizza il campo game
    if (result.game) {
      result.game = result.game.toLowerCase().replace(/[^a-z]/g, '');
      if (result.game !== 'pokemon' && result.game !== 'onepiece') {
        result.game = null;
      }
    }

    return res.status(200).json(result);

  } catch (e) {
    console.error('[scan] Handler error:', e);
    return res.status(500).json({ error: 'internal_error' });
  }
};
