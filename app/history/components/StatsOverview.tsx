interface StatsOverviewProps {
    title?: string;
    stats: {
        totalSessions: number;
        totalTrades: number;
        totalClosed: number;
        winRate: number;
        profitFactor: number;
        profitLossRatio: number;
        avgProfitRate: number;
    } | null;
}

export default function StatsOverview({ stats, title }: StatsOverviewProps) {
    if (!stats || stats.totalSessions === 0) {
        return null;
    }

    const formatRatio = (value: number) =>
        Number.isFinite(value) ? value.toFixed(2) : "∞";

    const formatPercent = (value: number) => {
        const sign = value > 0 ? "+" : "";
        return `${sign}${value.toFixed(2)}%`;
    };

    return (
        <div className="bg-card rounded-lg border p-4 mb-6">
            {title && <div className="text-sm font-semibold mb-3">{title}</div>}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">
                        セッション数
                    </div>
                    <div className="text-xl font-bold">
                        {stats.totalSessions}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        練習量
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">
                        決済数
                    </div>
                    <div className="text-xl font-bold">{stats.totalClosed}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        取引完了
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">
                        勝率
                    </div>
                    <div className="text-xl font-bold">
                        {stats.winRate.toFixed(1)}%
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        勝ちトレード率
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">
                        平均損益率
                    </div>
                    <div
                        className={`text-xl font-bold ${stats.avgProfitRate >= 0 ? "text-green-500" : "text-red-500"}`}
                    >
                        {formatPercent(stats.avgProfitRate)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        セッション平均
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">
                        プロフィットファクター
                    </div>
                    <div className="text-xl font-bold">
                        {formatRatio(stats.profitFactor)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        リスク管理
                    </div>
                </div>
                <div className="text-center">
                    <div className="text-xs text-muted-foreground mb-1">
                        損益レシオ
                    </div>
                    <div className="text-xl font-bold">
                        {formatRatio(stats.profitLossRatio)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                        利益/損失比
                    </div>
                </div>
            </div>
        </div>
    );
}
