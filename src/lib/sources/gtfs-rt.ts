export interface GtfsServiceAlert {
  kind: 'service-alert';
  entityId: string;
  header: string;
  description?: string;
  url?: string;
  cause?: number;
  effect?: number;
  severity?: number;
  activeFrom?: number;
  activeUntil?: number;
  agencyIds: string[];
  routeIds: string[];
  stopIds: string[];
  tripIds: string[];
}

export interface GtfsTripUpdate {
  kind: 'trip-update';
  entityId: string;
  tripId?: string;
  routeId?: string;
  startDate?: string;
  startTime?: string;
  timestamp?: number;
  delaySeconds?: number;
  stopUpdates: Array<{ stopId?: string; stopSequence?: number; arrivalDelaySeconds?: number; departureDelaySeconds?: number }>;
}

export interface GtfsRealtimeFeed {
  timestamp?: number;
  alerts: GtfsServiceAlert[];
  tripUpdates: GtfsTripUpdate[];
}

class Reader {
  private pos = 0;
  constructor(private readonly data: Uint8Array) {}

  get done() { return this.pos >= this.data.length; }

  varint(): number {
    let value = 0;
    let shift = 0;
    while (this.pos < this.data.length && shift < 56) {
      const byte = this.data[this.pos++];
      value += (byte & 0x7f) * 2 ** shift;
      if ((byte & 0x80) === 0) return value;
      shift += 7;
    }
    throw new Error('Invalid protobuf varint');
  }

  bytes(): Uint8Array {
    const length = this.varint();
    const end = this.pos + length;
    if (length < 0 || end > this.data.length) throw new Error('Invalid protobuf length');
    const value = this.data.subarray(this.pos, end);
    this.pos = end;
    return value;
  }

  string(): string {
    return new TextDecoder().decode(this.bytes());
  }

  skip(wire: number) {
    if (wire === 0) { this.varint(); return; }
    if (wire === 1) { this.pos += 8; return; }
    if (wire === 2) { this.bytes(); return; }
    if (wire === 5) { this.pos += 4; return; }
    throw new Error(`Unsupported protobuf wire type ${wire}`);
  }
}

function fields(data: Uint8Array, visit: (field: number, wire: number, reader: Reader) => void) {
  const reader = new Reader(data);
  while (!reader.done) {
    const tag = reader.varint();
    const field = Math.floor(tag / 8);
    const wire = tag & 7;
    visit(field, wire, reader);
  }
}

function translatedString(data: Uint8Array): string | undefined {
  let fallback: string | undefined;
  let english: string | undefined;
  fields(data, (field, wire, reader) => {
    if (field !== 1 || wire !== 2) { reader.skip(wire); return; }
    let text: string | undefined;
    let language: string | undefined;
    fields(reader.bytes(), (f, w, r) => {
      if (f === 1 && w === 2) text = r.string();
      else if (f === 2 && w === 2) language = r.string();
      else r.skip(w);
    });
    if (text && !fallback) fallback = text;
    if (text && language?.toLowerCase().startsWith('en')) english = text;
  });
  return english ?? fallback;
}

function timeRange(data: Uint8Array): { start?: number; end?: number } {
  const out: { start?: number; end?: number } = {};
  fields(data, (field, wire, reader) => {
    if (wire !== 0) { reader.skip(wire); return; }
    if (field === 1) out.start = reader.varint();
    else if (field === 2) out.end = reader.varint();
    else reader.skip(wire);
  });
  return out;
}

function tripDescriptor(data: Uint8Array) {
  const out: { tripId?: string; routeId?: string; startDate?: string; startTime?: string } = {};
  fields(data, (field, wire, reader) => {
    if (wire !== 2) { reader.skip(wire); return; }
    if (field === 1) out.tripId = reader.string();
    else if (field === 2) out.startTime = reader.string();
    else if (field === 3) out.startDate = reader.string();
    else if (field === 5) out.routeId = reader.string();
    else reader.skip(wire);
  });
  return out;
}

function selector(data: Uint8Array) {
  const out: { agencyId?: string; routeId?: string; stopId?: string; tripId?: string } = {};
  fields(data, (field, wire, reader) => {
    if (field === 4 && wire === 2) {
      out.tripId = tripDescriptor(reader.bytes()).tripId;
      return;
    }
    if (wire !== 2) { reader.skip(wire); return; }
    if (field === 1) out.agencyId = reader.string();
    else if (field === 2) out.routeId = reader.string();
    else if (field === 5) out.stopId = reader.string();
    else reader.skip(wire);
  });
  return out;
}

function stopTimeEvent(data: Uint8Array): { delay?: number } {
  const out: { delay?: number } = {};
  fields(data, (field, wire, reader) => {
    if (field === 1 && wire === 0) out.delay = reader.varint();
    else reader.skip(wire);
  });
  return out;
}

