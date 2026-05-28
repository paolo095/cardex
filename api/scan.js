// /api/scan.js — Vercel Serverless Function
// Riceve un frame base64 dalla fotocamera, lo invia a Gemini Vision,
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

  const prompt = `Analyze this trading card game card image. Extract the following:
1. The card name in English (e.g. "Charizard", "Monkey D. Luffy")
2. The collector number exactly as printed on the card (e.g. "4/165" for Pokémon, "OP01-060" or "EB04-007" for One Piece)
3. The game — must be exactly one of: "pokemon" or "onepiece"

Return ONLY a valid JSON object with no markdown formatting, no explanation, nothing else:
{"name":"card name","collector_number":"number as printed","game":"pokemon or onepiece"}

If the image is not a recognizable TCG card, or the text is too blurry to read clearly, return exactly:
{"error":"not_found"}`;

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
            maxOutputTokens: 150
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
