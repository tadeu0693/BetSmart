const SDB_LEAGUES = [
  { id: '4328', name: 'Premier League' },
  { id: '4335', name: 'La Liga' },
  { id: '4332', name: 'Serie A' },
  { id: '4331', name: 'Bundesliga' },
  { id: '4334', name: 'Ligue 1' },
  { id: '4480', name: 'Champions League' },
  { id: '4351', name: 'Brasileirão' },
  { id: '4424', name: 'Paulistão' },
  { id: '4803', name: 'Copa do Brasil' },
  { id: '4346', name: 'Libertadores' },
  { id: '4344', name: 'Sul-Americana' },
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const fdKey = process.env.FOOTBALLDATA_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const hoje = new Date().toISOString().split('T')[0];

  let fdJogos = [], sdbGeral = [], sdbPorLiga = {};

  // FD
  if (fdKey) {
    try {
      const r = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${hoje}&dateTo=${hoje}`, { headers: {"X-Auth-Token": fdKey} });
      const d = await r.json();
      fdJogos = (d.matches||[]).map(m => m.homeTeam?.name + ' vs ' + m.awayTeam?.name);
    } catch(e) {}
  }

  // SDB geral
  try {
    const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${hoje}&s=Soccer`);
    const d = await r.json();
    sdbGeral = (d.events||[]).map(e => e.strHomeTeam + ' vs ' + e.strAwayTeam + ' (' + e.strLeague + ')');
  } catch(e) {}

  // SDB por liga
  const results = await Promise.allSettled(
    SDB_LEAGUES.map(async (l) => {
      const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${hoje}&l=${l.id}`);
      const d = await r.json();
      return { name: l.name, count: (d.events||[]).length, jogos: (d.events||[]).map(e => e.strHomeTeam + ' vs ' + e.strAwayTeam) };
    })
  );

  results.forEach(r => {
    if (r.status === 'fulfilled' && r.value.count > 0) {
      sdbPorLiga[r.value.name] = r.value.jogos;
    }
  });

  const totalSdb = Object.values(sdbPorLiga).reduce((a,b) => a+b.length, 0) + sdbGeral.length;

  return res.status(200).json({
    FOOTBALLDATA_KEY: fdKey ? "✅ OK" : "❌ NÃO configurada",
    ANTHROPIC_API_KEY: anthropicKey ? "✅ OK" : "❌ NÃO configurada",
    TheSportsDB: "✅ Gratuito sem chave",
    data_hoje: hoje,
    fd_jogos: fdJogos.length,
    sdb_geral: sdbGeral.length,
    sdb_por_liga: sdbPorLiga,
    total_encontrado: fdJogos.length + totalSdb,
  });
}
