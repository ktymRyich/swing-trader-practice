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

const DEFAULT_MA = [5, 10, 20, 50, 100];
const ORANGE_MA = 100;

function loadAllPrices(): StockPrice[] {
    const dataDir = path.join(process.cwd(), "lib", "data", "cache");
    const pricesPath = path.join(dataDir, "prices.json");

    if (!fs.existsSync(pricesPath)) {
        return [];
    }

    return JSON.parse(fs.readFileSync(pricesPath, "utf-8"));
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

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function toScore(value: number): number {
    return Math.round(clamp(value, 0, 1) * 100);
}

function computeRegimeScores(session: SessionRow, prices: StockPrice[]) {
    const maSettings = parseMaSettings(session.ma_settings);
    const maPeriods = Array.from(new Set([...maSettings, ORANGE_MA])).sort(
        (a, b) => a - b,
    );
    const maxPeriod = Math.max(...maPeriods);

    const series = prices
        .filter(
            (p) =>
                p.symbol === session.symbol &&
                p.date >= session.practice_start_date &&
                p.date <= session.practice_end_date,
        )
        .sort((a, b) => a.date.localeCompare(b.date));

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

    const ma100Index = maPeriods.indexOf(ORANGE_MA);
    const fastIndex = 0;
    const slowIndex = maPeriods.length - 1;
    const midIndex = Math.floor(maPeriods.length / 2);

    let orangeSum = 0;
    let orangeCount = 0;
    let upAlignCount = 0;
    let downAlignCount = 0;
    let crossCount = 0;
    let prevDiff: number | null = null;

    let maxClose = -Infinity;
    let minClose = Infinity;

    for (let i = startIndex; i <= endIndex; i++) {
        const maValues = maArrays.map((ma) => ma[i]);
        if (maValues.some((v) => !Number.isFinite(v))) {
            continue;
        }

        const fast = maValues[fastIndex];
        const slow = maValues[slowIndex];

        const diff = fast - slow;
        if (prevDiff !== null && diff * prevDiff < 0) {
            crossCount += 1;
        }
        prevDiff = diff;

        const isUpAligned = maValues.every(
            (value, idx, arr) => idx === 0 || arr[idx - 1] > value,
        );
        const isDownAligned = maValues.every(
            (value, idx, arr) => idx === 0 || arr[idx - 1] < value,
        );
        if (isUpAligned) upAlignCount += 1;
        if (isDownAligned) downAlignCount += 1;

        maxClose = Math.max(maxClose, closes[i]);
        minClose = Math.min(minClose, closes[i]);

        if (ma100Index >= 0) {
            const ma100 = maValues[ma100Index];
            const distance = Math.abs(closes[i] - ma100) / ma100;
            const closenessScore = 1 - clamp(distance / 0.03, 0, 1);

            let slopeScore = 1;
            if (i - 5 >= 0 && Number.isFinite(maArrays[ma100Index][i - 5])) {
                const slope =
                    (maArrays[ma100Index][i] - maArrays[ma100Index][i - 5]) /
                    maArrays[ma100Index][i - 5];
                slopeScore = 1 - clamp(Math.abs(slope) / 0.01, 0, 1);
            }

            orangeSum += closenessScore * slopeScore;
            orangeCount += 1;
        }
    }

    const validDays = Math.max(1, endIndex - startIndex + 1);
    const priceReturn =
        (closes[endIndex] - closes[startIndex]) / closes[startIndex];

    const slowMa = maArrays[slowIndex];
    const slowSlope =
        (slowMa[endIndex] - slowMa[startIndex]) / slowMa[startIndex];

    const boxRange = (maxClose - minClose) / closes[startIndex];
    const crossRate = crossCount / Math.max(1, validDays - 1);

    const boxScore =
        (1 - clamp(boxRange / 0.12, 0, 1)) *
        (1 - clamp(Math.abs(priceReturn) / 0.08, 0, 1)) *
        clamp(crossRate / 0.2, 0, 1);

    const orangeScore = orangeCount > 0 ? orangeSum / orangeCount : 0;

    const upTrendScore =
        clamp(priceReturn / 0.2, 0, 1) * clamp(slowSlope / 0.05, 0, 1);
    const downTrendScore =
        clamp(-priceReturn / 0.2, 0, 1) * clamp(-slowSlope / 0.05, 0, 1);

    return {
        orange: toScore(orangeScore),
        box: toScore(boxScore),
        ppp: toScore(upAlignCount / validDays),
        reversePpp: toScore(downAlignCount / validDays),
        upTrend: toScore(upTrendScore),
        downTrend: toScore(downTrendScore),
        crossRate: crossRate,
        priceReturn,
    };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    try {
        const { sessionId } = await params;
        const nickname = request.nextUrl.searchParams.get("nickname");

        if (!nickname) {
            return NextResponse.json(
                { success: false, error: "ユーザー情報がありません" },
                { status: 400 },
            );
        }

        const db = getDatabase();
        const session = db
            .prepare(
                `
        SELECT id, nickname, symbol, practice_start_date, practice_end_date,
               practice_start_index, period_days, ma_settings
        FROM sessions
        WHERE id = ? AND nickname = ?
      `,
            )
            .get(sessionId, nickname) as SessionRow | undefined;

        if (!session) {
            return NextResponse.json(
                { success: false, error: "Session not found" },
                { status: 404 },
            );
        }

        const prices = loadAllPrices();
        const scores = computeRegimeScores(session, prices);

        if (!scores) {
            return NextResponse.json(
                { success: false, error: "特徴量の計算に失敗しました" },
                { status: 400 },
            );
        }

        return NextResponse.json({
            success: true,
            scores,
        });
    } catch (error) {
        console.error("局面スコア生成エラー:", error);
        return NextResponse.json(
            { success: false, error: "局面スコア生成に失敗しました" },
            { status: 500 },
        );
    }
}
