const cache = new Map();

function cached(key, ttl, fn) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < ttl) return Promise.resolve(hit.data);
  return fn().then(data => { cache.set(key, { data, ts: Date.now() }); return data; });
}

const MIN = 60000, HOUR = 3600000;

async function fdFetch(apiKey, path) {
  const url = 'https://api.football-data.org/v4/' + path;
  const r = await fetch(url, { headers: { 'X-Auth-Token': apiKey } });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || 'Erro ' + r.status);
  return d;
}

// Converte partida football-data.org → formato app
function toFixture(m) {
  return {
    fixture: { id: m.id, date: m.utcDate, status: { short: { SCHEDULED:'NS', TIMED:'NS', IN_PLAY:'1H', PAUSED:'HT', FINISHED:'FT', POSTPONED:'PST', CANCELLED:'CANC' }[m.status] || m.status } },
    league: { id: m.competition?.id, name: m.competition?.name, season: m.season?.startDate ? new Date(m.season.startDate).getFullYear() : new Date().getFullYear() },
    teams: { home: { id: m.homeTeam?.id, name: m.homeTeam?.name }, away: { id: m.awayTeam?.id, name: m.awayTeam?.name } },
    goals: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null }
  };
}

// IDs numéricos antigos → códigos football-data.org
const FD = {
  // IDs numéricos antigos -> códigos football-data.org
  39:'PL', 140:'PD', 135:'SA', 78:'BL1', 61:'FL1',
  2:'UCL', 3:'UEL', 71:'BSA', 13:'CLI', 94:'PPL', 88:'DED',
  // Diretos
  'PL':'PL','PD':'PD','SA':'SA','BL1':'BL1','FL1':'FL1',
  'UCL':'UCL','UEL':'UEL','BSA':'BSA','CLI':'CLI','PPL':'PPL','DED':'DED',
  'ELC':'ELC','EC':'EC','WC':'WC','BL2':'BL2',
};

