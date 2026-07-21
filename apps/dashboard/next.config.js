const path = require("node:path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",
  images: {
    unoptimized: true,
  },
  // Dashboard keeps its own Docker lockfile; pin Turbopack to the monorepo root.
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

module.exports = nextConfig;
