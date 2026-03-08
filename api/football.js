// Cache em memória
const cache = new Map();

// Mapeamento de endpoints do app -> football-data.org
export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const apiKey = process.env.FOOTBALLDATA_KEY;
  if (!apiKey) return res.status(500).json({ error: "FOOTBALLDATA_KEY não configurada no Vercel." });

  const { endpoint, ...params } = req.query;
  if (!endpoint) return res.status(400).json({ error: "endpoint obrigatório" });

  // TTL de cache
  let ttl = 30 * 60 * 1000; // 30min default
  if (endpoint.includes('lineups') || endpoint.includes('injuries')) ttl = 10 * 60 * 1000;
  else if (endpoint.includes('statistics') || endpoint.includes('head2head') || endpoint.includes('standings') || endpoint.includes('odds')) ttl = 2 * 60 * 60 * 1000;

  try {
    let result = null;

    // ── FIXTURES DO DIA ──────────────────────────────────────────────────────
    if (endpoint === 'fixtures') {
      const date = params.date;
      const leagueId = params.league; // ID do football-data.org

      if (date && !leagueId) {
        // Busca todos os jogos do dia nas competições suportadas
        // football-data.org: busca por competição
        const competitions = ['PL','PD','SA','BL1','FL1','UCL','PPL','DED','BSA','CLI'];
        const cacheKey = 'fixtures_' + date;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.ts < ttl) {
          res.setHeader("X-Cache", "HIT");
          return res.status(200).json(cached.data);
        }

        const dateFrom = date;
        const dateTo = date;
        const url = `https://api.football-data.org/v4/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`;

        const resp = await fetch(url, {
          headers: { "X-Auth-Token": apiKey }
        });
        const data = await resp.json();
        if (!resp.ok) return res.status(resp.status).json({ error: data.message || "Erro API" });

        // Converte para formato compatível com o app
        const matches = data.matches || [];
        const fixtures = matches.map(m => convertMatch(m));
        result = { response: fixtures, results: fixtures.length };

        cache.set(cacheKey, { data: result, ts: Date.now() });
        return res.status(200).json(result);
      }

      if (leagueId) {
        // Busca por liga específica
        const cacheKey = 'fixtures_league_' + leagueId + '_' + (date||'');
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.ts < ttl) {
          res.setHeader("X-Cache", "HIT");
          return res.status(200).json(cached.data);
        }

        const fdCode = toFDCode(leagueId);
        if (!fdCode) return res.status(200).json({ response: [] });

        const url = `https://api.football-data.org/v4/competitions/${fdCode}/matches?dateFrom=${date}&dateTo=${date}`;
        const resp = await fetch(url, { headers: { "X-Auth-Token": apiKey } });
        const data = await resp.json();
        const matches = data.matches || [];
        result = { response: matches.map(m => convertMatch(m)) };
        cache.set(cacheKey, { data: result, ts: Date.now() });
        return res.status(200).json(result);
      }

      // fixtures?team=ID&last=5&status=FT
      if (params.team) {
        const cacheKey = 'team_fixtures_' + params.team + '_' + (params.last||5);
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.ts < ttl) {
          res.setHeader("X-Cache", "HIT");
          return res.status(200).json(cached.data);
        }

        const limit = parseInt(params.last) || 5;
        const url = `https://api.football-data.org/v4/teams/${params.team}/matches?status=FINISHED&limit=${limit}`;
        const resp = await fetch(url, { headers: { "X-Auth-Token": apiKey } });
        const data = await resp.json();
        const matches = (data.matches || []).slice(-limit);
        result = { response: matches.map(m => convertMatch(m)) };
        cache.set(cacheKey, { data: result, ts: Date.now() });
        return res.status(200).json(result);
      }
    }

    // ── LINEUPS ──────────────────────────────────────────────────────────────
    if (endpoint === 'fixtures/lineups') {
      // football-data.org fornece lineups no próprio match
      const fixtureId = params.fixture;
      const cacheKey = 'lineups_' + fixtureId;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.ts < ttl) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached.data);
      }

      const url = `https://api.football-data.org/v4/matches/${fixtureId}`;
      const resp = await fetch(url, { headers: { "X-Auth-Token": apiKey } });
      const data = await resp.json();
      if (!resp.ok) return res.status(200).json({ response: [] });

      const lineups = [];
      if (data.homeTeam?.lineup?.length) {
        lineups.push({
          team: { id: data.homeTeam.id, name: data.homeTeam.name },
          formation: data.homeTeam.formation || '?',
          startXI: (data.homeTeam.lineup || []).map(p => ({ player: { id: p.id, name: p.name } }))
        });
      }
      if (data.awayTeam?.lineup?.length) {
        lineups.push({
          team: { id: data.awayTeam.id, name: data.awayTeam.name },
          formation: data.awayTeam.formation || '?',
          startXI: (data.awayTeam.lineup || []).map(p => ({ player: { id: p.id, name: p.name } }))
        });
      }

      result = { response: lineups };
      cache.set(cacheKey, { data: result, ts: Date.now() });
      return res.status(200).json(result);
    }

    // ── INJURIES (não disponível no plano grátis - retorna vazio) ────────────
    if (endpoint === 'injuries') {
      return res.status(200).json({ response: [] });
    }

    // ── HEAD TO HEAD ─────────────────────────────────────────────────────────
    if (endpoint === 'fixtures/headtohead') {
      const h2h = params.h2h; // "teamA-teamB"
      const [t1, t2] = (h2h || '').split('-');
      if (!t1 || !t2) return res.status(200).json({ response: [] });

      const cacheKey = 'h2h_' + h2h;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.ts < 2 * 60 * 60 * 1000) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached.data);
      }

      const url = `https://api.football-data.org/v4/teams/${t1}/matches?status=FINISHED&limit=20`;
      const resp = await fetch(url, { headers: { "X-Auth-Token": apiKey } });
      const data = await resp.json();
      const h2hMatches = (data.matches || [])
        .filter(m => m.homeTeam?.id == t2 || m.awayTeam?.id == t2)
        .slice(-5);

      result = { response: h2hMatches.map(m => convertMatch(m)) };
      cache.set(cacheKey, { data: result, ts: Date.now() });
      return res.status(200).json(result);
    }

    // ── STANDINGS ────────────────────────────────────────────────────────────
    if (endpoint === 'standings') {
      const leagueId = params.league;
      const season = params.season;
      const fdCode = toFDCode(leagueId);
      if (!fdCode) return res.status(200).json({ response: [] });

      const cacheKey = 'standings_' + fdCode + '_' + season;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.ts < 2 * 60 * 60 * 1000) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached.data);
      }

      const url = `https://api.football-data.org/v4/competitions/${fdCode}/standings?season=${season}`;
      const resp = await fetch(url, { headers: { "X-Auth-Token": apiKey } });
      const data = await resp.json();
      if (!resp.ok) return res.status(200).json({ response: [] });

      // Converte para formato compatível
      const table = data.standings?.[0]?.table || [];
      const converted = table.map(row => ({
        rank: row.position,
        team: { id: row.team.id, name: row.team.name },
        points: row.points,
        form: row.form || '',
        description: row.description || '',
        all: {
          win: row.won, draw: row.draw, lose: row.lost,
          goals: { for: row.goalsFor, against: row.goalsAgainst }
        }
      }));

      result = { response: [{ league: { standings: [converted] } }] };
      cache.set(cacheKey, { data: result, ts: Date.now() });
      return res.status(200).json(result);
    }

    // ── TEAM STATISTICS ──────────────────────────────────────────────────────
    if (endpoint === 'teams/statistics') {
      const teamId = params.team;
      const leagueId = params.league;
      const season = params.season;
      const fdCode = toFDCode(leagueId);

      const cacheKey = 'stats_' + teamId + '_' + (fdCode||leagueId) + '_' + season;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.ts < 2 * 60 * 60 * 1000) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached.data);
      }

      // Busca últimas partidas para calcular estatísticas
      const url = `https://api.football-data.org/v4/teams/${teamId}/matches?status=FINISHED&limit=20`;
      const resp = await fetch(url, { headers: { "X-Auth-Token": apiKey } });
      const data = await resp.json();
      const matches = data.matches || [];

      // Calcula stats manualmente
      let wH=0,dH=0,lH=0,wA=0,dA=0,lA=0;
      let gfH=0,gaH=0,gfA=0,gaA=0,cs=0;
      matches.forEach(m => {
        const isHome = m.homeTeam?.id == teamId;
        const gf = isHome ? m.score?.fullTime?.home : m.score?.fullTime?.away;
        const ga = isHome ? m.score?.fullTime?.away : m.score?.fullTime?.home;
        if (gf === null || gf === undefined) return;
        if (ga === 0) cs++;
        if (isHome) {
          gfH += gf; gaH += ga;
          if (gf > ga) wH++; else if (gf === ga) dH++; else lH++;
        } else {
          gfA += gf; gaA += ga;
          if (gf > ga) wA++; else if (gf === ga) dA++; else lA++;
        }
      });

      const pH = wH+dH+lH || 1, pA = wA+dA+lA || 1, pT = pH+pA || 1;
      result = { response: {
        fixtures: {
          played: { total: pT, home: pH, away: pA },
          wins: { total: wH+wA }, draws: { total: dH+dA }, loses: { total: lH+lA }
        },
        goals: {
          for: { total: { total: gfH+gfA, home: gfH, away: gfA } },
          against: { total: { total: gaH+gaA, home: gaH, away: gaA } }
        },
        clean_sheet: { total: cs }
      }};
      cache.set(cacheKey, { data: result, ts: Date.now() });
      return res.status(200).json(result);
    }

    // ── TEAMS SEARCH ─────────────────────────────────────────────────────────
    if (endpoint === 'teams') {
      const search = params.search;
      const cacheKey = 'search_' + search;
      const cached = cache.get(cacheKey);
      if (cached && Date.now() - cached.ts < 60 * 60 * 1000) {
        res.setHeader("X-Cache", "HIT");
        return res.status(200).json(cached.data);
      }

      // football-data.org não tem busca por nome - tenta encontrar pelo nome na lista de times
      // Usa endpoint de times de competições brasileiras
      const comps = ['BSA', 'CLI'];
      let found = [];
      for (const comp of comps) {
        try {
          const r = await fetch(`https://api.football-data.org/v4/competitions/${comp}/teams`, {
            headers: { "X-Auth-Token": apiKey }
          });
          const d = await r.json();
          const teams = d.teams || [];
          const match = teams.filter(t =>
            t.name.toLowerCase().includes(search.toLowerCase()) ||
            t.shortName?.toLowerCase().includes(search.toLowerCase()) ||
            t.tla?.toLowerCase().includes(search.toLowerCase())
          );
          found.push(...match);
        } catch(e) {}
      }

      result = { response: found.map(t => ({ team: { id: t.id, name: t.name } })) };
      cache.set(cacheKey, { data: result, ts: Date.now() });
      return res.status(200).json(result);
    }

    // ── ODDS (não disponível no plano gratuito) ───────────────────────────────
    if (endpoint === 'odds') {
      return res.status(200).json({ response: [] });
    }

    return res.status(404).json({ error: "Endpoint não suportado: " + endpoint });

  } catch (err) {
    return res.status(500).json({ error: "Erro: " + err.message });
  }
}

