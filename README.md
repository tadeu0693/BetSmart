# BetSmart IA — Deploy no Vercel

## O que é isso?
App de análise de apostas esportivas com IA. Funciona 100% no celular como um app instalado.

## Passo a passo para hospedar GRÁTIS

### 1. Criar conta no GitHub (gratuito)
- Acesse https://github.com e crie uma conta

### 2. Criar repositório
- Clique em "New repository"
- Nome: `betsmart-ia`
- Deixe público
- Clique "Create repository"

### 3. Fazer upload dos arquivos
- Clique em "uploading an existing file"
- Faça upload de todos os arquivos desta pasta mantendo a estrutura:
  ```
  api/analyze.js
  public/index.html
  public/manifest.json
  vercel.json
  ```

### 4. Criar conta no Vercel (gratuito)
- Acesse https://vercel.com
- Clique "Sign Up" → "Continue with GitHub"

### 5. Importar projeto
- No Vercel, clique "Add New Project"
- Selecione o repositório `betsmart-ia`
- Clique "Deploy"

### 6. ⚠️ IMPORTANTE — Adicionar a chave da API
- No Vercel, vá em Settings → Environment Variables
- Adicione:
  - **Name:** `ANTHROPIC_API_KEY`
  - **Value:** sua chave da API da Anthropic (https://console.anthropic.com)
- Clique "Save" e depois "Redeploy"

### 7. Pronto! Seu app estará em:
```
https://betsmart-ia.vercel.app
```

---

## Instalar no celular como app (ícone na tela inicial)

### Android (Chrome):
1. Abra o link no Chrome
2. Toque nos 3 pontinhos (⋮) no canto superior direito
3. Toque "Adicionar à tela inicial"
4. Confirme → aparece o ícone igual a um app!

### iPhone (Safari):
1. Abra o link no Safari
2. Toque no botão compartilhar (□ com seta)
3. Role para baixo e toque "Adicionar à Tela de Início"
4. Confirme → ícone na tela inicial!

---

## Onde pegar a chave da API Anthropic
1. Acesse https://console.anthropic.com
2. Faça login ou crie conta
3. Vá em "API Keys" → "Create Key"
4. Copie e cole no Vercel como mostrado no passo 6
