const cache = new Map();

function getCached(key) {
  const h = cache.get(key);
  return (h && Date.now() - h.ts < h.ttl) ? h.data : null;
}
function setCached(key, data, ttl) {
  cache.set(key, { data, ts: Date.now(), ttl });
  if (cache.size > 300) {
    const oldest = [...cache.entries()].sort((a,b)=>a[1].ts-b[1].ts)[0];
    cache.delete(oldest[0]);
  }
}

const MIN = 60000, HOUR = 3600000;

// ── football-data.org ─────────────────────────────────────────────────────────
async function fdFetch(apiKey, path) {
  const r = await fetch('https://api.football-data.org/v4/' + path, {
    headers: { 'X-Auth-Token': apiKey }
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.message || 'FD erro ' + r.status);
  return d;
}

const FD_COMPS = ['PL','PD','SA','BL1','FL1','UCL','UEL','BSA','CLI','PPL','DED','ELC','BL2'];

function fdToFixture(m) {
  return {
    fixture: { id: 'fd_' + m.id, date: m.utcDate },
    league: { id: 'fd_' + m.competition?.id, name: m.competition?.name, season: m.season?.startDate ? new Date(m.season.startDate).getFullYear() : new Date().getFullYear() },
    teams: { home: { id: 'fd_' + m.homeTeam?.id, name: m.homeTeam?.name }, away: { id: 'fd_' + m.awayTeam?.id, name: m.awayTeam?.name } },
    goals: { home: m.score?.fullTime?.home ?? null, away: m.score?.fullTime?.away ?? null },
    source: 'fd'
  };
}

async function fetchFDToday(apiKey, date) {
  const cached = getCached('fd_day_' + date);
  if (cached) return cached;
  let matches = [];
  try {
    const d = await fdFetch(apiKey, `matches?dateFrom=${date}&dateTo=${date}`);
    if (d.matches?.length > 0) matches = d.matches;
  } catch(e) {}
  if (matches.length === 0) {
    const results = await Promise.allSettled(
      FD_COMPS.map(c => fdFetch(apiKey, `competitions/${c}/matches?dateFrom=${date}&dateTo=${date}`))
    );
    results.forEach(r => { if (r.status === 'fulfilled') matches.push(...(r.value.matches||[])); });
  }
  const fixtures = matches.map(fdToFixture);
  setCached('fd_day_' + date, fixtures, 30*MIN);
  return fixtures;
}

// ── TheSportsDB (gratuito, sem limite, sem cadastro) ──────────────────────────
async function sdbFetch(path) {
  const r = await fetch('https://www.thesportsdb.com/api/v1/json/3/' + path);
  const d = await r.json();
  return d;
}

// Ligas do TheSportsDB com IDs conhecidos
// TheSportsDB: usar nome exato da liga no parâmetro &l=
// O endpoint eventsday aceita nome OU id numérico
const SDB_LEAGUES = [
  { id: '4351', name: 'Brazilian Serie A',        country: '🇧🇷' },
  { id: '4424', name: 'Campeonato Paulista',       country: '🇧🇷' },
  { id: '4346', name: 'Copa Libertadores',         country: '🌎' },
  { id: '4344', name: 'Copa Sudamericana',         country: '🌎' },
  { id: '4803', name: 'Copa do Brasil',            country: '🇧🇷' },
  { id: '4328', name: 'English Premier League',    country: '🏴' },
  { id: '4335', name: 'Spanish La Liga',           country: '🇪🇸' },
  { id: '4332', name: 'Italian Serie A',           country: '🇮🇹' },
  { id: '4331', name: 'German Bundesliga',         country: '🇩🇪' },
  { id: '4334', name: 'French Ligue 1',            country: '🇫🇷' },
  { id: '4480', name: 'UEFA Champions League',     country: '🏆' },
  { id: '4481', name: 'UEFA Europa League',        country: '🏆' },
  { id: '4337', name: 'Dutch Eredivisie',          country: '🇳🇱' },
  { id: '4333', name: 'Portuguese Primeira Liga',  country: '🇵🇹' },
  { id: '4336', name: 'English Championship',      country: '🏴' },
  { id: '4390', name: 'American Major League Soccer', country: '🇺🇸' },
  { id: '4347', name: 'Mexican Primera Liga',      country: '🇲🇽' },
  { id: '4354', name: 'Argentine Primera Division',country: '🇦🇷' },
  { id: '4406', name: 'Turkish Super Lig',         country: '🇹🇷' },
  { id: '4329', name: 'Scottish Premier League',   country: '🏴󠁧󠁢󠁳󠁣󠁴󠁿' },
  { id: '4480', name: 'UEFA Champions League',     country: '🏆' },
];

function sdbToFixture(e, leagueName, leagueId, leagueCountry) {
  // TheSportsDB retorna timestamps em formato diferente
  const date = e.strTimestamp || (e.dateEvent + 'T' + (e.strTime||'00:00:00') + 'Z');
  return {
    fixture: { id: 'sdb_' + e.idEvent, date: date },
    league: { id: 'sdb_' + leagueId, name: leagueName, season: parseInt(e.strSeason)||new Date().getFullYear(), country: leagueCountry },
    teams: {
      home: { id: 'sdb_' + e.idHomeTeam, name: e.strHomeTeam },
      away: { id: 'sdb_' + e.idAwayTeam, name: e.strAwayTeam }
    },
    goals: {
      home: e.intHomeScore != null ? parseInt(e.intHomeScore) : null,
      away: e.intAwayScore != null ? parseInt(e.intAwayScore) : null
    },
    source: 'sdb'
  };
}

async function fetchSDBToday(date) {
  const cached = getCached('sdb_day_' + date);
  if (cached) return cached;

  let all = [];
  const seen = new Set();

  // Método 1: endpoint geral por data e esporte
  try {
    const d = await sdbFetch(`eventsday.php?d=${date}&s=Soccer`);
    (d.events||[]).forEach(e => {
      if (!seen.has(e.idEvent)) {
        seen.add(e.idEvent);
        const league = SDB_LEAGUES.find(l => l.name === e.strLeague) || { id: e.idLeague||'0', name: e.strLeague||'?', country: '🌍' };
        all.push(sdbToFixture(e, league.name, league.id, league.country));
      }
    });
  } catch(e) {}

  // Método 2: busca por cada liga usando ID numérico (mais confiável)
  const results = await Promise.allSettled(
    SDB_LEAGUES.map(async (league) => {
      // Tenta com ID primeiro, depois com nome
      let events = [];
      try {
        const d1 = await sdbFetch(`eventsday.php?d=${date}&l=${league.id}`);
        events = d1.events || [];
      } catch(e) {}
      if (events.length === 0) {
        try {
          const d2 = await sdbFetch(`eventsday.php?d=${date}&l=${encodeURIComponent(league.name)}`);
          events = d2.events || [];
        } catch(e) {}
      }
      return { league, events };
    })
  );

  results.forEach(r => {
    if (r.status === 'fulfilled') {
      (r.value.events||[]).forEach(e => {
        if (e.strSport === 'Soccer' && !seen.has(e.idEvent)) {
          seen.add(e.idEvent);
          all.push(sdbToFixture(e, r.value.league.name, r.value.league.id, r.value.league.country));
        }
      });
    }
  });

  setCached('sdb_day_' + date, all, 30*MIN);
  return all;
}

// ── Merge das duas fontes ─────────────────────────────────────────────────────
function normalize(s) { return (s||'').toLowerCase().replace(/[^a-z0-9]/g,''); }

function mergeFixtures(fd, sdb) {
  const seen = new Set();
  const all = [];

  fd.forEach(f => {
    const key = normalize(f.teams.home.name) + '_' + normalize(f.teams.away.name);
    if (!seen.has(key)) { seen.add(key); all.push(f); }
  });

  sdb.forEach(f => {
    const key = normalize(f.teams.home.name) + '_' + normalize(f.teams.away.name);
    const rev = normalize(f.teams.away.name) + '_' + normalize(f.teams.home.name);
    if (!seen.has(key) && !seen.has(rev)) {
      seen.add(key);
      all.push(f);
    }
  });

  return all.sort((a,b) => new Date(a.fixture.date) - new Date(b.fixture.date));
}

// ── HANDLER ───────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const fdKey = process.env.FOOTBALLDATA_KEY;
  const q = req.query;
  const ep = q.endpoint || '';

  try {

    // ── JOGOS DO DIA ──────────────────────────────────────────────────────────
    if (ep === 'fixtures' && q.date && !q.team) {
      const date = q.date;
      const cKey = 'merged_day_' + date;
      const cached = getCached(cKey);
      if (cached) return res.status(200).json({ response: cached, results: cached.length, cached: true });

      const [fdF, sdbF] = await Promise.all([
        fdKey ? fetchFDToday(fdKey, date) : Promise.resolve([]),
        fetchSDBToday(date),
      ]);

      const merged = mergeFixtures(fdF, sdbF);
      setCached(cKey, merged, 30*MIN);
      return res.status(200).json({ response: merged, results: merged.length, sources: { fd: fdF.length, sdb: sdbF.length, total: merged.length } });
    }

    // ── FORMA DO TIME ─────────────────────────────────────────────────────────
    if (ep === 'fixtures' && q.team) {
      const teamId = String(q.team);
      const limit = parseInt(q.last) || 5;
      const cKey = 'form_' + teamId + '_' + limit;
      const cached = getCached(cKey);
      if (cached) return res.status(200).json({ response: cached });

      let matches = [];

      if (teamId.startsWith('sdb_') ) {
        const id = teamId.replace('sdb_','');
        try {
          const d = await sdbFetch(`eventslast.php?id=${id}`);
          matches = (d.results||[]).slice(-limit).map(e => sdbToFixture(e, e.strLeague||'', e.idLeague||'', '🌍'));
        } catch(e) {}
      } else if (teamId.startsWith('fd_') && fdKey) {
        const id = teamId.replace('fd_','');
        try {
          const d = await fdFetch(fdKey, `teams/${id}/matches?status=FINISHED&limit=${limit*2}`);
          matches = (d.matches||[]).slice(-limit).map(fdToFixture);
        } catch(e) {}
      }

      setCached(cKey, matches, 30*MIN);
      return res.status(200).json({ response: matches });
    }

    // ── ESCALAÇÕES ────────────────────────────────────────────────────────────
    if (ep === 'fixtures/lineups') {
      // TheSportsDB não tem escalações no plano grátis
      // FD tem só quando divulgadas
      const fid = String(q.fixture);
      if (fid.startsWith('fd_') && fdKey) {
        const id = fid.replace('fd_','');
        try {
          const d = await fdFetch(fdKey, `matches/${id}`);
          const lineups = [];
          for (const side of ['homeTeam','awayTeam']) {
            const t = d[side];
            if (t?.lineup?.length) {
              lineups.push({ team:{id:'fd_'+t.id,name:t.name}, formation:t.formation||'?', startXI:t.lineup.map(p=>({player:{id:p.id,name:p.name}})) });
            }
          }
          return res.status(200).json({ response: lineups });
        } catch(e) {}
      }
      return res.status(200).json({ response: [] });
    }

    // ── LESÕES ────────────────────────────────────────────────────────────────
    if (ep === 'injuries') return res.status(200).json({ response: [] });

    // ── H2H ───────────────────────────────────────────────────────────────────
    if (ep === 'fixtures/headtohead') {
      const [t1, t2] = (q.h2h||'').split('-');
      const cKey = 'h2h_' + q.h2h;
      const cached = getCached(cKey);
      if (cached) return res.status(200).json({ response: cached });

      let h2h = [];
      if (t1.startsWith('sdb_')) {
        const id = t1.replace('sdb_','');
        try {
          const d = await sdbFetch(`eventslast.php?id=${id}`);
          const t2id = t2.replace('sdb_','');
          h2h = (d.results||[])
            .filter(e => String(e.idHomeTeam)===t2id || String(e.idAwayTeam)===t2id)
            .slice(-5)
            .map(e => sdbToFixture(e, e.strLeague||'', e.idLeague||'', '🌍'));
        } catch(e) {}
      } else if (t1.startsWith('fd_') && fdKey) {
        const id = t1.replace('fd_','');
        const t2id = t2.replace('fd_','');
        try {
          const d = await fdFetch(fdKey, `teams/${id}/matches?status=FINISHED&limit=30`);
          h2h = (d.matches||[]).filter(m => String(m.homeTeam?.id)===t2id || String(m.awayTeam?.id)===t2id).slice(-5).map(fdToFixture);
        } catch(e) {}
      }

      setCached(cKey, h2h, 2*HOUR);
      return res.status(200).json({ response: h2h });
    }

    // ── TABELA ────────────────────────────────────────────────────────────────
    if (ep === 'standings') {
      const leagueId = String(q.league);
      const season = q.season;
      const cKey = 'standings_' + leagueId + '_' + season;
      const cached = getCached(cKey);
      if (cached) return res.status(200).json({ response: cached });

      let result = [];

      if (leagueId.startsWith('sdb_')) {
        const id = leagueId.replace('sdb_','');
        try {
          const d = await sdbFetch(`lookuptable.php?l=${id}&s=${season}`);
          const table = (d.table||[]).map((row,i) => ({
            rank: i+1, team:{id:'sdb_'+row.idTeam, name:row.strTeam},
            points: parseInt(row.intPoints)||0, form:'', description:'',
            all:{win:parseInt(row.intWin)||0, draw:parseInt(row.intDraw)||0, lose:parseInt(row.intLoss)||0,
              goals:{for:parseInt(row.intGoalsFor)||0, against:parseInt(row.intGoalsAgainst)||0}}
          }));
          result = [{ league: { standings: [table] } }];
        } catch(e) {}
      } else if (fdKey) {
        const fdCodes = {'fd_2021':'PL','fd_2014':'PD','fd_2019':'SA','fd_2002':'BL1','fd_2015':'FL1','fd_2001':'UCL','fd_2013':'BSA','fd_2152':'CLI'};
        const fdCode = fdCodes[leagueId];
        if (fdCode) {
          try {
            const d = await fdFetch(fdKey, `competitions/${fdCode}/standings?season=${season}`);
            const table = (d.standings?.[0]?.table||[]).map(row => ({
              rank:row.position, team:{id:'fd_'+row.team.id,name:row.team.name},
              points:row.points, form:row.form||'', description:row.description||'',
              all:{win:row.won,draw:row.draw,lose:row.lost,goals:{for:row.goalsFor,against:row.goalsAgainst}}
            }));
            result = [{ league: { standings: [table] } }];
          } catch(e) {}
        }
      }

      setCached(cKey, result, 2*HOUR);
      return res.status(200).json({ response: result });
    }

    // ── ESTATÍSTICAS ──────────────────────────────────────────────────────────
    if (ep === 'teams/statistics') {
      const teamId = String(q.team);
      const cKey = 'stats_' + teamId;
      const cached = getCached(cKey);
      if (cached) return res.status(200).json({ response: cached });

      let result = null;

      const fetchAndCalc = async (matches) => {
        let wH=0,dH=0,lH=0,wA=0,dA=0,lA=0,gfH=0,gaH=0,gfA=0,gaA=0,cs=0;
        const tid = teamId.replace('sdb_','').replace('fd_','');
        matches.forEach(m => {
          const isHome = String(m.teams?.home?.id||'').replace('sdb_','').replace('fd_','') === tid;
          const gf = m.goals?.home != null ? (isHome ? m.goals.home : m.goals.away) : null;
          const ga = m.goals?.home != null ? (isHome ? m.goals.away : m.goals.home) : null;
          if (gf==null) return;
          if (ga===0) cs++;
          if (isHome) { gfH+=gf;gaH+=ga; gf>ga?wH++:gf===ga?dH++:lH++; }
          else { gfA+=gf;gaA+=ga; gf>ga?wA++:gf===ga?dA++:lA++; }
        });
        const pH=wH+dH+lH||1, pA=wA+dA+lA||1;
        return {
          fixtures:{played:{total:pH+pA,home:pH,away:pA},wins:{total:wH+wA},draws:{total:dH+dA},loses:{total:lH+lA}},
          goals:{for:{total:{total:gfH+gfA,home:gfH,away:gfA}},against:{total:{total:gaH+gaA,home:gaH,away:gaA}}},
          clean_sheet:{total:cs}
        };
      };

      if (teamId.startsWith('sdb_')) {
        const id = teamId.replace('sdb_','');
        try {
          const d = await sdbFetch(`eventslast.php?id=${id}`);
          const matches = (d.results||[]).map(e => sdbToFixture(e,'','',''));
          result = await fetchAndCalc(matches);
        } catch(e) {}
      } else if (teamId.startsWith('fd_') && fdKey) {
        const id = teamId.replace('fd_','');
        try {
          const d = await fdFetch(fdKey, `teams/${id}/matches?status=FINISHED&limit=30`);
          const matches = (d.matches||[]).map(fdToFixture);
          result = await fetchAndCalc(matches);
        } catch(e) {}
      }

      setCached(cKey, result, 2*HOUR);
      return res.status(200).json({ response: result });
    }

    // ── BUSCA DE TIMES ────────────────────────────────────────────────────────
    if (ep === 'teams') {
      const search = (q.search||'').toLowerCase();
      const cKey = 'search_' + search;
      const cached = getCached(cKey);
      if (cached) return res.status(200).json({ response: cached });

      let found = [];

      // TheSportsDB tem busca por nome
      try {
        const d = await sdbFetch(`searchteams.php?t=${encodeURIComponent(q.search)}`);
        found = (d.teams||[])
          .filter(t => t.strSport === 'Soccer')
          .slice(0,5)
          .map(t => ({ team:{ id:'sdb_'+t.idTeam, name:t.strTeam } }));
      } catch(e) {}

      setCached(cKey, found, HOUR);
      return res.status(200).json({ response: found });
    }

    // ── ODDS (não disponível grátis) ──────────────────────────────────────────
    if (ep === 'odds') return res.status(200).json({ response: [] });

    return res.status(404).json({ error: 'Endpoint não mapeado: ' + ep });

  } catch(err) {
    return res.status(500).json({ error: err.message });
  }
}
