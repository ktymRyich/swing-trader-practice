import { Trade, Position } from "@/lib/db/schema";

export interface DailyStats {
    date: string;
    tradeCount: number;
    newPositions: number;
    closedPositions: number;
    dailyProfit: number;
    cumulativeProfit: number;
    capitalBalance: number;
    winCount: number;
    lossCount: number;
    violations: number;
}

export function calculateDailyStats(
    trades: Trade[],
    positions: Position[],
    initialCapital: number,
): DailyStats[] {
    // 日付ごとにデータをグループ化
    const dailyMap = new Map<string, DailyStats>();

    // 全決済済みポジションをマッピング
    const closedPositionsByDate = new Map<string, Position[]>();
    positions
        .filter((p) => p.status === "closed" && p.exitDate)
        .forEach((p) => {
            const date = p.exitDate!;
            if (!closedPositionsByDate.has(date)) {
                closedPositionsByDate.set(date, []);
            }
            closedPositionsByDate.get(date)!.push(p);
        });

    // 新規ポジション（建玉）を日付ごとにマッピング
    const newPositionsByDate = new Map<string, Position[]>();
    positions.forEach((p) => {
        const date = p.entryDate;
        if (!newPositionsByDate.has(date)) {
            newPositionsByDate.set(date, []);
        }
        newPositionsByDate.get(date)!.push(p);
    });

    // 取引日をソートして日次データを作成
    const tradeDates = Array.from(
        new Set([
            ...trades.map((t) => t.tradeDate),
            ...positions.map((p) => p.entryDate),
            ...positions
                .filter((p) => p.exitDate)
                .map((p) => p.exitDate as string),
        ]),
    ).sort();

    let cumulativeProfit = 0;
    let currentCapital = initialCapital;

    tradeDates.forEach((date) => {
        const dayTrades = trades.filter((t) => t.tradeDate === date);
        const closedToday = closedPositionsByDate.get(date) || [];
        const newToday = newPositionsByDate.get(date) || [];

        const dailyProfit = closedToday.reduce(
            (sum, p) => sum + (p.profit || 0),
            0,
        );
        cumulativeProfit += dailyProfit;

        const winCount = closedToday.filter((p) => (p.profit || 0) > 0).length;
        const lossCount = closedToday.filter(
            (p) => (p.profit || 0) <= 0,
        ).length;

        // 最後の取引後の資金残高を取得
        const lastTradeOfDay = dayTrades[dayTrades.length - 1];
        if (lastTradeOfDay) {
            currentCapital = lastTradeOfDay.capitalAfterTrade;
        }

        dailyMap.set(date, {
            date,
            tradeCount: dayTrades.length,
            newPositions: newToday.length,
            closedPositions: closedToday.length,
            dailyProfit,
            cumulativeProfit,
            capitalBalance: currentCapital,
            winCount,
            lossCount,
            violations: 0, // TODO: 違反データも追加可能
        });
    });

    return Array.from(dailyMap.values()).sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
    );
}
