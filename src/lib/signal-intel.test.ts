import { describe, expect, it } from 'vitest';
import { aggregateGnssIntegrity, normalizeOperationalNotams, parseNotamCoordinate, parseReceiverbookHtml } from './signal-intel';

describe('aggregateGnssIntegrity', () => {
  it('uses all valid samples as the denominator and reports confidence', () => {
    const zones = aggregateGnssIntegrity([
      { lat: 51.1, lng: 13.1, nac_p: 3 },
      { lat: 51.2, lng: 13.2, nac_p: 4 },
      { lat: 51.3, lng: 13.3, nac_p: 8 },
      { lat: 51.4, lng: 13.4, nac_p: 9 },
      { lat: 51.5, lng: 13.5, nac_p: 10 },
      { lat: 51.6, lng: 13.6, nac_p: 9 },
      { lat: 51.7, lng: 13.7, nac_p: 8 },
      { lat: 51.8, lng: 13.8, nac_p: 9 },
    ]);
    expect(zones).toHaveLength(1);
    expect(zones[0]).toMatchObject({ affected: 2, samples: 8, affected_percent: 12.5, confidence: 'medium', level: 'high' });
  });

  it('does not emit a zone from a single low-quality report', () => {
    expect(aggregateGnssIntegrity([
      { lat: 40, lng: 20, nac_p: 1 },
      { lat: 40.1, lng: 20.1, nac_p: 10 },
      { lat: 40.2, lng: 20.2, nac_p: 10 },
    ])).toEqual([]);
  });
});

describe('parseReceiverbookHtml', () => {
  it('flattens receivers and rejects unsafe URLs', () => {
    const html = `<script>var receivers = [{"label":"Berlin","location":{"coordinates":[13.4,52.5]},"receivers":[{"label":"Kiwi One","version":"1.9","url":"http://example.test:8073/","type":"KiwiSDR"},{"label":"bad","url":"javascript:alert(1)","type":"WebSDR"}]}];</script>`;
    expect(parseReceiverbookHtml(html)).toEqual([
      expect.objectContaining({ name: 'Kiwi One', location: 'Berlin', lat: 52.5, lng: 13.4, receiver_type: 'KiwiSDR' }),
    ]);
  });
});

describe('NOTAM normalization', () => {
  it('parses compact ICAO coordinates', () => {
    expect(parseNotamCoordinate('Q) TEST/5129N00028W005')).toEqual({ lat: 51.483333333333334, lng: -0.4666666666666667 });
  });

  it('keeps operational airspace notices and filters routine notices', () => {
    const rows = normalizeOperationalNotams({ data: [
      { id: 'A1', location: 'EDGG', message: 'TEMPORARY RESTRICTED AIRSPACE DUE MILITARY EXERCISE 5000N00830E', startdate: '2026-09-14', enddate: '2026-09-15' },
      { id: 'A2', location: 'EDGG', message: 'TWY LIGHTS UNSERVICEABLE' },
    ] });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ location: 'EDGG', severity: 'high', position_basis: 'notam-coordinate', lat: 50, lng: 8.5 });
  });
});
