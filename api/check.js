export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const rapidKey = process.env.RAPIDAPI_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  return res.status(200).json({
    RAPIDAPI_KEY: rapidKey ? `✅ Configurada (${rapidKey.length} caracteres)` : "❌ NÃO configurada",
    ANTHROPIC_API_KEY: anthropicKey ? `✅ Configurada (${anthropicKey.length} caracteres)` : "❌ NÃO configurada",
    node_version: process.version,
    timestamp: new Date().toISOString(),
  });
}
