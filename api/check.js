export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const apiKey = process.env.FOOTBALLDATA_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  let debug = {};

  if (apiKey) {
    const hoje = new Date().toISOString().split('T')[0];

    // Testa endpoint de matches geral
    try {
      const r = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${hoje}&dateTo=${hoje}`, {
        headers: { "X-Auth-Token": apiKey }
      });
      const d = await r.json();
      debug.matches_geral = {
        status: r.status,
        total: d.matches?.length || 0,
        erro: d.message || d.errorCode || null,
        competicoes: [...new Set((d.matches||[]).map(m => m.competition?.name + ' (id:' + m.competition?.id + ')'))].slice(0,10)
      };
    } catch(e) { debug.matches_geral = { erro: e.message }; }

    // Testa Premier League diretamente
    try {
      const r = await fetch(`https://api.football-data.org/v4/competitions/PL/matches?dateFrom=${hoje}&dateTo=${hoje}`, {
        headers: { "X-Auth-Token": apiKey }
      });
      const d = await r.json();
      debug.pl_hoje = { status: r.status, total: d.matches?.length || 0, erro: d.message || null };
    } catch(e) { debug.pl_hoje = { erro: e.message }; }

    // Testa Brasileirão
    try {
      const r = await fetch(`https://api.football-data.org/v4/competitions/BSA/matches?dateFrom=${hoje}&dateTo=${hoje}`, {
        headers: { "X-Auth-Token": apiKey }
      });
      const d = await r.json();
      debug.brasileirao_hoje = { status: r.status, total: d.matches?.length || 0, erro: d.message || null };
    } catch(e) { debug.brasileirao_hoje = { erro: e.message }; }

    // Verifica quais competições o plano permite
    try {
      const r = await fetch(`https://api.football-data.org/v4/competitions`, {
        headers: { "X-Auth-Token": apiKey }
      });
      const d = await r.json();
      debug.competicoes_disponiveis = (d.competitions||[]).map(c => c.code + ' - ' + c.name);
    } catch(e) { debug.competicoes_disponiveis = { erro: e.message }; }
  }

  return res.status(200).json({
    FOOTBALLDATA_KEY: apiKey ? `✅ OK (${apiKey.length} chars)` : "❌ NÃO configurada",
    ANTHROPIC_API_KEY: anthropicKey ? `✅ OK (${anthropicKey.length} chars)` : "❌ NÃO configurada",
    data_hoje: new Date().toISOString().split('T')[0],
    debug
  });
}
