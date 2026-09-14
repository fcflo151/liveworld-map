from pathlib import Path


def patch(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    data = p.read_bytes().decode('utf-8')
    newline = '\r\n' if '\r\n' in data else '\n'
    old_n = old.replace('\n', newline)
    new_n = new.replace('\n', newline)
    if old_n not in data:
        raise SystemExit(f'missing patch target: {label} in {path}')
    p.write_bytes(data.replace(old_n, new_n, 1).encode('utf-8'))


patch('src/app/page.tsx', """    maritime: true,
    maritime_routes: true,
    train_stations: true,
    rail_corridors: true,
    satellites: false,""", """    maritime: true,
    maritime_routes: false,
    train_stations: false,
    rail_corridors: false,
    satellites: false,
    nasa_gibs_true_color: false,
    nasa_gibs_aerosol: false,
    osm_civic: false,""", 'default noisy route layers off')

patch('src/components/LayerPanel.tsx', """    layers: [
      { key: 'maritime', label: 'Maritime / Naval', dataKey: 'maritime_ships,maritime_ports,maritime_chokepoints' },
    ],
  },
  {
    label: 'SPACE',""", """    layers: [
      { key: 'maritime', label: 'Maritime / Naval', dataKey: 'maritime_ships,maritime_ports,maritime_chokepoints' },
      { key: 'maritime_routes', label: 'Cruise / Ferry Corridors', dataKey: 'maritime_routes', description: 'Optional route context · off by default', parent: 'maritime' },
    ],
  },
  {
    label: 'TRANSIT',
    fullLabel: 'RAIL & TRANSIT',
    icon: Network,
    layers: [
      { key: 'train_stations', label: 'Major Rail Stations', dataKey: 'train_stations', description: 'Optional station context · off by default' },
      { key: 'rail_corridors', label: 'Rail Corridors', dataKey: 'rail_corridors', description: 'Optional route context · off by default' },
    ],
  },
  {
    label: 'SPACE',""", 'explicit transit and cruise toggles')

patch('src/components/LayerPanel.tsx', """      { key: 'sat_earth', label: 'Earth Observation', dataKey: 'satellites', catKey: 'earth_obs' },
      { key: 'sat_science', label: 'Stations / Telescopes', dataKey: 'satellites', catKey: 'science' },
    ],""", """      { key: 'sat_earth', label: 'Earth Observation', dataKey: 'satellites', catKey: 'earth_obs' },
      { key: 'sat_science', label: 'Stations / Telescopes', dataKey: 'satellites', catKey: 'science' },
      { key: 'nasa_gibs_true_color', label: 'NASA GIBS True Color', dataKey: '', description: 'Daily MODIS Terra imagery · off by default' },
      { key: 'nasa_gibs_aerosol', label: 'NASA GIBS Aerosol', dataKey: '', description: 'Atmospheric aerosol context · off by default' },
    ],""", 'GIBS layer toggles')

patch('src/components/LayerPanel.tsx', """      { key: 'waterways', label: 'River Gauges (Pegelonline)', dataKey: 'waterway_gauges', description: 'Bundeswasserstraßen Pegel' },
      { key: 'earthquakes', label: 'Earthquakes', dataKey: 'earthquakes' },""", """      { key: 'waterways', label: 'River Gauges (Pegelonline)', dataKey: 'waterway_gauges', description: 'Bundeswasserstraßen Pegel' },
      { key: 'osm_civic', label: 'OSM Civic Infrastructure', dataKey: '', description: 'Hospitals, fire stations & shelters · small-area queries only' },
      { key: 'earthquakes', label: 'Earthquakes', dataKey: 'earthquakes' },""", 'OSM civic toggle')

patch('src/components/LiveWorldMap.tsx', "import { applyMapProjection } from '@/lib/map-projection';", "import { applyMapProjection } from '@/lib/map-projection';\nimport { createGibsRasterSource, getGibsLayer, type GibsLayerId } from '@/lib/nasa-gibs';", 'GIBS import')

patch('src/components/LiveWorldMap.tsx', "'maritime','maritime-choke','maritime-ships','maritime-routes','train-stations','rail-corridors','nina-alerts'", "'maritime','maritime-choke','maritime-ships','maritime-routes','train-stations','rail-corridors','osm-civic','nina-alerts'", 'OSM source registration')

patch('src/components/LiveWorldMap.tsx', """      map.addLayer({ id: 'station-glow', type: 'circle', source: 'train-stations', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 3,6, 7,14, 12,24],
        'circle-color': '#00E5FF', 'circle-opacity': 0.15, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'station-dots', type: 'circle', source: 'train-stations', paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 3,3.5, 7,6, 12,10],
        'circle-color': ['match', ['get', 'category'], 1, '#00E5FF', '#26A69A'],
        'circle-opacity': 0.9,
        'circle-stroke-width': 2, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-opacity': 0.6,
      }});
      map.addLayer({ id: 'station-label', type: 'symbol', source: 'train-stations', minzoom: 5, layout: {""", """      map.addLayer({ id: 'station-glow', type: 'circle', source: 'train-stations', minzoom: 6, paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 6,3, 9,6, 13,10],
        'circle-color': '#00E5FF', 'circle-opacity': 0.10, 'circle-blur': 1,
      }});
      map.addLayer({ id: 'station-dots', type: 'circle', source: 'train-stations', minzoom: 5, paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 5,2.5, 9,4.5, 13,7],
        'circle-color': ['match', ['get', 'category'], 1, '#00E5FF', '#26A69A'],
        'circle-opacity': 0.82,
        'circle-stroke-width': 1, 'circle-stroke-color': '#FFFFFF', 'circle-stroke-opacity': 0.45,
      }});
      map.addLayer({ id: 'station-label', type: 'symbol', source: 'train-stations', minzoom: 7, layout: {""", 'de-emphasize station markers')

patch('src/components/LiveWorldMap.tsx', """      map.addLayer({ id: 'maritime-routes-glow', type: 'line', source: 'maritime-routes', paint: {
        'line-color': ['coalesce', ['get', 'color'], '#00E5FF'],
        'line-width': 4,
        'line-opacity': 0.18,
        'line-blur': 2,
      }});
      map.addLayer({ id: 'maritime-routes-line', type: 'line', source: 'maritime-routes', paint: {
        'line-color': ['coalesce', ['get', 'color'], '#00E5FF'],
        'line-width': 2,
        'line-opacity': 0.85,""", """      map.addLayer({ id: 'maritime-routes-glow', type: 'line', source: 'maritime-routes', minzoom: 5, paint: {
        'line-color': ['coalesce', ['get', 'color'], '#00E5FF'],
        'line-width': 2.5,
        'line-opacity': 0.10,
        'line-blur': 2,
      }});
      map.addLayer({ id: 'maritime-routes-line', type: 'line', source: 'maritime-routes', minzoom: 5, paint: {
        'line-color': ['coalesce', ['get', 'color'], '#00E5FF'],
        'line-width': 1.4,
        'line-opacity': 0.65,""", 'de-emphasize maritime routes')

patch('src/components/LiveWorldMap.tsx', """      map.addLayer({ id: 'rail-corridors-glow', type: 'line', source: 'rail-corridors', paint: {
        'line-color': ['coalesce', ['get', 'color'], '#FFD700'],
        'line-width': 4,
        'line-opacity': 0.18,
        'line-blur': 2,
      }});
      map.addLayer({ id: 'rail-corridors-line', type: 'line', source: 'rail-corridors', paint: {
        'line-color': ['coalesce', ['get', 'color'], '#FFD700'],
        'line-width': 2.2,
        'line-opacity': 0.85,
      }});""", """      map.addLayer({ id: 'rail-corridors-glow', type: 'line', source: 'rail-corridors', minzoom: 5, paint: {
        'line-color': ['coalesce', ['get', 'color'], '#FFD700'],
        'line-width': 2.5,
        'line-opacity': 0.10,
        'line-blur': 2,
      }});
      map.addLayer({ id: 'rail-corridors-line', type: 'line', source: 'rail-corridors', minzoom: 5, paint: {
        'line-color': ['coalesce', ['get', 'color'], '#FFD700'],
        'line-width': 1.4,
        'line-opacity': 0.60,
      }});
      map.addLayer({ id: 'osm-civic-dots', type: 'circle', source: 'osm-civic', minzoom: 8, paint: {
        'circle-radius': ['interpolate',['linear'],['zoom'], 8,3, 12,6, 16,9],
        'circle-color': ['match', ['get','category'], 'hospital','#EF5350', 'fire_station','#FF9800', 'shelter','#66BB6A', '#90A4AE'],
        'circle-opacity': 0.86, 'circle-stroke-width': 1, 'circle-stroke-color': '#101418',
      }});
      map.addLayer({ id: 'osm-civic-label', type: 'symbol', source: 'osm-civic', minzoom: 12, layout: {
        'text-field': ['get','name'], 'text-size': 10, 'text-font': ['Open Sans Regular'], 'text-offset': [0, 1.2], 'text-allow-overlap': false,
      }, paint: { 'text-color': '#CFD8DC', 'text-halo-color': '#000', 'text-halo-width': 1 }});""", 'rail clutter and OSM layers')

patch('src/components/LiveWorldMap.tsx', "    setGeo('maritime-routes', (activeLayers.maritime || activeLayers.maritime_routes) && data.maritime_routes ? data.maritime_routes.map((r: any) => ({", "    setGeo('maritime-routes', activeLayers.maritime_routes === true && data.maritime_routes ? data.maritime_routes.map((r: any) => ({", 'maritime routes explicit toggle only')

patch('src/components/LiveWorldMap.tsx', "    setVis(['maritime-routes-glow','maritime-routes-line'], activeLayers.maritime_routes !== false || activeLayers.maritime !== false);", "    setVis(['maritime-routes-glow','maritime-routes-line'], activeLayers.maritime_routes === true);\n    setVis(['osm-civic-dots','osm-civic-label'], activeLayers.osm_civic === true);", 'visibility explicit toggles')

patch('src/components/LiveWorldMap.tsx', """  const setVis = useCallback((ids: string[], visible: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    ids.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'); });
  }, []);""", """  const setVis = useCallback((ids: string[], visible: boolean) => {
    const map = mapRef.current;
    if (!map) return;
    ids.forEach(id => { if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none'); });
  }, []);

  useEffect(() => {
    if (!mapReady) return;
    const map = mapRef.current;
    if (!map) return;
    const sync = (id: GibsLayerId, enabled: boolean) => {
      const sourceId = `nasa-gibs-${id}`;
      const layerId = `${sourceId}-raster`;
      if (!enabled) {
        if (map.getLayer(layerId)) map.removeLayer(layerId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);
        return;
      }
      if (!map.getSource(sourceId)) map.addSource(sourceId, createGibsRasterSource(id));
      if (!map.getLayer(layerId)) map.addLayer({ id: layerId, type: 'raster', source: sourceId, paint: { 'raster-opacity': getGibsLayer(id).opacity } });
    };
    sync('true-color', activeLayers.nasa_gibs_true_color === true);
    sync('aerosol', activeLayers.nasa_gibs_aerosol === true);
  }, [mapReady, mapStyle, activeLayers.nasa_gibs_true_color, activeLayers.nasa_gibs_aerosol]);

  useEffect(() => {
    if (!mapReady || activeLayers.osm_civic !== true) {
      setGeo('osm-civic', []);
      return;
    }
    const map = mapRef.current;
    if (!map) return;
    let controller: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const refresh = () => {
      if (map.getZoom() < 8) { setGeo('osm-civic', []); return; }
      const bounds = map.getBounds();
      const south = bounds.getSouth(); const west = bounds.getWest();
      const north = bounds.getNorth(); const east = bounds.getEast();
      if (north - south > 1.5 || east - west > 2) { setGeo('osm-civic', []); return; }
      controller?.abort();
      controller = new AbortController();
      const bbox = [south, west, north, east].map(value => value.toFixed(5)).join(',');
      fetch(`/api/osm-infrastructure?bbox=${encodeURIComponent(bbox)}&categories=hospital,fire_station,shelter`, { signal: controller.signal })
        .then(response => response.ok ? response.json() : Promise.reject(new Error(`OSM HTTP ${response.status}`)))
        .then(payload => {
          const features = Array.isArray(payload?.features) ? payload.features : [];
          setGeo('osm-civic', features.map((item: any) => ({
            type: 'Feature', geometry: { type: 'Point', coordinates: [item.lng, item.lat] },
            properties: { id: item.id, name: item.name, category: item.category, sourceUrl: item.sourceUrl },
          })));
        })
        .catch(error => { if (error?.name !== 'AbortError') console.warn('[LiveWorldMap] OSM civic layer:', error); });
    };
    const schedule = () => { if (timer) clearTimeout(timer); timer = setTimeout(refresh, 350); };
    map.on('moveend', schedule);
    refresh();
    return () => { map.off('moveend', schedule); if (timer) clearTimeout(timer); controller?.abort(); };
  }, [mapReady, activeLayers.osm_civic, setGeo]);""", 'GIBS and OSM effects')

Path('.github/workflows/finalize-keyless-ui.yml').unlink(missing_ok=True)
Path('tools/finalize-keyless-ui.py').unlink(missing_ok=True)
