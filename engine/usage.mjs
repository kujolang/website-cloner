import { randomUUID } from 'node:crypto';
const number = (...values) => values.find(v => typeof v === 'number' && Number.isSafeInteger(v) && v >= 0) ?? null;
export function normalizeUsage(result = {}) {
  const u = result.usage || {}, details = u.input_tokens_details || u.prompt_tokens_details || {};
  let input = number(u.input_tokens, u.prompt_tokens);
  const output = number(u.output_tokens, u.completion_tokens);
  const cached = number(u.cached_input_tokens, u.cached_tokens, details.cached_tokens, u.cache_read_input_tokens, u.prompt_cache_hit_tokens);
  const cacheWrite = number(u.cache_creation_input_tokens, u.cache_write_input_tokens);
  // Native Anthropic input excludes cache read/write; OpenAI-style input includes cache hits.
  if (input != null && u.prompt_tokens == null && u.cached_input_tokens == null && u.input_tokens != null && (u.cache_read_input_tokens != null || u.cache_creation_input_tokens != null)) input += (cached || 0) + (cacheWrite || 0);
  const total = number(u.total_tokens) ?? (input != null && output != null ? input + output : null);
  return { input, output, cached, cacheWrite, total, uncachedInput: input != null && cached != null ? Math.max(0, input - cached - (cacheWrite || 0)) : null,
    reasoning: number(u.output_tokens_details?.reasoning_tokens, u.completion_tokens_details?.reasoning_tokens),
    complete: input != null && output != null && result.usage_complete !== false && !(number(result.provider_rounds) != null && number(result.usage_reported_rounds) != null && result.usage_reported_rounds < result.provider_rounds),
    providerRounds: number(result.provider_rounds), reportedRounds: number(result.usage_reported_rounds) };
}
export function summarizeUsage(rounds) {
  const fields = ['input','output','cached','cacheWrite','uncachedInput','total','reasoning'];
  return { calls: rounds.reduce((n,r) => n + (r.legacyCalls || 1), 0), complete: rounds.every(r => r.tokens?.complete),
    ...Object.fromEntries(fields.map(field => [field, { known: rounds.reduce((n,r) => n + (r.tokens?.[field] ?? 0), 0), missing: rounds.filter(r => r.tokens?.[field] == null).length }])) };
}
export async function beginUsage(model, info, persist = async () => {}) {
  initializeUsage(model);
  const rounds = model.metrics.aiUsage;
  const entry = { id: randomUUID(), ...info, requestedModel: info.model, startedAt: new Date().toISOString(), status: 'pending', tokens: normalizeUsage() };
  rounds.push(entry); refresh(model); await persist(rounds); return entry;
}
export function initializeUsage(model) {
  if (!model.metrics.aiUsage) {
    model.metrics.aiUsage = model.metrics.aiCalls > 0 ? [{ id: randomUUID(), stage: 'legacy-aggregate', model: model.metrics.aiModel || 'unrecorded', status: 'historical', legacyCalls: model.metrics.aiCalls, tokens: normalizeUsage({ usage: { input_tokens: model.metrics.inputTokens, output_tokens: model.metrics.outputTokens }, usage_complete: !model.metrics.usageUnavailable }) }] : [];
  }
  refresh(model);
}
function refresh(model) {
  const total = summarizeUsage(model.metrics.aiUsage || []);
  model.metrics.aiCalls = total.calls; model.metrics.inputTokens = total.input.known; model.metrics.outputTokens = total.output.known;
  model.metrics.cachedInputTokens = total.cached.missing ? null : total.cached.known;
  model.metrics.totalTokens = total.total.missing ? null : total.total.known;
  model.metrics.usageUnavailable = !total.complete; model.metrics.aiUsageTotals = total;
}
export async function finishUsage(model, entry, result, status, persist = async () => {}) {
  if (result) {
    entry.tokens = normalizeUsage(result);
    if (typeof result.model === 'string') entry.model = result.model;
    if (typeof result.provider === 'string') entry.provider = result.provider;
    if (typeof result.billing_source === 'string') entry.billingSource = result.billing_source;
  }
  entry.status = status; entry.finishedAt = new Date().toISOString(); refresh(model); await persist(model.metrics.aiUsage);
}
