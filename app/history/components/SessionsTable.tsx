import Link from "next/link";
import { Bookmark, Eye, RotateCcw, Trash2 } from "lucide-react";

interface Session {
    id: string;
    stockName: string;
    symbol: string;
    createdAt: string;
    startDate: string;
    startDateOfData?: string;
    endDateOfData?: string;
    practiceStartIndex?: number;
    practiceStartDate?: string;
    periodDays: number;
    initialCapital: number;
    playbackSpeed?: number;
    maSettings?: number[];
    stockSector?: string;
    stockDescription?: string;
    stockMarketCapEstimate?: string;
    tradeCount: number;
    winRate: number;
    currentCapital: number;
    ruleViolations: number;
    isBookmarked?: boolean;
    reflection?: string;
}

interface SessionsTableProps {
    sessions: Session[];
    sortBy: "date" | "winRate" | "profit";
    onSortChange: (sortBy: "date" | "winRate" | "profit") => void;
    onReflectionOpen: (session: Session) => void;
    onReplay: (session: Session, e: React.MouseEvent) => void;
    onToggleBookmark: (session: Session, e: React.MouseEvent) => void;
    onDelete: (
        sessionId: string,
        sessionName: string,
        e: React.MouseEvent,
    ) => void;
    replayingSessionId: string | null;
    clusterMap?: Record<
        string,
        {
            label: string;
            color: string;
        }
    >;
}

