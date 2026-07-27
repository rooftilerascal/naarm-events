import { load } from 'cheerio';

export const RRR_USER_AGENT = 'Mozilla/5.0 (compatible; NaarmEventsBot/1.0)';

// RRR's own event page sometimes has a "More info" button pointing straight to the
// real ticketing/event page (e.g. a venue's own site or a professional promoter's
// page). Small DIY gigs usually don't have one — in that case we keep linking to
// the RRR page itself, which is still the best available info page for those.
export async function resolveMoreInfoUrl(rrrEventUrl) {
  try {
    const res = await fetch(rrrEventUrl, { headers: { 'User-Agent': RRR_USER_AGENT } });
    if (!res.ok) return rrrEventUrl;
    const $ = load(await res.text());
    const moreInfoLink = $('a.action-button')
      .filter((_, el) => $(el).text().trim().toLowerCase().startsWith('more info'))
      .first();
    const href = moreInfoLink.attr('href');
    return href && href.startsWith('http') ? href : rrrEventUrl;
  } catch {
    return rrrEventUrl;
  }
}
