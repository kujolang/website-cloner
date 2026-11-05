import {load} from 'cheerio';

// Date navigation describes a view over content, not another content record.
// Following next/previous day/month indefinitely never completes a whole-site crawl.
export function calendarDiscoveryLinks(html, base) {
  const $=load(html), content=new Set(), navigation=new Set();
  $('a[href]').each((_,element)=>{
    const a=$(element);let url;try{url=new URL(a.attr('href'),base);url.hash='';}catch{return;}
    const dateView=/\/\d{4}-\d{2}(?:-\d{2})?\/?$/.test(url.pathname);
    const calendarNav=a.is('[data-js="tribe-events-view-link"]') &&
      a.is('.tribe-events-c-top-bar__nav-link, .tribe-events-c-nav__next, .tribe-events-c-nav__prev');
    (dateView&&calendarNav?navigation:content).add(url.href);
  });
  for(const url of content)navigation.delete(url);
  return {content:[...content],navigation:[...navigation]};
}
