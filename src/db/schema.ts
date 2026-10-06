import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const files = pgTable("files", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),
  fileType: text("file_type").notNull(), // SHAPEFILE | KML
  fileSize: integer("file_size").notNull().default(0),
  status: text("status").notNull().default("COMPLETED"), // COMPLETED | FAILED
  crs: text("crs").notNull().default("UNKNOWN"),
  crsEpsg: integer("crs_epsg"),
  crsGeographic: boolean("crs_geographic").notNull().default(true),
  featureCount: integer("feature_count").notNull().default(0),
  measurementStrategy: text("measurement_strategy"),
  error: text("error"),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const features = pgTable(
  "features",
  {
    id: text("id").primaryKey(),
    fileId: text("file_id")
      .notNull()
      .references(() => files.id, { onDelete: "cascade" }),
    fIndex: integer("f_index").notNull(),
    geometryType: text("geometry_type").notNull(),
    properties: jsonb("properties").notNull().default({}),
    geometry: jsonb("geometry"),
    supported: boolean("supported").notNull().default(false),
    areaM2: doublePrecision("area_m2"),
    lengthM: doublePrecision("length_m"),
    areaM2Geodesic: doublePrecision("area_m2_geodesic"),
    lengthMGeodesic: doublePrecision("length_m_geodesic"),
    measurementCrs: text("measurement_crs"),
    note: text("note"),
  },
  (t) => [index("features_file_idx").on(t.fileId, t.fIndex)],
);