export default function SessionsTable({
    sessions,
    sortBy,
    onSortChange,
    onReflectionOpen,
    onReplay,
    onToggleBookmark,
    onDelete,
    replayingSessionId,
    clusterMap,
}: SessionsTableProps) {
    if (sessions.length === 0) {
        return (
            <div className="bg-card rounded-lg border p-12 text-center">
                <div className="text-muted-foreground mb-4">
                    <svg
                        className="w-16 h-16 mx-auto opacity-50"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                        />
                    </svg>
                </div>
                <p className="text-muted-foreground mb-2">
                    完了したセッションがありません
                </p>
                <p className="text-sm text-muted-foreground">
                    セッションを完了すると、ここに履歴が表示されます
                </p>
            </div>
        );
    }

    return (
        <>
            {/* ソート */}
            <div className="flex items-center gap-4 mb-4">
                <span className="text-sm font-medium">並び替え:</span>
                <div className="flex gap-2">
                    <button
                        onClick={() => onSortChange("date")}
                        className={`px-3 py-1.5 rounded text-xs transition ${
                            sortBy === "date"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary hover:bg-secondary/80"
                        }`}
                    >
                        日付
                    </button>
                    <button
                        onClick={() => onSortChange("winRate")}
                        className={`px-3 py-1.5 rounded text-xs transition ${
                            sortBy === "winRate"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary hover:bg-secondary/80"
                        }`}
                    >
                        勝率
                    </button>
                    <button
                        onClick={() => onSortChange("profit")}
                        className={`px-3 py-1.5 rounded text-xs transition ${
                            sortBy === "profit"
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary hover:bg-secondary/80"
                        }`}
                    >
                        損益
                    </button>
                </div>
            </div>

            {/* テーブル */}
            <div className="bg-card rounded-lg border overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 border-b">
                            <tr>
                                <th className="text-left p-3 font-medium">
                                    銘柄
                                </th>
                                <th className="text-left p-3 font-medium">
                                    日付
                                </th>
                                <th className="text-right p-3 font-medium">
                                    取引数
                                </th>
                                <th className="text-right p-3 font-medium">
                                    勝率
                                </th>
                                <th className="text-right p-3 font-medium">
                                    損益
                                </th>
                                <th className="text-right p-3 font-medium">
                                    月利回り
                                </th>
                                <th className="text-right p-3 font-medium">
                                    違反
                                </th>
                                <th className="text-center p-3 font-medium">
                                    クラスタ
                                </th>
                                <th className="text-center p-3 font-medium">
                                    詳細
                                </th>
                                <th className="text-center p-3 font-medium">
                                    再プレイ
                                </th>
                                <th className="text-center p-3 font-medium">
                                    ブックマーク
                                </th>
                                <th className="text-center p-3 font-medium w-20">
                                    削除
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessions.map((session) => {
                                const profit =
                                    ((session.currentCapital -
                                        session.initialCapital) /
                                        session.initialCapital) *
                                    100;
                                const profitYen =
                                    session.currentCapital -
                                    session.initialCapital;
                                const monthlyReturn =
                                    session.periodDays > 0
                                        ? (profit / session.periodDays) * 20
                                        : 0;

                                return (
                                    <tr
                                        key={session.id}
                                        className="border-b hover:bg-accent/50 transition"
                                    >
                                        <td className="p-3">
                                            <Link
                                                href={`/session/${session.id}`}
                                                className="hover:underline font-medium"
                                            >
                                                {session.stockName}
                                                <span className="text-xs text-muted-foreground ml-2">
                                                    ({session.symbol})
                                                </span>
                                            </Link>
                                        </td>
                                        <td className="p-3 text-muted-foreground">
                                            {new Date(
                                                session.createdAt ||
                                                    session.startDate,
                                            ).toLocaleDateString("ja-JP", {
                                                year: "numeric",
                                                month: "short",
                                                day: "numeric",
                                            })}
                                        </td>
                                        <td className="p-3 text-right">
                                            {session.tradeCount}
                                        </td>
                                        <td className="p-3 text-right font-medium">
                                            {session.winRate.toFixed(1)}%
                                        </td>
                                        <td className="p-3 text-right">
                                            <div
                                                className={`font-medium ${profit >= 0 ? "text-green-500" : "text-red-500"}`}
                                            >
                                                {profit >= 0 ? "+" : ""}
                                                {profit.toFixed(1)}%
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {profitYen >= 0 ? "+" : ""}¥
                                                {profitYen.toLocaleString()}
                                            </div>
                                        </td>
                                        <td className="p-3 text-right">
                                            <span
                                                className={`font-medium ${monthlyReturn >= 0 ? "text-green-500" : "text-red-500"}`}
                                            >
                                                {monthlyReturn >= 0 ? "+" : ""}
                                                {monthlyReturn.toFixed(1)}%
                                            </span>
                                        </td>
                                        <td className="p-3 text-right">
                                            <span
                                                className={
                                                    session.ruleViolations > 0
                                                        ? "text-red-500 font-medium"
                                                        : "text-muted-foreground"
                                                }
                                            >
                                                {session.ruleViolations}
                                            </span>
                                        </td>
                                        <td className="p-3 text-center">
                                            {clusterMap?.[session.id] ? (
                                                <span
                                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border"
                                                    style={{
                                                        borderColor:
                                                            clusterMap[
                                                                session.id
                                                            ].color,
                                                        color: clusterMap[
                                                            session.id
                                                        ].color,
                                                        backgroundColor: `${clusterMap[session.id].color}1A`,
                                                    }}
                                                >
                                                    {
                                                        clusterMap[session.id]
                                                            .label
                                                    }
                                                </span>
                                            ) : (
                                                <span className="text-xs text-muted-foreground">
                                                    -
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    onReflectionOpen(session);
                                                }}
                                                className="p-1.5 hover:bg-primary/20 rounded transition"
                                                title="詳細を見る"
                                            >
                                                <Eye className="w-4 h-4 text-primary" />
                                            </button>
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                onClick={(e) =>
                                                    onReplay(session, e)
                                                }
                                                disabled={
                                                    replayingSessionId ===
                                                    session.id
                                                }
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-primary/30 text-primary hover:bg-primary/10 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                                title="同じ銘柄・同じ期間でもう一度"
                                            >
                                                {replayingSessionId ===
                                                session.id ? (
                                                    <span className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                )}
                                                もう一度
                                            </button>
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                onClick={(e) =>
                                                    onToggleBookmark(session, e)
                                                }
                                                className={`inline-flex items-center justify-center w-9 h-9 rounded-full border transition ${
                                                    session.isBookmarked
                                                        ? "border-amber-400/70 bg-amber-100 text-amber-700"
                                                        : "border-muted-foreground/20 text-muted-foreground hover:bg-muted"
                                                }`}
                                                title={
                                                    session.isBookmarked
                                                        ? "ブックマーク解除"
                                                        : "ブックマーク"
                                                }
                                            >
                                                <Bookmark
                                                    className={`w-4 h-4 ${
                                                        session.isBookmarked
                                                            ? "fill-current"
                                                            : ""
                                                    }`}
                                                />
                                            </button>
                                        </td>
                                        <td className="p-3 text-center">
                                            <button
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    onDelete(
                                                        session.id,
                                                        `${session.stockName} (${session.symbol})`,
                                                        e,
                                                    );
                                                }}
                                                className="p-1.5 hover:bg-destructive/20 rounded transition"
                                                title="削除"
                                            >
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
