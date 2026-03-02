export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { match } = req.body || {};
  if (!match) return res.status(400).json({ error: "match is required" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "API key não configurada no Vercel" });

  const SYSTEM_PROMPT = `Voce e especialista em apostas esportivas. Analise a partida e responda EXATAMENTE neste formato de tags. Nao use JSON nem markdown.

[MATCH]Times[/MATCH]
[LEAGUE]Liga[/LEAGUE]
[CONFIDENCE]Alta ou Media ou Baixa[/CONFIDENCE]
[FORM_HOME]Forma recente do time da casa em 2-3 frases.[/FORM_HOME]
[FORM_AWAY]Forma recente do visitante em 2-3 frases.[/FORM_AWAY]
[SQUAD_HOME]Desfalques do time da casa em 2 frases.[/SQUAD_HOME]
[SQUAD_AWAY]Desfalques do visitante em 2 frases.[/SQUAD_AWAY]
[H2H]Historico em 2 frases.[/H2H]
[CONTEXT]Contexto da partida em 2 frases.[/CONTEXT]
[TIPS]
- Resultado Final | Time vence | Razao curta | **** | Baixo
- Ambos Marcam | Sim | Razao curta | *** | Medio
- Total de Gols | Mais de 2.5 | Razao curta | *** | Medio
- Total de Gols | Menos de 2.5 | Razao curta | ** | Medio
- Escanteios | Mais de 9.5 | Razao curta | ** | Medio
- Cartoes | Mais de 3.5 | Razao curta | ** | Alto
- Placar Correto | 2-0 | Razao curta | * | Alto
- Marcador | Jogador | Razao curta | ** | Medio
- Intervalo | Vencendo | Razao curta | ** | Alto
- Dupla Chance | Casa ou X | Razao curta | **** | Baixo
[/TIPS]

Substitua pelos dados reais da partida. Use * para estrelas. Mantenha pipe | como separador.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: "Analise esta partida: " + match }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: "Anthropic API error: " + err });
    }

    const data = await response.json();
    const text = data.content.map(c => c.text || "").join("");
    return res.status(200).json({ text });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
