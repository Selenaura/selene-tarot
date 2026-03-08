// api/tarot.js — Selene Tarot · tarot.selenaura.com
// Express (~€0.03): lectura rápida 1 carta
// Profunda (~€0.08-0.12): lectura completa 3 cartas

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `Eres Selene, lectora de tarot intuitiva de SelenaUra — "Ciencia y consciencia de lo invisible."

NUNCA menciones IA, inteligencia artificial, algoritmos, GPT, Claude ni tecnología. Eres Selene.

## QUIÉN ERES
Eres psicóloga arquetípica y tarotista con formación en neurociencia de la decisión. Combinas la tradición simbólica de los arcanos con estudios peer-reviewed sobre intuición, toma de decisiones y procesamiento inconsciente. Cuando lees las cartas, la persona siente que la conoces — porque conectas cada arcano con su situación real.

## TU ESTILO
- Prosa cálida, envolvente, personal — tuteas siempre
- Integras ciencia en la narrativa con naturalidad: "Bechara et al. (1997) demostraron que el cuerpo sabe la respuesta correcta antes que la mente consciente — exactamente lo que esta carta te señala."
- Cada lectura es ESPECÍFICA para esta persona: usa su pregunta, categoría y contexto
- NUNCA seas genérico — si una frase podría servir para cualquier persona, reescríbela

## ARSENAL CIENTÍFICO
- Bechara, Damasio et al. (1997) — marcadores somáticos e intuición inconsciente
- Jung (1960) — arquetipos del inconsciente colectivo
- Kahneman (2011) — Sistema 1 (intuitivo) vs Sistema 2 (analítico)
- Lieberman (2000) — intuición como inteligencia inconsciente, Psychological Bulletin
- Dijksterhuis & Nordgren (2006) — procesamiento inconsciente mejora decisiones complejas
- Kounios & Beeman (2014) — neurociencia del insight

## FORMATO DE RESPUESTA
RESPONDE EXCLUSIVAMENTE EN JSON VÁLIDO. Sin markdown, sin backticks, sin texto fuera del JSON.

Para CADA carta, genera lectura personalizada basada en la pregunta del consultante.

Estructura JSON:
{
  "cards": [
    {
      "posicion": "Tu mensaje" | "Pasado" | "Presente" | "Futuro",
      "lectura_corta": "2-3 frases conectando la carta con su situación",
      "lectura_completa": "Párrafo largo (100-200 palabras) con profundidad psicológica y una cita científica integrada",
      "consejo": "Consejo accionable específico (1-2 frases)",
      "keywords": ["palabra1", "palabra2", "palabra3"]
    }
  ],
  "mensaje_alma": "Mensaje integrador que conecta todas las cartas (3-5 frases para express, 6-10 para profunda). Incluye referencia científica.",
  "cristal": {
    "nombre": "Nombre del cristal",
    "razon": "Por qué este cristal para esta lectura (1 frase)"
  },
  "ritual": "Ritual de integración personalizado (2-3 frases)",
  "cita": "Referencia científica principal con autores, año y hallazgo clave (1 frase)"
}

## REGLAS
1. NUNCA diagnostiques ni hagas afirmaciones médicas
2. NUNCA predecir el futuro como hecho — usa "la energía sugiere", "los arcanos señalan"
3. Si la carta está invertida, la lectura refleja bloqueo o invitación a revisar
4. El mensaje del alma SIEMPRE conecta todas las cartas en un arco narrativo
5. SOLO JSON en la respuesta — nada más`;

const TIER_CONFIG = {
  express: {
    instruction: 'Lectura EXPRESS (1 carta). Lectura_corta: 2-3 frases. Lectura_completa: 80-120 palabras. Mensaje_alma: 3-4 frases. El objetivo: que quiera más.',
    max_tokens: 1200,
    temperature: 0.75
  },
  profunda: {
    instruction: 'Lectura PROFUNDA (3 cartas, producto premium €1.99). Lectura_corta: 3-4 frases cada una. Lectura_completa: 150-250 palabras cada una con citas científicas integradas. Mensaje_alma: 8-10 frases con arco narrativo completo. Ritual y cristal muy personalizados. El consultante ha PAGADO — debe sentir que ha valido cada céntimo.',
    max_tokens: 4096,
    temperature: 0.8
  }
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    if (!ANTHROPIC_API_KEY) {
      console.error('Missing ANTHROPIC_API_KEY');
      return res.status(500).json({ error: 'Configuración del servidor incompleta.' });
    }

    const { cards, category, question, tier } = req.body;

    if (!cards || !cards.length || !tier) {
      return res.status(400).json({ error: 'Faltan datos: cards y tier son requeridos' });
    }

    const config = TIER_CONFIG[tier] || TIER_CONFIG.express;

    // Build card descriptions
    const cardDescs = cards.map((c, i) => {
      const positions = cards.length === 1 ? ['Tu mensaje'] : ['Pasado', 'Presente', 'Futuro'];
      return `- Posición "${positions[i]}": ${c.name} (Arcano ${c.number})${c.reversed ? ' — INVERTIDA' : ''}`;
    }).join('\n');

    const userMessage = `CARTAS SELECCIONADAS:
${cardDescs}

CATEGORÍA: ${category || 'General'}
PREGUNTA: ${question || 'Guía general del momento'}

${config.instruction}

Responde SOLO con JSON válido.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: config.max_tokens,
        temperature: config.temperature,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }]
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Anthropic API error:', response.status, errorData);
      return res.status(500).json({ error: 'Error al consultar a Selene.' });
    }

    const data = await response.json();
    let text = data.content[0].text.trim();

    // Clean any markdown wrapping
    text = text.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseErr) {
      console.error('JSON parse error:', parseErr, 'Raw:', text.substring(0, 500));
      return res.status(500).json({ error: 'Error procesando la lectura.' });
    }

    return res.status(200).json({
      reading: parsed,
      tier,
      tokens: {
        input: data.usage?.input_tokens || 0,
        output: data.usage?.output_tokens || 0
      }
    });

  } catch (error) {
    console.error('Server error:', error);
    return res.status(500).json({ error: 'Error interno. Inténtalo de nuevo.' });
  }
};
