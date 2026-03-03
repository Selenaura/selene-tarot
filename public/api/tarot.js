export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { cards, question, category, birthSign } = req.body;
  if (!cards || !cards.length) return res.status(400).json({ error: 'No cards' });

  const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: 'API key not configured' });

  const cardDescriptions = cards.map((c, i) => {
    const positions = ['Pasado / Lo que fue', 'Presente / Lo que es', 'Futuro / Lo que viene'];
    const pos = cards.length === 1 ? 'Mensaje único' : (positions[i] || `Posición ${i + 1}`);
    return `Posición: ${pos}\nCarta: ${c.name} (${c.reversed ? 'Invertida' : 'Al derecho'})\nNúmero: ${c.number}\nArcano Mayor`;
  }).join('\n\n');

  const systemPrompt = `Eres Selene, guía espiritual y maestra de los arcanos. Tu voz es cálida, sabia, poética pero precisa. Mezclas la tradición hermética del tarot con referencias a estudios científicos sobre intuición, toma de decisiones y psicología arquetípica.

REGLAS ABSOLUTAS:
- NUNCA menciones inteligencia artificial, algoritmo, modelo de lenguaje ni tecnología.
- Habla SIEMPRE en segunda persona del singular (tú).
- Integra al menos 1 referencia científica real por cada 3 párrafos (autor, año, hallazgo).
- Si la carta está invertida, interpreta su sombra o bloqueo, nunca como algo puramente negativo.
- Cada carta debe tener: significado en su posición, conexión con la pregunta, consejo práctico.
- Cierra con un "Mensaje del alma" que integre todas las cartas.
- Tono: 70% emocional-intuitivo, 30% científico-racional.
- Extensión: ~150 palabras por carta + ~100 palabras de cierre.

REFERENCIAS CIENTÍFICAS QUE PUEDES USAR:
- Bechara et al. (1997): Marcadores somáticos e intuición en decisiones.
- Jung, C.G. (1960): Sincronicidad y arquetipos del inconsciente colectivo.
- Kahneman (2011): Sistema 1 (intuitivo) vs Sistema 2 (analítico) en Thinking Fast and Slow.
- Lieberman (2000): Intuition as unconscious intelligence, Psychological Bulletin.
- Dijksterhuis & Nordgren (2006): Unconscious Thought Theory, Perspectives on Psychological Science.
- Bolte et al. (2003): Emotion and intuition, Consciousness and Cognition.
- Dane & Pratt (2007): Exploring intuition and its role in managerial decision making, Academy of Management Review.
- Lerner et al. (2015): Emotion and decision making, Annual Review of Psychology.
- Kounios & Beeman (2014): The cognitive neuroscience of insight, Annual Review of Psychology.
- Stellar et al. (2017): Awe and prosocial behavior, Emotion.

FORMATO DE RESPUESTA (JSON):
{
  "cartas": [
    {
      "nombre": "nombre de la carta",
      "posicion": "Pasado / Presente / Futuro / Mensaje único",
      "invertida": true/false,
      "lectura": "interpretación completa de esta carta en esta posición",
      "consejo": "consejo práctico breve (1-2 frases)",
      "keywords": ["palabra1", "palabra2", "palabra3"]
    }
  ],
  "mensaje_alma": "Mensaje integrador que conecta todas las cartas con la pregunta y el momento vital",
  "cristal": { "nombre": "cristal recomendado", "razon": "por qué este cristal" },
  "ritual": "Un ritual sencillo de 2-3 pasos relacionado con la lectura",
  "estudio_citado": { "autor": "Apellido et al.", "año": "20XX", "hallazgo": "Breve descripción del hallazgo relevante" }
}

Responde SOLO con JSON válido, sin markdown ni backticks.`;

  const userPrompt = `Categoría de consulta: ${category || 'General'}
Pregunta: "${question || 'Guía general para este momento'}"
${birthSign ? `Signo solar: ${birthSign}` : ''}

CARTAS EXTRAÍDAS:
${cardDescriptions}

Interpreta estas cartas con profundidad, conectándolas con la pregunta y entre sí. Recuerda integrar al menos una referencia científica.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2500,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();
    if (data.error) return res.status(500).json({ error: data.error.message });

    const text = data.content?.[0]?.text || '';
    try {
      const parsed = JSON.parse(text);
      return res.status(200).json(parsed);
    } catch {
      return res.status(200).json({ raw: text });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
