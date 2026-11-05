// Explicit opt-in: ambient provider credentials never enable inference by themselves.
export function aiPolicy({ aiEnabled = false, ai = {}, agent = null } = {}) {
  if (typeof aiEnabled !== 'boolean') throw Error('aiEnabled must be a boolean');
  return { ai: { ...ai, enabled: aiEnabled }, agent: aiEnabled ? agent : null };
}