function stopTimeUpdate(data: Uint8Array) {
  const out: { stopId?: string; stopSequence?: number; arrivalDelaySeconds?: number; departureDelaySeconds?: number } = {};
  fields(data, (field, wire, reader) => {
    if (field === 1 && wire === 0) out.stopSequence = reader.varint();
    else if (field === 2 && wire === 2) out.arrivalDelaySeconds = stopTimeEvent(reader.bytes()).delay;
    else if (field === 3 && wire === 2) out.departureDelaySeconds = stopTimeEvent(reader.bytes()).delay;
    else if (field === 4 && wire === 2) out.stopId = reader.string();
    else reader.skip(wire);
  });
  return out;
}

function tripUpdate(entityId: string, data: Uint8Array): GtfsTripUpdate {
  const out: GtfsTripUpdate = { kind: 'trip-update', entityId, stopUpdates: [] };
  fields(data, (field, wire, reader) => {
    if (field === 1 && wire === 2) Object.assign(out, tripDescriptor(reader.bytes()));
    else if (field === 2 && wire === 2) out.stopUpdates.push(stopTimeUpdate(reader.bytes()));
    else if (field === 4 && wire === 0) out.timestamp = reader.varint();
    else if (field === 5 && wire === 0) out.delaySeconds = reader.varint();
    else reader.skip(wire);
  });
  return out;
}

function alert(entityId: string, data: Uint8Array): GtfsServiceAlert {
  const out: GtfsServiceAlert = { kind: 'service-alert', entityId, header: 'Transit service alert', agencyIds: [], routeIds: [], stopIds: [], tripIds: [] };
  fields(data, (field, wire, reader) => {
    if (field === 1 && wire === 2) {
      const range = timeRange(reader.bytes());
      out.activeFrom ??= range.start;
      out.activeUntil = range.end ?? out.activeUntil;
    } else if (field === 5 && wire === 2) {
      const target = selector(reader.bytes());
      if (target.agencyId) out.agencyIds.push(target.agencyId);
      if (target.routeId) out.routeIds.push(target.routeId);
      if (target.stopId) out.stopIds.push(target.stopId);
      if (target.tripId) out.tripIds.push(target.tripId);
    } else if (field === 6 && wire === 0) out.cause = reader.varint();
    else if (field === 7 && wire === 0) out.effect = reader.varint();
    else if (field === 8 && wire === 2) out.url = translatedString(reader.bytes());
    else if (field === 10 && wire === 2) out.header = translatedString(reader.bytes()) ?? out.header;
    else if (field === 11 && wire === 2) out.description = translatedString(reader.bytes());
    else if (field === 14 && wire === 0) out.severity = reader.varint();
    else reader.skip(wire);
  });
  out.agencyIds = [...new Set(out.agencyIds)];
  out.routeIds = [...new Set(out.routeIds)];
  out.stopIds = [...new Set(out.stopIds)];
  out.tripIds = [...new Set(out.tripIds)];
  return out;
}

function entity(data: Uint8Array): { alert?: GtfsServiceAlert; trip?: GtfsTripUpdate } {
  let id = '';
  let deleted = false;
  let tripBytes: Uint8Array | undefined;
  let alertBytes: Uint8Array | undefined;
  fields(data, (field, wire, reader) => {
    if (field === 1 && wire === 2) id = reader.string();
    else if (field === 2 && wire === 0) deleted = reader.varint() !== 0;
    else if (field === 3 && wire === 2) tripBytes = reader.bytes();
    else if (field === 5 && wire === 2) alertBytes = reader.bytes();
    else reader.skip(wire);
  });
  if (deleted) return {};
  return {
    trip: tripBytes ? tripUpdate(id, tripBytes) : undefined,
    alert: alertBytes ? alert(id, alertBytes) : undefined,
  };
}

export function parseGtfsRealtime(input: ArrayBuffer | Uint8Array): GtfsRealtimeFeed {
  const data = input instanceof Uint8Array ? input : new Uint8Array(input);
  const result: GtfsRealtimeFeed = { alerts: [], tripUpdates: [] };
  fields(data, (field, wire, reader) => {
    if (field === 1 && wire === 2) {
      fields(reader.bytes(), (f, w, r) => {
        if (f === 3 && w === 0) result.timestamp = r.varint();
        else r.skip(w);
      });
    } else if (field === 2 && wire === 2) {
      const parsed = entity(reader.bytes());
      if (parsed.alert) result.alerts.push(parsed.alert);
      if (parsed.trip) result.tripUpdates.push(parsed.trip);
    } else reader.skip(wire);
  });
  return result;
}

export function selectSituationalGtfs(feed: GtfsRealtimeFeed, maxAlerts = 300, maxTrips = 1000): GtfsRealtimeFeed {
  return {
    timestamp: feed.timestamp,
    alerts: feed.alerts.slice(0, maxAlerts),
    tripUpdates: feed.tripUpdates
      .filter(update => (update.delaySeconds ?? 0) !== 0 || update.stopUpdates.some(stop => (stop.arrivalDelaySeconds ?? 0) !== 0 || (stop.departureDelaySeconds ?? 0) !== 0))
      .slice(0, maxTrips),
  };
}
