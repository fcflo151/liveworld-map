import { describe, expect, it } from 'vitest';
import { ENTSOE_CORRIDORS, parseFrequency, parseGenerationOutages, parsePhysicalFlow, ENTSOE_AREAS } from './grid-intel';

describe('grid intel parsers', () => {
  it('normalizes the latest legacy Energy-Charts frequency value', () => {
    expect(parseFrequency({ unix_seconds: [1_700_000_000, 1_700_000_001], data: [49.999, 49.87] }))
      .toMatchObject({ hz: 49.87, deviation_mhz: -130, status: 'strained' });
  });

  it('extracts the latest ENTSO-E physical flow point', () => {
    const xml = `<Publication_MarketDocument><TimeSeries><Period><timeInterval><start>2026-09-14T10:00Z</start></timeInterval><resolution>PT60M</resolution><Point><position>1</position><quantity>1200</quantity></Point><Point><position>2</position><quantity>1350</quantity></Point></Period></TimeSeries></Publication_MarketDocument>`;
    expect(parsePhysicalFlow(xml, ENTSOE_CORRIDORS[0])).toMatchObject({ id: 'de-fr', mw: 1350, measured_at: '2026-09-14T11:00:00.000Z' });
  });

  it('calculates unavailable generation capacity', () => {
    const xml = `<Unavailability_MarketDocument><TimeSeries><registeredResource.name>Test Reactor 1</registeredResource.name><production_RegisteredResource.pSRType.psrType>B14</production_RegisteredResource.pSRType.psrType><nominalP>1300</nominalP><Period><timeInterval><start>2026-09-14T00:00Z</start><end>2026-09-15T00:00Z</end></timeInterval><resolution>PT60M</resolution><Point><position>1</position><quantity>400</quantity></Point></Period></TimeSeries></Unavailability_MarketDocument>`;
    expect(parseGenerationOutages(xml, ENTSOE_AREAS.FR)[0]).toMatchObject({ name: 'Test Reactor 1', fuel: 'Nuclear', unavailable_mw: 900, available_mw: 400 });
  });
});
