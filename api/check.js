export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const fdKey = process.env.FOOTBALLDATA_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const hoje = new Date().toISOString().split('T')[0];

  let fdJogos = [], sdbJogos = [], fdErro = null, sdbErro = null;

  // Testa football-data.org
  if (fdKey) {
    try {
      const r = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${hoje}&dateTo=${hoje}`, { headers: {"X-Auth-Token": fdKey} });
      const d = await r.json();
      fdJogos = (d.matches||[]).map(m => m.homeTeam?.name + ' vs ' + m.awayTeam?.name + ' (' + m.competition?.name + ')');
    } catch(e) { fdErro = e.message; }
  }

  // Testa TheSportsDB (sem chave)
  try {
    const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${hoje}&s=Soccer`);
    const d = await r.json();
    sdbJogos = (d.events||[]).slice(0,20).map(e => e.strHomeTeam + ' vs ' + e.strAwayTeam + ' (' + e.strLeague + ')');
  } catch(e) { sdbErro = e.message; }

  return res.status(200).json({
    FOOTBALLDATA_KEY: fdKey ? `✅ OK` : "❌ NÃO configurada",
    ANTHROPIC_API_KEY: anthropicKey ? `✅ OK` : "❌ NÃO configurada",
    TheSportsDB: "✅ Gratuito sem chave",
    data_hoje: hoje,
    fd_total: fdJogos.length,
    fd_jogos: fdJogos.slice(0,5),
    fd_erro: fdErro,
    sdb_total: sdbJogos.length,
    sdb_jogos: sdbJogos.slice(0,10),
    sdb_erro: sdbErro,
  });
}
