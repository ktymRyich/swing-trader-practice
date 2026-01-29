"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import {
    generateTradeId,
    generatePositionId,
    generateViolationId,
} from "@/lib/db/schema";
import { useSessionStore } from "@/lib/store/sessionStore";
import TradingChart from "@/components/chart/TradingChart";
import OrderFormModal from "@/components/trading/OrderFormModal";
import PositionList from "@/components/trading/PositionList";
import PlaybackControls from "@/components/trading/PlaybackControls";
import TradeHistory from "@/components/trading/TradeHistory";
import {
    ArrowLeft,
    Plus,
    Play,
    Pause,
    SkipForward,
    BarChart3,
    Settings,
} from "lucide-react";
import Link from "next/link";
import {
    calculateBuyOrder,
    calculateSellOrder,
    calculatePositionPnL,
} from "@/lib/trading/calculator";

export default function SessionPage({
    params,
}: {
    params: Promise<{ sessionId: string }>;
}) {
    const { sessionId } = use(params);
    const router = useRouter();

    const {
        currentSession,
        stockPrices,
        visiblePrices,
        openPositions,
        isPlaying,
        currentPriceIndex,
        setSession,
        setStockPrices,
        setOpenPositions,
        setClosedPositions,
        setTrades,
        play,
        pause,
        togglePlayPause,
        advanceDay,
        updateSession,
        reset,
        setCurrentPriceIndex,
    } = useSessionStore();

    const [nickname, setNickname] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
    const [isCompanyInfoOpen, setIsCompanyInfoOpen] = useState(false);
    const [isStatsModalOpen, setIsStatsModalOpen] = useState(false);
    const [isReflectionModalOpen, setIsReflectionModalOpen] = useState(false);
    const [reflection, setReflection] = useState("");
    const [highlightedTradeId, setHighlightedTradeId] = useState<string | null>(
        null,
    );
    const [stockInfo, setStockInfo] = useState<{
        name: string;
        symbol: string;
        description?: string;
        sector?: string;
        marketCapEstimate?: string;
    } | null>(null);
    const [closedPositions, setLocalClosedPositions] = useState<any[]>([]);
    const [trades, setLocalTrades] = useState<any[]>([]);

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

    // 平均増益額と平均損額を計算
    const profitStats = closedPositions
        ? (() => {
              const profits = closedPositions.filter(
                  (p) => (p.profit || 0) > 0,
              );
              const losses = closedPositions.filter((p) => (p.profit || 0) < 0);

              return {
                  avgProfit:
                      profits.length > 0
                          ? profits.reduce(
                                (sum, p) => sum + (p.profit || 0),
                                0,
                            ) / profits.length
                          : 0,
                  avgLoss:
                      losses.length > 0
                          ? losses.reduce(
                                (sum, p) => sum + (p.profit || 0),
                                0,
                            ) / losses.length
                          : 0,
              };
          })()
        : { avgProfit: 0, avgLoss: 0 };

    // モーダル開閉時に自動再生を一時停止
    useEffect(() => {
        if (isOrderModalOpen && isPlaying) {
            pause();
        }
    }, [isOrderModalOpen]);

    // セッションとデータを読み込み
    useEffect(() => {
        const savedNickname = localStorage.getItem("userNickname");
        if (!savedNickname) {
            router.push("/login");
            return;
        }
        setNickname(savedNickname);

        // まずストアをリセット
        reset();
        loadSession(savedNickname);
    }, [sessionId]);

    // 自動再生タイマー
    useEffect(() => {
        if (!isPlaying || !currentSession) return;

        const timer = setInterval(() => {
            const practiceStartIndex = currentSession.practiceStartIndex || 0;
            const practiceEndIndex =
                practiceStartIndex + currentSession.periodDays - 1;

            if (currentPriceIndex >= practiceEndIndex) {
                pause();
                completeSession();
            } else {
                advanceDay();
            }
        }, currentSession.playbackSpeed * 1000);

        return () => clearInterval(timer);
    }, [isPlaying, currentPriceIndex, stockPrices.length, currentSession]);

    // 既に記録済みの違反を追跡（ポジションID + 違反タイプ）
    const [recordedViolations, setRecordedViolations] = useState<Set<string>>(
        new Set(),
    );

    // ルール違反チェック（1日ごと）- 同じポジションの同じ違反は1回のみ記録
    useEffect(() => {
        if (openPositions.length === 0 || !currentSession || !nickname) return;
        if (visiblePrices.length === 0) return;

        const currentPrice = visiblePrices[visiblePrices.length - 1].close;

        // 各ポジションごとに違反をチェック
        const newViolations: Array<{
            positionId: string;
            type: string;
            description: string;
            severity: "warning" | "critical";
        }> = [];

        for (const position of openPositions) {
            // 損切りルール違反チェック
            const { pnLPercent } = calculatePositionPnL({
                type: position.type,
                shares: position.shares,
                entryPrice: position.entryPrice,
                currentPrice: currentPrice,
                unrealizedPnL: 0,
                unrealizedPnLPercent: 0,
            });

            const positionId =
                position.id || `pos_${position.entryDate}_${position.shares}`;

            if (pnLPercent < -10) {
                const violationKey = `${positionId}_stop_loss`;
                if (!recordedViolations.has(violationKey)) {
                    newViolations.push({
                        positionId,
                        type: "stop_loss",
                        description: `含み損が${pnLPercent.toFixed(2)}%に達しています（損切りライン: -10%）`,
                        severity: "critical",
                    });
                }
            }

            // ポジションサイズ違反チェック
            const positionValue = position.shares * currentPrice;
            const sizePercent =
                (positionValue / currentSession.currentCapital) * 100;
            if (sizePercent > 30) {
                const violationKey = `${positionId}_position_size`;
                if (!recordedViolations.has(violationKey)) {
                    newViolations.push({
                        positionId,
                        type: "position_size",
                        description: `ポジションサイズが${sizePercent.toFixed(1)}%です（上限: 30%）`,
                        severity: "warning",
                    });
                }
            }
        }

        // 同時保有数違反チェック（セッション単位で1回のみ）
        if (openPositions.length > 3) {
            const violationKey = "session_max_positions";
            if (!recordedViolations.has(violationKey)) {
                newViolations.push({
                    positionId: "session",
                    type: "max_positions",
                    description: `${openPositions.length}銘柄を同時保有しています（上限: 3銘柄）`,
                    severity: "warning",
                });
            }
        }

        // レバレッジ違反チェック（セッション単位で1回のみ）
        const totalPositionValue = openPositions.reduce(
            (sum, p) => sum + p.shares * currentPrice,
            0,
        );
        const leverage = totalPositionValue / currentSession.currentCapital;
        if (leverage > 2) {
            const violationKey = "session_leverage";
            if (!recordedViolations.has(violationKey)) {
                newViolations.push({
                    positionId: "session",
                    type: "leverage",
                    description: `レバレッジが${leverage.toFixed(2)}倍です（推奨上限: 2倍）`,
                    severity: "critical",
                });
            }
        }

        // 新しい違反があれば記録
        if (newViolations.length > 0) {
            const newRecordedKeys = new Set(recordedViolations);
            let updatedViolations = [...(currentSession.violations || [])];
            let violationCount = currentSession.ruleViolations || 0;

            newViolations.forEach((v) => {
                const violationKey = `${v.positionId}_${v.type}`;
                newRecordedKeys.add(violationKey);

                const violation = {
                    id: generateViolationId(),
                    sessionId: currentSession.id!,
                    timestamp: new Date().toISOString(),
                    positionId: v.positionId,
                    type: v.type,
                    description: v.description,
                    severity: v.severity,
                };

                updatedViolations.push(violation);
                violationCount++;
            });

            setRecordedViolations(newRecordedKeys);

            updateSession({
                ruleViolations: violationCount,
                violations: updatedViolations,
            });

            // サーバーに保存
            saveSession({
                ...currentSession,
                ruleViolations: violationCount,
                violations: updatedViolations,
            });
        }
    }, [currentPriceIndex, openPositions.length]);

    const saveSession = async (session: any) => {
        if (!nickname) return;

        try {
            // 株価データを除外してセッションを保存
            const { prices, ...sessionWithoutPrices } = session;

            await fetch(`/api/sessions/${sessionId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nickname,
                    session: sessionWithoutPrices,
                }),
            });
        } catch (error) {
            console.error("セッション保存エラー:", error);
        }
    };

    const loadSession = async (userNickname: string) => {
        try {
            const response = await fetch(
                `/api/sessions/${sessionId}?nickname=${userNickname}`,
            );
            const data = await response.json();

            if (!data.success) {
                alert("セッションが見つかりません");
                router.push("/");
                return;
            }

            const session = data.session;

            // 株価データを動的に読み込む
            const pricesResponse = await fetch(
                `/api/stocks/prices/${session.symbol}?startDate=${session.startDateOfData}&endDate=${session.endDateOfData}`,
            );
            const pricesData = await pricesResponse.json();

            if (
                !pricesData.success ||
                !pricesData.prices ||
                pricesData.prices.length === 0
            ) {
                alert("株価データの読み込みに失敗しました");
                router.push("/");
                return;
            }

            // 株式情報を設定（セッションデータになければstocks.jsonから取得）
            let stockDescription = session.stockDescription;
            let stockMarketCapEstimate = session.stockMarketCapEstimate;

            if (!stockDescription || !stockMarketCapEstimate) {
                try {
                    const stocksResponse = await fetch("/api/stocks/cached");
                    const stocksData = await stocksResponse.json();
                    if (stocksData.success) {
                        const stock = stocksData.stocks.find(
                            (s: any) => s.symbol === session.symbol,
                        );
                        if (stock) {
                            stockDescription =
                                stock.description || stockDescription;
                            stockMarketCapEstimate =
                                stock.marketCapEstimate ||
                                stockMarketCapEstimate;
                        }
                    }
                } catch (error) {
                    console.error("株式情報の取得エラー:", error);
                }
            }

            setStockInfo({
                name: session.stockName,
                symbol: session.symbol,
                sector: session.stockSector,
                description: stockDescription,
                marketCapEstimate: stockMarketCapEstimate,
            });

            // ストアに状態をセット（正しい順序で）
            setSession(session);
            // APIから取得した価格データをセット
            setStockPrices(pricesData.prices);
            // その後に過去データ分を考慮してインデックスを設定（これでvisiblePricesが正しく計算される）
            const practiceStartIndex = session.practiceStartIndex || 0;
            // 完了済みセッションはリプレイのため最初から表示
            const actualIndex =
                session.status === "completed"
                    ? practiceStartIndex
                    : practiceStartIndex + (session.currentDay || 0);
            setCurrentPriceIndex(actualIndex);

            // 完了済みセッションの場合、currentDayを0にリセットしてリプレイモードに
            if (session.status === "completed") {
                const resetSession = { ...session, currentDay: 0 };
                setSession(resetSession);
            }

            // ポジションと取引履歴をセット
            const openPos = (session.positions || []).filter(
                (p: any) => p.status === "open",
            );
            const closedPos = (session.positions || []).filter(
                (p: any) => p.status === "closed",
            );
            setOpenPositions(openPos);
            setClosedPositions(closedPos);
            setLocalClosedPositions(closedPos);
            setTrades(session.trades || []);
            setLocalTrades(session.trades || []);

            // 感想を読み込み
            if (session.reflection) {
                setReflection(session.reflection);
            }

            setIsLoading(false);
        } catch (error) {
            console.error("セッション読み込みエラー:", error);
            alert("セッションの読み込みに失敗しました");
            router.push("/");
        }
    };

    const completeSession = async () => {
        if (!currentSession || !nickname) return;

        try {
            const updatedSession = {
                ...currentSession,
                status: "completed" as const,
                endDate: new Date().toISOString(),
            };

            updateSession(updatedSession);
            await saveSession(updatedSession);

            // 感想入力モーダルを表示
            setIsReflectionModalOpen(true);
        } catch (error) {
            console.error("セッション完了エラー:", error);
            alert("セッションの完了処理に失敗しました");
        }
    };

    const saveReflection = async () => {
        if (!currentSession || !nickname) return;

        try {
            const updatedSession = {
                ...currentSession,
                reflection: reflection.trim(),
            };

            updateSession(updatedSession);
            await saveSession(updatedSession);

            setIsReflectionModalOpen(false);
            alert("感想を保存しました");
        } catch (error) {
            console.error("感想保存エラー:", error);
            alert("感想の保存に失敗しました");
        }
    };

    const handleOrder = async (order: {
        type: "buy" | "sell";
        tradingType: "spot" | "margin";
        shares: number;
        price: number;
        memo: string;
    }) => {
        if (!currentSession || !nickname) return;

        try {
            // 再生を一時停止
            pause();

            const { type, tradingType, shares, price, memo } = order;
            const calculation =
                type === "buy"
                    ? calculateBuyOrder(price, shares, tradingType)
                    : calculateSellOrder(price, shares, tradingType);

            // 取引を記録
            const trade = {
                id: generateTradeId(),
                sessionId: currentSession.id!,
                timestamp: new Date().toISOString(),
                tradeDate: visiblePrices[visiblePrices.length - 1].date,
                type,
                tradingType,
                isShort: type === "sell" && tradingType === "margin",
                shares,
                price,
                fee: calculation.fee,
                slippage: calculation.slippage,
                totalCost: calculation.totalCost,
                memo,
                capitalAfterTrade:
                    currentSession.currentCapital -
                    (type === "buy"
                        ? calculation.totalCost
                        : -calculation.totalCost),
            };

            // 資金を更新
            const newCapital =
                type === "buy"
                    ? currentSession.currentCapital - calculation.totalCost
                    : currentSession.currentCapital + calculation.totalCost;

            let updatedPositions = [...(currentSession.positions || [])];
            let updatedOpenPositions = [...openPositions];

            // ポジションを更新
            if (type === "buy") {
                // 買い注文 → ロングポジション作成
                const position = {
                    id: generatePositionId(),
                    sessionId: currentSession.id!,
                    openTradeId: trade.id!,
                    type: "long" as const,
                    tradingType,
                    shares,
                    entryPrice: price,
                    entryDate: trade.tradeDate,
                    status: "open" as const,
                };

                updatedPositions.push(position);
                updatedOpenPositions.push(position);
                setOpenPositions(updatedOpenPositions);
            } else if (type === "sell") {
                if (tradingType === "spot") {
                    // 現物売り → エラー（現物売りはポジション決済のみ）
                    alert(
                        "現物売りはできません。保有ポジションの決済ボタンから売却してください。",
                    );
                    return;
                } else if (tradingType === "margin") {
                    // 信用売り → ショートポジション作成
                    const position = {
                        id: generatePositionId(),
                        sessionId: currentSession.id!,
                        openTradeId: trade.id!,
                        type: "short" as const,
                        tradingType: "margin" as const,
                        shares,
                        entryPrice: price,
                        entryDate: trade.tradeDate,
                        status: "open" as const,
                    };

                    updatedPositions.push(position);
                    updatedOpenPositions.push(position);
                    setOpenPositions(updatedOpenPositions);
                }
            }

            // 取引履歴を更新
            const updatedTrades = [...(currentSession.trades || []), trade];
            setTrades(updatedTrades);
            setLocalTrades(updatedTrades);

            // 統計を更新（決済済みポジションのみカウント）
            const allClosedPositions = updatedPositions.filter(
                (p) => p.status === "closed",
            );
            const winCount = allClosedPositions.filter(
                (p) => (p.profit || 0) > 0,
            ).length;
            const winRate =
                allClosedPositions.length > 0
                    ? (winCount / allClosedPositions.length) * 100
                    : 0;

            const updatedSession = {
                ...currentSession,
                currentCapital: newCapital,
                positions: updatedPositions,
                trades: updatedTrades,
                tradeCount: allClosedPositions.length,
                winCount,
                winRate,
            };

            updateSession(updatedSession);
            await saveSession(updatedSession);

            alert("注文が完了しました");
        } catch (error) {
            console.error("注文エラー:", error);
            alert("注文の処理に失敗しました");
        }
    };

    const handleClosePosition = async (
        positionId: string,
        memo: string = "ポジション決済",
    ) => {
        console.log("=== handleClosePosition START ===");
        console.log("positionId:", positionId);
        console.log("memo:", memo);
        console.log("currentSession:", currentSession);
        console.log("openPositions:", openPositions);
        console.log("visiblePrices length:", visiblePrices.length);

        if (!currentSession || !nickname) {
            console.error("No current session or nickname");
            alert("セッション情報が見つかりません");
            return;
        }

        const position = openPositions.find((p) => p.id === positionId);
        if (!position) {
            console.error("Position not found:", positionId);
            alert("ポジションが見つかりません");
            return;
        }

        if (visiblePrices.length === 0) {
            console.error("No visible prices");
            alert("価格データがありません");
            return;
        }

        const currentPrice = visiblePrices[visiblePrices.length - 1].close;
        console.log("Current price:", currentPrice, "Position:", position);
        console.log("Starting close process...");

        try {
            // 再生を一時停止
            pause();

            // 決済取引を作成
            const calculation = calculateSellOrder(
                currentPrice,
                position.shares,
                position.tradingType,
            );

            // 資金変動を計算
            let capitalChange: number;
            if (position.type === "long") {
                // ロングの場合：売却で資金が増える
                capitalChange = calculation.totalCost;
            } else {
                // ショートの場合：買い戻しで資金が減る
                capitalChange = -calculation.totalCost;
            }

            const trade = {
                id: generateTradeId(),
                sessionId: currentSession.id!,
                timestamp: new Date().toISOString(),
                tradeDate: visiblePrices[visiblePrices.length - 1].date,
                type: "sell" as const,
                tradingType: position.tradingType,
                isShort: false,
                shares: position.shares,
                price: currentPrice,
                fee: calculation.fee,
                slippage: calculation.slippage,
                totalCost: calculation.totalCost,
                memo: memo,
                capitalAfterTrade:
                    currentSession.currentCapital + capitalChange,
            };

            // 資金を更新
            const newCapital = currentSession.currentCapital + capitalChange;

            // 利益を計算
            let profit: number;
            if (position.type === "long") {
                // ロング：売却額 - 購入額
                profit =
                    calculation.totalCost -
                    position.entryPrice * position.shares;
            } else {
                // ショート：売却額（エントリー時） - 買戻額（現在）
                const entryCalculation = calculateSellOrder(
                    position.entryPrice,
                    position.shares,
                    position.tradingType,
                );
                profit = entryCalculation.totalCost - calculation.totalCost;
            }
            const profitRate =
                (profit / (position.entryPrice * position.shares)) * 100;

            // ポジションを更新
            let updatedPositions = [...(currentSession.positions || [])];
            const posIndex = updatedPositions.findIndex(
                (p) => p.id === positionId,
            );
            if (posIndex >= 0) {
                updatedPositions[posIndex] = {
                    ...updatedPositions[posIndex],
                    status: "closed",
                    closeTradeId: trade.id,
                    exitPrice: currentPrice,
                    exitDate: trade.tradeDate,
                    profit,
                    profitRate,
                };
            }

            // 統計を更新
            const allClosedPositions = updatedPositions.filter(
                (p) => p.status === "closed",
            );
            const winCount = allClosedPositions.filter(
                (p) => (p.profit || 0) > 0,
            ).length;
            const winRate =
                allClosedPositions.length > 0
                    ? (winCount / allClosedPositions.length) * 100
                    : 0;

            // 取引履歴を更新
            const updatedTrades = [...(currentSession.trades || []), trade];

            const updatedSession = {
                ...currentSession,
                currentCapital: newCapital,
                positions: updatedPositions,
                trades: updatedTrades,
                tradeCount: allClosedPositions.length,
                winCount,
                winRate,
            };

            updateSession(updatedSession);
            await saveSession(updatedSession);

            // 状態を更新
            const updatedOpenPositions = openPositions.filter(
                (p) => p.id !== positionId,
            );
            setOpenPositions(updatedOpenPositions);

            const closedPos = updatedPositions.filter(
                (p) => p.status === "closed",
            );
            setClosedPositions(closedPos);
            setLocalClosedPositions(closedPos);

            setTrades(updatedTrades);
            setLocalTrades(updatedTrades);

            console.log("=== handleClosePosition SUCCESS ===");
            alert("ポジションを決済しました");
        } catch (error) {
            console.error("=== handleClosePosition ERROR ===");
            console.error("決済エラー:", error);
            if (error instanceof Error) {
                console.error("Error message:", error.message);
                console.error("Error stack:", error.stack);
            }
            alert(`決済の処理に失敗しました: ${error}`);
        }
    };

    const handleTradeClick = (tradeId: string) => {
        // ハイライトを設定
        setHighlightedTradeId(tradeId);

        // 該当の取引にスクロール
        const element = document.getElementById(`trade-${tradeId}`);
        if (element) {
            element.scrollIntoView({ behavior: "smooth", block: "center" });

            // 2秒後にハイライトを解除
            setTimeout(() => setHighlightedTradeId(null), 2000);
        }
    };

    const handleSaveAndExit = async () => {
        if (!currentSession || !nickname) return;

        // 完了済みセッションは確認なしで戻る
        if (currentSession.status === "completed") {
            router.push("/");
            return;
        }

        if (confirm("セッションを保存して終了しますか？")) {
            try {
                const updatedSession = {
                    ...currentSession,
                    status: "paused",
                    currentDay:
                        currentPriceIndex -
                        (currentSession.practiceStartIndex || 0),
                };

                updateSession(updatedSession);
                await saveSession(updatedSession);
                router.push("/");
            } catch (error) {
                console.error("保存エラー:", error);
                alert("保存に失敗しました");
            }
        }
    };

    if (isLoading || !currentSession) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-muted-foreground">
                        セッションを読み込み中...
                    </p>
                </div>
            </div>
        );
    }

    const currentPrice =
        visiblePrices.length > 0
            ? visiblePrices[visiblePrices.length - 1].close
            : 0;

    // 完了済みセッションのリプレイ時は、現在の日付までの取引のみを表示
    const currentDate =
        visiblePrices.length > 0
            ? visiblePrices[visiblePrices.length - 1].date
            : "";

    const visibleTrades =
        currentSession.status === "completed"
            ? (trades || []).filter((t) => t.tradeDate <= currentDate)
            : trades || [];

    // 完了済みセッションのリプレイ時は、現在の日付までに開始したポジションのみを表示
    const visibleOpenPositions =
        currentSession.status === "completed"
            ? openPositions.filter((p) => p.entryDate <= currentDate)
            : openPositions;

    // 完了済みセッションのリプレイ時は、現在の日付までに決済されたポジションで統計を計算
    const visibleClosedPositions =
        currentSession.status === "completed"
            ? closedPositions.filter(
                  (p) => p.exitDate && p.exitDate <= currentDate,
              )
            : closedPositions;

    // リプレイ時の統計を動的に計算
    const replayStats =
        currentSession.status === "completed"
            ? (() => {
                  const profits = visibleClosedPositions.filter(
                      (p) => (p.profit || 0) > 0,
                  );
                  const losses = visibleClosedPositions.filter(
                      (p) => (p.profit || 0) < 0,
                  );
                  const winCount = profits.length;
                  const tradeCount = visibleClosedPositions.length;
                  const winRate =
                      tradeCount > 0 ? (winCount / tradeCount) * 100 : 0;

                  return {
                      tradeCount,
                      winCount,
                      winRate,
                      avgProfit:
                          profits.length > 0
                              ? profits.reduce(
                                    (sum, p) => sum + (p.profit || 0),
                                    0,
                                ) / profits.length
                              : 0,
                      avgLoss:
                          losses.length > 0
                              ? losses.reduce(
                                    (sum, p) => sum + (p.profit || 0),
                                    0,
                                ) / losses.length
                              : 0,
                  };
              })()
            : null;

    const totalPositionValue = visibleOpenPositions.reduce(
        (sum, p) => sum + p.shares * currentPrice,
        0,
    );

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            {/* ヘッダー */}
            <header className="bg-card border-b flex-shrink-0">
                <div className="max-w-[1920px] mx-auto px-4 py-2">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Link
                                href="/"
                                onClick={handleSaveAndExit}
                                className="p-2 hover:bg-accent rounded-lg flex-shrink-0"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </Link>
                            <button
                                onClick={() => setIsCompanyInfoOpen(true)}
                                className="flex items-center gap-2 hover:bg-accent rounded-lg px-2 py-1 transition min-w-0 flex-1"
                            >
                                <div className="min-w-0 flex-1">
                                    <h1 className="text-sm font-bold truncate">
                                        {currentSession.symbol} -{" "}
                                        {currentSession.stockName}
                                    </h1>
                                    <p className="text-xs text-muted-foreground">
                                        資産: ¥
                                        {(() => {
                                            const unrealizedPnL =
                                                visibleOpenPositions.reduce(
                                                    (sum, p) => {
                                                        const { pnL } =
                                                            calculatePositionPnL(
                                                                {
                                                                    type: p.type,
                                                                    shares: p.shares,
                                                                    entryPrice:
                                                                        p.entryPrice,
                                                                    currentPrice:
                                                                        currentPrice,
                                                                    unrealizedPnL: 0,
                                                                    unrealizedPnLPercent: 0,
                                                                },
                                                            );
                                                        return sum + pnL;
                                                    },
                                                    0,
                                                );
                                            const totalAssets =
                                                currentSession.currentCapital +
                                                unrealizedPnL;
                                            return totalAssets.toLocaleString();
                                        })()}
                                        <span
                                            className={`ml-1 ${(() => {
                                                const unrealizedPnL =
                                                    visibleOpenPositions.reduce(
                                                        (sum, p) => {
                                                            const { pnL } =
                                                                calculatePositionPnL(
                                                                    {
                                                                        type: p.type,
                                                                        shares: p.shares,
                                                                        entryPrice:
                                                                            p.entryPrice,
                                                                        currentPrice:
                                                                            currentPrice,
                                                                        unrealizedPnL: 0,
                                                                        unrealizedPnLPercent: 0,
                                                                    },
                                                                );
                                                            return sum + pnL;
                                                        },
                                                        0,
                                                    );
                                                return unrealizedPnL >= 0
                                                    ? "text-green-500"
                                                    : "text-red-500";
                                            })()}`}
                                        >
                                            {(() => {
                                                const unrealizedPnL =
                                                    visibleOpenPositions.reduce(
                                                        (sum, p) => {
                                                            const { pnL } =
                                                                calculatePositionPnL(
                                                                    {
                                                                        type: p.type,
                                                                        shares: p.shares,
                                                                        entryPrice:
                                                                            p.entryPrice,
                                                                        currentPrice:
                                                                            currentPrice,
                                                                        unrealizedPnL: 0,
                                                                        unrealizedPnLPercent: 0,
                                                                    },
                                                                );
                                                            return sum + pnL;
                                                        },
                                                        0,
                                                    );
                                                return unrealizedPnL >= 0
                                                    ? "+"
                                                    : "";
                                            })()}
                                            {(() => {
                                                const unrealizedPnL =
                                                    visibleOpenPositions.reduce(
                                                        (sum, p) => {
                                                            const { pnL } =
                                                                calculatePositionPnL(
                                                                    {
                                                                        type: p.type,
                                                                        shares: p.shares,
                                                                        entryPrice:
                                                                            p.entryPrice,
                                                                        currentPrice:
                                                                            currentPrice,
                                                                        unrealizedPnL: 0,
                                                                        unrealizedPnLPercent: 0,
                                                                    },
                                                                );
                                                            return sum + pnL;
                                                        },
                                                        0,
                                                    );
                                                return unrealizedPnL.toLocaleString();
                                            })()}
                                        </span>
                                    </p>
                                </div>
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* 企業情報モーダル */}
            {isCompanyInfoOpen && stockInfo && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setIsCompanyInfoOpen(false)}
                >
                    <div
                        className="bg-card rounded-xl border max-w-2xl w-full max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-card border-b px-6 py-4">
                            <h2 className="text-xl font-bold">
                                {stockInfo.symbol}
                            </h2>
                            <p className="text-lg text-muted-foreground">
                                {stockInfo.name}
                            </p>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* 基本情報 */}
                            <div className="grid grid-cols-2 gap-4">
                                {stockInfo.sector && (
                                    <div>
                                        <h3 className="text-sm font-medium text-muted-foreground mb-1">
                                            セクター
                                        </h3>
                                        <p className="text-base">
                                            {stockInfo.sector}
                                        </p>
                                    </div>
                                )}
                                {stockInfo.marketCapEstimate && (
                                    <div>
                                        <h3 className="text-sm font-medium text-muted-foreground mb-1">
                                            時価総額
                                        </h3>
                                        <p className="text-base font-semibold">
                                            {stockInfo.marketCapEstimate}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* 企業概要 */}
                            {stockInfo.description && (
                                <div>
                                    <h3 className="text-sm font-medium text-muted-foreground mb-2">
                                        企業概要
                                    </h3>
                                    <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                                        {stockInfo.description}
                                    </p>
                                </div>
                            )}

                            {!stockInfo.description &&
                                !stockInfo.sector &&
                                !stockInfo.marketCapEstimate && (
                                    <p className="text-muted-foreground text-center py-8">
                                        企業情報がありません
                                    </p>
                                )}
                        </div>
                        <div className="sticky bottom-0 bg-card border-t px-6 py-4">
                            <button
                                onClick={() => setIsCompanyInfoOpen(false)}
                                className="w-full py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* メインコンテンツ */}
            <main className="flex-1 min-h-0 overflow-hidden">
                <div className="max-w-[1920px] mx-auto h-full px-4 pt-4 pb-2">
                    <div className="h-full flex gap-4">
                        {/* チャート部分 */}
                        <div className="flex-1 min-w-0 bg-card rounded-lg border overflow-hidden">
                            <TradingChart
                                stockPrices={visiblePrices}
                                maSettings={currentSession.maSettings}
                                trades={visibleTrades}
                                onTradeClick={handleTradeClick}
                                height="100%"
                            />
                        </div>

                        {/* PC表示時の右側統計・履歴パネル */}
                        <div className="hidden lg:flex flex-col w-80 xl:w-96 gap-4 overflow-hidden">
                            {/* 統計パネル */}
                            <div className="bg-card rounded-lg border p-4 flex-shrink-0">
                                <h3 className="font-bold mb-3 text-sm">統計</h3>
                                <div className="grid grid-cols-2 gap-3 text-xs">
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground mb-1">
                                            取引回数
                                        </span>
                                        <span className="font-medium text-sm">
                                            {replayStats
                                                ? replayStats.tradeCount
                                                : currentSession.tradeCount}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground mb-1">
                                            勝率
                                        </span>
                                        <span className="font-medium text-sm">
                                            {replayStats
                                                ? replayStats.winRate.toFixed(1)
                                                : currentSession.winRate.toFixed(
                                                      1,
                                                  )}
                                            %
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground mb-1">
                                            資産増減
                                        </span>
                                        <span
                                            className={`font-medium text-sm ${
                                                currentSession.currentCapital >=
                                                currentSession.initialCapital
                                                    ? "text-green-500"
                                                    : "text-red-500"
                                            }`}
                                        >
                                            {currentSession.currentCapital >=
                                            currentSession.initialCapital
                                                ? "+"
                                                : ""}
                                            ¥
                                            {(
                                                currentSession.currentCapital -
                                                currentSession.initialCapital
                                            ).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground mb-1">
                                            資産増減率
                                        </span>
                                        <span
                                            className={`font-medium text-sm ${
                                                currentSession.currentCapital >=
                                                currentSession.initialCapital
                                                    ? "text-green-500"
                                                    : "text-red-500"
                                            }`}
                                        >
                                            {currentSession.currentCapital >=
                                            currentSession.initialCapital
                                                ? "+"
                                                : ""}
                                            {(
                                                ((currentSession.currentCapital -
                                                    currentSession.initialCapital) /
                                                    currentSession.initialCapital) *
                                                100
                                            ).toFixed(2)}
                                            %
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground mb-1">
                                            平均増益額
                                        </span>
                                        <span className="font-medium text-green-500 text-sm">
                                            +¥
                                            {(replayStats
                                                ? replayStats.avgProfit
                                                : profitStats.avgProfit
                                            ).toLocaleString(undefined, {
                                                maximumFractionDigits: 0,
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground mb-1">
                                            平均損失額
                                        </span>
                                        <span className="font-medium text-red-500 text-sm">
                                            ¥
                                            {(replayStats
                                                ? replayStats.avgLoss
                                                : profitStats.avgLoss
                                            ).toLocaleString(undefined, {
                                                maximumFractionDigits: 0,
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground mb-1">
                                            最大利益
                                        </span>
                                        <span className="font-medium text-green-500 text-sm">
                                            {(() => {
                                                const profits =
                                                    visibleClosedPositions.map(
                                                        (p) => p.profit || 0,
                                                    );
                                                const maxProfit =
                                                    profits.length > 0
                                                        ? Math.max(...profits)
                                                        : 0;
                                                return (
                                                    "+¥" +
                                                    maxProfit.toLocaleString(
                                                        undefined,
                                                        {
                                                            maximumFractionDigits: 0,
                                                        },
                                                    )
                                                );
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground mb-1">
                                            最大損失
                                        </span>
                                        <span className="font-medium text-red-500 text-sm">
                                            {(() => {
                                                const losses =
                                                    visibleClosedPositions
                                                        .map(
                                                            (p) =>
                                                                p.profit || 0,
                                                        )
                                                        .filter((p) => p < 0);
                                                const maxLoss =
                                                    losses.length > 0
                                                        ? Math.min(...losses)
                                                        : 0;
                                                return (
                                                    "¥" +
                                                    maxLoss.toLocaleString(
                                                        undefined,
                                                        {
                                                            maximumFractionDigits: 0,
                                                        },
                                                    )
                                                );
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground mb-1">
                                            総損益
                                        </span>
                                        <span
                                            className={`font-medium text-sm ${(() => {
                                                const totalPnL =
                                                    visibleClosedPositions.reduce(
                                                        (sum, p) =>
                                                            sum +
                                                            (p.profit || 0),
                                                        0,
                                                    );
                                                return totalPnL >= 0
                                                    ? "text-green-500"
                                                    : "text-red-500";
                                            })()}`}
                                        >
                                            {(() => {
                                                const totalPnL =
                                                    visibleClosedPositions.reduce(
                                                        (sum, p) =>
                                                            sum +
                                                            (p.profit || 0),
                                                        0,
                                                    );
                                                return (
                                                    (totalPnL >= 0 ? "+" : "") +
                                                    "¥" +
                                                    totalPnL.toLocaleString(
                                                        undefined,
                                                        {
                                                            maximumFractionDigits: 0,
                                                        },
                                                    )
                                                );
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-muted-foreground mb-1">
                                            ルール違反
                                        </span>
                                        <span className="font-medium text-red-500 text-sm">
                                            {currentSession.ruleViolations}回
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 保有ポジションパネル */}
                            <div className="bg-card rounded-lg border p-4 flex-shrink-0 max-h-[30vh] overflow-y-auto">
                                <h3 className="font-bold mb-3 text-sm">
                                    保有ポジション
                                </h3>
                                <PositionList
                                    positions={visibleOpenPositions}
                                    currentPrice={currentPrice}
                                    onClose={handleClosePosition}
                                />
                            </div>

                            {/* 取引履歴パネル */}
                            <div className="bg-card rounded-lg border p-4 flex-1 min-h-0 flex flex-col">
                                <h3 className="font-bold mb-3 text-sm flex-shrink-0">
                                    取引履歴
                                </h3>
                                <div className="flex-1 min-h-0 overflow-y-auto">
                                    <TradeHistory
                                        trades={visibleTrades}
                                        currentPrice={currentPrice}
                                        highlightedTradeId={highlightedTradeId}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* 下部コントロール */}
            <footer className="flex-shrink-0 bg-card border-t px-4 py-3">
                <div className="max-w-[1920px] mx-auto flex items-center justify-center gap-2">
                    {/* 再生/一時停止ボタン */}
                    <button
                        onClick={togglePlayPause}
                        disabled={
                            currentSession.currentDay >=
                            currentSession.periodDays
                        }
                        className="p-3 bg-primary hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground text-primary-foreground rounded-full transition-all hover:scale-105 disabled:hover:scale-100 shadow-lg"
                        title={isPlaying ? "一時停止" : "再生"}
                    >
                        {isPlaying ? (
                            <Pause className="w-5 h-5" />
                        ) : (
                            <Play className="w-5 h-5" />
                        )}
                    </button>

                    {/* 一日送りボタン */}
                    <button
                        onClick={() => {
                            pause();
                            advanceDay();
                        }}
                        disabled={
                            currentSession.currentDay >=
                            currentSession.periodDays
                        }
                        className="p-3 bg-secondary hover:bg-secondary/80 disabled:bg-muted disabled:text-muted-foreground text-secondary-foreground rounded-full transition-all hover:scale-105 disabled:hover:scale-100 shadow-lg"
                        title="1日送り"
                    >
                        <SkipForward className="w-5 h-5" />
                    </button>

                    {/* 進捗表示 */}
                    <div className="px-5 py-2.5 bg-muted/50 rounded-full text-sm font-semibold border border-border/50">
                        <span className="text-primary">
                            {currentSession.currentDay + 1}
                        </span>
                        <span className="text-muted-foreground mx-1">/</span>
                        <span className="text-muted-foreground">
                            {currentSession.periodDays}
                        </span>
                    </div>

                    {/* 速度設定 */}
                    <div className="relative group">
                        <button
                            className="p-3 bg-background hover:bg-accent border rounded-full transition-all hover:scale-105 shadow-lg"
                            title="速度設定"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                        <select
                            value={currentSession.playbackSpeed}
                            onChange={(e) => {
                                updateSession({
                                    playbackSpeed: Number(e.target.value),
                                });
                            }}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        >
                            <option value={0.5}>0.5秒/日</option>
                            <option value={1}>1秒/日</option>
                            <option value={2}>2秒/日</option>
                            <option value={3}>3秒/日</option>
                        </select>
                    </div>

                    <div className="w-px h-8 bg-border mx-2" />

                    {/* 注文ボタン（進行中のみ） */}
                    {currentSession.status !== "completed" && (
                        <button
                            onClick={() => setIsOrderModalOpen(true)}
                            className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-full transition-all hover:scale-105 shadow-lg"
                            title="注文"
                        >
                            <Plus className="w-5 h-5" />
                        </button>
                    )}

                    {/* 統計確認ボタン（モバイルのみ表示） */}
                    <button
                        onClick={() => setIsStatsModalOpen(true)}
                        className="lg:hidden p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-full transition-all hover:scale-105 shadow-lg"
                        title="統計・履歴"
                    >
                        <BarChart3 className="w-5 h-5" />
                    </button>
                </div>
            </footer>

            {/* 注文モーダル */}
            <OrderFormModal
                isOpen={isOrderModalOpen}
                onClose={() => setIsOrderModalOpen(false)}
                currentPrice={currentPrice}
                availableCapital={currentSession.currentCapital}
                openPositionCount={openPositions.length}
                totalPositionValue={totalPositionValue}
                onSubmit={handleOrder}
            />

            {/* 統計モーダル */}
            {isStatsModalOpen && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setIsStatsModalOpen(false)}
                >
                    <div
                        className="bg-card rounded-xl border max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-bold">
                                セッション統計・取引履歴
                            </h2>
                            <button
                                onClick={() => setIsStatsModalOpen(false)}
                                className="p-2 hover:bg-accent rounded-lg"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6 space-y-6">
                            {/* 統計 */}
                            <div className="bg-muted/50 rounded-lg p-4">
                                <h3 className="font-bold mb-3">統計</h3>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            取引回数
                                        </span>
                                        <span className="font-medium">
                                            {replayStats
                                                ? replayStats.tradeCount
                                                : currentSession.tradeCount}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            勝率
                                        </span>
                                        <span className="font-medium">
                                            {replayStats
                                                ? replayStats.winRate.toFixed(1)
                                                : currentSession.winRate.toFixed(
                                                      1,
                                                  )}
                                            %
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            資産増減
                                        </span>
                                        <span
                                            className={`font-medium ${
                                                currentSession.currentCapital >=
                                                currentSession.initialCapital
                                                    ? "text-green-500"
                                                    : "text-red-500"
                                            }`}
                                        >
                                            {currentSession.currentCapital >=
                                            currentSession.initialCapital
                                                ? "+"
                                                : ""}
                                            ¥
                                            {(
                                                currentSession.currentCapital -
                                                currentSession.initialCapital
                                            ).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            資産増減率
                                        </span>
                                        <span
                                            className={`font-medium ${
                                                currentSession.currentCapital >=
                                                currentSession.initialCapital
                                                    ? "text-green-500"
                                                    : "text-red-500"
                                            }`}
                                        >
                                            {currentSession.currentCapital >=
                                            currentSession.initialCapital
                                                ? "+"
                                                : ""}
                                            {(
                                                ((currentSession.currentCapital -
                                                    currentSession.initialCapital) /
                                                    currentSession.initialCapital) *
                                                100
                                            ).toFixed(2)}
                                            %
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            平均増益額
                                        </span>
                                        <span className="font-medium text-green-500">
                                            +¥
                                            {(replayStats
                                                ? replayStats.avgProfit
                                                : profitStats.avgProfit
                                            ).toLocaleString(undefined, {
                                                maximumFractionDigits: 0,
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            平均損失額
                                        </span>
                                        <span className="font-medium text-red-500">
                                            ¥
                                            {(replayStats
                                                ? replayStats.avgLoss
                                                : profitStats.avgLoss
                                            ).toLocaleString(undefined, {
                                                maximumFractionDigits: 0,
                                            })}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            最大利益
                                        </span>
                                        <span className="font-medium text-green-500">
                                            {(() => {
                                                const profits =
                                                    visibleClosedPositions.map(
                                                        (p) => p.profit || 0,
                                                    );
                                                const maxProfit =
                                                    profits.length > 0
                                                        ? Math.max(...profits)
                                                        : 0;
                                                return (
                                                    "+¥" +
                                                    maxProfit.toLocaleString(
                                                        undefined,
                                                        {
                                                            maximumFractionDigits: 0,
                                                        },
                                                    )
                                                );
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            最大損失
                                        </span>
                                        <span className="font-medium text-red-500">
                                            {(() => {
                                                const losses =
                                                    visibleClosedPositions
                                                        .map(
                                                            (p) =>
                                                                p.profit || 0,
                                                        )
                                                        .filter((p) => p < 0);
                                                const maxLoss =
                                                    losses.length > 0
                                                        ? Math.min(...losses)
                                                        : 0;
                                                return (
                                                    "¥" +
                                                    maxLoss.toLocaleString(
                                                        undefined,
                                                        {
                                                            maximumFractionDigits: 0,
                                                        },
                                                    )
                                                );
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            総損益
                                        </span>
                                        <span
                                            className={`font-medium ${(() => {
                                                const totalPnL =
                                                    visibleClosedPositions.reduce(
                                                        (sum, p) =>
                                                            sum +
                                                            (p.profit || 0),
                                                        0,
                                                    );
                                                return totalPnL >= 0
                                                    ? "text-green-500"
                                                    : "text-red-500";
                                            })()}`}
                                        >
                                            {(() => {
                                                const totalPnL =
                                                    visibleClosedPositions.reduce(
                                                        (sum, p) =>
                                                            sum +
                                                            (p.profit || 0),
                                                        0,
                                                    );
                                                return (
                                                    (totalPnL >= 0 ? "+" : "") +
                                                    "¥" +
                                                    totalPnL.toLocaleString(
                                                        undefined,
                                                        {
                                                            maximumFractionDigits: 0,
                                                        },
                                                    )
                                                );
                                            })()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">
                                            ルール違反
                                        </span>
                                        <span className="font-medium text-red-500">
                                            {currentSession.ruleViolations}回
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* 保有ポジション */}
                            <div>
                                <h3 className="font-bold mb-3">
                                    保有ポジション
                                </h3>
                                <PositionList
                                    positions={visibleOpenPositions}
                                    currentPrice={currentPrice}
                                    onClose={handleClosePosition}
                                />
                            </div>

                            {/* 取引履歴 */}
                            <div>
                                <h3 className="font-bold mb-3">取引履歴</h3>
                                <TradeHistory
                                    trades={visibleTrades}
                                    currentPrice={currentPrice}
                                    highlightedTradeId={highlightedTradeId}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* 感想・反省モーダル */}
            {isReflectionModalOpen && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
                    onClick={() => {
                        if (
                            currentSession.status === "completed" &&
                            !currentSession.reflection
                        ) {
                            // 完了時の初回入力の場合は閉じない
                            return;
                        }
                        setIsReflectionModalOpen(false);
                    }}
                >
                    <div
                        className="bg-card rounded-t-2xl sm:rounded-xl border max-w-2xl w-full flex flex-col max-h-[90vh] sm:max-h-[85vh]"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="sticky top-0 bg-card border-b px-6 py-4">
                            <h2 className="text-xl font-bold">
                                セッションの感想・反省
                            </h2>
                            <p className="text-sm text-muted-foreground mt-1">
                                今回のトレードを振り返って、学んだことや反省点を記録しましょう
                            </p>
                        </div>
                        <div className="p-6 overflow-y-auto flex-1">
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
                                rows={8}
                                className="w-full px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary text-base"
                                placeholder="例：&#10;・うまくいった点：移動平均線のクロスを見逃さず、早めにエントリーできた&#10;・反省点：損切りラインを守らず、含み損が大きくなってしまった&#10;・次回への改善：エントリー前に必ず損切りラインを設定する"
                                autoComplete="off"
                                style={{ fontSize: "16px" }}
                            />
                        </div>
                        <div className="sticky bottom-0 bg-card border-t px-6 py-4 flex gap-3">
                            {currentSession.status === "completed" &&
                            !currentSession.reflection ? (
                                <button
                                    onClick={() => {
                                        setReflection("");
                                        setIsReflectionModalOpen(false);
                                    }}
                                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-accent transition"
                                >
                                    後で入力
                                </button>
                            ) : (
                                <button
                                    onClick={() =>
                                        setIsReflectionModalOpen(false)
                                    }
                                    className="flex-1 px-4 py-2 border rounded-lg hover:bg-accent transition"
                                >
                                    キャンセル
                                </button>
                            )}
                            <button
                                onClick={saveReflection}
                                className="flex-1 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-medium transition"
                            >
                                保存
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
