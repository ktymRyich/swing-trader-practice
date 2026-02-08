/** @type {import('next').NextConfig} */
const isTauriBuild = process.env.TAURI_BUILD === "true";
const nextConfig = {
    reactStrictMode: true,
    output: isTauriBuild ? "export" : undefined,
    trailingSlash: isTauriBuild,
    images: {
        unoptimized: isTauriBuild,
    },
    webpack: (config, { isServer }) => {
        // クライアントサイドでのみ実行されるモジュールの設定
        if (!isServer) {
            config.resolve.fallback = {
                ...config.resolve.fallback,
                fs: false,
                net: false,
                tls: false,
            };
        }
        return config;
    },
    // PWA設定
    async headers() {
        return [
            {
                source: "/manifest.json",
                headers: [
                    {
                        key: "Content-Type",
                        value: "application/manifest+json",
                    },
                ],
            },
        ];
    },
};

module.exports = nextConfig;
