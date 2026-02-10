import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getDatabase } from "@/lib/db/sqlite";

type SessionRow = {
    id: string;
    nickname: string;
    symbol: string;
    practice_start_date: string;
    practice_end_date: string;
    practice_start_index: number;
    period_days: number;
    ma_settings: string | null;
};

type StockPrice = {
    symbol: string;
    date: string;
    close: number;
};

type ClusterSummary = {
    id: string;
    label: string;
    color: string;
    sessionIds: string[];
};

type ClusterMapEntry = {
    clusterId: string;
    label: string;
    color: string;
};

const DEFAULT_MA = [5, 10, 20, 50, 100];
const CLUSTER_COLORS = [
    "#2563EB",
    "#16A34A",
    "#F97316",
    "#9333EA",
    "#DC2626",
    "#0EA5E9",
];

function loadAllPrices(): StockPrice[] {
    const dataDir = path.join(process.cwd(), "lib", "data", "cache");
    const pricesPath = path.join(dataDir, "prices.json");

    if (!fs.existsSync(pricesPath)) {
        return [];
    }

    return JSON.parse(fs.readFileSync(pricesPath, "utf-8"));
}

function buildPriceMap(allPrices: StockPrice[]): Map<string, StockPrice[]> {
    const map = new Map<string, StockPrice[]>();

    for (const price of allPrices) {
        if (!map.has(price.symbol)) {
            map.set(price.symbol, []);
        }
        map.get(price.symbol)!.push(price);
    }

    for (const [symbol, list] of map.entries()) {
        list.sort((a, b) => a.date.localeCompare(b.date));
        map.set(symbol, list);
    }

    return map;
}

function computeMovingAverage(values: number[], period: number): number[] {
    const result = new Array(values.length).fill(Number.NaN);
    let sum = 0;

    for (let i = 0; i < values.length; i++) {
        sum += values[i];
        if (i >= period) {
            sum -= values[i - period];
        }
        if (i >= period - 1) {
            result[i] = sum / period;
        }
    }

    return result;
}

function computeStdDev(values: number[]): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance =
        values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
    return Math.sqrt(variance);
}

function parseMaSettings(raw: string | null): number[] {
    if (!raw) return DEFAULT_MA;
    try {
        const parsed = JSON.parse(raw) as number[];
        if (Array.isArray(parsed) && parsed.length > 0) {
            return parsed;
        }
    } catch {
        return DEFAULT_MA;
    }
    return DEFAULT_MA;
}

