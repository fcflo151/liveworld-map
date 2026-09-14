import { describe, expect, it } from 'vitest';
import { normalizeLng, normalizePipeline } from './route';

describe('energy infrastructure normalization', () => {
  it('maps the GEM pipeline handoff schema', () => {
    expect(normalizePipeline({
      type: 'Feature', geometry: { type: 'LineString', coordinates: [[1, 2], [3, 4]] },
      properties: { ProjectID: 'P1', PipelineName: 'Baltic Pipe', Status: 'Operating', CountriesOrAreas: 'Denmark; Poland', Wiki: 'https://example.test/p1' },
    })).toMatchObject({ properties: { id: 'P1', name: 'Baltic Pipe', status: 'operating', source: 'Global Energy Monitor · GGIT' } });
  });

  it('maps LNG point features and rejects non-points', () => {
    expect(normalizeLng({ type: 'Feature', geometry: { type: 'Point', coordinates: [8.1, 53.5] }, properties: { TerminalName: 'Test LNG', Status: 'Operating' } }))
      .toMatchObject({ properties: { name: 'Test LNG', status: 'operating' } });
    expect(normalizeLng({ type: 'Feature', geometry: { type: 'LineString', coordinates: [] }, properties: { TerminalName: 'No' } })).toBeNull();
  });
});
