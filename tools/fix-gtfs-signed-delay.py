from pathlib import Path


def patch(path: str, old: str, new: str, label: str) -> None:
    p = Path(path)
    data = p.read_text(encoding='utf-8')
    if old not in data:
        raise SystemExit(f'missing patch target: {label}')
    p.write_text(data.replace(old, new, 1), encoding='utf-8')


patch(
    'src/lib/sources/gtfs-rt.ts',
    """  varint(): number {
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

  bytes(): Uint8Array {""",
    """  varint(): number {
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

  int32(): number {
    let low = 0;
    for (let index = 0; index < 10 && this.pos < this.data.length; index++) {
      const byte = this.data[this.pos++];
      const shift = index * 7;
      if (shift < 32) low = (low | ((byte & 0x7f) << shift)) >>> 0;
      if ((byte & 0x80) === 0) return low | 0;
    }
    throw new Error('Invalid protobuf int32');
  }

  bytes(): Uint8Array {""",
    'signed int32 reader',
)

patch(
    'src/lib/sources/gtfs-rt.ts',
    "if (field === 1 && wire === 0) out.delay = reader.varint();",
    "if (field === 1 && wire === 0) out.delay = reader.int32();",
    'StopTimeEvent signed delay',
)

patch(
    'src/lib/sources/gtfs-rt.ts',
    "else if (field === 5 && wire === 0) out.delaySeconds = reader.varint();",
    "else if (field === 5 && wire === 0) out.delaySeconds = reader.int32();",
    'TripUpdate signed delay',
)

patch(
    'src/__tests__/keyless-data-sources.test.ts',
    """    const zeroTrip = concat(fieldString(1, 'trip-2'), fieldString(5, 'route-2'));
    const zeroTripEntity = concat(fieldString(1, 'trip-zero'), fieldBytes(3, fieldBytes(1, zeroTrip)));
    const header = concat(fieldString(1, '2.0'), fieldVarint(3, 1_789_000_000));
    const feedBytes = new Uint8Array(concat(fieldBytes(1, header), fieldBytes(2, alertEntity), fieldBytes(2, tripEntity), fieldBytes(2, zeroTripEntity)));

    const selected = selectSituationalGtfs(parseGtfsRealtime(feedBytes));
    expect(selected.timestamp).toBe(1_789_000_000);
    expect(selected.alerts[0]).toMatchObject({ entityId: 'alert-1', header: 'Signal failure', effect: 1 });
    expect(selected.tripUpdates).toHaveLength(1);
    expect(selected.tripUpdates[0]).toMatchObject({ tripId: 'trip-1', routeId: 'route-1', delaySeconds: 420 });""",
    """    const zeroTrip = concat(fieldString(1, 'trip-2'), fieldString(5, 'route-2'));
    const zeroTripEntity = concat(fieldString(1, 'trip-zero'), fieldBytes(3, fieldBytes(1, zeroTrip)));

    // GTFS-Realtime delay is signed int32; early-running services use negative values.
    const earlyTrip = concat(fieldString(1, 'trip-early'), fieldString(5, 'route-early'));
    const negativeSixty = [0xc4, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x01];
    const earlyDelayField = concat(varint(5 << 3), negativeSixty);
    const earlyTripUpdate = concat(fieldBytes(1, earlyTrip), earlyDelayField);
    const earlyTripEntity = concat(fieldString(1, 'trip-early-entity'), fieldBytes(3, earlyTripUpdate));

    const header = concat(fieldString(1, '2.0'), fieldVarint(3, 1_789_000_000));
    const feedBytes = new Uint8Array(concat(fieldBytes(1, header), fieldBytes(2, alertEntity), fieldBytes(2, tripEntity), fieldBytes(2, zeroTripEntity), fieldBytes(2, earlyTripEntity)));

    const selected = selectSituationalGtfs(parseGtfsRealtime(feedBytes));
    expect(selected.timestamp).toBe(1_789_000_000);
    expect(selected.alerts[0]).toMatchObject({ entityId: 'alert-1', header: 'Signal failure', effect: 1 });
    expect(selected.tripUpdates).toHaveLength(2);
    expect(selected.tripUpdates).toEqual(expect.arrayContaining([
      expect.objectContaining({ tripId: 'trip-1', routeId: 'route-1', delaySeconds: 420 }),
      expect.objectContaining({ tripId: 'trip-early', routeId: 'route-early', delaySeconds: -60 }),
    ]));""",
    'negative delay fixture',
)

Path('.github/workflows/fix-gtfs-signed-delay.yml').unlink(missing_ok=True)
Path('tools/fix-gtfs-signed-delay.py').unlink(missing_ok=True)
