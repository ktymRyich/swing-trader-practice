"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
    ConfirmDialog,
    AlertDialogSimple,
} from "@/components/ui/confirm-dialog";
import { generateSessionId } from "@/lib/db/schema";
import StatsOverview from "./components/StatsOverview";
import SessionsTable from "./components/SessionsTable";
import IncompleteSessionsList from "./components/IncompleteSessionsList";
import SessionDetailModal from "./components/SessionDetailModal";

export default function HistoryPage() {
    const router = useRouter();
    const [nickname, setNickname] = useState<string | null>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [incompleteSessions, setIncompleteSessions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sortBy, setSortBy] = useState<"date" | "winRate" | "profit">("date");
    const [filterBy, setFilterBy] = useState<"all" | "bookmarked">("all");
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [replayingSessionId, setReplayingSessionId] = useState<string | null>(
        null,
    );

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

    const handleOpenDetail = (session: any, e?: React.MouseEvent) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        setSelectedSession(session);
        setIsDetailModalOpen(true);
    };

    const handleSaveReflection = async (reflection: string) => {
        if (!nickname || !selectedSession) return;

        try {
            const getResponse = await fetch(
                `/api/sessions/${selectedSession.id}?nickname=${nickname}`,
            );
            const getData = await getResponse.json();

            if (!getData.success) {
                alert("セッション情報の取得に失敗しました");
                return;
            }

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
                loadSessions(nickname);
                setSelectedSession(updatedSession);
            } else {
                alert("保存に失敗しました");
            }
        } catch (error) {
            console.error("感想保存エラー:", error);
            alert("保存中にエラーが発生しました");
        }
    };

    const handleReplay = async (session: any, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!nickname) {
            alert("ログインが必要です");
            return;
        }

        setReplayingSessionId(session.id);

        try {
            const sessionId = generateSessionId();
            const startDateOfData =
                session.startDateOfData || session.startDate;
            const endDateOfData =
                session.endDateOfData || session.endDate || session.startDate;
            const practiceStartDate =
                session.practiceStartDate || startDateOfData;

            if (!startDateOfData || !endDateOfData) {
                alert("期間情報が不足しているため再プレイできません");
                return;
            }

            const replaySession = {
                id: sessionId,
                nickname,
                startDate: new Date().toISOString(),
                symbol: session.symbol,
                stockName: session.stockName,
                stockSector: session.stockSector,
                stockDescription: session.stockDescription,
                stockMarketCapEstimate: session.stockMarketCapEstimate,
                periodDays: session.periodDays,
                initialCapital: session.initialCapital ?? 1500000,
                currentCapital: session.initialCapital ?? 1500000,
                playbackSpeed: session.playbackSpeed ?? 5,
                status: "paused" as const,
                currentDay: 0,
                practiceStartIndex: session.practiceStartIndex ?? 0,
                practiceStartDate,
                startDateOfData,
                endDateOfData,
                tradeCount: 0,
                winCount: 0,
                winRate: 0,
                maxDrawdown: 0,
                ruleViolations: 0,
                isBookmarked: false,
                maSettings: session.maSettings || [5, 10, 20, 50, 100],
                positions: [],
                trades: [],
                violations: [],
            };

            const saveResponse = await fetch("/api/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(replaySession),
            });

            const saveData = await saveResponse.json();

            if (!saveData.success) {
                throw new Error("再プレイセッションの作成に失敗しました");
            }

            router.push(`/session/${sessionId}`);
        } catch (error) {
            console.error("再プレイ作成エラー:", error);
            alert(
                error instanceof Error
                    ? error.message
                    : "再プレイの作成に失敗しました",
            );
        } finally {
            setReplayingSessionId(null);
        }
    };

    const handleToggleBookmark = async (session: any, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (!nickname) {
            alert("ログインが必要です");
            return;
        }

        const nextValue = !session.isBookmarked;
        const updatedSession = { ...session, isBookmarked: nextValue };

        setSessions((prev) =>
            prev.map((s) => (s.id === session.id ? updatedSession : s)),
        );
        if (selectedSession?.id === session.id) {
            setSelectedSession(updatedSession);
        }

        try {
            const response = await fetch(`/api/sessions/${session.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nickname,
                    session: updatedSession,
                }),
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error("ブックマークの更新に失敗しました");
            }
        } catch (error) {
            console.error("ブックマーク更新エラー:", error);
            setSessions((prev) =>
                prev.map((s) =>
                    s.id === session.id
                        ? { ...s, isBookmarked: !nextValue }
                        : s,
                ),
            );
            if (selectedSession?.id === session.id) {
                setSelectedSession((prev: any) =>
                    prev ? { ...prev, isBookmarked: !nextValue } : prev,
                );
            }
            alert(
                error instanceof Error
                    ? error.message
                    : "ブックマークの更新に失敗しました",
            );
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
            const response = await fetch(`/api/sessions?nickname=${nickname}`);
            const data = await response.json();

            if (data.success) {
                const allSessions = data.sessions || [];
                const updatedSessions = allSessions.filter(
                    (s: any) => s.id !== sessionId,
                );

                const deletedCount =
                    allSessions.length - updatedSessions.length;
                if (deletedCount !== 1) {
                    alert(
                        `エラー: 削除対象は1件ですが、${deletedCount}件が削除されようとしています。削除を中止しました。`,
                    );
                    return;
                }

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

    const filteredSessions = (sortedSessions || []).filter((session) => {
        if (filterBy === "bookmarked") {
            return session.isBookmarked;
        }
        return true;
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

                  const totalProfitYen = sessions.reduce(
                      (sum, s) => sum + (s.currentCapital - s.initialCapital),
                      0,
                  );

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

                  const allProfits = allClosedPositions.map(
                      (p: any) => p.profit || 0,
                  );
                  const maxProfit =
                      allProfits.length > 0 ? Math.max(...allProfits) : 0;

                  const avgProfitLoss =
                      allClosedPositions.length > 0
                          ? allClosedPositions.reduce(
                                (sum, p: any) => sum + (p.profit || 0),
                                0,
                            ) / allClosedPositions.length
                          : 0;

                  // 平均損益率（建玉金額に対する割合）
                  const avgProfitLossRate =
                      allClosedPositions.length > 0
                          ? allClosedPositions.reduce((sum, p: any) => {
                                const entryAmount =
                                    (p.entryPrice || 0) * (p.shares || 0);
                                const rate =
                                    entryAmount > 0
                                        ? ((p.profit || 0) / entryAmount) * 100
                                        : 0;
                                return sum + rate;
                            }, 0) / allClosedPositions.length
                          : 0;

                  // 150万円基準の総利益率
                  const baseCapital = 1500000;
                  const totalReturnOnBase =
                      (totalProfitYen / baseCapital) * 100;

                  // 150万円基準のセッション平均利益率
                  const avgSessionReturnOnBase =
                      sessions.length > 0
                          ? sessions.reduce((sum, s) => {
                                const sessionProfit =
                                    s.currentCapital - s.initialCapital;
                                return (
                                    sum + (sessionProfit / baseCapital) * 100
                                );
                            }, 0) / sessions.length
                          : 0;

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
                      avgProfitLoss,
                      avgProfitLossRate,
                      totalReturnOnBase,
                      avgSessionReturnOnBase,
                      avgProfit,
                      avgLoss,
                      maxProfit,
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

            <main className="max-w-7xl mx-auto px-4 py-6">
                <StatsOverview stats={stats} />

                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setFilterBy("all")}
                            className={`px-3 py-1.5 rounded text-xs transition ${
                                filterBy === "all"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary hover:bg-secondary/80"
                            }`}
                        >
                            すべて
                        </button>
                        <button
                            onClick={() => setFilterBy("bookmarked")}
                            className={`px-3 py-1.5 rounded text-xs transition ${
                                filterBy === "bookmarked"
                                    ? "bg-primary text-primary-foreground"
                                    : "bg-secondary hover:bg-secondary/80"
                            }`}
                        >
                            ブックマーク
                        </button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        表示: {filteredSessions.length}件
                    </div>
                </div>

                <SessionsTable
                    sessions={filteredSessions}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    onReflectionOpen={handleOpenDetail}
                    onReplay={handleReplay}
                    onToggleBookmark={handleToggleBookmark}
                    onDelete={handleDelete}
                    replayingSessionId={replayingSessionId}
                />

                <IncompleteSessionsList
                    sessions={incompleteSessions}
                    onDelete={handleDelete}
                />
            </main>

            <SessionDetailModal
                isOpen={isDetailModalOpen}
                session={selectedSession}
                nickname={nickname || ""}
                onClose={() => setIsDetailModalOpen(false)}
                onReflectionSave={handleSaveReflection}
            />

            <ConfirmDialog
                open={deleteDialog.open}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteDialog({
                            open: false,
                            sessionId: "",
                            sessionName: "",
                        });
                    }
                }}
                title="セッションの削除"
                description={`${deleteDialog.sessionName}を削除してもよろしいですか？この操作は取り消せません。`}
                onConfirm={async () => {
                    const sessionId = deleteDialog.sessionId;
                    setDeleteDialog({
                        open: false,
                        sessionId: "",
                        sessionName: "",
                    });
                    await handleDelete(
                        sessionId,
                        "",
                        new MouseEvent("click") as any,
                    );
                }}
            />
            <AlertDialogSimple
                open={alertDialog.open}
                onOpenChange={(open) => {
                    if (!open) {
                        setAlertDialog({
                            open: false,
                            title: "",
                            description: "",
                        });
                    }
                }}
                title={alertDialog.title}
                description={alertDialog.description}
            />
        </div>
    );
}
