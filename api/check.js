const LIGAS_TESTE = [
  { id: '4351', name: 'Brazilian Serie A' },
  { id: '4424', name: 'Campeonato Paulista' },
  { id: '4346', name: 'Copa Libertadores' },
  { id: '4328', name: 'English Premier League' },
  { id: '4480', name: 'UEFA Champions League' },
  { id: '4335', name: 'Spanish La Liga' },
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const fdKey = process.env.FOOTBALLDATA_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const hoje = new Date().toISOString().split('T')[0];

  // Testa SDB com ID e com nome para cada liga
  const resultados = {};
  await Promise.allSettled(LIGAS_TESTE.map(async (l) => {
    // Por ID
    try {
      const r1 = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${hoje}&l=${l.id}`);
      const d1 = await r1.json();
      const c1 = (d1.events||[]).length;
      // Por nome
      const r2 = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${hoje}&l=${encodeURIComponent(l.name)}`);
      const d2 = await r2.json();
      const c2 = (d2.events||[]).length;
      resultados[l.name] = { porId: c1, porNome: c2, jogos: (d1.events||d2.events||[]).slice(0,3).map(e=>e.strHomeTeam+' vs '+e.strAwayTeam) };
    } catch(e) {
      resultados[l.name] = { erro: e.message };
    }
  }));

  // Testa endpoint geral
  let geral = 0;
  try {
    const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${hoje}&s=Soccer`);
    const d = await r.json();
    geral = (d.events||[]).length;
  } catch(e) {}

  // Testa eventsnextleague (próximos jogos da liga)
  let nextBSA = [];
  try {
    const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsnextleague.php?id=4351`);
    const d = await r.json();
    nextBSA = (d.events||[]).slice(0,3).map(e=>e.strHomeTeam+' vs '+e.strAwayTeam+' ('+e.dateEvent+')');
  } catch(e) {}

  return res.status(200).json({
    FOOTBALLDATA_KEY: fdKey ? "✅ OK" : "❌ Falta",
    ANTHROPIC_API_KEY: anthropicKey ? "✅ OK" : "❌ Falta",
    data_hoje: hoje,
    sdb_geral_soccer: geral,
    sdb_por_liga: resultados,
    sdb_proximos_brasileirao: nextBSA,
  });
}
