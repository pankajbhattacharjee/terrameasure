/**
 * Generates the bundled sample geospatial fixtures:
 *   public/samples/kenya-survey.kml  — 8 KML features (EPSG:4326)
 *   public/samples/plot-utm33.zip    — Shapefile set in EPSG:32633 (.shp/.shx/.dbf/.prj)
 *
 * Run with: node scripts/make-samples.mjs
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync, strToU8 } from "fflate";

/* Minimal Shapefile writers (Point=1, PolyLine=3, Polygon=5) — enough for
 * our fixtures, avoids depending on writer libraries that aren't published. */
const f64be = (v) => { const b = Buffer.alloc(8); b.writeDoubleLE(v, 0); return b; };
const i32be = (v) => { const b = Buffer.alloc(4); b.writeInt32BE(v, 0); return b; };
const i32le = (v) => { const b = Buffer.alloc(4); b.writeInt32LE(v, 0); return b; };

function shapeHeader(shapeType, bbox, fileLenWords) {
  // ESRI header: 0 file code (BE 9994), 4-23 unused, 24 length (BE, 16-bit
  // words), 28 version (LE), 32 shape type (LE), 36-68 bbox (LE f64).
  const h = Buffer.alloc(100);
  h.writeInt32BE(9994, 0);
  h.writeInt32BE(fileLenWords, 24);
  h.writeInt32LE(1000, 28);
  h.writeInt32LE(shapeType, 32);
  h.writeDoubleLE(bbox[0], 36);
  h.writeDoubleLE(bbox[1], 44);
  h.writeDoubleLE(bbox[2], 52);
  h.writeDoubleLE(bbox[3], 60);
  return h;
}

function bboxOf(coords) {
  const pts = coords.flat(Infinity).filter((v) => typeof v === "number");
  const xs = pts.filter((_, i) => i % 2 === 0);
  const ys = pts.filter((_, i) => i % 2 === 1);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

function ringPoints(ring) {
  return ring.flatMap(([x, y]) => [x, y]);
}

function record(num, content) {
  return Buffer.concat([
    i32be(num),
    i32be(content.length / 2),
    content,
  ]);
}

function writeShpShx(geojson) {
  const typeCode = { Point: 1, LineString: 3, Polygon: 5 }[geojson.features[0].geometry.type];
  const records = [];
  const xOffs = [];
  let fileBytes = 100;
  let offsetWords = 50;
  const allCoords = [];
  for (const f of geojson.features) {
    const g = f.geometry;
    let content;
    if (g.type === "Point") {
      const [x, y] = g.coordinates;
      allCoords.push(x, y);
      content = Buffer.concat([i32le(1), f64be(x), f64be(y)]);
    } else if (g.type === "LineString" || g.type === "Polygon") {
      const typeCode = g.type === "LineString" ? 3 : 5;
      const rings = g.type === "LineString" ? [g.coordinates] : g.coordinates;
      const parts = [];
      let n = 0;
      const flat = [];
      for (const ring of rings) {
        parts.push(n);
        for (const [x, y] of ring) {
          allCoords.push(x, y);
          flat.push(x, y);
          n += 1;
        }
      }
      const bbox = bboxOf(flat);
      const buf = [i32le(typeCode), f64be(bbox[0]), f64be(bbox[1]), f64be(bbox[2]), f64be(bbox[3]), i32le(parts.length), i32le(n)];
      for (const p of parts) buf.push(i32le(p));
      for (let i = 0; i < flat.length; i += 2) buf.push(f64be(flat[i]), f64be(flat[i + 1]));
      content = Buffer.concat(buf);
    } else {
      throw new Error(`Unsupported geometry for fixture: ${g.type}`);
    }
    const rec = record(records.length + 1, content);
    xOffs.push([offsetWords, content.length / 2]);
    records.push(rec);
    fileBytes += rec.length;
    offsetWords += rec.length / 2;
  }
  const fileBbox = bboxOf(allCoords);
  const shp = Buffer.concat([
    shapeHeader(typeCode, fileBbox, fileBytes / 2),
    ...records,
  ]);
  const shx = Buffer.concat([
    shapeHeader(typeCode, fileBbox, (100 + xOffs.length * 8) / 2),
    ...xOffs.map(([off, len]) => Buffer.concat([i32be(off), i32be(len)])),
  ]);
  return { shp, shx };
}

function writeDbf(geojson) {
  const fields = [
    { name: "plot_id", type: "C", length: 12, decimal: 0 },
    { name: "owner", type: "C", length: 20, decimal: 0 },
    { name: "value_m2", type: "N", length: 14, decimal: 0 },
  ];
  const headerSize = 32 + 32 * fields.length + 1;
  const recordSize = 1 + fields.reduce((s, f) => s + f.length, 0);
  const h = Buffer.alloc(32);
  h[0] = 0x03;
  const now = new Date();
  h[1] = (now.getFullYear() - 2000) % 100;
  h[2] = now.getMonth() + 1;
  h[3] = now.getDate();
  h.writeInt32LE(geojson.features.length, 4);
  h.writeInt16LE(headerSize, 8);
  h.writeInt16LE(recordSize, 10);
  const chunks = [h];
  for (const f of fields) {
    const d = Buffer.alloc(32);
    d.write(f.name, 0, "ascii");
    d.write(f.type, 11, "ascii");
    d.writeInt8(f.length, 16);
    d.writeInt8(f.decimal, 17);
    chunks.push(d);
  }
  chunks.push(Buffer.from([0x0d]));
  for (const feat of geojson.features) {
    const rec = [Buffer.from(" ")];
    for (const f of fields) {
      const raw = feat.properties?.[f.name] ?? "";
      const b = Buffer.alloc(f.length);
      if (f.type === "N") {
        const s = String(Math.round(Number(raw) || 0)).padStart(f.length, " ");
        b.write(s, 0, "ascii");
      } else {
        const s = String(raw).slice(0, f.length);
        b.write(s, 0, "ascii");
      }
      rec.push(b);
    }
    chunks.push(Buffer.concat(rec));
  }
  chunks.push(Buffer.from([0x1a]));
  return Buffer.concat(chunks);
}

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "samples");
mkdirSync(outDir, { recursive: true });