// Converte match do football-data.org para formato compatível com o app
function convertMatch(m) {
  return {
    fixture: {
      id: m.id,
      date: m.utcDate,
      status: { short: convertStatus(m.status) }
    },
    league: {
      id: m.competition?.id,
      name: m.competition?.name,
      season: m.season?.startDate ? new Date(m.season.startDate).getFullYear() : new Date().getFullYear()
    },
    teams: {
      home: { id: m.homeTeam?.id, name: m.homeTeam?.name },
      away: { id: m.awayTeam?.id, name: m.awayTeam?.name }
    },
    goals: {
      home: m.score?.fullTime?.home ?? null,
      away: m.score?.fullTime?.away ?? null
    }
  };
}

function convertStatus(s) {
  const map = { 'SCHEDULED':'NS','LIVE':'1H','IN_PLAY':'1H','PAUSED':'HT','FINISHED':'FT','POSTPONED':'PST','SUSPENDED':'SUSP','CANCELLED':'CANC' };
  return map[s] || s;
}

// Mapa de ID numérico (antigo api-football) -> código football-data.org
function toFDCode(id) {
  const map = {
    39:'PL',    // Premier League
    140:'PD',   // La Liga
    135:'SA',   // Serie A
    78:'BL1',   // Bundesliga
    61:'FL1',   // Ligue 1
    2:'UCL',    // Champions League
    3:'UEL',    // Europa League
    71:'BSA',   // Brasileirão
    13:'CLI',   // Libertadores
    94:'PPL',   // Primeira Liga
    88:'DED',   // Eredivisie
    // Códigos diretos (já são códigos FD)
    'PL':'PL','PD':'PD','SA':'SA','BL1':'BL1','FL1':'FL1',
    'UCL':'UCL','UEL':'UEL','BSA':'BSA','CLI':'CLI','PPL':'PPL','DED':'DED',
  };
  return map[id] || null;
}
