// Netlify Function: generate-content
// Keeps the Gemini API key server-side. The browser never sees it.

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'GEMINI_API_KEY não configurada no servidor.' }) };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Pedido inválido.' }) };
  }

  const { businessName, industry, objective, tone, platform, topic } = body;

  if (!businessName || !topic) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Faltam dados obrigatórios (empresa, tópico).' }) };
  }

  const platformLine = platform && platform !== 'geral'
    ? `Formato: pensado especificamente para ${platform}.`
    : `Formato: ideia de conteúdo geral, sem plataforma específica (pode ser adaptado depois).`;

  const prompt = `És um copywriter especialista em marketing digital em Portugal, a escrever para uma agência de gestão de tráfego chamada Unique Ads.

Cria conteúdo para o seguinte negócio cliente:
- Nome: ${businessName}
- Setor: ${industry || 'não especificado'}
- Objetivo da publicação: ${objective || 'awareness'}
- Tom de voz: ${tone || 'profissional'}
- Tópico: ${topic}
${platformLine}

Escreve em português europeu (Portugal), natural e apelativo, nunca em português do Brasil.

Responde APENAS com um objeto JSON válido, sem markdown, sem texto antes ou depois, exatamente neste formato:
{
  "headline": "título curto e apelativo",
  "caption": "legenda completa, 2 a 4 frases",
  "cta": "call-to-action curto",
  "hashtags": "5 a 8 hashtags relevantes separadas por espaço, começando com #"
}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, maxOutputTokens: 500 }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', data);
      return { statusCode: 502, body: JSON.stringify({ error: 'Erro ao contactar o serviço de IA.' }) };
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = rawText.replace(/```json|```/g, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse Gemini JSON:', rawText);
      return { statusCode: 502, body: JSON.stringify({ error: 'Resposta da IA em formato inesperado. Tenta novamente.' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(parsed)
    };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: 'Erro interno ao gerar conteúdo.' }) };
  }
};