/* ---------------------------------------------------------------- KML ---- */

const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.earth.google.com/kml/2.2">
  <Document>
    <name>Kenya Grid Survey 2026</name>
    <description>Substations, transmission lines and reserved buffers near Nairobi (WGS 84).</description>
    <Folder>
      <name>Points</name>
      <Placemark>
        <name>Substation A</name>
        <description>132kV substation compound</description>
        <ExtendedData>
          <Data name="asset_id"><value>SUB-A-0117</value></Data>
          <Data name="category"><value>substation</value></Data>
          <Data name="elevation_m"><value>1520</value></Data>
          <Data name="status"><value>active</value></Data>
        </ExtendedData>
        <Point>
          <coordinates>
                36.81620 -1.28890 1520
              </coordinates>
        </Point>
      </Placemark>
      <Placemark>
        <name>Substation B</name>
        <description>66kV substation compound</description>
        <ExtendedData>
          <Data name="asset_id"><value>SUB-B-0221</value></Data>
          <Data name="category"><value>substation</value></Data>
          <Data name="elevation_m"><value>1498</value></Data>
          <Data name="status"><value>active</value></Data>
        </ExtendedData>
        <Point>
          <coordinates>
                36.82980 -1.28230 1498
              </coordinates>
        </Point>
      </Placemark>
    </Folder>
    <Folder>
      <name>Lines</name>
      <Placemark>
        <name>Transmission line A–B</name>
        <description>132kV double circuit, 4 towers</description>
        <ExtendedData>
          <Data name="asset_id"><value>TL-132-004</value></Data>
          <Data name="voltage_kv"><value>132</value></Data>
        </ExtendedData>
        <LineString>
          <tessellate>1</tessellate>
          <coordinates>
                36.81620 -1.28890 1520,
                36.82190 -1.28670 1505,
                36.82510 -1.28520 1500,
                36.82980 -1.28230 1498
              </coordinates>
        </LineString>
      </Placemark>
      <Placemark>
        <name>Access road</name>
        <description>Gravel access road from national highway</description>
        <ExtendedData>
          <Data name="asset_id"><value>RD-ACC-19</value></Data>
          <Data name="surface"><value>gravel</value></Data>
        </ExtendedData>
        <LineString>
          <coordinates>
                36.81500 -1.28950 1518,
                36.81620 -1.28890 1520,
                36.81750 -1.28780 1516,
                36.81980 -1.28610 1509
              </coordinates>
        </LineString>
      </Placemark>
    </Folder>
    <Folder>
      <name>Polygons</name>
      <Placemark>
        <name>Substation A footprint</name>
        <description>Compound boundary with transformer bay cut out</description>
        <ExtendedData>
          <Data name="asset_id"><value>PLT-A-FP</value></Data>
          <Data name="land_use"><value>utility</value></Data>
        </ExtendedData>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>
                36.81520 -1.28950 1519,
                36.81720 -1.28950 1519,
                36.81720 -1.28830 1520,
                36.81520 -1.28830 1520,
                36.81520 -1.28950 1519
              </coordinates>
            </LinearRing>
          </outerBoundaryIs>
          <innerBoundaryIs>
            <LinearRing>
              <coordinates>
                36.81580 -1.28920 1520,
                36.81580 -1.28860 1520,
                36.81660 -1.28860 1520,
                36.81660 -1.28920 1520,
                36.81580 -1.28920 1520
              </coordinates>
            </LinearRing>
          </innerBoundaryIs>
        </Polygon>
      </Placemark>
      <Placemark>
        <name>Reserved buffer east</name>
        <description>Future substation reservation</description>
        <ExtendedData>
          <Data name="asset_id"><value>RES-E-077</value></Data>
          <Data name="land_use"><value>reserved</value></Data>
        </ExtendedData>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>
                36.83100 -1.28150 1500,
                36.83300 -1.28150 1500,
                36.83300 -1.28030 1499,
                36.83100 -1.28030 1499,
                36.83100 -1.28150 1500
              </coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
      <Placemark>
        <name>Compound parcels 3–4</name>
        <description>Two adjacent compound parcels as a MultiGeometry</description>
        <ExtendedData>
          <Data name="asset_id"><value>PLT-3-4</value></Data>
        </ExtendedData>
        <MultiGeometry>
          <Polygon>
            <outerBoundaryIs>
              <LinearRing>
                <coordinates>
                36.81300 -1.29050 1522,
                36.81420 -1.29050 1522,
                36.81420 -1.28970 1521,
                36.81300 -1.28970 1521,
                36.81300 -1.29050 1522
              </coordinates>
              </LinearRing>
            </outerBoundaryIs>
          </Polygon>
          <Polygon>
            <outerBoundaryIs>
              <LinearRing>
                <coordinates>
                36.81450 -1.29050 1522,
                36.81550 -1.29050 1522,
                36.81550 -1.28970 1521,
                36.81450 -1.28970 1521,
                36.81450 -1.29050 1522
              </coordinates>
              </LinearRing>
            </outerBoundaryIs>
          </Polygon>
        </MultiGeometry>
      </Placemark>
    </Folder>
    <Placemark>
      <name>Boundary marker 42</name>
      <description>Survey marker — geometry pending digitization</description>
      <ExtendedData>
        <Data name="asset_id"><value>BM-042</value></Data>
      </ExtendedData>
    </Placemark>
  </Document>
