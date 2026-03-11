const FD_COMPS = ['PL','PD','SA','BL1','FL1','BSA','CLI','PPL','DED','ELC'];
const SDB_LEAGUES = [
  {id:'4480',name:'UEFA Champions League'},
  {id:'4481',name:'UEFA Europa League'},
  {id:'4390',name:'MLS'},
  {id:'4354',name:'Argentine Primera'},
  {id:'4406',name:'Turkish Super Lig'},
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin","*");
  const fdKey = process.env.FOOTBALLDATA_KEY;
  const hoje = new Date().toISOString().split('T')[0];
  const resultado = { data: hoje, fd: {}, sdb: {} };

  if (fdKey) {
    await Promise.allSettled(FD_COMPS.map(async comp => {
      try {
        const r = await fetch(`https://api.football-data.org/v4/competitions/${comp}/matches?dateFrom=${hoje}&dateTo=${hoje}`,
          { headers: {"X-Auth-Token": fdKey} });
        const d = await r.json();
        resultado.fd[comp] = d.matches?.length > 0
          ? d.matches.map(m => m.homeTeam?.name+' vs '+m.awayTeam?.name)
          : (d.message ? '❌ '+d.message.substring(0,50) : '0 jogos');
      } catch(e) { resultado.fd[comp] = '❌ '+e.message; }
    }));
  }

  await Promise.allSettled(SDB_LEAGUES.map(async l => {
    try {
      const r = await fetch(`https://www.thesportsdb.com/api/v1/json/3/eventsday.php?d=${hoje}&l=${l.id}`);
      const d = await r.json();
      resultado.sdb[l.name] = (d.events||[]).length > 0
        ? (d.events||[]).map(e => e.strHomeTeam+' vs '+e.strAwayTeam)
        : '0 jogos';
    } catch(e) { resultado.sdb[l.name] = '❌ '+e.message; }
  }));

  return res.status(200).json(resultado);
}
