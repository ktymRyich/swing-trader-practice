"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
    ArrowLeft,
    TrendingUp,
    TrendingDown,
    Trash2,
    Clock,
    FileText,
    Edit,
} from "lucide-react";
import {
    ConfirmDialog,
    AlertDialogSimple,
} from "@/components/ui/confirm-dialog";

export default function HistoryPage() {
    const router = useRouter();
    const [nickname, setNickname] = useState<string | null>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [incompleteSessions, setIncompleteSessions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sortBy, setSortBy] = useState<"date" | "winRate" | "profit">("date");
    const [isReflectionModalOpen, setIsReflectionModalOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [reflection, setReflection] = useState("");

    // ダイアログ用のstate
    const [deleteDialog, setDeleteDialog] = useState<{
        open: boolean;
        sessionId: string;
        sessionName: string;
    }>({ open: false, sessionId: "", sessionName: "" });
    const [alertDialog, setAlertDialog] = useState<{
        open: boolean;
        title: string;
        description: string;
    }>({ open: false, title: "", description: "" });

    // 感想モーダル表示中はbodyのスクロールを無効化
    useEffect(() => {
        if (isReflectionModalOpen) {
            document.body.classList.add("modal-open");
        } else {
            document.body.classList.remove("modal-open");
        }

        return () => {
            document.body.classList.remove("modal-open");
        };
    }, [isReflectionModalOpen]);

    useEffect(() => {
        const savedNickname = localStorage.getItem("userNickname");
        if (!savedNickname) {
            router.push("/login");
            return;
        }
        setNickname(savedNickname);
        loadSessions(savedNickname);
    }, [router]);

    const loadSessions = async (userNickname: string) => {
        try {
            const response = await fetch(
                `/api/sessions?nickname=${userNickname}`,
            );
            const data = await response.json();

            if (data.success) {
                const allSessions = data.sessions || [];
                const completedSessions = allSessions.filter(
                    (s: any) => s.status === "completed",
                );
                const incomplete = allSessions.filter(
                    (s: any) => s.status !== "completed",
                );
                setSessions(completedSessions);
                setIncompleteSessions(incomplete);
            }
        } catch (error) {
            console.error("セッション読み込みエラー:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleOpenReflection = (session: any, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedSession(session);
        setReflection(session.reflection || "");
        setIsReflectionModalOpen(true);
    };

    const handleSaveReflection = async () => {
        if (!nickname || !selectedSession) return;

        try {
            // 現在のセッションデータを取得
            const getResponse = await fetch(
                `/api/sessions/${selectedSession.id}?nickname=${nickname}`,
            );
            const getData = await getResponse.json();

            if (!getData.success) {
                alert("セッション情報の取得に失敗しました");
                return;
            }

            // reflectionフィールドを追加して更新
            const updatedSession = {
                ...getData.session,
                reflection,
            };

            const response = await fetch(
                `/api/sessions/${selectedSession.id}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        nickname,
                        session: updatedSession,
                    }),
                },
            );

            const data = await response.json();
            if (data.success) {
                setIsReflectionModalOpen(false);
                loadSessions(nickname);
            } else {
                alert("保存に失敗しました");
            }
        } catch (error) {
            console.error("感想保存エラー:", error);
            alert("保存中にエラーが発生しました");
        }
    };

    const handleDelete = async (
        sessionId: string,
        sessionName: string,
        e: React.MouseEvent,
    ) => {
        e.preventDefault();
        e.stopPropagation();

        if (!nickname) return;

        if (
            !confirm(
                `「${sessionName}」のセッションを削除しますか？\nこの操作は元に戻せません。`,
            )
        ) {
            return;
        }

        try {
            // セッション一覧を取得して該当セッションを除外
            const response = await fetch(`/api/sessions?nickname=${nickname}`);
            const data = await response.json();

            if (data.success) {
                const allSessions = data.sessions || [];
                console.log(`削除前のセッション数: ${allSessions.length}`);

                // 該当セッションが存在するか確認
                const targetSession = allSessions.find(
                    (s: any) => s.id === sessionId,
                );
                if (!targetSession) {
                    alert("指定されたセッションが見つかりませんでした");
                    return;
                }

                const updatedSessions = allSessions.filter(
                    (s: any) => s.id !== sessionId,
                );
                console.log(`削除後のセッション数: ${updatedSessions.length}`);

                // 削除数の確認（安全チェック）
                const deletedCount =
                    allSessions.length - updatedSessions.length;
                if (deletedCount !== 1) {
                    console.error(
                        `異常: ${deletedCount}件のセッションが削除されます`,
                    );
                    alert(
                        `エラー: 削除対象は1件ですが、${deletedCount}件が削除されようとしています。削除を中止しました。`,
                    );
                    return;
                }

                // 更新後のセッション一覧を保存
                const saveResponse = await fetch("/api/sessions", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        nickname,
                        sessions: updatedSessions,
                    }),
                });

                const saveData = await saveResponse.json();
                if (saveData.success) {
                    alert("セッションを削除しました");
                    loadSessions(nickname);
                } else {
                    throw new Error("削除に失敗しました");
                }
            }
        } catch (error) {
            console.error("削除エラー:", error);
            alert("削除に失敗しました");
        }
    };

    const sortedSessions = sessions?.sort((a, b) => {
        switch (sortBy) {
            case "date":
                return (
                    new Date(b.startDate).getTime() -
                    new Date(a.startDate).getTime()
                );
            case "winRate":
                return b.winRate - a.winRate;
            case "profit":
                const profitA =
                    ((a.currentCapital - a.initialCapital) / a.initialCapital) *
                    100;
                const profitB =
                    ((b.currentCapital - b.initialCapital) / b.initialCapital) *
                    100;
                return profitB - profitA;
            default:
                return 0;
        }
    });

    // 統計計算
    const stats =
        sessions.length > 0
            ? (() => {
                  const totalSessions = sessions.length;
                  const totalTrades = sessions.reduce(
                      (sum, s) => sum + (s.tradeCount || 0),
                      0,
                  );
                  const avgWinRate =
                      sessions.reduce((sum, s) => sum + s.winRate, 0) /
                      totalSessions;
                  const profitableSessions = sessions.filter(
                      (s) => s.currentCapital > s.initialCapital,
                  ).length;
                  const totalProfitPercent = sessions.reduce(
                      (sum, s) =>
                          sum +
                          ((s.currentCapital - s.initialCapital) /
                              s.initialCapital) *
                              100,
                      0,
                  );

                  // 全セッションの損益を計算
                  const totalProfitYen = sessions.reduce(
                      (sum, s) => sum + (s.currentCapital - s.initialCapital),
                      0,
                  );

                  // 平均増益額と平均損失額
                  const allClosedPositions = sessions.flatMap((s) =>
                      (s.positions || []).filter(
                          (p: any) => p.status === "closed",
                      ),
                  );
                  const profits = allClosedPositions.filter(
                      (p: any) => (p.profit || 0) > 0,
                  );
                  const losses = allClosedPositions.filter(
                      (p: any) => (p.profit || 0) < 0,
                  );
                  const avgProfit =
                      profits.length > 0
                          ? profits.reduce(
                                (sum, p: any) => sum + (p.profit || 0),
                                0,
                            ) / profits.length
                          : 0;
                  const avgLoss =
                      losses.length > 0
                          ? losses.reduce(
                                (sum, p: any) => sum + (p.profit || 0),
                                0,
                            ) / losses.length
                          : 0;

                  // 最大利益と最大損失
                  const allProfits = allClosedPositions.map(
                      (p: any) => p.profit || 0,
                  );
                  const maxProfit =
                      allProfits.length > 0 ? Math.max(...allProfits) : 0;
                  const maxLoss =
                      allProfits.filter((p) => p < 0).length > 0
                          ? Math.min(...allProfits.filter((p) => p < 0))
                          : 0;

                  // 1ヶ月(20営業日)あたりの利回りを計算
                  const totalDays = sessions.reduce(
                      (sum, s) => sum + (s.periodDays || 0),
                      0,
                  );
                  const avgDaysPerSession = totalDays / totalSessions;
                  const avgProfitPerSession =
                      totalProfitPercent / totalSessions;
                  const monthlyReturn =
                      avgDaysPerSession > 0
                          ? (avgProfitPerSession / avgDaysPerSession) * 20
                          : 0;

                  return {
                      total: totalSessions,
                      totalTrades,
                      avgWinRate,
                      profitableSessions,
                      totalProfit: totalProfitPercent,
                      totalProfitYen,
                      avgProfit,
                      avgLoss,
                      maxProfit,
                      maxLoss,
                      monthlyReturn,
                  };
              })()
            : null;

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">履歴を読み込み中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* ヘッダー */}
            <header className="bg-card border-b">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/"
                            className="p-2 hover:bg-accent rounded-lg"
                        >
                            <ArrowLeft className="w-6 h-6" />
                        </Link>
                        <h1 className="text-2xl font-bold">セッション履歴</h1>
                    </div>
                </div>
            </header>

            <main className="max-w-6xl mx-auto px-4 py-8">
                {/* 統計カード */}
                {stats && stats.total > 0 && (
                    <div className="space-y-4 mb-8">
                        {/* メイン統計 */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-card rounded-lg border p-6">
                                <div className="text-sm text-muted-foreground mb-1">
                                    完了セッション
                                </div>
                                <div className="text-3xl font-bold">
                                    {stats.total}
                                </div>
                            </div>
                            <div className="bg-card rounded-lg border p-6">
                                <div className="text-sm text-muted-foreground mb-1">
                                    総取引回数
                                </div>
                                <div className="text-3xl font-bold">
                                    {stats.totalTrades}
                                </div>
                            </div>
                            <div className="bg-card rounded-lg border p-6">
                                <div className="text-sm text-muted-foreground mb-1">
                                    平均勝率
                                </div>
                                <div className="text-3xl font-bold">
                                    {stats.avgWinRate.toFixed(1)}%
                                </div>
                            </div>
                            <div className="bg-card rounded-lg border p-6">
                                <div className="text-sm text-muted-foreground mb-1">
                                    利益セッション
                                </div>
                                <div className="text-3xl font-bold text-green-500">
                                    {stats.profitableSessions}/{stats.total}
                                </div>
                            </div>
                        </div>

                        {/* 損益統計 */}
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="bg-card rounded-lg border p-6">
                                <div className="text-sm text-muted-foreground mb-1">
                                    累計損益
                                </div>
                                <div
                                    className={`text-3xl font-bold ${
                                        stats.totalProfit >= 0
                                            ? "text-green-500"
                                            : "text-red-500"
                                    }`}
                                >
                                    {stats.totalProfit >= 0 ? "+" : ""}
                                    {stats.totalProfit.toFixed(1)}%
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                    {stats.totalProfitYen >= 0 ? "+" : ""}¥
                                    {stats.totalProfitYen.toLocaleString()}
                                </div>
                            </div>
                            <div className="bg-card rounded-lg border p-6">
                                <div className="text-sm text-muted-foreground mb-1">
                                    月利回り (20営業日)
                                </div>
                                <div
                                    className={`text-3xl font-bold ${
                                        stats.monthlyReturn >= 0
                                            ? "text-green-500"
                                            : "text-red-500"
                                    }`}
                                >
                                    {stats.monthlyReturn >= 0 ? "+" : ""}
                                    {stats.monthlyReturn.toFixed(2)}%
                                </div>
                            </div>
                            <div className="bg-card rounded-lg border p-6">
                                <div className="text-sm text-muted-foreground mb-1">
                                    最大利益
                                </div>
                                <div className="text-3xl font-bold text-green-500">
                                    +¥
                                    {stats.maxProfit.toLocaleString(undefined, {
                                        maximumFractionDigits: 0,
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* 詳細統計 */}
                        <div className="bg-card rounded-lg border p-6">
                            <h3 className="font-bold mb-4 text-lg">詳細統計</h3>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                                <div>
                                    <div className="text-muted-foreground mb-1">
                                        平均増益額
                                    </div>
                                    <div className="font-medium text-green-500 text-lg">
                                        +¥
                                        {stats.avgProfit.toLocaleString(
                                            undefined,
                                            { maximumFractionDigits: 0 },
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground mb-1">
                                        平均損失額
                                    </div>
                                    <div className="font-medium text-red-500 text-lg">
                                        ¥
                                        {stats.avgLoss.toLocaleString(
                                            undefined,
                                            { maximumFractionDigits: 0 },
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground mb-1">
                                        最大損失
                                    </div>
                                    <div className="font-medium text-red-500 text-lg">
                                        ¥
                                        {stats.maxLoss.toLocaleString(
                                            undefined,
                                            { maximumFractionDigits: 0 },
                                        )}
                                    </div>
                                </div>
                                <div>
                                    <div className="text-muted-foreground mb-1">
                                        損益比率
                                    </div>
                                    <div className="font-medium text-lg">
                                        {stats.avgLoss !== 0
                                            ? Math.abs(
                                                  stats.avgProfit /
                                                      stats.avgLoss,
                                              ).toFixed(2)
                                            : "∞"}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ソート */}
                <div className="bg-card rounded-lg border p-4 mb-6">
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium">並び替え:</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setSortBy("date")}
                                className={`px-4 py-2 rounded-lg text-sm transition ${
                                    sortBy === "date"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary hover:bg-secondary/80"
                                }`}
                            >
                                日付
                            </button>
                            <button
                                onClick={() => setSortBy("winRate")}
                                className={`px-4 py-2 rounded-lg text-sm transition ${
                                    sortBy === "winRate"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary hover:bg-secondary/80"
                                }`}
                            >
                                勝率
                            </button>
                            <button
                                onClick={() => setSortBy("profit")}
                                className={`px-4 py-2 rounded-lg text-sm transition ${
                                    sortBy === "profit"
                                        ? "bg-primary text-primary-foreground"
                                        : "bg-secondary hover:bg-secondary/80"
                                }`}
                            >
                                損益
                            </button>
                        </div>
                    </div>
                </div>

                {/* セッション一覧 */}
                {sortedSessions && sortedSessions.length > 0 ? (
                    <div className="grid gap-4">
                        {sortedSessions.map((session) => {
                            const profit =
                                ((session.currentCapital -
                                    session.initialCapital) /
                                    session.initialCapital) *
                                100;
                            const isProfitable = profit >= 0;
                            const profitYen =
                                session.currentCapital - session.initialCapital;

                            // 月利回り（20営業日換算）
                            const monthlyReturn =
                                session.periodDays > 0
                                    ? (profit / session.periodDays) * 20
                                    : 0;

                            // 平均増益額と平均損失額
                            const closedPositions = (
                                session.positions || []
                            ).filter((p: any) => p.status === "closed");
                            const profits = closedPositions.filter(
                                (p: any) => (p.profit || 0) > 0,
                            );
                            const losses = closedPositions.filter(
                                (p: any) => (p.profit || 0) < 0,
                            );
                            const avgProfit =
                                profits.length > 0
                                    ? profits.reduce(
                                          (sum, p: any) =>
                                              sum + (p.profit || 0),
                                          0,
                                      ) / profits.length
                                    : 0;
                            const avgLoss =
                                losses.length > 0
                                    ? losses.reduce(
                                          (sum, p: any) =>
                                              sum + (p.profit || 0),
                                          0,
                                      ) / losses.length
                                    : 0;

                            return (
                                <div
                                    key={session.id}
                                    className="relative bg-card rounded-lg border hover:bg-accent transition"
                                >
                                    {/* 削除ボタン */}
                                    <button
                                        onClick={(e) =>
                                            handleDelete(
                                                session.id!,
                                                `${session.stockName} (${session.symbol})`,
                                                e,
                                            )
                                        }
                                        className="absolute top-4 right-4 p-2 hover:bg-destructive/20 rounded-lg transition z-10"
                                        title="削除"
                                    >
                                        <Trash2 className="w-5 h-5 text-destructive" />
                                    </button>

                                    <Link
                                        href={`/session/${session.id}`}
                                        className="block p-6 pr-16"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            {/* 左側 - 基本情報 */}
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-xl font-bold">
                                                        {session.stockName}
                                                    </h3>
                                                    <span className="text-muted-foreground">
                                                        ({session.symbol})
                                                    </span>
                                                </div>

                                                <div className="text-sm text-muted-foreground mb-4">
                                                    {new Date(
                                                        session.createdAt ||
                                                            session.startDate,
                                                    ).toLocaleDateString(
                                                        "ja-JP",
                                                        {
                                                            year: "numeric",
                                                            month: "long",
                                                            day: "numeric",
                                                            hour: "2-digit",
                                                            minute: "2-digit",
                                                        },
                                                    )}{" "}
                                                    開始
                                                </div>

                                                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">
                                                            練習期間
                                                        </div>
                                                        <div className="font-medium">
                                                            {session.periodDays}
                                                            日
                                                        </div>
                                                        {(session.practiceStartDate ||
                                                            session.startDateOfData) && (
                                                            <div className="text-xs text-muted-foreground mt-0.5">
                                                                {new Date(
                                                                    session.practiceStartDate ||
                                                                        session.startDateOfData,
                                                                ).toLocaleDateString(
                                                                    "ja-JP",
                                                                    {
                                                                        year: "numeric",
                                                                        month: "short",
                                                                        day: "numeric",
                                                                    },
                                                                )}
                                                                〜
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">
                                                            取引回数
                                                        </div>
                                                        <div className="font-medium">
                                                            {session.tradeCount}
                                                            回
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">
                                                            勝率
                                                        </div>
                                                        <div className="font-medium">
                                                            {session.winRate.toFixed(
                                                                1,
                                                            )}
                                                            %
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">
                                                            月利回り
                                                        </div>
                                                        <div
                                                            className={`font-medium ${monthlyReturn >= 0 ? "text-green-500" : "text-red-500"}`}
                                                        >
                                                            {monthlyReturn >= 0
                                                                ? "+"
                                                                : ""}
                                                            {monthlyReturn.toFixed(
                                                                2,
                                                            )}
                                                            %
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-xs text-muted-foreground">
                                                            違反
                                                        </div>
                                                        <div className="font-medium text-red-500">
                                                            {
                                                                session.ruleViolations
                                                            }
                                                            回
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 追加統計 */}
                                                <div className="mt-4 pt-4 border-t grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                                    <div>
                                                        <div className="text-muted-foreground mb-0.5">
                                                            平均増益額
                                                        </div>
                                                        <div className="font-medium text-green-500">
                                                            +¥
                                                            {avgProfit.toLocaleString(
                                                                undefined,
                                                                {
                                                                    maximumFractionDigits: 0,
                                                                },
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground mb-0.5">
                                                            平均損失額
                                                        </div>
                                                        <div className="font-medium text-red-500">
                                                            ¥
                                                            {avgLoss.toLocaleString(
                                                                undefined,
                                                                {
                                                                    maximumFractionDigits: 0,
                                                                },
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground mb-0.5">
                                                            損益比率
                                                        </div>
                                                        <div className="font-medium">
                                                            {avgLoss !== 0
                                                                ? Math.abs(
                                                                      avgProfit /
                                                                          avgLoss,
                                                                  ).toFixed(2)
                                                                : "∞"}
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <div className="text-muted-foreground mb-0.5">
                                                            総損益
                                                        </div>
                                                        <div
                                                            className={`font-medium ${isProfitable ? "text-green-500" : "text-red-500"}`}
                                                        >
                                                            {isProfitable
                                                                ? "+"
                                                                : ""}
                                                            ¥
                                                            {profitYen.toLocaleString()}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 感想・反省 */}
                                                {session.reflection && (
                                                    <div className="mt-4 pt-4 border-t">
                                                        <div className="flex items-start gap-2">
                                                            <FileText className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-xs text-muted-foreground mb-1">
                                                                    感想・反省
                                                                </div>
                                                                <div className="text-sm text-foreground break-words line-clamp-3">
                                                                    {
                                                                        session.reflection
                                                                    }
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 右側 - 損益と編集ボタン */}
                                            <div className="text-right flex flex-col items-end">
                                                <button
                                                    onClick={(e) =>
                                                        handleOpenReflection(
                                                            session,
                                                            e,
                                                        )
                                                    }
                                                    className="mb-2 p-2 hover:bg-accent rounded-md transition-colors"
                                                    title={
                                                        session.reflection
                                                            ? "感想を編集"
                                                            : "感想を追加"
                                                    }
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <div className="flex items-center justify-end gap-2 mb-2">
                                                    {isProfitable ? (
                                                        <TrendingUp className="w-6 h-6 text-green-500" />
                                                    ) : (
                                                        <TrendingDown className="w-6 h-6 text-red-500" />
                                                    )}
                                                </div>
                                                <div
                                                    className={`text-3xl font-bold ${
                                                        isProfitable
                                                            ? "text-green-500"
                                                            : "text-red-500"
                                                    }`}
                                                >
                                                    {isProfitable ? "+" : ""}
                                                    {profit.toFixed(2)}%
                                                </div>
                                                <div className="text-sm text-muted-foreground mt-1">
                                                    ¥
                                                    {session.currentCapital.toLocaleString()}
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-card rounded-lg border p-12 text-center">
                        <div className="text-muted-foreground mb-4">
                            <TrendingUp className="w-16 h-16 mx-auto opacity-50" />
                        </div>
                        <p className="text-muted-foreground mb-2">
                            完了したセッションがありません
                        </p>
                        <p className="text-sm text-muted-foreground">
                            セッションを完了すると、ここに履歴が表示されます
                        </p>
                    </div>
                )}

                {/* 未完了セッション一覧 */}
                {incompleteSessions.length > 0 && (
                    <div className="mt-12">
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Clock className="w-5 h-5 text-muted-foreground" />
                            未完了セッション ({incompleteSessions.length}件)
                        </h2>
                        <div className="grid gap-3">
                            {incompleteSessions.map((session) => (
                                <div
                                    key={session.id}
                                    className="relative bg-card rounded-lg border hover:bg-accent transition"
                                >
                                    {/* 削除ボタン */}
                                    <button
                                        onClick={(e) =>
                                            handleDelete(
                                                session.id!,
                                                `${session.stockName} (${session.symbol})`,
                                                e,
                                            )
                                        }
                                        className="absolute top-3 right-3 p-2 hover:bg-destructive/20 rounded-lg transition z-10"
                                        title="削除"
                                    >
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                    </button>

                                    <Link
                                        href={`/session/${session.id}`}
                                        className="block p-4 pr-14"
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-medium">
                                                        {session.stockName}
                                                    </span>
                                                    <span className="text-sm text-muted-foreground">
                                                        ({session.symbol})
                                                    </span>
                                                </div>
                                                <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                                                    <span>
                                                        {new Date(
                                                            session.createdAt ||
                                                                session.startDate,
                                                        ).toLocaleDateString(
                                                            "ja-JP",
                                                            {
                                                                month: "short",
                                                                day: "numeric",
                                                                hour: "2-digit",
                                                                minute: "2-digit",
                                                            },
                                                        )}
                                                    </span>
                                                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                                        {session.periodDays}日間
                                                    </span>
                                                    {(session.practiceStartDate ||
                                                        session.startDateOfData) && (
                                                        <span className="text-xs">
                                                            (
                                                            {new Date(
                                                                session.practiceStartDate ||
                                                                    session.startDateOfData,
                                                            ).toLocaleDateString(
                                                                "ja-JP",
                                                                {
                                                                    year: "numeric",
                                                                    month: "short",
                                                                    day: "numeric",
                                                                },
                                                            )}
                                                            〜)
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <div className="text-sm font-medium text-primary">
                                                    進行中 (
                                                    {session.currentDay || 0}/
                                                    {session.periodDays}日)
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {session.tradeCount || 0}
                                                    回取引
                                                </div>
                                            </div>
                                        </div>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>

            {/* 感想・反省モーダル */}
            {isReflectionModalOpen && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
                    onClick={() => setIsReflectionModalOpen(false)}
                >
                    <div
                        className="bg-background rounded-t-2xl sm:rounded-lg p-6 max-w-2xl w-full flex flex-col max-h-[90vh] sm:max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h2 className="text-xl font-bold mb-4">
                            セッションの感想・反省
                        </h2>
                        <p className="text-sm text-muted-foreground mb-4">
                            このセッションで気づいたこと、良かった点、改善点などを記録しましょう
                        </p>
                        <div className="flex-1 overflow-y-auto mb-4">
                            <textarea
                                value={reflection}
                                onChange={(e) => setReflection(e.target.value)}
                                onFocus={(e) => {
                                    setTimeout(() => {
                                        e.target.scrollIntoView({
                                            behavior: "smooth",
                                            block: "center",
                                        });
                                    }, 300);
                                }}
                                className="w-full h-48 p-3 border rounded-md resize-none text-base"
                                placeholder="例：&#10;・エントリータイミングが早すぎた&#10;・損切りルールを守れた&#10;・次回は移動平均線のクロスを待ってから入る"
                                style={{ fontSize: "16px" }}
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSaveReflection}
                                className="flex-1 bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition"
                            >
                                保存
                            </button>
                            <button
                                onClick={() => setIsReflectionModalOpen(false)}
                                className="px-4 py-2 border rounded-md hover:bg-accent transition"
                            >
                                キャンセル
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
