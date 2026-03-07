export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const apiKey = process.env.APIFOOTBALL_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  let fixturesInfo = "não testado";
  let leagueIds = [];

  if (apiKey) {
    try {
      const hoje = new Date().toISOString().split('T')[0];
      const resp = await fetch(`https://v3.football.api-sports.io/fixtures?date=${hoje}&timezone=America/Sao_Paulo`, {
        headers: { "x-apisports-key": apiKey }
      });
      const data = await resp.json();
      const fixtures = data.response || [];
      leagueIds = [...new Set(fixtures.map(f => f.league.id))];
      fixturesInfo = `${fixtures.length} jogos encontrados. Liga IDs: ${leagueIds.join(', ')}`;
    } catch(e) {
      fixturesInfo = "Erro: " + e.message;
    }
  }

  return res.status(200).json({
    APIFOOTBALL_KEY: apiKey ? `✅ OK (${apiKey.length} chars)` : "❌ NÃO configurada",
    ANTHROPIC_API_KEY: anthropicKey ? `✅ OK (${anthropicKey.length} chars)` : "❌ NÃO configurada",
    fixtures_hoje: fixturesInfo,
    league_ids_encontrados: leagueIds,
    timestamp: new Date().toISOString(),
  });
}
