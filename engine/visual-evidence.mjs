// Scores remain raw. Different scroll positions can move fixed/sticky content
// and viewport-relative measurements even when the source DOM is unchanged.
export function compareCapturePositions(source, rebuilt) {
  const valid = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
  if (!valid(source) || !valid(rebuilt)) return { status: 'unknown', reason: 'Capture scroll position was not recorded on both sides.' };
  const delta = { x: rebuilt.x - source.x, y: rebuilt.y - source.y };
  return { status: Math.abs(delta.x) <= 1 && Math.abs(delta.y) <= 1 ? 'aligned' : 'mismatched', delta };
}

export function visualEvidenceFailures(visual) {
  const failures = [];
  const position = v => compareCapturePositions(v.capturePosition?.source, v.capturePosition?.rebuilt).status;
  const low = v => Number.isFinite(v.pixelSimilarity) && v.pixelSimilarity < 0.85 || Number.isFinite(v.layoutSimilarity) && v.layoutSimilarity < 0.7;
  if (visual.some(v => position(v) === 'mismatched'))
    failures.push('Source and rebuilt capture scroll positions differ; visual fidelity cannot be verified from this comparison.');
  if (visual.some(v => low(v) && position(v) === 'unknown'))
    failures.push('Visual differences require review; capture scroll alignment is unverified in the saved evidence.');
  if (visual.some(v => low(v) && position(v) === 'aligned'))
    failures.push('The rebuilt layout differs substantially from the captured source.');
  return failures;
}
