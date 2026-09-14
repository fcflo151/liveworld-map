export interface GdacsObservation {
  id: string;
  externalEventId: string;
  episodeId: string | null;
  eventType: string;
  title: string;
  alertLevel: 'green' | 'orange' | 'red' | 'unknown';
  alertScore: number | null;
  severityText: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  publishedAt: string | null;
  sourceUrl: string;
  source: 'GDACS';
  role: 'supplementary-observation';
  complements: 'USGS' | 'NASA FIRMS' | 'NASA EONET' | 'weather-layer' | null;
}

function tag(xml: string, name: string): string {
  const match = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, 'i'));
  return (match?.[1] ?? '').replace(/^<!\[CDATA\[|\]\]>$/g, '').trim();
}

function decode(value: string) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function finite(value: string): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function complementFor(eventType: string): GdacsObservation['complements'] {
  if (eventType === 'EQ') return 'USGS';
  if (eventType === 'WF') return 'NASA FIRMS';
  if (eventType === 'VO') return 'NASA EONET';
  if (['TC', 'FL', 'DR'].includes(eventType)) return 'weather-layer';
  return null;
}

export function parseGdacsObservations(xml: string): GdacsObservation[] {
  if (!xml.trim()) throw new Error('Empty GDACS response');
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  const out: GdacsObservation[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const eventType = tag(item, 'gdacs:eventtype').toUpperCase();
    const eventId = tag(item, 'gdacs:eventid');
    if (!eventType || !eventId) continue;
    const episodeId = tag(item, 'gdacs:episodeid') || null;
    const id = `gdacs:${eventType}:${eventId}:${episodeId ?? 'event'}`;
    if (seen.has(id)) continue;
    seen.add(id);
    const levelRaw = tag(item, 'gdacs:alertlevel').toLowerCase();
    const alertLevel = levelRaw === 'green' || levelRaw === 'orange' || levelRaw === 'red' ? levelRaw : 'unknown';
    const lat = finite(tag(item, 'geo:lat'));
    const lng = finite(tag(item, 'geo:long'));
    const link = decode(tag(item, 'link')) || 'https://www.gdacs.org/';
    out.push({
      id,
      externalEventId: eventId,
      episodeId,
      eventType,
      title: decode(tag(item, 'title')) || `${eventType} ${eventId}`,
      alertLevel,
      alertScore: finite(tag(item, 'gdacs:alertscore')),
      severityText: decode(tag(item, 'gdacs:severity')) || null,
      country: decode(tag(item, 'gdacs:country')) || null,
      latitude: lat,
      longitude: lng,
      publishedAt: tag(item, 'pubDate') || null,
      sourceUrl: link,
      source: 'GDACS',
      role: 'supplementary-observation',
      complements: complementFor(eventType),
    });
  }
  return out;
}