// TODAS as competições disponíveis no plano gratuito football-data.org
const ALL_COMPETITIONS = [
  'PL',   // Premier League
  'PD',   // La Liga
  'SA',   // Serie A
  'BL1',  // Bundesliga
  'FL1',  // Ligue 1
  'UCL',  // Champions League
  'UEL',  // Europa League
  'BSA',  // Brasileirão Série A
  'CLI',  // Copa Libertadores
  'PPL',  // Primeira Liga
  'DED',  // Eredivisie
  'ELC',  // Championship (Inglaterra)
  'EC',   // Eurocopa
  'WC',   // Copa do Mundo
  'BL2',  // 2. Bundesliga
  'PL2',  // Premier League 2
];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const apiKey = process.env.FOOTBALLDATA_KEY;
  if (!apiKey) return res.status(500).json({ error: 'FOOTBALLDATA_KEY não configurada no Vercel.' });

  const q = req.query;
  const ep = q.endpoint || '';

  try {

    // ── JOGOS DO DIA ──────────────────────────────────────────────────────────
    if (ep === 'fixtures' && q.date && !q.team) {
      const date = q.date;
      const data = await cached('day_' + date, 30*MIN, async () => {
        // Tenta endpoint geral primeiro
        try {
          const d = await fdFetch(apiKey, `matches?dateFrom=${date}&dateTo=${date}`);
          if (d.matches && d.matches.length > 0) return d;
        } catch(e) {}

        // Se geral retornar 0, busca competição por competição
        let allMatches = [];
        for (const comp of ALL_COMPETITIONS) {
          try {
            const d = await fdFetch(apiKey, `competitions/${comp}/matches?dateFrom=${date}&dateTo=${date}`);
            if (d.matches && d.matches.length > 0) {
              allMatches.push(...d.matches);
            }
          } catch(e) {} // ignora competições sem acesso
        }
        return { matches: allMatches };
      });
      const fixtures = (data.matches || []).map(toFixture);
      return res.status(200).json({ response: fixtures, results: fixtures.length });
    }

    // ── FORMA DO TIME (últimos N jogos) ───────────────────────────────────────
    if (ep === 'fixtures' && q.team) {
      const teamId = q.team;
      const limit = parseInt(q.last) || 5;
      const data = await cached('team_' + teamId + '_' + limit, 30*MIN, () =>
        fdFetch(apiKey, `teams/${teamId}/matches?status=FINISHED&limit=${limit * 2}`)
      );
      const matches = (data.matches || []).slice(-(limit));
      return res.status(200).json({ response: matches.map(toFixture) });
    }

    // ── ESCALAÇÕES ────────────────────────────────────────────────────────────
    if (ep === 'fixtures/lineups') {
      const fid = q.fixture;
      const data = await cached('match_' + fid, 10*MIN, () =>
        fdFetch(apiKey, `matches/${fid}`)
      );
      const lineups = [];
      for (const side of ['homeTeam', 'awayTeam']) {
        const t = data[side];
        if (t?.lineup?.length) {
          lineups.push({
            team: { id: t.id, name: t.name },
            formation: t.formation || '?',
            startXI: t.lineup.map(p => ({ player: { id: p.id, name: p.name } }))
          });
        }
      }
      return res.status(200).json({ response: lineups });
    }

    // ── LESÕES (não disponível no gratuito) ───────────────────────────────────
    if (ep === 'injuries') {
      return res.status(200).json({ response: [] });
    }

    // ── H2H ───────────────────────────────────────────────────────────────────
    if (ep === 'fixtures/headtohead') {
      const [t1, t2] = (q.h2h || '').split('-');
      if (!t1 || !t2) return res.status(200).json({ response: [] });
      const data = await cached('h2h_' + t1 + '_' + t2, 2*HOUR, () =>
        fdFetch(apiKey, `teams/${t1}/matches?status=FINISHED&limit=30`)
      );
      const h2h = (data.matches || [])
        .filter(m => String(m.homeTeam?.id) === t2 || String(m.awayTeam?.id) === t2)
        .slice(-5);
      return res.status(200).json({ response: h2h.map(toFixture) });
    }

    // ── TABELA ────────────────────────────────────────────────────────────────
    if (ep === 'standings') {
      const fdCode = FD[q.league] || q.league;
      const season = q.season;
      if (!fdCode) return res.status(200).json({ response: [] });
      const data = await cached('standings_' + fdCode + '_' + season, 2*HOUR, () =>
        fdFetch(apiKey, `competitions/${fdCode}/standings?season=${season}`)
      );
      const table = (data.standings?.[0]?.table || []).map(row => ({
        rank: row.position,
        team: { id: row.team.id, name: row.team.name },
        points: row.points,
        form: row.form || '',
        description: row.description || '',
        all: { win: row.won, draw: row.draw, lose: row.lost, goals: { for: row.goalsFor, against: row.goalsAgainst } }
      }));
      return res.status(200).json({ response: [{ league: { standings: [table] } }] });
    }

    // ── ESTATÍSTICAS (calculadas a partir dos jogos) ──────────────────────────
    if (ep === 'teams/statistics') {
      const teamId = q.team;
      const data = await cached('stats_' + teamId, 2*HOUR, () =>
        fdFetch(apiKey, `teams/${teamId}/matches?status=FINISHED&limit=30`)
      );
      const matches = data.matches || [];
      let wH=0,dH=0,lH=0,wA=0,dA=0,lA=0,gfH=0,gaH=0,gfA=0,gaA=0,cs=0;
      matches.forEach(m => {
        const isHome = String(m.homeTeam?.id) === String(teamId);
        const gf = isHome ? m.score?.fullTime?.home : m.score?.fullTime?.away;
        const ga = isHome ? m.score?.fullTime?.away : m.score?.fullTime?.home;
        if (gf == null) return;
        if (ga === 0) cs++;
        if (isHome) { gfH+=gf; gaH+=ga; gf>ga?wH++:gf===ga?dH++:lH++; }
        else         { gfA+=gf; gaA+=ga; gf>ga?wA++:gf===ga?dA++:lA++; }
      });
      const pH=wH+dH+lH||1, pA=wA+dA+lA||1;
      return res.status(200).json({ response: {
        fixtures: { played: { total: pH+pA, home: pH, away: pA }, wins: { total: wH+wA }, draws: { total: dH+dA }, loses: { total: lH+lA } },
        goals: { for: { total: { total: gfH+gfA, home: gfH, away: gfA } }, against: { total: { total: gaH+gaA, home: gaH, away: gaA } } },
        clean_sheet: { total: cs }
      }});
    }

    // ── BUSCA DE TIMES ────────────────────────────────────────────────────────
    if (ep === 'teams') {
      const search = (q.search || '').toLowerCase();
      const data = await cached('teams_search_' + search, HOUR, async () => {
        // Busca em competições principais
        const comps = ['BSA','CLI','PL','PD','SA','BL1','FL1','UCL'];
        let all = [];
        for (const comp of comps.slice(0, 3)) { // limita para economizar requests
          try {
            const d = await fdFetch(apiKey, `competitions/${comp}/teams`);
            all.push(...(d.teams || []));
          } catch(e) {}
        }
        return { teams: all };
      });
      const found = (data.teams || []).filter(t =>
        t.name?.toLowerCase().includes(search) ||
        t.shortName?.toLowerCase().includes(search) ||
        t.tla?.toLowerCase().includes(search)
      );
      return res.status(200).json({ response: found.slice(0,5).map(t => ({ team: { id: t.id, name: t.name } })) });
    }

    // ── ODDS (não disponível no gratuito) ─────────────────────────────────────
    if (ep === 'odds') {
      return res.status(200).json({ response: [] });
    }

    return res.status(404).json({ error: 'Endpoint não mapeado: ' + ep });

  } catch(err) {
    console.error('football proxy error:', err);
    return res.status(500).json({ error: err.message });
  }
}