</kml>`;

writeFileSync(join(outDir, "kenya-survey.kml"), KML);
console.log("wrote public/samples/kenya-survey.kml");

/* ----------------------------------------------------------- Shapefile --- */

const UTM33N_WKT =
  'PROJCS["WGS 84 / UTM zone 33N",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",15],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",0],UNIT["metre",1]]';

const ring = (pts) => [...pts, pts[0]];
const plotGeo = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: { plot_id: "P-1001", owner: "GridCo", value_m2: 500000 },
      // 1000 m x 500 m — planar area must be exactly 500,000 m²
      // (shapefile convention: outer rings clockwise, holes counter-clockwise)
      geometry: { type: "Polygon", coordinates: [ring([[517000, 5820000], [517000, 5820500], [518000, 5820500], [518000, 5820000]])] },
    },
    {
      type: "Feature",
      properties: { plot_id: "P-1002", owner: "MunCo", value_m2: 3750000 },
      // 2000x2000 with a 500x500 hole — 3,750,000 m²
      geometry: {
        type: "Polygon",
        coordinates: [
          ring([[519000, 5821000], [519000, 5823000], [521000, 5823000], [521000, 5821000]]),
          ring([[519750, 5821750], [520250, 5821750], [520250, 5822250], [519750, 5822250]]),
        ],
      },
    },
    {
      type: "Feature",
      properties: { plot_id: "L-2001", owner: "GridCo", value_m2: 0 },
      // sqrt(1000² + 1118.03²) = 1500 m exactly
      geometry: { type: "LineString", coordinates: [[517000, 5820500], [518000, 5821618.034]] },
    },
    {
      type: "Feature",
      properties: { plot_id: "PT-3001", owner: "Survey", value_m2: 0 },
      geometry: { type: "Point", coordinates: [517500, 5820250] },
    },
    {
      type: "Feature",
      properties: { plot_id: "PT-3002", owner: "Survey", value_m2: 0 },
      geometry: { type: "Point", coordinates: [519750, 5821750] },
    },
  ],
};

const byType = { Polygon: [], LineString: [], Point: [] };
for (const f of plotGeo.features) byType[f.geometry.type].push(f);
const layers = [
  { base: "plot_poly", feats: byType.Polygon },
  { base: "plot_line", feats: byType.LineString },
  { base: "plot_point", feats: byType.Point },
];

const zipEntries = {};
for (const layer of layers) {
  const g = { type: "FeatureCollection", features: layer.feats };
  const { shp, shx } = writeShpShx(g);
  zipEntries[`${layer.base}.shp`] = new Uint8Array(shp);
  zipEntries[`${layer.base}.shx`] = new Uint8Array(shx);
  zipEntries[`${layer.base}.dbf`] = new Uint8Array(writeDbf(g));
  zipEntries[`${layer.base}.prj`] = strToU8(UTM33N_WKT);
}
writeFileSync(join(outDir, "plot-utm33.zip"), Buffer.from(zipSync(zipEntries)));
console.log("wrote public/samples/plot-utm33.zip");
