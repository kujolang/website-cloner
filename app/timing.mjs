// Persist accumulated time; a resumed process never counts time spent offline.
export function startTiming(prior, now=Date.now()) {
  return {workMs:prior?.workMs||0,waitMs:prior?.waitMs||0,state:'running',since:now};
}
export function timingSnapshot(timing, now=Date.now()) {
  if(!timing)return null;
  const value={...timing};
  if(value.state==='running'||value.state==='waiting') {
    value[value.state==='running'?'workMs':'waitMs']+=Math.max(0,now-value.since);
    value.since=now;
  }
  return value;
}
export function transitionTiming(timing,state,now=Date.now()) {
  return {...timingSnapshot(timing,now),state,since:now};
}
