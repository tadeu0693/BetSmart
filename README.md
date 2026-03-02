# BetSmart IA — Versão Corrigida

## ⚠️ Se deu erro 404, siga estes passos:

### No GitHub:
1. Apague os arquivos antigos do repositório
2. Faça upload dos novos arquivos desta pasta mantendo a estrutura:
   ```
   api/analyze.js        ← ARQUIVO DA API
   public/index.html     ← PÁGINA PRINCIPAL
   public/manifest.json  ← CONFIGURAÇÃO DO APP
   vercel.json           ← CONFIGURAÇÃO DO VERCEL
   ```
   ⚠️ A estrutura de pastas é obrigatória!

### No Vercel:
1. Vá em Settings → Environment Variables
2. Confirme que existe: ANTHROPIC_API_KEY = sk-ant-...
3. Vá em Deployments → clique nos 3 pontinhos → Redeploy

### Instalar no celular (Android):
1. Abra a URL do Vercel no Chrome
2. Toque nos 3 pontinhos → "Adicionar à tela inicial"

### Instalar no celular (iPhone):
1. Abra a URL no Safari
2. Botão compartilhar → "Adicionar à Tela de Início"
