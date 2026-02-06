"use client";

import { DailyStats } from "./utils/dailyStats";

interface DailyPerformanceChartProps {
    dailyStats: DailyStats[];
}

export default function DailyPerformanceChart({
    dailyStats,
}: DailyPerformanceChartProps) {
    if (dailyStats.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                データがありません
            </div>
        );
    }

    const width = 800;
    const height = 300;
    const padding = { top: 20, right: 20, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // データの範囲を計算
    const maxCumulativeProfit = Math.max(
        ...dailyStats.map((d) => d.cumulativeProfit),
        0,
    );
    const minCumulativeProfit = Math.min(
        ...dailyStats.map((d) => d.cumulativeProfit),
        0,
    );
    const maxDailyProfit = Math.max(...dailyStats.map((d) => d.dailyProfit), 0);
    const minDailyProfit = Math.min(...dailyStats.map((d) => d.dailyProfit), 0);

    const profitRange = maxCumulativeProfit - minCumulativeProfit;
    const dailyRange = maxDailyProfit - minDailyProfit;

    // スケール関数
    const xScale = (index: number) =>
        padding.left + (index / (dailyStats.length - 1)) * chartWidth;
    const yScaleCumulative = (value: number) =>
        padding.top +
        chartHeight -
        ((value - minCumulativeProfit) / profitRange) * chartHeight;
    const yScaleDaily = (value: number) =>
        padding.top +
        chartHeight -
        ((value - minDailyProfit) / dailyRange) * chartHeight;

    // 折れ線グラフのパス
    const linePath = dailyStats
        .map((d, i) => {
            const x = xScale(i);
            const y = yScaleCumulative(d.cumulativeProfit);
            return `${i === 0 ? "M" : "L"} ${x} ${y}`;
        })
        .join(" ");

    // ゼロラインのY座標
    const zeroY = yScaleDaily(0);

    return (
        <div className="bg-card rounded-lg border p-4">
            <h3 className="text-sm font-semibold mb-4">パフォーマンス推移</h3>
            <div className="overflow-x-auto">
                <svg
                    width={width}
                    height={height}
                    className="mx-auto"
                    style={{ minWidth: "600px" }}
                >
                    {/* グリッド線 */}
                    {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                        const y = padding.top + chartHeight * ratio;
                        const value = maxCumulativeProfit - ratio * profitRange;
                        return (
                            <g key={ratio}>
                                <line
                                    x1={padding.left}
                                    y1={y}
                                    x2={width - padding.right}
                                    y2={y}
                                    stroke="#e5e7eb"
                                    strokeWidth="1"
                                    strokeDasharray="3,3"
                                />
                                <text
                                    x={padding.left - 10}
                                    y={y + 4}
                                    textAnchor="end"
                                    fontSize="11"
                                    fill="#6b7280"
                                >
                                    {value.toLocaleString()}
                                </text>
                            </g>
                        );
                    })}

                    {/* ゼロライン（日次損益用） */}
                    <line
                        x1={padding.left}
                        y1={zeroY}
                        x2={width - padding.right}
                        y2={zeroY}
                        stroke="#9ca3af"
                        strokeWidth="1"
                    />

                    {/* 日次損益の棒グラフ */}
                    {dailyStats.map((d, i) => {
                        const x = xScale(i);
                        const barHeight = Math.abs(
                            yScaleDaily(d.dailyProfit) - zeroY,
                        );
                        const y =
                            d.dailyProfit >= 0
                                ? yScaleDaily(d.dailyProfit)
                                : zeroY;
                        const barWidth = Math.max(
                            chartWidth / dailyStats.length - 2,
                            3,
                        );

                        return (
                            <rect
                                key={`bar-${i}`}
                                x={x - barWidth / 2}
                                y={y}
                                width={barWidth}
                                height={barHeight}
                                fill={
                                    d.dailyProfit >= 0 ? "#22c55e" : "#ef4444"
                                }
                                opacity="0.3"
                            />
                        );
                    })}

                    {/* 累積損益の折れ線グラフ */}
                    <path
                        d={linePath}
                        fill="none"
                        stroke="#3b82f6"
                        strokeWidth="2"
                    />

                    {/* データポイント */}
                    {dailyStats.map((d, i) => {
                        const x = xScale(i);
                        const y = yScaleCumulative(d.cumulativeProfit);
                        return (
                            <circle
                                key={`point-${i}`}
                                cx={x}
                                cy={y}
                                r="3"
                                fill="#3b82f6"
                            />
                        );
                    })}

                    {/* X軸ラベル（日付） */}
                    {dailyStats.map((d, i) => {
                        // データが多い場合は間引いて表示
                        const showLabel =
                            dailyStats.length <= 10 ||
                            i % Math.ceil(dailyStats.length / 10) === 0 ||
                            i === dailyStats.length - 1;

                        if (!showLabel) return null;

                        const x = xScale(i);
                        const date = new Date(d.date);
                        const label = `${date.getMonth() + 1}/${date.getDate()}`;

                        return (
                            <text
                                key={`label-${i}`}
                                x={x}
                                y={height - padding.bottom + 20}
                                textAnchor="middle"
                                fontSize="10"
                                fill="#6b7280"
                            >
                                {label}
                            </text>
                        );
                    })}

                    {/* 軸ラベル */}
                    <text
                        x={padding.left - 45}
                        y={padding.top + chartHeight / 2}
                        textAnchor="middle"
                        fontSize="11"
                        fill="#6b7280"
                        transform={`rotate(-90, ${padding.left - 45}, ${padding.top + chartHeight / 2})`}
                    >
                        累積損益 (円)
                    </text>
                </svg>
            </div>
            <div className="flex items-center justify-center gap-6 mt-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-0.5 bg-blue-500"></div>
                    <span>累積損益</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-3 bg-green-500 opacity-30"></div>
                    <span>日次利益</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-3 bg-red-500 opacity-30"></div>
                    <span>日次損失</span>
                </div>
            </div>
        </div>
    );
}
