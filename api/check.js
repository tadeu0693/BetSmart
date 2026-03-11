export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const fdKey = process.env.FOOTBALLDATA_KEY;
  const hoje = new Date().toISOString().split('T')[0];

  const FD_COMPS = ['UCL','UEL','PL','PD','SA','BL1','FL1','BSA','CLI','PPL','DED','ELC','BL2'];
  const resultFD = {};
  let fdGeral = 0;

  if (fdKey) {
    // Endpoint geral
    try {
      const r = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${hoje}&dateTo=${hoje}`, {
        headers: {"X-Auth-Token": fdKey}
      });
      const d = await r.json();
      fdGeral = d.matches?.length || 0;
      if (fdGeral > 0) {
        const por = {};
        d.matches.forEach(m => {
          const n = m.competition?.name || '?';
          if (!por[n]) por[n] = [];
          por[n].push(m.homeTeam?.name + ' vs ' + m.awayTeam?.name);
        });
        resultFD['__geral__'] = por;
      }
    } catch(e) { resultFD['__geral_erro__'] = e.message; }

    // Por competição
    const results = await Promise.allSettled(
      FD_COMPS.map(async comp => {
        const r = await fetch(`https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${hoje}&dateTo=${hoje}`, {
          headers: {"X-Auth-Token": fdKey}
        });
        const d = await r.json();
        return { comp, count: d.matches?.length || 0, erro: d.message || null,
          jogos: (d.matches||[]).map(m => m.homeTeam?.name + ' vs ' + m.awayTeam?.name) };
      })
    );
    results.forEach(r => {
      if (r.status === 'fulfilled') {
        if (r.value.count > 0) resultFD[r.value.comp] = r.value.jogos;
        else if (r.value.erro) resultFD[r.value.comp + '_err'] = r.value.erro;
      }
    });
  }

  // SDB geral
  let sdbGeral = 0, sdbJogos = [];
  try {
    const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${hoje}&s=Soccer`);
    const d = await r.json();
    sdbGeral = d.events?.length || 0;
    sdbJogos = (d.events||[]).map(e => e.strHomeTeam + ' vs ' + e.strAwayTeam + ' (' + e.strLeague + ')');
  } catch(e) {}

  return res.status(200).json({
    data_hoje: hoje,
    fd_geral: fdGeral,
    fd_por_comp: resultFD,
    sdb_geral: sdbGeral,
    sdb_jogos: sdbJogos,
    total: fdGeral + sdbGeral
  });
}
