import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

export async function chatConfig() {
  const saved = process.env.AI_CHAT_ENV_FILE
    ? parseEnv(await readFile(process.env.AI_CHAT_ENV_FILE, "utf8")) : {};
  const url = new URL(process.env.AI_CHAT_URL || `http://127.0.0.1:${saved.PORT || 4174}`);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.username || url.password)
    throw Error("AI Chat must use the configured loopback service");
  return { origin: url.origin, token: process.env.AI_CHAT_TOKEN || saved.API_AUTH_TOKEN };
}
export async function chatRequest(route, body, timeout = 15000) {
  const { origin, token } = await chatConfig();
  if (!token) throw Error("AI Chat connection is not configured");
  const response = await fetch(origin + route, {
    method: body ? "POST" : "GET", redirect: "error",
    headers: { "X-API-Token": token, "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(timeout),
  });
  const data = await response.json();
  if (!response.ok || data.ok === false)
    throw Object.assign(Error(`AI Chat: ${data.error?.message || `HTTP ${response.status}`}`), { usageResult: { usage: data.usage, usage_complete: data.usage_complete, provider_rounds: data.provider_rounds, usage_reported_rounds: data.usage_reported_rounds } });
  return data;
}
export async function availableModels() {
  const data = await chatRequest("/api/state?messages=none");
  return (data.state?.settings?.profiles || []).filter(p => p.provider_id !== "codex")
    .flatMap(p => String(p.models_csv || "").split(",").filter(Boolean).map(model => ({
      profileId: p.id, provider: p.provider_id, model,
      label: `${p.provider_id === "openai_chatgpt_plan" ? "ChatGPT" : p.name} · ${model}`,
    })));
}
export async function askModel(selection, messages) {
  return chatRequest("/api/chat", {
    profile_id: selection.profileId, model: selection.model, messages,
    include_saved_runtime_presets: false, tools: [], max_tokens: 6000,
    max_retries: 0, temperature: 0.1,
  }, 180000);
}