function computeFeatures(
    session: SessionRow,
    prices: StockPrice[],
): number[] | null {
    const maPeriods = parseMaSettings(session.ma_settings);
    const maxPeriod = Math.max(...maPeriods);

    const series = prices.filter(
        (p) =>
            p.date >= session.practice_start_date &&
            p.date <= session.practice_end_date,
    );

    if (series.length === 0) {
        return null;
    }

    const closes = series.map((p) => p.close);
    const maArrays = maPeriods.map((period) =>
        computeMovingAverage(closes, period),
    );

    const rawStartIndex = session.practice_start_index || 0;
    const startIndex = Math.max(rawStartIndex, maxPeriod - 1);
    const endIndex = Math.min(
        startIndex + Math.max(0, session.period_days - 1),
        closes.length - 1,
    );

    if (endIndex <= startIndex) {
        return null;
    }

    const firstValidIndex = startIndex;
    const lastValidIndex = endIndex;

    const slopes: number[] = [];
    for (const ma of maArrays) {
        const startValue = ma[firstValidIndex];
        const endValue = ma[lastValidIndex];
        if (!Number.isFinite(startValue) || !Number.isFinite(endValue)) {
            return null;
        }
        slopes.push((endValue - startValue) / startValue);
    }

    let bandWidthSum = 0;
    let bandWidthSqSum = 0;
    let bandWidthCount = 0;
    let crossCount = 0;
    let trendUpCount = 0;
    let trendDownCount = 0;
    let prevDiff: number | null = null;
    const fastMa = maArrays[0];
    const slowMa = maArrays[maArrays.length - 1];
    const fastReturns: number[] = [];
    const priceReturns: number[] = [];

    for (let i = startIndex; i <= endIndex; i++) {
        const maValues = maArrays.map((ma) => ma[i]);
        if (maValues.some((v) => !Number.isFinite(v))) {
            continue;
        }

        const maxMa = Math.max(...maValues);
        const minMa = Math.min(...maValues);
        const bandWidth = (maxMa - minMa) / closes[i];
        bandWidthSum += bandWidth;
        bandWidthSqSum += bandWidth * bandWidth;
        bandWidthCount += 1;

        const diff = fastMa[i] - slowMa[i];
        if (prevDiff !== null && diff * prevDiff < 0) {
            crossCount += 1;
        }
        prevDiff = diff;

        if (i > startIndex && Number.isFinite(fastMa[i - 1])) {
            fastReturns.push((fastMa[i] - fastMa[i - 1]) / fastMa[i - 1]);
        }

        if (i > startIndex) {
            priceReturns.push((closes[i] - closes[i - 1]) / closes[i - 1]);
        }

        const isUpAligned = maValues.every(
            (value, idx, arr) => idx === 0 || arr[idx - 1] > value,
        );
        const isDownAligned = maValues.every(
            (value, idx, arr) => idx === 0 || arr[idx - 1] < value,
        );
        if (isUpAligned) trendUpCount += 1;
        if (isDownAligned) trendDownCount += 1;
    }

    if (bandWidthCount === 0) {
        return null;
    }

    const avgBandWidth = bandWidthSum / bandWidthCount;
    const bandWidthStd = Math.sqrt(
        Math.max(0, bandWidthSqSum / bandWidthCount - avgBandWidth ** 2),
    );
    const crossRate = crossCount / Math.max(1, bandWidthCount - 1);
    const trendUpRatio = trendUpCount / bandWidthCount;
    const trendDownRatio = trendDownCount / bandWidthCount;
    const priceReturn =
        (closes[endIndex] - closes[startIndex]) / closes[startIndex];
    const priceVolatility = computeStdDev(priceReturns);
    const fastVolatility = computeStdDev(fastReturns);

    return [
        ...slopes,
        avgBandWidth,
        bandWidthStd,
        crossRate,
        trendUpRatio,
        trendDownRatio,
        priceReturn,
        priceVolatility,
        fastVolatility,
    ];
}

function standardize(vectors: number[][]): number[][] {
    if (vectors.length === 0) return [];
    const dims = vectors[0].length;
    const means = new Array(dims).fill(0);
    const stds = new Array(dims).fill(0);

    for (const vec of vectors) {
        for (let i = 0; i < dims; i++) {
            means[i] += vec[i];
        }
    }

    for (let i = 0; i < dims; i++) {
        means[i] /= vectors.length;
    }

    for (const vec of vectors) {
        for (let i = 0; i < dims; i++) {
            stds[i] += (vec[i] - means[i]) ** 2;
        }
    }

    for (let i = 0; i < dims; i++) {
        stds[i] = Math.sqrt(stds[i] / vectors.length) || 1;
    }

    return vectors.map((vec) =>
        vec.map((value, i) => (value - means[i]) / stds[i]),
    );
}

function initializeCentroids(vectors: number[][], k: number): number[][] {
    const centroids: number[][] = [];
    const count = Math.min(k, vectors.length);
    const firstIndex = Math.floor(Math.random() * vectors.length);
    centroids.push(vectors[firstIndex].slice());

    while (centroids.length < count) {
        const distances = vectors.map((vec) => {
            let bestDistance = Infinity;
            for (const centroid of centroids) {
                let distance = 0;
                for (let d = 0; d < vec.length; d++) {
                    const diff = vec[d] - centroid[d];
                    distance += diff * diff;
                }
                bestDistance = Math.min(bestDistance, distance);
            }
            return bestDistance;
        });

        const totalDistance = distances.reduce((sum, v) => sum + v, 0);
        if (totalDistance === 0) {
            break;
        }

        let threshold = Math.random() * totalDistance;
        let selectedIndex = 0;
        for (let i = 0; i < distances.length; i++) {
            threshold -= distances[i];
            if (threshold <= 0) {
                selectedIndex = i;
                break;
            }
        }

        centroids.push(vectors[selectedIndex].slice());
    }

    return centroids;
}

