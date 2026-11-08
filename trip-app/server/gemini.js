/* Gemini (free tier) — shared by /api/extract and /api/plan. Key in GEMINI_API_KEY. */

const GEMINI = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
// Tried in order; set GEMINI_MODEL in Vercel to put a specific model first.
// Flash-Lite answers in ~1 s on the free tier; the full Flash models are often
// "overloaded" (503) or slow there, so they're only the fallback.
const MODELS = [...new Set([process.env.GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-flash-latest'].filter(Boolean))];
const PER_MODEL_MS = 20000;


/**
 * Ask Gemini for JSON matching `schema`. Tries the models in order, skipping
 * ones that are missing, overloaded or slow. Errors carry a Chinese message
 * and an HTTP status for the caller to pass on.
 */
export async function askGeminiJSON({ parts, schema, temperature = 0.2 }) {
  const body = {
    contents: [{ role: 'user', parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature },
  };
  let lastError = '';
  for (const model of MODELS) {
    const r = await fetch(`${GEMINI}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PER_MODEL_MS),
    }).catch((e) => {
      if (e.name === 'TimeoutError') return { status: 504 }; // too slow: try the next model
      throw Object.assign(new Error('AI 连不上，再试一次'), { status: 504 });
    });
    if (r.status === 404) { lastError = `找不到模型 ${model}`; continue; } // try the next name
    if (r.status >= 500) { lastError = 'AI 现在太忙'; console.warn(`gemini ${model} ${r.status}`); continue; } // overloaded/slow: try the next model
    if (r.status === 429) throw Object.assign(new Error('AI 免费额度暂时用完了，过一分钟再试'), { status: 429 });
    if (r.status === 400 || r.status === 403) {
      const msg = (await r.json().catch(() => ({})))?.error?.message || '';
      throw Object.assign(new Error(/api key/i.test(msg) ? 'GEMINI_API_KEY 无效' : `AI 请求被拒绝：${msg.slice(0, 120)}`), { status: 500 });
    }
    if (!r.ok) throw Object.assign(new Error(`AI 出错（${r.status}）`), { status: 502 });
    const data = await r.json();
    const textOut = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    try {
      return JSON.parse(textOut.replace(/^```(?:json)?|```$/g, '').trim());
    } catch {
      throw Object.assign(new Error('AI 回传的格式不对'), { status: 502 });
    }
  }
  throw Object.assign(new Error(lastError === 'AI 现在太忙' ? 'AI 现在太忙，过一下再试' : `${lastError}，请在 Vercel 设定 GEMINI_MODEL`), { status: lastError === 'AI 现在太忙' ? 503 : 500 });
}

