export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.APIFOOTBALL_KEY;
  if (!apiKey) return res.status(500).json({ error: "APIFOOTBALL_KEY não configurada. Vá em Vercel > Settings > Environment Variables, adicione APIFOOTBALL_KEY com sua chave do dashboard.api-football.com e marque os 3 ambientes, depois faça Redeploy." });

  const { endpoint } = req.query;
  if (!endpoint) return res.status(400).json({ error: "endpoint é obrigatório" });

  // Monta query string com os demais parâmetros
  const params = { ...req.query };
  delete params.endpoint;
  const qs = new URLSearchParams(params).toString();
  const url = `https://v3.football.api-sports.io/${endpoint}${qs ? "?" + qs : ""}`;

  try {
    const resp = await fetch(url, {
      headers: {
        "x-apisports-key": apiKey,
      },
    });
    const text = await resp.text();
    let data;
    try { data = JSON.parse(text); } catch(e) { return res.status(500).json({ error: "Resposta inválida da API: " + text.slice(0,200) }); }
    if (!resp.ok) return res.status(resp.status).json({ error: `RapidAPI erro ${resp.status}: ${JSON.stringify(data)}` });
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "Fetch falhou: " + err.message, url: url.replace(apiKey, "***") });
  }
}
