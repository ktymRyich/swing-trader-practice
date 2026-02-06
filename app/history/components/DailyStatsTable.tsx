"use client";

import { DailyStats } from "./utils/dailyStats";

interface DailyStatsTableProps {
    dailyStats: DailyStats[];
}

export default function DailyStatsTable({ dailyStats }: DailyStatsTableProps) {
    if (dailyStats.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                取引データがありません
            </div>
        );
    }

    return (
        <div className="bg-card rounded-lg border">
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b">
                        <tr>
                            <th className="px-3 py-2 text-left font-medium">
                                日付
                            </th>
                            <th className="px-3 py-2 text-center font-medium">
                                取引数
                            </th>
                            <th className="px-3 py-2 text-center font-medium">
                                新規建
                            </th>
                            <th className="px-3 py-2 text-center font-medium">
                                決済数
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                                日次損益
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                                累積損益
                            </th>
                            <th className="px-3 py-2 text-right font-medium">
                                資金残高
                            </th>
                            <th className="px-3 py-2 text-center font-medium">
                                勝敗
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {dailyStats.map((day, index) => {
                            const date = new Date(day.date);
                            const dayOfWeek = [
                                "日",
                                "月",
                                "火",
                                "水",
                                "木",
                                "金",
                                "土",
                            ][date.getDay()];
                            const dateStr = `${date.getMonth() + 1}/${date.getDate()}(${dayOfWeek})`;

                            const winRate =
                                day.closedPositions > 0
                                    ? (day.winCount / day.closedPositions) * 100
                                    : 0;

                            return (
                                <tr
                                    key={index}
                                    className="border-b hover:bg-muted/30 transition-colors"
                                >
                                    <td className="px-3 py-2 font-medium">
                                        {dateStr}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {day.tradeCount}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {day.newPositions}
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {day.closedPositions}
                                    </td>
                                    <td
                                        className={`px-3 py-2 text-right font-medium ${
                                            day.dailyProfit > 0
                                                ? "text-green-600"
                                                : day.dailyProfit < 0
                                                  ? "text-red-600"
                                                  : ""
                                        }`}
                                    >
                                        {day.dailyProfit > 0 && "+"}
                                        {day.dailyProfit.toLocaleString()}円
                                    </td>
                                    <td
                                        className={`px-3 py-2 text-right font-medium ${
                                            day.cumulativeProfit > 0
                                                ? "text-green-600"
                                                : day.cumulativeProfit < 0
                                                  ? "text-red-600"
                                                  : ""
                                        }`}
                                    >
                                        {day.cumulativeProfit > 0 && "+"}
                                        {day.cumulativeProfit.toLocaleString()}
                                        円
                                    </td>
                                    <td className="px-3 py-2 text-right">
                                        {day.capitalBalance.toLocaleString()}円
                                    </td>
                                    <td className="px-3 py-2 text-center">
                                        {day.closedPositions > 0 ? (
                                            <span className="text-xs">
                                                {day.winCount}勝{day.lossCount}
                                                敗
                                                <span className="ml-1 text-muted-foreground">
                                                    ({winRate.toFixed(0)}%)
                                                </span>
                                            </span>
                                        ) : (
                                            <span className="text-muted-foreground text-xs">
                                                -
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                    <tfoot className="bg-muted/50 border-t font-semibold">
                        <tr>
                            <td className="px-3 py-2">合計</td>
                            <td className="px-3 py-2 text-center">
                                {dailyStats.reduce(
                                    (sum, d) => sum + d.tradeCount,
                                    0,
                                )}
                            </td>
                            <td className="px-3 py-2 text-center">
                                {dailyStats.reduce(
                                    (sum, d) => sum + d.newPositions,
                                    0,
                                )}
                            </td>
                            <td className="px-3 py-2 text-center">
                                {dailyStats.reduce(
                                    (sum, d) => sum + d.closedPositions,
                                    0,
                                )}
                            </td>
                            <td className="px-3 py-2 text-right">-</td>
                            <td
                                className={`px-3 py-2 text-right ${
                                    dailyStats[dailyStats.length - 1]
                                        .cumulativeProfit > 0
                                        ? "text-green-600"
                                        : dailyStats[dailyStats.length - 1]
                                                .cumulativeProfit < 0
                                          ? "text-red-600"
                                          : ""
                                }`}
                            >
                                {dailyStats[dailyStats.length - 1]
                                    .cumulativeProfit > 0 && "+"}
                                {dailyStats[
                                    dailyStats.length - 1
                                ].cumulativeProfit.toLocaleString()}
                                円
                            </td>
                            <td className="px-3 py-2 text-right">
                                {dailyStats[
                                    dailyStats.length - 1
                                ].capitalBalance.toLocaleString()}
                                円
                            </td>
                            <td className="px-3 py-2 text-center">
                                {(() => {
                                    const totalWins = dailyStats.reduce(
                                        (sum, d) => sum + d.winCount,
                                        0,
                                    );
                                    const totalLosses = dailyStats.reduce(
                                        (sum, d) => sum + d.lossCount,
                                        0,
                                    );
                                    const totalClosed = totalWins + totalLosses;
                                    const totalWinRate =
                                        totalClosed > 0
                                            ? (totalWins / totalClosed) * 100
                                            : 0;
                                    return (
                                        <span className="text-xs">
                                            {totalWins}勝{totalLosses}敗
                                            <span className="ml-1 text-muted-foreground">
                                                ({totalWinRate.toFixed(0)}%)
                                            </span>
                                        </span>
                                    );
                                })()}
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </div>
        </div>
    );
}
