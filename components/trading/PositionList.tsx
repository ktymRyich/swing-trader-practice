"use client";

import { Position } from "@/lib/db/schema";
import { calculatePositionPnL } from "@/lib/trading/calculator";
import { X } from "lucide-react";
import { useState, useEffect } from "react";

interface PositionListProps {
    positions: Position[];
    currentPrice: number;
    onClose: (positionId: string, memo: string) => void;
}

export default function PositionList({
    positions,
    currentPrice,
    onClose,
}: PositionListProps) {
    const [isClosingModalOpen, setIsClosingModalOpen] = useState(false);
    const [selectedPosition, setSelectedPosition] = useState<Position | null>(
        null,
    );
    const [closeMemo, setCloseMemo] = useState("");
    const [error, setError] = useState("");

    const handleCloseClick = (position: Position) => {
        setSelectedPosition(position);
        setCloseMemo("");
        setError("");
        setIsClosingModalOpen(true);
    };

    const handleCloseSubmit = () => {
        if (!closeMemo.trim()) {
            setError("決済理由を入力してください");
            return;
        }
        if (selectedPosition) {
            onClose(selectedPosition.id!, closeMemo.trim());
            setIsClosingModalOpen(false);
            setSelectedPosition(null);
            setCloseMemo("");
            setError("");
        }
    };

    // モーダル表示中はbodyのスクロールを無効化
    useEffect(() => {
        if (isClosingModalOpen) {
            document.body.classList.add("modal-open");
        } else {
            document.body.classList.remove("modal-open");
        }

        return () => {
            document.body.classList.remove("modal-open");
        };
    }, [isClosingModalOpen]);

    if (positions.length === 0) {
        return (
            <div className="bg-card rounded-lg border p-8 text-center">
                <p className="text-muted-foreground">ポジションがありません</p>
            </div>
        );
    }

    return (
        <div className="bg-card rounded-lg border overflow-hidden">
            <div className="bg-muted px-4 py-3 border-b">
                <h3 className="font-bold">保有ポジション</h3>
            </div>

            <div className="divide-y">
                {positions.map((position) => {
                    const { pnL, pnLPercent } = calculatePositionPnL({
                        type: position.type,
                        shares: position.shares,
                        entryPrice: position.entryPrice,
                        currentPrice,
                        unrealizedPnL: 0,
                        unrealizedPnLPercent: 0,
                    });

                    const isProfitable = pnL >= 0;

                    return (
                        <div
                            key={position.id}
                            className="p-4 hover:bg-accent transition"
                        >
                            <div className="flex items-start justify-between gap-4">
                                <div className="flex-1">
                                    {/* ポジション情報 */}
                                    <div className="flex items-center gap-2 mb-2">
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-bold ${
                                                position.type === "long"
                                                    ? "bg-green-500/20 text-green-500"
                                                    : "bg-red-500/20 text-red-500"
                                            }`}
                                        >
                                            {position.type === "long"
                                                ? "ロング"
                                                : "ショート"}
                                        </span>
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-medium ${
                                                position.tradingType === "spot"
                                                    ? "bg-blue-500/20 text-blue-500"
                                                    : "bg-purple-500/20 text-purple-500"
                                            }`}
                                        >
                                            {position.tradingType === "spot"
                                                ? "現物"
                                                : "信用"}
                                        </span>
                                    </div>

                                    {/* 株数と価格 */}
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <div className="text-muted-foreground">
                                                株数
                                            </div>
                                            <div className="font-medium">
                                                {position.shares.toLocaleString()}
                                                株
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">
                                                建玉価格
                                            </div>
                                            <div className="font-medium">
                                                ¥
                                                {position.entryPrice.toLocaleString()}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">
                                                現在価格
                                            </div>
                                            <div className="font-medium">
                                                ¥{currentPrice.toLocaleString()}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground">
                                                建玉日
                                            </div>
                                            <div className="font-medium text-xs">
                                                {new Date(
                                                    position.entryDate,
                                                ).toLocaleDateString("ja-JP")}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 損益 */}
                                    <div className="mt-3 p-3 bg-muted rounded">
                                        <div className="flex justify-between items-center">
                                            <span className="text-sm text-muted-foreground">
                                                含み損益
                                            </span>
                                            <div className="text-right">
                                                <div
                                                    className={`text-lg font-bold ${
                                                        isProfitable
                                                            ? "text-green-500"
                                                            : "text-red-500"
                                                    }`}
                                                >
                                                    {isProfitable ? "+" : ""}¥
                                                    {pnL.toLocaleString()}
                                                </div>
                                                <div
                                                    className={`text-sm ${
                                                        isProfitable
                                                            ? "text-green-500"
                                                            : "text-red-500"
                                                    }`}
                                                >
                                                    {isProfitable ? "+" : ""}
                                                    {pnLPercent.toFixed(2)}%
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 決済ボタン */}
                                <button
                                    onClick={() => handleCloseClick(position)}
                                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2 transition"
                                >
                                    <X className="w-4 h-4" />
                                    決済
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* 決済モーダル */}
            {isClosingModalOpen && selectedPosition && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
                    onClick={() => setIsClosingModalOpen(false)}
                >
                    <div
                        className="bg-card rounded-t-2xl sm:rounded-xl border max-w-md w-full flex flex-col max-h-[90vh] sm:max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b">
                            <h3 className="text-lg font-bold">
                                ポジション決済
                            </h3>
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            {/* ポジション情報 */}
                            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                                <div className="flex items-center gap-2">
                                    <span
                                        className={`px-2 py-1 rounded text-xs font-bold ${
                                            selectedPosition.type === "long"
                                                ? "bg-green-500/20 text-green-500"
                                                : "bg-red-500/20 text-red-500"
                                        }`}
                                    >
                                        {selectedPosition.type === "long"
                                            ? "ロング"
                                            : "ショート"}
                                    </span>
                                    <span className="text-sm font-medium">
                                        {selectedPosition.shares.toLocaleString()}
                                        株
                                    </span>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    建玉価格: ¥
                                    {selectedPosition.entryPrice.toLocaleString()}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                    現在価格: ¥{currentPrice.toLocaleString()}
                                </div>
                            </div>

                            {/* 決済理由入力 */}
                            <div>
                                <label className="block text-sm font-medium mb-2">
                                    決済理由{" "}
                                    <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    key={`close-memo-${selectedPosition?.id}`}
                                    value={closeMemo}
                                    onChange={(e) => {
                                        setCloseMemo(e.target.value);
                                        setError("");
                                    }}
                                    onFocus={(e) => {
                                        setTimeout(() => {
                                            e.target.scrollIntoView({
                                                behavior: "smooth",
                                                block: "center",
                                            });
                                        }, 300);
                                    }}
                                    placeholder="例: 目標価格到達、損切り実行など"
                                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary bg-background text-base"
                                    rows={3}
                                    style={{ fontSize: "16px" }}
                                />
                                {error && (
                                    <p className="mt-1 text-sm text-red-500">
                                        {error}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="px-6 py-4 border-t flex gap-3 sticky bottom-0 bg-card">
                            <button
                                onClick={() => setIsClosingModalOpen(false)}
                                className="flex-1 px-4 py-2 border rounded-lg hover:bg-accent transition"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleCloseSubmit}
                                className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition font-medium"
                            >
                                決済実行
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
