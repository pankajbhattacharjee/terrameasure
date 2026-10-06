declare module "shpjs" {
  function shp(
    input: ArrayBuffer | Uint8Array | string,
    options?: Record<string, unknown>,
  ): Promise<unknown>;
  export default shp;
}
