export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.RAPIDAPI_KEY;
  if (!apiKey) return res.status(500).json({ error: "RAPIDAPI_KEY não configurada no Vercel." });

  const { endpoint } = req.query;
  if (!endpoint) return res.status(400).json({ error: "endpoint é obrigatório" });

  // Monta query string com os demais parâmetros
  const params = { ...req.query };
  delete params.endpoint;
  const qs = new URLSearchParams(params).toString();
  const url = `https://api-football-v1.p.rapidapi.com/v3/${endpoint}${qs ? "?" + qs : ""}`;

  try {
    const resp = await fetch(url, {
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": "api-football-v1.p.rapidapi.com",
      },
    });
    const data = await resp.json();
    return res.status(resp.status).json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
