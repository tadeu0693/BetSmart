export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();

  // Serve HTML page on GET /
  if (req.method === "GET") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(getHTML());
  }

  // Handle POST /api/analyze
  if (req.method === "POST") {
    const { match } = req.body || {};
    if (!match) return res.status(400).json({ error: "match is required" });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY não configurada. Vá em Settings > Environment Variables no Vercel." });

    const SYSTEM_PROMPT = `Voce e especialista em apostas esportivas. Analise a partida e responda EXATAMENTE neste formato de tags. Nao use JSON nem markdown.

[MATCH]Times[/MATCH]
[LEAGUE]Liga[/LEAGUE]
[CONFIDENCE]Alta ou Media ou Baixa[/CONFIDENCE]
[FORM_HOME]Forma recente do time da casa em 2-3 frases.[/FORM_HOME]
[FORM_AWAY]Forma recente do visitante em 2-3 frases.[/FORM_AWAY]
[SQUAD_HOME]Desfalques do time da casa em 2 frases.[/SQUAD_HOME]
[SQUAD_AWAY]Desfalques do visitante em 2 frases.[/SQUAD_AWAY]
[H2H]Historico em 2 frases.[/H2H]
[CONTEXT]Contexto da partida em 2 frases.[/CONTEXT]
[TIPS]
- Resultado Final | Time vence | Razao curta | **** | Baixo
- Ambos Marcam | Sim | Razao curta | *** | Medio
- Total de Gols | Mais de 2.5 | Razao curta | *** | Medio
- Total de Gols | Menos de 2.5 | Razao curta | ** | Medio
- Escanteios | Mais de 9.5 | Razao curta | ** | Medio
- Cartoes | Mais de 3.5 | Razao curta | ** | Alto
- Placar Correto | 2-0 | Razao curta | * | Alto
- Marcador | Jogador | Razao curta | ** | Medio
- Intervalo | Vencendo | Razao curta | ** | Alto
- Dupla Chance | Casa ou X | Razao curta | **** | Baixo
[/TIPS]
Substitua pelos dados reais. Use * para estrelas. Mantenha pipe | como separador.`;

    try {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1500,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: "Analise esta partida: " + match }],
        }),
      });

      if (!response.ok) {
        const err = await response.text();
        return res.status(response.status).json({ error: "Anthropic error: " + err });
      }

      const data = await response.json();
      const text = data.content.map(c => c.text || "").join("");
      return res.status(200).json({ text });

    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: "Method not allowed" });
}

