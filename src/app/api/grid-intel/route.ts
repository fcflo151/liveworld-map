import { NextResponse } from 'next/server';
import {
  ENTSOE_AREAS,
  ENTSOE_CORRIDORS,
  parseFrequency,
  parseGenerationOutages,
  parsePhysicalFlow,
} from '@/lib/grid-intel';

export const dynamic = 'force-dynamic';

const ENTSOE_API = 'https://web-api.tp.entsoe.eu/api';
const ENERGY_CHARTS_API = 'https://api.energy-charts.info';

function utcWindow(hoursBack: number, hoursForward = 0) {
  const now = Date.now();
  const format = (value: number) => new Date(value).toISOString().replace(/[-:]/g, '').slice(0, 12);
  return { start: format(now - hoursBack * 3_600_000), end: format(now + hoursForward * 3_600_000) };
}

async function fetchFrequency(signal: AbortSignal) {
  const now = new Date();
  const start = new Date(now.getTime() - 10 * 60_000).toISOString();
  const urls = [
    `${ENERGY_CHARTS_API}/v2/frequency?region=DE-Freiburg&start=${encodeURIComponent(start)}&end=${encodeURIComponent(now.toISOString())}`,
    `${ENERGY_CHARTS_API}/frequency?region=DE-FR&start=${encodeURIComponent(start)}&end=${encodeURIComponent(now.toISOString())}`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, { signal, cache: 'no-store' });
      if (!response.ok) continue;
      const frequency = parseFrequency(await response.json());
      if (frequency) return frequency;
    } catch {
      // Try the legacy Energy-Charts endpoint before reporting unavailable.
    }
  }
  return null;
}

async function entsoeXml(params: Record<string, string>, signal: AbortSignal): Promise<string> {
  const query = new URLSearchParams({ securityToken: process.env.ENTSOE_API_TOKEN || '', ...params });
  const response = await fetch(`${ENTSOE_API}?${query}`, { signal, cache: 'no-store', headers: { Accept: 'application/xml' } });
  if (!response.ok) throw new Error(`ENTSO-E responded ${response.status}`);
  const xml = await response.text();
  if (/Acknowledgement_MarketDocument/i.test(xml)) throw new Error('ENTSO-E rejected the query');
  return xml;
}

async function fetchEntsoe(signal: AbortSignal) {
  const recent = utcWindow(6, 1);
  const outageWindow = utcWindow(24, 7 * 24);
  const flowJobs = ENTSOE_CORRIDORS.map(async corridor => {
    const xml = await entsoeXml({
      documentType: 'A11',
      in_Domain: corridor.to.code,
      out_Domain: corridor.from.code,
      periodStart: recent.start,
      periodEnd: recent.end,
    }, signal);
    return parsePhysicalFlow(xml, corridor);
  });
  const outageAreas = ['DE', 'FR', 'BE', 'NL', 'PL', 'CZ', 'AT'].map(code => ENTSOE_AREAS[code]);
  const outageJobs = outageAreas.map(async area => {
    const xml = await entsoeXml({
      documentType: 'A80',
      processType: 'A26',
      biddingZone_Domain: area.code,
      periodStart: outageWindow.start,
      periodEnd: outageWindow.end,
    }, signal);
    return parseGenerationOutages(xml, area);
  });
  const [flowsSettled, outagesSettled] = await Promise.all([
    Promise.allSettled(flowJobs), Promise.allSettled(outageJobs),
  ]);
  return {
    power_flows: flowsSettled.flatMap(result => result.status === 'fulfilled' && result.value ? [result.value] : []),
    generation_outages: outagesSettled.flatMap(result => result.status === 'fulfilled' ? result.value : []),
    partial: flowsSettled.some(result => result.status === 'rejected') || outagesSettled.some(result => result.status === 'rejected'),
  };
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const entsoeConfigured = Boolean(process.env.ENTSOE_API_TOKEN);
  if (searchParams.get('probe') === '1') {
    return NextResponse.json({ configured: true, frequency: true, entsoe: entsoeConfigured });
  }

  const signal = AbortSignal.timeout(20_000);
  const [frequencyResult, entsoeResult] = await Promise.allSettled([
    fetchFrequency(signal),
    entsoeConfigured ? fetchEntsoe(signal) : Promise.resolve({ power_flows: [], generation_outages: [], partial: false }),
  ]);
  const frequency = frequencyResult.status === 'fulfilled' ? frequencyResult.value : null;
  const entsoe = entsoeResult.status === 'fulfilled'
    ? entsoeResult.value
    : { power_flows: [], generation_outages: [], partial: true };

  return NextResponse.json({
    configured: true,
    entsoe_configured: entsoeConfigured,
    frequency,
    power_flows: entsoe.power_flows,
    generation_outages: entsoe.generation_outages,
    partial: entsoe.partial || frequencyResult.status === 'rejected' || frequency === null,
    sources: {
      frequency: 'Fraunhofer ISE Energy-Charts (CC BY 4.0)',
      grid: 'ENTSO-E Transparency Platform',
    },
    timestamp: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=240' } });
}
