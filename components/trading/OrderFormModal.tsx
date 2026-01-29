"use client";

import { useState, useEffect } from "react";
import { X, TrendingUp, TrendingDown, Plus, Minus } from "lucide-react";
import {
    calculateBuyOrder,
    calculateSellOrder,
    calculateMaxShares,
} from "@/lib/trading/calculator";
import { checkBeforeOpenPosition } from "@/lib/trading/rules";

interface OrderFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentPrice: number;
    availableCapital: number;
    openPositionCount: number;
    totalPositionValue: number;
    onSubmit: (order: {
        type: "buy" | "sell";
        tradingType: "spot" | "margin";
        shares: number;
        price: number;
        memo: string;
    }) => void;
}

export default function OrderFormModal({
    isOpen,
    onClose,
    currentPrice,
    availableCapital,
    openPositionCount,
    totalPositionValue,
    onSubmit,
}: OrderFormModalProps) {
    const [orderType, setOrderType] = useState<"buy" | "sell">("buy");
    const [tradingType, setTradingType] = useState<"spot" | "margin">("spot");
    const [shares, setShares] = useState<number>(100);
    const [memo, setMemo] = useState("");

    // モーダル表示中はbodyのスクロールを無効化
    useEffect(() => {
        if (isOpen) {
            document.body.classList.add("modal-open");
        } else {
            document.body.classList.remove("modal-open");
        }

        return () => {
            document.body.classList.remove("modal-open");
        };
    }, [isOpen]);

    if (!isOpen) return null;

    // 購入可能な最大株数を計算
    const maxShares = calculateMaxShares(
        availableCapital,
        currentPrice,
        tradingType,
        tradingType === "margin" ? 3.0 : 1.0,
    );

    // 注文計算
    const calculation =
        orderType === "buy"
            ? calculateBuyOrder(currentPrice, shares, tradingType)
            : calculateSellOrder(currentPrice, shares, tradingType);

    // ルール違反チェック
    const violations =
        orderType === "buy"
            ? checkBeforeOpenPosition({
                  openPositionCount,
                  newPositionValue: shares * currentPrice,
                  currentCapital: availableCapital,
                  totalPositionValue,
                  tradingType,
              })
            : [];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (shares <= 0 || shares % 100 !== 0) {
            alert("株数は100株単位で入力してください");
            return;
        }

        // 現物売りを禁止
        if (orderType === "sell" && tradingType === "spot") {
            alert(
                "現物売りはできません。保有ポジションの決済ボタンから売却してください。",
            );
            return;
        }

        if (orderType === "buy" && calculation.totalCost > availableCapital) {
            alert("資金が不足しています");
            return;
        }

        if (!memo.trim()) {
            alert("取引理由を入力してください");
            return;
        }

        onSubmit({
            type: orderType,
            tradingType,
            shares,
            price: currentPrice,
            memo: memo.trim(),
        });

        // モーダルを閉じる（フォームリセットはuseEffectで行われる）
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50" onClick={onClose}>
            <div className="absolute inset-0 overflow-y-auto flex items-center justify-center p-4">
                <div
                    className="bg-card rounded-2xl w-full sm:max-w-md flex flex-col border max-h-[90vh]"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* ヘッダー */}
                    <div className="sticky top-0 bg-card border-b px-4 py-3 flex items-center justify-between">
                        <h2 className="text-lg font-bold">注文</h2>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-accent rounded"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* フォーム */}
                    <form
                        key={isOpen ? "open" : "closed"}
                        onSubmit={handleSubmit}
                        className="p-4 space-y-4 overflow-y-auto flex-1"
                    >
                        {/* 注文種別 */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                注文種別
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setOrderType("buy")}
                                    className={`p-3 rounded-lg border-2 transition flex items-center justify-center gap-2 ${
                                        orderType === "buy"
                                            ? "border-green-500 bg-green-500/10 text-green-500"
                                            : "border-border"
                                    }`}
                                >
                                    <TrendingUp className="w-4 h-4" />
                                    <span className="font-medium">買い</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setOrderType("sell")}
                                    className={`p-3 rounded-lg border-2 transition flex items-center justify-center gap-2 ${
                                        orderType === "sell"
                                            ? "border-red-500 bg-red-500/10 text-red-500"
                                            : "border-border"
                                    }`}
                                >
                                    <TrendingDown className="w-4 h-4" />
                                    <span className="font-medium">売り</span>
                                </button>
                            </div>
                        </div>

                        {/* 取引区分 */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                取引区分
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setTradingType("spot")}
                                    className={`p-2 rounded-lg border-2 transition ${
                                        tradingType === "spot"
                                            ? "border-primary bg-primary/10"
                                            : "border-border"
                                    }`}
                                >
                                    <div className="font-medium text-sm">
                                        現物
                                    </div>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTradingType("margin")}
                                    className={`p-2 rounded-lg border-2 transition ${
                                        tradingType === "margin"
                                            ? "border-primary bg-primary/10"
                                            : "border-border"
                                    }`}
                                >
                                    <div className="font-medium text-sm">
                                        信用
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* 株数 */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                株数（100株単位）
                            </label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShares(Math.max(100, shares - 100))
                                    }
                                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center border rounded-lg bg-background hover:bg-accent transition-colors"
                                >
                                    <Minus className="w-4 h-4" />
                                </button>
                                <input
                                    type="number"
                                    value={shares}
                                    onChange={(e) =>
                                        setShares(Number(e.target.value))
                                    }
                                    step="100"
                                    min="100"
                                    className="flex-1 px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary text-base text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    autoComplete="off"
                                    style={{ fontSize: "16px" }}
                                />
                                <button
                                    type="button"
                                    onClick={() =>
                                        setShares(
                                            Math.min(maxShares, shares + 100),
                                        )
                                    }
                                    className="flex-shrink-0 w-10 h-10 flex items-center justify-center border rounded-lg bg-background hover:bg-accent transition-colors"
                                >
                                    <Plus className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="mt-1 text-xs text-muted-foreground">
                                最大: {maxShares.toLocaleString()}株
                            </p>
                        </div>

                        {/* 取引理由 */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                取引理由
                            </label>
                            <textarea
                                key={`memo-${isOpen}`}
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                                onFocus={(e) => {
                                    setTimeout(() => {
                                        e.target.scrollIntoView({
                                            behavior: "smooth",
                                            block: "center",
                                        });
                                    }, 300);
                                }}
                                rows={2}
                                className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary text-base"
                                placeholder="なぜこの取引を？"
                                autoComplete="off"
                                style={{ fontSize: "16px" }}
                            />
                        </div>

                        {/* 概算 */}
                        <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    約定代金
                                </span>
                                <span className="font-medium">
                                    ¥{(currentPrice * shares).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">
                                    手数料等
                                </span>
                                <span className="font-medium">
                                    ¥
                                    {(
                                        calculation.fee + calculation.slippage
                                    ).toLocaleString()}
                                </span>
                            </div>
                            <div className="flex justify-between pt-2 border-t">
                                <span className="font-bold">合計</span>
                                <span className="font-bold text-lg">
                                    ¥{calculation.totalCost.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* 警告 */}
                        {violations.length > 0 && (
                            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                                {violations.map((v, i) => (
                                    <div
                                        key={i}
                                        className="text-xs text-red-500"
                                    >
                                        ⚠️ {v.description}
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* 送信ボタン */}
                        <button
                            type="submit"
                            className={`w-full py-3 rounded-lg font-bold transition ${
                                orderType === "buy"
                                    ? "bg-green-500 hover:bg-green-600 text-white"
                                    : "bg-red-500 hover:bg-red-600 text-white"
                            }`}
                        >
                            {orderType === "buy" ? "買い注文" : "売り注文"}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