function getHTML() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="BetSmart IA">
<meta name="theme-color" content="#080c10">
<title>BetSmart IA</title>
<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
:root{--green:#00ff88;--green-dk:#00cc6a;--bg:#080c10;--card:#0d1724;--card2:#111d2e;--border:#1e2d42;--text:#e2eaf6;--muted:#5a7a99;--yellow:#ffd166;--red:#ff4d6d;--blue:#4dabf7}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{min-height:100%;background:var(--bg);color:var(--text);font-family:'Outfit',sans-serif;overflow-x:hidden}
body::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:0;background-image:linear-gradient(rgba(0,255,136,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(0,255,136,.025) 1px,transparent 1px);background-size:40px 40px}
.wrap{max-width:860px;margin:0 auto;padding:0 16px;position:relative;z-index:1}
header{padding:18px 16px 14px;border-bottom:1px solid var(--border);background:linear-gradient(180deg,rgba(0,255,136,.06) 0%,transparent 100%);position:sticky;top:0;z-index:100;backdrop-filter:blur(12px)}
.header-inner{max-width:860px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.logo{font-size:1.8rem;font-weight:800;letter-spacing:2px;color:var(--green);text-shadow:0 0 28px rgba(0,255,136,.4);line-height:1}
.logo span{color:var(--text)}
.logo-badge{background:linear-gradient(135deg,var(--green),var(--green-dk));color:#000;font-size:.52rem;font-weight:800;padding:3px 8px;border-radius:20px;letter-spacing:1px;text-transform:uppercase;vertical-align:middle;margin-left:4px}
.logo-sub{font-size:.7rem;color:var(--muted);margin-top:2px}
.date-pill{font-size:.72rem;color:var(--muted);background:var(--card);padding:5px 12px;border-radius:20px;border:1px solid var(--border)}
.search-box{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:18px;margin:22px 0 0;box-shadow:0 4px 30px rgba(0,0,0,.3)}
.section-label{font-size:.65rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px}
.input-row{display:flex;gap:9px;flex-wrap:wrap;margin-bottom:14px}
.match-input{flex:1;min-width:160px;background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:11px 14px;color:var(--text);font-size:.92rem;font-family:'Outfit',sans-serif;outline:none;transition:border-color .2s}
.match-input:focus{border-color:var(--green)}
.match-input::placeholder{color:var(--muted)}
.btn-analyze{background:linear-gradient(135deg,var(--green),var(--green-dk));color:#000;border:none;border-radius:10px;padding:11px 20px;font-size:.88rem;font-weight:700;font-family:'Outfit',sans-serif;cursor:pointer;transition:all .2s;white-space:nowrap}
.btn-analyze:disabled{background:var(--border);color:var(--muted);cursor:not-allowed}
.btn-analyze:not(:disabled):active{transform:scale(.97)}
.quick-grid{display:flex;flex-wrap:wrap;gap:7px}
.quick-btn{background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:5px 11px;font-size:.72rem;color:var(--muted);cursor:pointer;font-family:'Outfit',sans-serif;transition:all .2s}
.quick-btn:hover,.quick-btn:active{border-color:var(--green);color:var(--green)}
.loading{display:none;text-align:center;padding:48px 20px}
.loading.show{display:block}
.spinner{width:44px;height:44px;border:3px solid var(--border);border-top-color:var(--green);border-radius:50%;animation:spin .8s linear infinite;margin:0 auto 13px}
.loading-text{color:var(--muted);font-size:.86rem;animation:pulse 1.5s ease-in-out infinite}
.error-box{display:none;background:rgba(255,77,109,.1);border:1px solid rgba(255,77,109,.3);border-radius:10px;padding:12px 15px;color:var(--red);font-size:.86rem;margin-top:14px}
.error-box.show{display:block}
.match-card{background:var(--card);border:1px solid var(--border);border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,.4);margin-top:22px;animation:fadeUp .4s ease both}
.card-head{padding:15px 18px;background:linear-gradient(135deg,var(--card2),var(--card));border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px}
.card-league{font-size:.65rem;font-weight:700;color:var(--green);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px}
.card-match{font-size:1.35rem;font-weight:800;letter-spacing:.3px}
.conf-badge{font-size:.68rem;font-weight:700;padding:5px 12px;border-radius:20px;text-transform:uppercase;letter-spacing:.5px;white-space:nowrap}
.conf-high{background:rgba(0,255,136,.12);color:var(--green);border:1px solid rgba(0,255,136,.3)}
.conf-mid{background:rgba(255,209,102,.12);color:var(--yellow);border:1px solid rgba(255,209,102,.3)}
.conf-low{background:rgba(255,77,109,.12);color:var(--red);border:1px solid rgba(255,77,109,.3)}
.card-body{padding:16px}
.info-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-bottom:16px}
@media(max-width:480px){.info-grid{grid-template-columns:1fr}}
.info-block{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:12px 13px}
.info-title{font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:6px;display:flex;align-items:center;gap:5px}
.info-title::before{content:'';width:3px;height:10px;background:var(--green);border-radius:2px;display:inline-block}
.info-title.blue::before{background:var(--blue)}
.info-text{font-size:.82rem;color:#c0d4e8;line-height:1.6}
.tips-title{font-size:.6rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:var(--muted);margin-bottom:10px;display:flex;align-items:center;gap:5px}
.tips-title::before{content:'';width:3px;height:10px;background:var(--yellow);border-radius:2px;display:inline-block}
.tips-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:8px}
.tip-card{background:var(--card2);border:1px solid var(--border);border-radius:9px;padding:10px 12px;transition:border-color .2s}
.tip-card:hover{border-color:var(--green)}
.tip-market{font-size:.58rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.7px;margin-bottom:3px}
.tip-bet{font-size:.9rem;font-weight:600;color:var(--text);margin-bottom:3px}
.tip-reason{font-size:.72rem;color:#7a9ab8;line-height:1.4;margin-bottom:4px}
.tip-stars{font-size:.78rem;color:var(--yellow)}
.risk-tag{display:inline-block;font-size:.58rem;font-weight:700;padding:2px 7px;border-radius:4px;text-transform:uppercase;letter-spacing:.5px;margin-top:4px}
.risk-low{background:rgba(0,255,136,.12);color:var(--green)}
.risk-mid{background:rgba(255,209,102,.12);color:var(--yellow)}
.risk-high{background:rgba(255,77,109,.12);color:var(--red)}
.disclaimer{background:rgba(255,77,109,.06);border:1px solid rgba(255,77,109,.15);border-radius:11px;padding:12px 15px;margin-top:22px;margin-bottom:30px;font-size:.74rem;color:var(--muted);text-align:center;line-height:1.6}
.disclaimer strong{color:var(--red)}
.empty{text-align:center;padding:50px 20px;color:var(--muted)}
.empty-icon{font-size:3rem;margin-bottom:10px;opacity:.3}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}
@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
</style>
</head>
<body>
<header>
  <div class="header-inner">
    <div>
      <div class="logo">Bet<span>Smart</span><span class="logo-badge">IA</span></div>
      <div class="logo-sub">Análise inteligente de apostas esportivas</div>
    </div>
    <div class="date-pill" id="datePill"></div>
  </div>
</header>
<div class="wrap">
  <div class="search-box">
    <div class="section-label">⚡ Analisar partida</div>
    <div class="input-row">
      <input class="match-input" id="matchInput" type="text" placeholder="Ex: Arsenal vs Chelsea, Real Madrid vs Getafe..." autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false"/>
      <button class="btn-analyze" id="btnAnalyze" onclick="doAnalyze()">Analisar com IA</button>
    </div>
    <div class="section-label">🎯 Jogos rápidos</div>
    <div class="quick-grid" id="quickGrid"></div>
  </div>
  <div class="error-box" id="errorBox"></div>
  <div class="loading" id="loading">
    <div class="spinner"></div>
    <div class="loading-text" id="loadingText"></div>
  </div>
  <div id="result">
    <div class="empty"><div class="empty-icon">⚽</div><div>Clique em um jogo ou digite o nome da partida para começar</div></div>
  </div>
  <div class="disclaimer"><strong>⚠️ AVISO:</strong> App apenas informativo. Apostas envolvem risco de perda financeira. Jogue com responsabilidade.</div>
</div>
<script>
const QUICK=["Arsenal vs Chelsea - Premier League","Real Betis vs Sevilha - La Liga","Girona vs Celta de Vigo - La Liga","Real Madrid vs Getafe - La Liga","Roma vs Juventus - Serie A","Torino vs Lazio - Serie A","Pisa vs Bologna - Serie A","Udinese vs Fiorentina - Serie A"];
const MSGS=["🔍 Buscando informações...","📊 Analisando forma recente...","🏥 Verificando desfalques...","🤖 Gerando previsões...","✅ Finalizando análise..."];
document.getElementById("datePill").textContent=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"2-digit",month:"long",year:"numeric"});
const qg=document.getElementById("quickGrid");
QUICK.forEach(m=>{const b=document.createElement("button");b.className="quick-btn";b.textContent="⚽ "+m.split(" - ")[0];b.onclick=()=>{document.getElementById("matchInput").value=m;doAnalyze()};qg.appendChild(b)});
document.getElementById("matchInput").addEventListener("keydown",e=>{if(e.key==="Enter")doAnalyze()});
let timer;
function setLoading(on){
  const el=document.getElementById("loading"),btn=document.getElementById("btnAnalyze");
  clearInterval(timer);
  if(on){el.classList.add("show");btn.disabled=true;btn.textContent="Analisando...";let i=0;document.getElementById("loadingText").textContent=MSGS[0];timer=setInterval(()=>{i=(i+1)%MSGS.length;document.getElementById("loadingText").textContent=MSGS[i]},1800)}
  else{el.classList.remove("show");btn.disabled=false;btn.textContent="Analisar com IA"}
}
function showError(msg){const el=document.getElementById("errorBox");el.textContent=msg;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),7000)}
function getTag(text,tag){const re=new RegExp("\\\\["+tag+"\\\\]([\\\\s\\\\S]*?)\\\\[/"+tag+"\\\\]","i");const m=text.match(re);return m?m[1].trim():""}
function parseTips(raw){const tips=[];raw.split("\\n").filter(l=>l.trim().startsWith("-")).forEach(line=>{const parts=line.replace(/^-\\s*/,"").split("|").map(s=>s.trim());if(parts.length>=3){const r=(parts[4]||"medio").toLowerCase();tips.push({market:parts[0]||"Mercado",bet:parts[1]||"",reason:parts[2]||"",stars:(parts[3]||"***").replace(/[^*]/g,"").length||3,risk:r.includes("alto")?"high":r.includes("baixo")?"low":"mid"})}});return tips}
function starsHTML(n){"★".repeat(Math.min(n,5))+'<span style="opacity:.25">'+"★".repeat(Math.max(0,5-n))+"</span>"}
function renderCard(a){
  const cc={high:"conf-high",mid:"conf-mid",low:"conf-low"}[a.confidence]||"conf-mid";
  const cl={high:"Confiança Alta",mid:"Confiança Média",low:"Confiança Baixa"}[a.confidence]||"Confiança Média";
  const rl={low:["Baixo Risco","risk-low"],mid:["Médio Risco","risk-mid"],high:["Alto Risco","risk-high"]};
  const ib=(t,tx,bl)=>\`<div class="info-block"><div class="info-title\${bl?" blue":""}">\${t}</div><div class="info-text">\${tx||"—"}</div></div>\`;
  const th=a.tips.map(t=>{const[rl2,rc]=rl[t.risk]||rl.mid;const st="★".repeat(Math.min(t.stars,5))+'<span style="opacity:.25">'+"★".repeat(Math.max(0,5-t.stars))+"</span>";return\`<div class="tip-card"><div class="tip-market">\${t.market}</div><div class="tip-bet">\${t.bet}</div><div class="tip-reason">\${t.reason}</div><div class="tip-stars">\${st}</div><span class="risk-tag \${rc}">\${rl2}</span></div>\`}).join("");
  document.getElementById("result").innerHTML=\`<div class="match-card"><div class="card-head"><div><div class="card-league">\${a.league||""}</div><div class="card-match">\${a.match||""}</div></div><span class="conf-badge \${cc}">\${cl}</span></div><div class="card-body"><div class="info-grid">\${ib("Forma — Casa",a.formHome)}\${ib("Forma — Visitante",a.formAway)}\${ib("Elenco — Casa",a.squadHome)}\${ib("Elenco — Visitante",a.squadAway)}\${ib("Histórico H2H",a.h2h,true)}\${ib("Contexto",a.context,true)}</div><div class="tips-title">Dicas de Apostas</div><div class="tips-grid">\${th}</div></div></div>\`;
}
async function doAnalyze(){
  const input=document.getElementById("matchInput").value.trim();
  if(!input){showError("Digite o nome do jogo.");return}
  document.getElementById("errorBox").classList.remove("show");
  document.getElementById("result").innerHTML="";
  setLoading(true);
  try{
    const resp=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({match:input})});
    if(!resp.ok)throw new Error("Erro no servidor: "+resp.status);
    const data=await resp.json();
    if(data.error)throw new Error(data.error);
    const raw=data.text||"";
    if(!raw.includes("[MATCH]"))throw new Error("Resposta inválida. Tente novamente.");
    const confRaw=getTag(raw,"CONFIDENCE").toLowerCase();
    const analysis={match:getTag(raw,"MATCH")||input,league:getTag(raw,"LEAGUE"),confidence:confRaw.includes("alta")?"high":confRaw.includes("baixa")?"low":"mid",formHome:getTag(raw,"FORM_HOME"),formAway:getTag(raw,"FORM_AWAY"),squadHome:getTag(raw,"SQUAD_HOME"),squadAway:getTag(raw,"SQUAD_AWAY"),h2h:getTag(raw,"H2H"),context:getTag(raw,"CONTEXT"),tips:parseTips(getTag(raw,"TIPS"))};
    if(!analysis.tips.length)throw new Error("Sem dicas. Tente novamente.");
    renderCard(analysis);
    document.getElementById("matchInput").value="";
  }catch(err){showError("Erro: "+err.message)}
  finally{setLoading(false)}
}
</script>
</body>
</html>`;
}
