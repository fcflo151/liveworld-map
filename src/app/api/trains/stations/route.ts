import { NextResponse } from 'next/server';

/**
 * OSIRIS — Rail Intel: Train Stations
 * Curated catalog of major European & DACH railway hubs.
 */

export interface StationData {
  id: string; // EVA / Station ID
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  category: number; // 1 = Megahub, 2 = Major Hub
  tracks: number;
  dailyPassengers?: string;
  operator?: string;
  hasHighSpeed: boolean;
}

export const MAJOR_STATIONS: StationData[] = [
  // ── Germany (Cat 1 Hubs & Strategic Terminals) ──
  { id: '8011160', name: 'Berlin Hauptbahnhof', city: 'Berlin', country: 'Germany', lat: 52.525589, lng: 13.369548, category: 1, tracks: 14, dailyPassengers: '330,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000105', name: 'Frankfurt (Main) Hbf', city: 'Frankfurt', country: 'Germany', lat: 50.107149, lng: 8.663785, category: 1, tracks: 29, dailyPassengers: '500,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000261', name: 'München Hauptbahnhof', city: 'München', country: 'Germany', lat: 48.140228, lng: 11.558338, category: 1, tracks: 32, dailyPassengers: '413,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8002549', name: 'Hamburg Hauptbahnhof', city: 'Hamburg', country: 'Germany', lat: 53.552736, lng: 10.006909, category: 1, tracks: 12, dailyPassengers: '537,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000207', name: 'Köln Hauptbahnhof', city: 'Köln', country: 'Germany', lat: 50.943215, lng: 6.958656, category: 1, tracks: 11, dailyPassengers: '318,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000096', name: 'Stuttgart Hauptbahnhof', city: 'Stuttgart', country: 'Germany', lat: 48.784084, lng: 9.181636, category: 1, tracks: 16, dailyPassengers: '255,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000085', name: 'Düsseldorf Hauptbahnhof', city: 'Düsseldorf', country: 'Germany', lat: 51.219961, lng: 6.794317, category: 1, tracks: 16, dailyPassengers: '250,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000152', name: 'Hannover Hauptbahnhof', city: 'Hannover', country: 'Germany', lat: 52.376766, lng: 9.741017, category: 1, tracks: 14, dailyPassengers: '280,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8010205', name: 'Leipzig Hauptbahnhof', city: 'Leipzig', country: 'Germany', lat: 51.345437, lng: 12.381165, category: 1, tracks: 23, dailyPassengers: '150,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000284', name: 'Nürnberg Hauptbahnhof', city: 'Nürnberg', country: 'Germany', lat: 49.445617, lng: 11.082989, category: 1, tracks: 22, dailyPassengers: '210,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8010085', name: 'Dresden Hauptbahnhof', city: 'Dresden', country: 'Germany', lat: 51.040562, lng: 13.731326, category: 1, tracks: 16, dailyPassengers: '60,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000050', name: 'Bremen Hauptbahnhof', city: 'Bremen', country: 'Germany', lat: 53.083478, lng: 8.813834, category: 1, tracks: 9, dailyPassengers: '120,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000244', name: 'Mannheim Hauptbahnhof', city: 'Mannheim', country: 'Germany', lat: 49.479357, lng: 8.468943, category: 1, tracks: 10, dailyPassengers: '118,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000080', name: 'Dortmund Hauptbahnhof', city: 'Dortmund', country: 'Germany', lat: 51.517899, lng: 7.459294, category: 1, tracks: 16, dailyPassengers: '130,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000098', name: 'Essen Hauptbahnhof', city: 'Essen', country: 'Germany', lat: 51.451375, lng: 7.014793, category: 1, tracks: 13, dailyPassengers: '152,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000191', name: 'Karlsruhe Hauptbahnhof', city: 'Karlsruhe', country: 'Germany', lat: 48.993514, lng: 8.402181, category: 1, tracks: 16, dailyPassengers: '72,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000013', name: 'Augsburg Hauptbahnhof', city: 'Augsburg', country: 'Germany', lat: 48.365442, lng: 10.885571, category: 2, tracks: 9, dailyPassengers: '50,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000107', name: 'Freiburg (Breisgau) Hbf', city: 'Freiburg', country: 'Germany', lat: 47.997705, lng: 7.842014, category: 2, tracks: 8, dailyPassengers: '65,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000086', name: 'Duisburg Hauptbahnhof', city: 'Duisburg', country: 'Germany', lat: 51.429712, lng: 6.775836, category: 1, tracks: 12, dailyPassengers: '130,000', operator: 'DB InfraGO', hasHighSpeed: true },
  { id: '8000001', name: 'Aachen Hauptbahnhof', city: 'Aachen', country: 'Germany', lat: 50.767801, lng: 6.091499, category: 2, tracks: 7, dailyPassengers: '35,000', operator: 'DB InfraGO', hasHighSpeed: true },

  // ── Switzerland & Austria (DACH) ──
  { id: '8503000', name: 'Zürich HB', city: 'Zürich', country: 'Switzerland', lat: 47.378177, lng: 8.540192, category: 1, tracks: 26, dailyPassengers: '470,000', operator: 'SBB CFF FFS', hasHighSpeed: true },
  { id: '8500010', name: 'Basel SBB', city: 'Basel', country: 'Switzerland', lat: 47.547403, lng: 7.589564, category: 1, tracks: 17, dailyPassengers: '135,000', operator: 'SBB CFF FFS', hasHighSpeed: true },
  { id: '8501008', name: 'Genève-Cornavin', city: 'Genf', country: 'Switzerland', lat: 46.210411, lng: 6.142437, category: 1, tracks: 8, dailyPassengers: '73,000', operator: 'SBB CFF FFS', hasHighSpeed: true },
  { id: '8507000', name: 'Bern Hauptbahnhof', city: 'Bern', country: 'Switzerland', lat: 46.948825, lng: 7.439122, category: 1, tracks: 12, dailyPassengers: '260,000', operator: 'SBB CFF FFS', hasHighSpeed: true },
  { id: '8103000', name: 'Wien Hauptbahnhof', city: 'Wien', country: 'Austria', lat: 48.185196, lng: 16.377227, category: 1, tracks: 12, dailyPassengers: '145,000', operator: 'ÖBB', hasHighSpeed: true },
  { id: '8100002', name: 'Salzburg Hauptbahnhof', city: 'Salzburg', country: 'Austria', lat: 47.813083, lng: 13.045805, category: 1, tracks: 9, dailyPassengers: '40,000', operator: 'ÖBB', hasHighSpeed: true },
  { id: '8100108', name: 'Innsbruck Hauptbahnhof', city: 'Innsbruck', country: 'Austria', lat: 47.263592, lng: 11.401146, category: 1, tracks: 8, dailyPassengers: '38,000', operator: 'ÖBB', hasHighSpeed: true },

  // ── France, Benelux, UK & Major European Hubs ──
  { id: '8711300', name: 'Paris Gare du Nord', city: 'Paris', country: 'France', lat: 48.880948, lng: 2.355314, category: 1, tracks: 32, dailyPassengers: '700,000', operator: 'SNCF', hasHighSpeed: true },
  { id: '8727100', name: 'Paris Gare de Lyon', city: 'Paris', country: 'France', lat: 48.844888, lng: 2.373499, category: 1, tracks: 23, dailyPassengers: '300,000', operator: 'SNCF', hasHighSpeed: true },
  { id: '8772202', name: 'Lyon Part-Dieu', city: 'Lyon', country: 'France', lat: 45.760579, lng: 4.859344, category: 1, tracks: 11, dailyPassengers: '140,000', operator: 'SNCF', hasHighSpeed: true },
  { id: '8400058', name: 'Amsterdam Centraal', city: 'Amsterdam', country: 'Netherlands', lat: 52.379189, lng: 4.900278, category: 1, tracks: 15, dailyPassengers: '192,000', operator: 'NS', hasHighSpeed: true },
  { id: '8400530', name: 'Rotterdam Centraal', city: 'Rotterdam', country: 'Netherlands', lat: 51.924959, lng: 4.469145, category: 1, tracks: 13, dailyPassengers: '110,000', operator: 'NS', hasHighSpeed: true },
  { id: '8400621', name: 'Utrecht Centraal', city: 'Utrecht', country: 'Netherlands', lat: 52.088891, lng: 5.110278, category: 1, tracks: 16, dailyPassengers: '207,000', operator: 'NS', hasHighSpeed: true },
  { id: '8814001', name: 'Bruxelles-Midi / Brussel-Zuid', city: 'Brüssel', country: 'Belgium', lat: 50.835701, lng: 4.335967, category: 1, tracks: 22, dailyPassengers: '160,000', operator: 'SNCB/NMBS', hasHighSpeed: true },
  { id: '7015400', name: 'London St Pancras International', city: 'London', country: 'UK', lat: 51.531427, lng: -0.126133, category: 1, tracks: 15, dailyPassengers: '95,000', operator: 'Network Rail / Eurostar', hasHighSpeed: true },
  { id: '8300046', name: 'Milano Centrale', city: 'Mailand', country: 'Italy', lat: 45.486241, lng: 9.204683, category: 1, tracks: 24, dailyPassengers: '320,000', operator: 'RFI / Trenitalia', hasHighSpeed: true },
  { id: '8300084', name: 'Roma Termini', city: 'Rom', country: 'Italy', lat: 41.901375, lng: 12.500889, category: 1, tracks: 32, dailyPassengers: '480,000', operator: 'RFI / Trenitalia', hasHighSpeed: true },
  { id: '7100001', name: 'Madrid Puerta de Atocha', city: 'Madrid', country: 'Spain', lat: 40.406526, lng: -3.689447, category: 1, tracks: 15, dailyPassengers: '270,000', operator: 'Adif / Renfe', hasHighSpeed: true },
  { id: '7100004', name: 'Barcelona Sants', city: 'Barcelona', country: 'Spain', lat: 41.379220, lng: 2.140624, category: 1, tracks: 14, dailyPassengers: '125,000', operator: 'Adif / Renfe', hasHighSpeed: true },
  { id: '5400014', name: 'Praha hlavní nádraží', city: 'Prag', country: 'Czech Republic', lat: 50.083076, lng: 14.435252, category: 1, tracks: 8, dailyPassengers: '75,000', operator: 'Správa železnic', hasHighSpeed: false },
  { id: '5100065', name: 'Warszawa Centralna', city: 'Warschau', country: 'Poland', lat: 52.228892, lng: 21.003056, category: 1, tracks: 8, dailyPassengers: '60,000', operator: 'PKP', hasHighSpeed: false },
  { id: '8600020', name: 'København H', city: 'Kopenhagen', country: 'Denmark', lat: 55.672957, lng: 12.564757, category: 1, tracks: 7, dailyPassengers: '100,000', operator: 'DSB', hasHighSpeed: false },
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const country = searchParams.get('country');
  const query = searchParams.get('q')?.toLowerCase();

  let stations = MAJOR_STATIONS;

  if (country) {
    stations = stations.filter(s => s.country.toLowerCase() === country.toLowerCase());
  }

  if (query) {
    stations = stations.filter(s =>
      s.name.toLowerCase().includes(query) ||
      s.city.toLowerCase().includes(query) ||
      s.id.includes(query)
    );
  }

  return NextResponse.json({
    stations,
    total_stations: stations.length,
    timestamp: new Date().toISOString(),
  }, {
    headers: {
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    }
  });
}