function kmeans(vectors: number[][], k: number, maxIter = 20) {
    const dims = vectors[0].length;
    const centroids = initializeCentroids(vectors, k);
    const assignments = new Array(vectors.length).fill(0);

    for (let iter = 0; iter < maxIter; iter++) {
        let changed = false;

        for (let i = 0; i < vectors.length; i++) {
            let bestIndex = 0;
            let bestDistance = Infinity;

            for (let c = 0; c < k; c++) {
                let distance = 0;
                for (let d = 0; d < dims; d++) {
                    const diff = vectors[i][d] - centroids[c][d];
                    distance += diff * diff;
                }
                if (distance < bestDistance) {
                    bestDistance = distance;
                    bestIndex = c;
                }
            }

            if (assignments[i] !== bestIndex) {
                assignments[i] = bestIndex;
                changed = true;
            }
        }

        if (!changed) break;

        const sums = Array.from({ length: k }, () => new Array(dims).fill(0));
        const counts = new Array(k).fill(0);

        for (let i = 0; i < vectors.length; i++) {
            const cluster = assignments[i];
            counts[cluster] += 1;
            for (let d = 0; d < dims; d++) {
                sums[cluster][d] += vectors[i][d];
            }
        }

        for (let c = 0; c < k; c++) {
            if (counts[c] === 0) {
                let farthestIndex = 0;
                let farthestDistance = -Infinity;
                for (let i = 0; i < vectors.length; i++) {
                    let minDistance = Infinity;
                    for (let c2 = 0; c2 < k; c2++) {
                        if (counts[c2] === 0) continue;
                        let distance = 0;
                        for (let d = 0; d < dims; d++) {
                            const diff = vectors[i][d] - centroids[c2][d];
                            distance += diff * diff;
                        }
                        minDistance = Math.min(minDistance, distance);
                    }
                    if (minDistance > farthestDistance) {
                        farthestDistance = minDistance;
                        farthestIndex = i;
                    }
                }
                centroids[c] = vectors[farthestIndex].slice();
                continue;
            }
            for (let d = 0; d < dims; d++) {
                centroids[c][d] = sums[c][d] / counts[c];
            }
        }
    }

    return { assignments, centroids };
}

function computeTrendScore(vector: number[], maCount: number): number {
    const slopeFast = vector[0] || 0;
    const trendUpRatio = vector[maCount + 3] || 0;
    const trendDownRatio = vector[maCount + 4] || 0;
    const priceReturn = vector[maCount + 5] || 0;
    return slopeFast + priceReturn + trendUpRatio - trendDownRatio;
}

