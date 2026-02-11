"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ImageDown, CalendarIcon } from "lucide-react";
import { toPng } from "html-to-image";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import {
    ConfirmDialog,
    AlertDialogSimple,
} from "@/components/ui/confirm-dialog";
import { generateSessionId } from "@/lib/db/schema";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import StatsOverview from "./components/StatsOverview";
import SessionsTable from "./components/SessionsTable";
import IncompleteSessionsList from "./components/IncompleteSessionsList";
import SessionDetailModal from "./components/SessionDetailModal";

type ClusterSummary = {
    id: string;
    label: string;
    color: string;
    sessionIds: string[];
};

type ClusterMapEntry = {
    label: string;
    color: string;
    clusterId: string;
};

const CLUSTER_COUNT = 4;

export default function HistoryPage() {
    const router = useRouter();
    const [nickname, setNickname] = useState<string | null>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [incompleteSessions, setIncompleteSessions] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [sortBy, setSortBy] = useState<"date" | "winRate" | "profit">("date");
    const [filterBy, setFilterBy] = useState<"all" | "bookmarked">("all");
    const [clusters, setClusters] = useState<ClusterSummary[]>([]);
    const [clusterMap, setClusterMap] = useState<
        Record<string, ClusterMapEntry>
    >({});
    const [clusterFilter, setClusterFilter] = useState<string | "all">("all");
    const [isClusterLoading, setIsClusterLoading] = useState(false);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
    const [selectedSession, setSelectedSession] = useState<any>(null);
    const [replayingSessionId, setReplayingSessionId] = useState<string | null>(
        null,
    );
    const [isCopyingImage, setIsCopyingImage] = useState(false);
    const todaySummaryRef = useRef<HTMLDivElement | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const isSameLocalDay = (date: Date, target: Date) =>
        date.getFullYear() === target.getFullYear() &&
        date.getMonth() === target.getMonth() &&
        date.getDate() === target.getDate();

    const buildStats = (sourceSessions: any[]) => {
        if (!sourceSessions.length) return null;

        const totalSessions = sourceSessions.length;
        const totalTrades = sourceSessions.reduce(
            (sum, s) => sum + (s.tradeCount || 0),
            0,
        );

        const allClosedPositions = sourceSessions.flatMap((s) =>
            (s.positions || []).filter((p: any) => p.status === "closed"),
        );
        const totalClosed = allClosedPositions.length;
        const wins = allClosedPositions.filter((p: any) => (p.profit || 0) > 0);
        const losses = allClosedPositions.filter(
            (p: any) => (p.profit || 0) < 0,
        );

        const winCount = wins.length;
        const lossCount = losses.length;
        const winRate = totalClosed > 0 ? (winCount / totalClosed) * 100 : 0;

        const sumWin = wins.reduce((sum, p: any) => sum + (p.profit || 0), 0);
        const sumLoss = losses.reduce(
            (sum, p: any) => sum + (p.profit || 0),
            0,
        );

        const avgWin = winCount > 0 ? sumWin / winCount : 0;
        const avgLoss = lossCount > 0 ? sumLoss / lossCount : 0;

        const profitFactor =
            Math.abs(sumLoss) > 0
                ? sumWin / Math.abs(sumLoss)
                : sumWin > 0
                  ? Infinity
                  : 0;
        const profitLossRatio =
            avgLoss !== 0 ? Math.abs(avgWin / avgLoss) : Infinity;

        // セッションごとの損益率を計算して平均を取る
        const profitRates = sourceSessions.map((s) => {
            const profit = s.currentCapital - s.initialCapital;
            return (profit / s.initialCapital) * 100;
        });
        const avgProfitRate =
            profitRates.reduce((sum, rate) => sum + rate, 0) / totalSessions;

        return {
            totalSessions,
            totalTrades,
            totalClosed,
            winRate,
            profitFactor,
            profitLossRatio,
            avgProfitRate,
        };
    };

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

    useEffect(() => {
        const loadClusters = async () => {
            if (!nickname || sessions.length === 0) {
                setClusters([]);
                setClusterMap({});
                return;
            }

            setIsClusterLoading(true);

            try {
                const response = await fetch(
                    `/api/sessions/ma-clusters?nickname=${nickname}&k=${CLUSTER_COUNT}`,
                );
                const data = await response.json();

                if (!data.success) {
                    throw new Error(data.error || "クラスタ取得に失敗しました");
                }

                setClusters(data.clusters || []);
                setClusterMap(data.clusterMap || {});
                setClusterFilter("all");
            } catch (error) {
                console.error("クラスタ取得エラー:", error);
                setClusters([]);
                setClusterMap({});
            } finally {
                setIsClusterLoading(false);
            }
        };

        loadClusters();
    }, [nickname, sessions.length]);

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
        const bookmarkMatch =
            filterBy === "bookmarked" ? session.isBookmarked : true;
        const clusterMatch =
            clusterFilter === "all"
                ? true
                : clusterMap[session.id]?.clusterId === clusterFilter;
        return bookmarkMatch && clusterMatch;
    });

    // 統計計算
    const stats = buildStats(sessions);

    const today = new Date();
    const todaysSessions = sessions.filter((session) => {
        const rawDate = session.createdAt || session.startDate;
        if (!rawDate) return false;
        const date = new Date(rawDate);
        return !Number.isNaN(date.getTime()) && isSameLocalDay(date, today);
    });
    const todayStats = buildStats(todaysSessions);
    const todayLabel = today.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

    // 選択した日付のセッション
    const selectedDateSessions = sessions.filter((session) => {
        const rawDate = session.createdAt || session.startDate;
        if (!rawDate) return false;
        const date = new Date(rawDate);
        return (
            !Number.isNaN(date.getTime()) && isSameLocalDay(date, selectedDate)
        );
    });
    const selectedDateStats = buildStats(selectedDateSessions);
    const selectedDateLabel = selectedDate.toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

    const handleCopyTodayImage = async () => {
        if (!todaySummaryRef.current) return;
        if (isCopyingImage) return;

        if (
            typeof window === "undefined" ||
            !navigator.clipboard ||
            typeof (window as any).ClipboardItem === "undefined"
        ) {
            setAlertDialog({
                open: true,
                title: "コピーできません",
                description:
                    "このブラウザでは画像コピーがサポートされていません。",
            });
            return;
        }

        try {
            setIsCopyingImage(true);
            const dataUrl = await toPng(todaySummaryRef.current, {
                cacheBust: true,
                pixelRatio: 2,
                backgroundColor: "hsl(0 0% 3.9%)",
            });
            const response = await fetch(dataUrl);
            const blob = await response.blob();

            await navigator.clipboard.write([
                new (window as any).ClipboardItem({
                    "image/png": blob,
                }),
            ]);

            setAlertDialog({
                open: true,
                title: "コピーしました",
                description: `${selectedDateLabel}のまとめを画像としてクリップボードにコピーしました。`,
            });
        } catch (error) {
            console.error("画像コピーに失敗しました:", error);
            setAlertDialog({
                open: true,
                title: "コピーに失敗しました",
                description:
                    "画像の生成に失敗しました。もう一度お試しください。",
            });
        } finally {
            setIsCopyingImage(false);
        }
    };

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
                <section className="mb-8">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-xl font-bold">日別まとめ</h2>
                        <div className="flex items-center gap-2">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="justify-start text-left font-normal"
                                    >
                                        <CalendarIcon className="mr-2 h-4 w-4" />
                                        {format(
                                            selectedDate,
                                            "yyyy年M月d日 (E)",
                                            { locale: ja },
                                        )}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent
                                    className="w-auto p-0"
                                    align="end"
                                >
                                    <Calendar
                                        mode="single"
                                        selected={selectedDate}
                                        onSelect={(date) =>
                                            date && setSelectedDate(date)
                                        }
                                        defaultMonth={selectedDate}
                                        disabled={(date) => date > new Date()}
                                    />
                                </PopoverContent>
                            </Popover>
                            <button
                                onClick={handleCopyTodayImage}
                                disabled={isCopyingImage}
                                className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-muted-foreground/50 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                title="選択した日のまとめを画像コピー"
                            >
                                {isCopyingImage ? (
                                    <span className="w-3.5 h-3.5 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <ImageDown className="w-3.5 h-3.5" />
                                )}
                                画像コピー
                            </button>
                        </div>
                    </div>
                    {selectedDateStats ? (
                        <div ref={todaySummaryRef} className="space-y-3">
                            <StatsOverview
                                stats={selectedDateStats}
                                title={`${selectedDateLabel}のサマリー`}
                            />
                            <div className="bg-card rounded-lg border overflow-hidden">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                        <thead className="bg-muted/50 border-b">
                                            <tr>
                                                <th className="text-left p-3 font-medium">
                                                    銘柄
                                                </th>
                                                <th className="text-left p-3 font-medium">
                                                    練習期間
                                                </th>
                                                <th className="text-right p-3 font-medium">
                                                    元手
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
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {selectedDateSessions.map(
                                                (session) => {
                                                    const profitYen =
                                                        session.currentCapital -
                                                        session.initialCapital;
                                                    const profitPercent =
                                                        (profitYen /
                                                            session.initialCapital) *
                                                        100;
                                                    const practiceStart =
                                                        session.practiceStartDate ||
                                                        session.startDateOfData;
                                                    const practiceEnd =
                                                        session.endDateOfData;
                                                    const practiceLabel =
                                                        practiceStart &&
                                                        practiceEnd
                                                            ? `${new Date(
                                                                  practiceStart,
                                                              ).toLocaleDateString(
                                                                  "ja-JP",
                                                                  {
                                                                      year: "numeric",
                                                                      month: "short",
                                                                      day: "numeric",
                                                                  },
                                                              )} 〜 ${new Date(
                                                                  practiceEnd,
                                                              ).toLocaleDateString(
                                                                  "ja-JP",
                                                                  {
                                                                      year: "numeric",
                                                                      month: "short",
                                                                      day: "numeric",
                                                                  },
                                                              )}`
                                                            : "-";

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
                                                                    {
                                                                        session.stockName
                                                                    }
                                                                    <span className="text-xs text-muted-foreground ml-2">
                                                                        (
                                                                        {
                                                                            session.symbol
                                                                        }
                                                                        )
                                                                    </span>
                                                                </Link>
                                                            </td>
                                                            <td className="p-3 text-sm text-muted-foreground">
                                                                {practiceLabel}
                                                            </td>
                                                            <td className="p-3 text-right">
                                                                ¥
                                                                {session.initialCapital.toLocaleString()}
                                                            </td>
                                                            <td className="p-3 text-right">
                                                                {
                                                                    session.tradeCount
                                                                }
                                                            </td>
                                                            <td className="p-3 text-right font-medium">
                                                                {session.winRate.toFixed(
                                                                    1,
                                                                )}
                                                                %
                                                            </td>
                                                            <td className="p-3 text-right">
                                                                <div
                                                                    className={`font-medium ${profitYen >= 0 ? "text-green-500" : "text-red-500"}`}
                                                                >
                                                                    {profitYen >=
                                                                    0
                                                                        ? "+"
                                                                        : ""}
                                                                    {profitPercent.toFixed(
                                                                        1,
                                                                    )}
                                                                    %
                                                                </div>
                                                                <div className="text-xs text-muted-foreground">
                                                                    {profitYen >=
                                                                    0
                                                                        ? "+"
                                                                        : ""}
                                                                    ¥
                                                                    {profitYen.toLocaleString()}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                },
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-card rounded-lg border p-6 text-sm text-muted-foreground">
                            {selectedDateLabel}の完了セッションはありません
                        </div>
                    )}
                </section>

                <StatsOverview stats={stats} title="全期間サマリー" />

                <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                    <div className="flex flex-wrap items-center gap-2">
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
                            BM
                        </button>
                        <span className="px-3 py-1.5 rounded-full text-xs border border-muted-foreground/30 text-muted-foreground">
                            4分類
                        </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                        表示: {filteredSessions.length}件
                    </div>
                </div>

                {clusters.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 mb-4">
                        <button
                            onClick={() => setClusterFilter("all")}
                            className={`px-3 py-1.5 rounded-full text-xs border transition ${
                                clusterFilter === "all"
                                    ? "border-primary text-primary"
                                    : "border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground"
                            }`}
                        >
                            全クラスタ
                        </button>
                        {clusters.map((cluster) => (
                            <button
                                key={cluster.id}
                                onClick={() => setClusterFilter(cluster.id)}
                                className="px-3 py-1.5 rounded-full text-xs border transition"
                                style={{
                                    borderColor: cluster.color,
                                    color: cluster.color,
                                    backgroundColor:
                                        clusterFilter === cluster.id
                                            ? `${cluster.color}1A`
                                            : "transparent",
                                }}
                            >
                                {cluster.label} ({cluster.sessionIds.length})
                            </button>
                        ))}
                        {isClusterLoading && (
                            <span className="text-xs text-muted-foreground">
                                分類中...
                            </span>
                        )}
                    </div>
                )}

                <SessionsTable
                    sessions={filteredSessions}
                    sortBy={sortBy}
                    onSortChange={setSortBy}
                    onReflectionOpen={handleOpenDetail}
                    onReplay={handleReplay}
                    onToggleBookmark={handleToggleBookmark}
                    onDelete={handleDelete}
                    replayingSessionId={replayingSessionId}
                    clusterMap={clusterMap}
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
