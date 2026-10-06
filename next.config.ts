import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The API contract uses trailing slashes (POST /api/files/, GET /api/files/{id}/).
  trailingSlash: true,
};

export default nextConfig;
