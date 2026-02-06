"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import DailyPerformanceChart from "./DailyPerformanceChart";
import DailyStatsTable from "./DailyStatsTable";
import { calculateDailyStats, DailyStats } from "./utils/dailyStats";
import { Trade, Position, RuleViolation } from "@/lib/db/schema";

interface SessionDetailModalProps {
    isOpen: boolean;
    session: any;
    nickname: string;
    onClose: () => void;
    onReflectionSave: (reflection: string) => void;
}

type TabType = "overview" | "daily" | "trades" | "violations" | "reflection";

export default function SessionDetailModal({
    isOpen,
    session,
    nickname,
    onClose,
    onReflectionSave,
}: SessionDetailModalProps) {
    const [activeTab, setActiveTab] = useState<TabType>("overview");
    const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
    const [reflection, setReflection] = useState("");
    const [isEditingReflection, setIsEditingReflection] = useState(false);

    useEffect(() => {
        if (session && isOpen) {
            setReflection(session.reflection || "");
            setIsEditingReflection(!session.reflection);

            // 日次統計を計算
            if (session.trades && session.positions) {
                const stats = calculateDailyStats(
                    session.trades,
                    session.positions,
                    session.initialCapital,
                );
                setDailyStats(stats);
            }
        }
    }, [session, isOpen]);

    if (!isOpen || !session) return null;

    const profitYen = session.currentCapital - session.initialCapital;
    const profitPercent = (profitYen / session.initialCapital) * 100;

    const handleSaveReflection = () => {
        onReflectionSave(reflection);
        setIsEditingReflection(false);
    };

    const tabs = [
        { id: "overview" as TabType, label: "概要" },
        { id: "daily" as TabType, label: "日次分析" },
        { id: "trades" as TabType, label: "全取引" },
        { id: "violations" as TabType, label: "ルール違反" },
        { id: "reflection" as TabType, label: "反省" },
    ];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-background rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
                {/* ヘッダー */}
                <div className="flex items-center justify-between p-4 border-b">
                    <div>
                        <h2 className="text-xl font-bold">
                            {session.stockName}
                        </h2>
                        <p className="text-sm text-muted-foreground">
                            {new Date(session.startDate).toLocaleDateString(
                                "ja-JP",
                            )}{" "}
                            - 期間: {session.periodDays}日
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-accent rounded-lg"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* タブナビゲーション */}
                <div className="flex border-b">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`px-6 py-3 font-medium transition-colors ${
                                activeTab === tab.id
                                    ? "border-b-2 border-primary text-primary"
                                    : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* タブコンテンツ */}
                <div className="flex-1 overflow-y-auto p-6">
                    {activeTab === "overview" && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-card rounded-lg border p-4">
                                    <div className="text-xs text-muted-foreground mb-1">
                                        初期資金
                                    </div>
                                    <div className="text-lg font-semibold">
                                        {session.initialCapital.toLocaleString()}
                                        円
                                    </div>
                                </div>
                                <div className="bg-card rounded-lg border p-4">
                                    <div className="text-xs text-muted-foreground mb-1">
                                        最終資金
                                    </div>
                                    <div className="text-lg font-semibold">
                                        {session.currentCapital.toLocaleString()}
                                        円
                                    </div>
                                </div>
                                <div className="bg-card rounded-lg border p-4">
                                    <div className="text-xs text-muted-foreground mb-1">
                                        損益
                                    </div>
                                    <div
                                        className={`text-lg font-semibold ${profitYen > 0 ? "text-green-600" : profitYen < 0 ? "text-red-600" : ""}`}
                                    >
                                        {profitYen > 0 && "+"}
                                        {profitYen.toLocaleString()}円
                                    </div>
                                </div>
                                <div className="bg-card rounded-lg border p-4">
                                    <div className="text-xs text-muted-foreground mb-1">
                                        損益率
                                    </div>
                                    <div
                                        className={`text-lg font-semibold ${profitPercent > 0 ? "text-green-600" : profitPercent < 0 ? "text-red-600" : ""}`}
                                    >
                                        {profitPercent > 0 && "+"}
                                        {profitPercent.toFixed(2)}%
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="bg-card rounded-lg border p-4">
                                    <div className="text-xs text-muted-foreground mb-1">
                                        取引数
                                    </div>
                                    <div className="text-lg font-semibold">
                                        {session.tradeCount}回
                                    </div>
                                </div>
                                <div className="bg-card rounded-lg border p-4">
                                    <div className="text-xs text-muted-foreground mb-1">
                                        勝率
                                    </div>
                                    <div className="text-lg font-semibold">
                                        {session.winRate.toFixed(1)}%
                                    </div>
                                </div>
                                <div className="bg-card rounded-lg border p-4">
                                    <div className="text-xs text-muted-foreground mb-1">
                                        最大ドローダウン
                                    </div>
                                    <div className="text-lg font-semibold text-red-600">
                                        {session.maxDrawdown.toFixed(2)}%
                                    </div>
                                </div>
                                <div className="bg-card rounded-lg border p-4">
                                    <div className="text-xs text-muted-foreground mb-1">
                                        ルール違反
                                    </div>
                                    <div className="text-lg font-semibold">
                                        {session.ruleViolations}件
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === "daily" && (
                        <div className="space-y-6">
                            <DailyPerformanceChart dailyStats={dailyStats} />
                            <DailyStatsTable dailyStats={dailyStats} />
                        </div>
                    )}

                    {activeTab === "trades" && (
                        <div className="bg-card rounded-lg border">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-muted/50 border-b">
                                        <tr>
                                            <th className="px-3 py-2 text-left font-medium">
                                                日時
                                            </th>
                                            <th className="px-3 py-2 text-center font-medium">
                                                種別
                                            </th>
                                            <th className="px-3 py-2 text-right font-medium">
                                                株数
                                            </th>
                                            <th className="px-3 py-2 text-right font-medium">
                                                価格
                                            </th>
                                            <th className="px-3 py-2 text-right font-medium">
                                                総額
                                            </th>
                                            <th className="px-3 py-2 text-left font-medium">
                                                メモ
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {session.trades?.map(
                                            (trade: Trade, index: number) => (
                                                <tr
                                                    key={index}
                                                    className="border-b hover:bg-muted/30"
                                                >
                                                    <td className="px-3 py-2 font-mono text-xs">
                                                        {new Date(
                                                            trade.timestamp,
                                                        ).toLocaleString(
                                                            "ja-JP",
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-2 text-center">
                                                        <span
                                                            className={`px-2 py-1 rounded text-xs ${
                                                                trade.type ===
                                                                "buy"
                                                                    ? "bg-blue-100 text-blue-800"
                                                                    : "bg-orange-100 text-orange-800"
                                                            }`}
                                                        >
                                                            {trade.type ===
                                                            "buy"
                                                                ? "買い"
                                                                : "売り"}
                                                        </span>
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {trade.shares.toLocaleString()}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        {trade.price.toLocaleString()}
                                                        円
                                                    </td>
                                                    <td className="px-3 py-2 text-right font-medium">
                                                        {trade.totalCost.toLocaleString()}
                                                        円
                                                    </td>
                                                    <td className="px-3 py-2 text-xs text-muted-foreground max-w-xs truncate">
                                                        {trade.memo}
                                                    </td>
                                                </tr>
                                            ),
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {activeTab === "violations" && (
                        <div>
                            {session.violations &&
                            session.violations.length > 0 ? (
                                <div className="space-y-3">
                                    {session.violations.map(
                                        (
                                            violation: RuleViolation,
                                            index: number,
                                        ) => (
                                            <div
                                                key={index}
                                                className={`bg-card rounded-lg border-l-4 p-4 ${
                                                    violation.severity ===
                                                    "critical"
                                                        ? "border-red-500"
                                                        : "border-yellow-500"
                                                }`}
                                            >
                                                <div className="flex items-start justify-between">
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span
                                                                className={`px-2 py-1 rounded text-xs font-medium ${
                                                                    violation.severity ===
                                                                    "critical"
                                                                        ? "bg-red-100 text-red-800"
                                                                        : "bg-yellow-100 text-yellow-800"
                                                                }`}
                                                            >
                                                                {violation.severity ===
                                                                "critical"
                                                                    ? "重大"
                                                                    : "警告"}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground">
                                                                {new Date(
                                                                    violation.timestamp,
                                                                ).toLocaleString(
                                                                    "ja-JP",
                                                                )}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm">
                                                            {
                                                                violation.description
                                                            }
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        ),
                                    )}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-muted-foreground">
                                    ルール違反はありません
                                </div>
                            )}
                        </div>
                    )}

                    {activeTab === "reflection" && (
                        <div>
                            {isEditingReflection ? (
                                <div className="space-y-4">
                                    <textarea
                                        value={reflection}
                                        onChange={(e) =>
                                            setReflection(e.target.value)
                                        }
                                        placeholder="このセッションの反省や学びを記録してください..."
                                        className="w-full h-64 p-4 rounded-lg border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                                    />
                                    <div className="flex justify-end gap-2">
                                        <button
                                            onClick={() => {
                                                setReflection(
                                                    session.reflection || "",
                                                );
                                                setIsEditingReflection(false);
                                            }}
                                            className="px-4 py-2 rounded-lg border hover:bg-accent"
                                        >
                                            キャンセル
                                        </button>
                                        <button
                                            onClick={handleSaveReflection}
                                            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                                        >
                                            保存
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div>
                                    {reflection ? (
                                        <div className="space-y-4">
                                            <div className="bg-card rounded-lg border p-4 whitespace-pre-wrap">
                                                {reflection}
                                            </div>
                                            <button
                                                onClick={() =>
                                                    setIsEditingReflection(true)
                                                }
                                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                                            >
                                                編集
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-8">
                                            <p className="text-muted-foreground mb-4">
                                                まだ反省が記録されていません
                                            </p>
                                            <button
                                                onClick={() =>
                                                    setIsEditingReflection(true)
                                                }
                                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
                                            >
                                                反省を記録
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
