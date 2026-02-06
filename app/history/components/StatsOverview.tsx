interface StatsOverviewProps {
    stats: {
        total: number;
        totalTrades: number;
        avgWinRate: number;
        profitableSessions: number;
        totalProfitYen: number;
        monthlyReturn: number;
        avgProfitLoss: number;
        avgProfitLossRate: number;
        totalReturnOnBase: number;
        avgSessionReturnOnBase: number;
        avgProfit: number;
        avgLoss: number;
        maxProfit: number;
    } | null;
}

export default function StatsOverview({ stats }: StatsOverviewProps) {
    if (!stats || stats.total === 0) {
        return null;
    }

    return (
        <div className="bg-card rounded-lg border p-4 mb-6">
            <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                <div className="text-center">
                    <div className="text-xs text-muted-foreground">
                        セッション数
                    </div>
                    <div className="text-lg font-bold">{stats.total}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-muted-foreground">
                        総取引数
                    </div>
                    <div className="text-lg font-bold">{stats.totalTrades}</div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-muted-foreground">
                        平均勝率
                    </div>
                    <div className="text-lg font-bold">
                        {stats.avgWinRate.toFixed(1)}%
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-muted-foreground">利益率</div>
                    <div className="text-lg font-bold text-green-500">
                        {(
                            (stats.profitableSessions / stats.total) *
                            100
                        ).toFixed(0)}
                        %
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-muted-foreground">総損益</div>
                    <div
                        className={`text-lg font-bold ${stats.totalProfitYen >= 0 ? "text-green-500" : "text-red-500"}`}
                    >
                        {stats.totalProfitYen >= 0 ? "+" : ""}¥
                        {stats.totalProfitYen.toLocaleString()}
                    </div>
                    <div
                        className={`text-xs ${stats.totalReturnOnBase >= 0 ? "text-green-500" : "text-red-500"}`}
                    >
                        (150万円基準: {stats.totalReturnOnBase >= 0 ? "+" : ""}
                        {stats.totalReturnOnBase.toFixed(2)}%)
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-muted-foreground">
                        月利回り
                    </div>
                    <div
                        className={`text-lg font-bold ${stats.monthlyReturn >= 0 ? "text-green-500" : "text-red-500"}`}
                    >
                        {stats.monthlyReturn >= 0 ? "+" : ""}
                        {stats.monthlyReturn.toFixed(1)}%
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3 pt-3 border-t">
                <div className="text-center">
                    <div className="text-xs text-muted-foreground">
                        平均損益
                    </div>
                    <div
                        className={`text-sm font-medium ${stats.avgProfitLoss >= 0 ? "text-green-500" : "text-red-500"}`}
                    >
                        {stats.avgProfitLoss >= 0 ? "+" : ""}¥
                        {stats.avgProfitLoss.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                        })}
                    </div>
                    <div
                        className={`text-xs ${stats.avgProfitLossRate >= 0 ? "text-green-500" : "text-red-500"}`}
                    >
                        (ROI: {stats.avgProfitLossRate >= 0 ? "+" : ""}
                        {stats.avgProfitLossRate.toFixed(2)}%)
                    </div>
                    <div
                        className={`text-xs ${stats.avgSessionReturnOnBase >= 0 ? "text-green-500" : "text-red-500"}`}
                    >
                        (150万: {stats.avgSessionReturnOnBase >= 0 ? "+" : ""}
                        {stats.avgSessionReturnOnBase.toFixed(2)}%)
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-muted-foreground">
                        平均利益
                    </div>
                    <div className="text-sm font-medium text-green-500">
                        +¥
                        {stats.avgProfit.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                        })}
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-muted-foreground">
                        平均損失
                    </div>
                    <div className="text-sm font-medium text-red-500">
                        ¥
                        {stats.avgLoss.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                        })}
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-muted-foreground">
                        最大利益
                    </div>
                    <div className="text-sm font-medium text-green-500">
                        +¥
                        {stats.maxProfit.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                        })}
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-muted-foreground">
                        損益比率
                    </div>
                    <div className="text-sm font-medium">
                        {stats.avgLoss !== 0
                            ? Math.abs(stats.avgProfit / stats.avgLoss).toFixed(
                                  2,
                              )
                            : "∞"}
                    </div>
                </div>
            </div>
        </div>
    );
}
