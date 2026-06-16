import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/download-lol-china",
        destination: "/how-to-play",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