function describeCluster(
    centroid: number[],
    maCount: number,
    rank: number,
    total: number,
): string {
    const bandWidth = centroid[maCount] || 0;
    let baseLabel = "レンジ";

    if (total === 2) {
        baseLabel = rank === 0 ? "下降寄り" : "上昇寄り";
    } else if (total === 3) {
        baseLabel =
            rank === 0
                ? "下降トレンド"
                : rank === 1
                  ? "レンジ"
                  : "上昇トレンド";
    } else if (total >= 4) {
        baseLabel =
            rank === 0
                ? "下降トレンド"
                : rank === total - 1
                  ? "上昇トレンド"
                  : rank < total / 2
                    ? "下向きレンジ"
                    : "上向きレンジ";
    }

    let suffix = "";
    if (bandWidth > 0.04) {
        suffix = "・拡散";
    } else if (bandWidth < 0.02) {
        suffix = "・収束";
    }

    return `${baseLabel}${suffix}`;
}

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const nickname = searchParams.get("nickname");
        const kParam = searchParams.get("k");

        if (!nickname) {
            return NextResponse.json(
                { success: false, error: "ユーザー情報がありません" },
                { status: 400 },
            );
        }

        const k = Math.max(2, Math.min(6, Number(kParam) || 4));
        const db = getDatabase();

        const sessionRows = db
            .prepare(
                `
        SELECT id, nickname, symbol, practice_start_date, practice_end_date,
               practice_start_index, period_days, ma_settings
        FROM sessions
        WHERE nickname = ? AND status = ?
        ORDER BY created_at DESC
      `,
            )
            .all(nickname, "completed") as SessionRow[];

        if (sessionRows.length === 0) {
            return NextResponse.json({
                success: true,
                clusters: [],
                clusterMap: {},
            });
        }

        const allPrices = loadAllPrices();
        const priceMap = buildPriceMap(allPrices);

        const sessionIds: string[] = [];
        const vectors: number[][] = [];

        for (const session of sessionRows) {
            const symbolPrices = priceMap.get(session.symbol) || [];
            const vector = computeFeatures(session, symbolPrices);
            if (!vector) continue;
            sessionIds.push(session.id);
            vectors.push(vector);
        }

        if (vectors.length === 0) {
            return NextResponse.json({
                success: true,
                clusters: [],
                clusterMap: {},
            });
        }

        const actualK = Math.min(k, vectors.length);
        const standardized = standardize(vectors);
        const { assignments } = kmeans(standardized, actualK);

        let finalAssignments = assignments.slice();
        const counts = new Array(actualK).fill(0);
        for (const clusterIndex of finalAssignments) {
            counts[clusterIndex] += 1;
        }

        const maxCount = Math.max(...counts);
        const imbalanceRatio = maxCount / vectors.length;

        if (actualK > 1 && imbalanceRatio >= 0.8 && vectors.length >= actualK) {
            const maCount = Math.max(1, vectors[0].length - 8);
            const scored = vectors
                .map((vector, index) => ({
                    index,
                    score: computeTrendScore(vector, maCount),
                }))
                .sort((a, b) => a.score - b.score);

            finalAssignments = new Array(vectors.length).fill(0);
            for (let i = 0; i < scored.length; i++) {
                const bucket = Math.min(
                    actualK - 1,
                    Math.floor((i / scored.length) * actualK),
                );
                finalAssignments[scored[i].index] = bucket;
            }
        }

        const dims = vectors[0].length;
        const rawCentroids = Array.from({ length: actualK }, () =>
            new Array(dims).fill(0),
        );
        const rawCounts = new Array(actualK).fill(0);

        for (let i = 0; i < finalAssignments.length; i++) {
            const clusterIndex = finalAssignments[i];
            rawCounts[clusterIndex] += 1;
            for (let d = 0; d < dims; d++) {
                rawCentroids[clusterIndex][d] += vectors[i][d];
            }
        }

        for (let c = 0; c < actualK; c++) {
            if (rawCounts[c] === 0) continue;
            for (let d = 0; d < dims; d++) {
                rawCentroids[c][d] /= rawCounts[c];
            }
        }

        const clusters: ClusterSummary[] = Array.from(
            { length: actualK },
            (_, i) => ({
                id: `cluster-${i + 1}`,
                label: "",
                color: CLUSTER_COLORS[i % CLUSTER_COLORS.length],
                sessionIds: [],
            }),
        );

        for (let i = 0; i < finalAssignments.length; i++) {
            const clusterIndex = finalAssignments[i];
            clusters[clusterIndex].sessionIds.push(sessionIds[i]);
        }

        const clusterMap: Record<string, ClusterMapEntry> = {};
        const maCount = Math.max(1, dims - 8);
        const clusterScores = clusters.map((cluster, index) => ({
            index,
            score: computeTrendScore(rawCentroids[index], maCount),
        }));
        clusterScores.sort((a, b) => a.score - b.score);

        for (let rank = 0; rank < clusterScores.length; rank++) {
            const clusterIndex = clusterScores[rank].index;
            const label = describeCluster(
                rawCentroids[clusterIndex],
                maCount,
                rank,
                clusterScores.length,
            );
            clusters[clusterIndex].label = label;
        }

        for (let i = 0; i < clusters.length; i++) {
            for (const sessionId of clusters[i].sessionIds) {
                clusterMap[sessionId] = {
                    clusterId: clusters[i].id,
                    label: clusters[i].label,
                    color: clusters[i].color,
                };
            }
        }

        return NextResponse.json({
            success: true,
            clusters,
            clusterMap,
        });
    } catch (error) {
        console.error("クラスタ生成エラー:", error);
        return NextResponse.json(
            { success: false, error: "クラスタ生成に失敗しました" },
            { status: 500 },
        );
    }
}
