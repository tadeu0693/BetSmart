export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const apiKey = process.env.FOOTBALLDATA_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  let fixturesInfo = "não testado";
  let leagueIds = [];

  if (apiKey) {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const resp = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${hoje}&dateTo=${hoje}`, {
        headers: { "X-Auth-Token": apiKey }
      });
      const data = await resp.json();
      if (data.errorCode) {
        fixturesInfo = "ERRO: " + (data.message || JSON.stringify(data));
      } else {
        const matches = data.matches || [];
        leagueIds = [...new Set(matches.map(m => m.competition?.name))];
        fixturesInfo = matches.length + " jogos encontrados hoje. Competições: " + leagueIds.join(', ');
      }
    } catch(e) {
      fixturesInfo = "Erro: " + e.message;
    }
  }

  return res.status(200).json({
    FOOTBALLDATA_KEY: apiKey ? `✅ OK (${apiKey.length} chars)` : "❌ NÃO configurada — adicione no Vercel",
    ANTHROPIC_API_KEY: anthropicKey ? `✅ OK (${anthropicKey.length} chars)` : "❌ NÃO configurada",
    fixtures_hoje: fixturesInfo,
    competicoes: leagueIds,
    timestamp: new Date().toISOString(),
  });
}
