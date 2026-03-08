const ALL_COMPETITIONS = ['PL','PD','SA','BL1','FL1','UCL','UEL','BSA','CLI','PPL','DED','ELC','EC','WC','BL2'];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const apiKey = process.env.FOOTBALLDATA_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const hoje = new Date().toISOString().split('T')[0];

  let jogosHoje = [];
  let erros = [];

  if (apiKey) {
    // Tenta endpoint geral
    try {
      const r = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${hoje}&dateTo=${hoje}`, {
        headers: { "X-Auth-Token": apiKey }
      });
      const d = await r.json();
      if (d.matches?.length > 0) {
        jogosHoje = d.matches.map(m => m.homeTeam?.name + ' vs ' + m.awayTeam?.name + ' (' + m.competition?.name + ')');
      }
    } catch(e) { erros.push('geral: ' + e.message); }

    // Se geral retornou 0, testa cada competição
    if (jogosHoje.length === 0) {
      for (const comp of ALL_COMPETITIONS) {
        try {
          const r = await fetch(`https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${hoje}&dateTo=${hoje}`, {
            headers: { "X-Auth-Token": apiKey }
          });
          const d = await r.json();
          if (d.matches?.length > 0) {
            jogosHoje.push(...d.matches.map(m => m.homeTeam?.name + ' vs ' + m.awayTeam?.name + ' (' + comp + ')'));
          } else if (d.message) {
            erros.push(comp + ': ' + d.message);
          }
        } catch(e) { erros.push(comp + ': ' + e.message); }
      }
    }
  }

  return res.status(200).json({
    FOOTBALLDATA_KEY: apiKey ? `✅ OK (${apiKey.length} chars)` : "❌ NÃO configurada",
    ANTHROPIC_API_KEY: anthropicKey ? `✅ OK (${anthropicKey.length} chars)` : "❌ NÃO configurada",
    data_hoje: hoje,
    total_jogos: jogosHoje.length,
    jogos: jogosHoje.slice(0, 20),
    erros: erros.slice(0, 10),
  });
}
