'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { db, generateTradeId, generatePositionId, generateViolationId } from '@/lib/db/schema';
import { useSessionStore } from '@/lib/store/sessionStore';
import { useLiveQuery } from 'dexie-react-hooks';
import TradingChart from '@/components/chart/TradingChart';
import OrderFormModal from '@/components/trading/OrderFormModal';
import PositionList from '@/components/trading/PositionList';
import PlaybackControls from '@/components/trading/PlaybackControls';
import TradeHistory from '@/components/trading/TradeHistory';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { calculateBuyOrder, calculateSellOrder } from '@/lib/trading/calculator';
import { checkAllRules } from '@/lib/trading/rules';

export default function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
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

  const [isLoading, setIsLoading] = useState(true);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCompanyInfoOpen, setIsCompanyInfoOpen] = useState(false);
  const [highlightedTradeId, setHighlightedTradeId] = useState<string | null>(null);
  const [stockInfo, setStockInfo] = useState<{ name: string; symbol: string; description?: string; sector?: string } | null>(null);

  // 決済済みポジションをリアルタイムで取得して統計計算
  const closedPositions = useLiveQuery(
    () => db.positions
      .where('sessionId')
      .equals(sessionId)
      .and(p => p.status === 'closed')
      .toArray(),
    [sessionId]
  );

  // 取引履歴をリアルタイムで取得
  const trades = useLiveQuery(
    () => db.trades
      .where('sessionId')
      .equals(sessionId)
      .toArray(),
    [sessionId]
  );

  // 平均増益額と平均損額を計算
  const profitStats = closedPositions ? (() => {
    const profits = closedPositions.filter(p => (p.profit || 0) > 0);
    const losses = closedPositions.filter(p => (p.profit || 0) < 0);
    
    return {
      avgProfit: profits.length > 0 
        ? profits.reduce((sum, p) => sum + (p.profit || 0), 0) / profits.length
        : 0,
      avgLoss: losses.length > 0
        ? losses.reduce((sum, p) => sum + (p.profit || 0), 0) / losses.length
        : 0,
    };
  })() : { avgProfit: 0, avgLoss: 0 };

  // モーダル開閉時に自動再生を一時停止
  useEffect(() => {
    if (isOrderModalOpen && isPlaying) {
      pause();
    }
  }, [isOrderModalOpen]);

  // セッションとデータを読み込み
  useEffect(() => {
    // まずストアをリセット
    reset();
    loadSession();
  }, [sessionId]);

  // 自動再生タイマー
  useEffect(() => {
    if (!isPlaying || !currentSession) return;

    const timer = setInterval(() => {
      const practiceStartIndex = currentSession.practiceStartIndex || 0;
      const practiceEndIndex = practiceStartIndex + currentSession.periodDays - 1;
      
      if (currentPriceIndex >= practiceEndIndex) {
        pause();
        completeSession();
      } else {
        advanceDay();
      }
    }, currentSession.playbackSpeed * 1000);

    return () => clearInterval(timer);
  }, [isPlaying, currentPriceIndex, stockPrices.length, currentSession]);

  // ルール違反チェック（1日ごと）
  useEffect(() => {
    if (openPositions.length === 0 || !currentSession) return;
    if (visiblePrices.length === 0) return;

    const currentPrice = visiblePrices[visiblePrices.length - 1].close;
    
    const positionsWithPrice = openPositions.map(p => ({
      type: p.type,
      shares: p.shares,
      entryPrice: p.entryPrice,
      currentPrice,
    }));

    const totalPositionValue = openPositions.reduce(
      (sum, p) => sum + p.shares * currentPrice,
      0
    );

    const violations = checkAllRules({
      openPositions: positionsWithPrice,
      currentCapital: currentSession.currentCapital,
      totalPositionValue,
    });

    // 新しい違反があれば記録
    violations.forEach(async (v) => {
      const violation = {
        id: generateViolationId(),
        sessionId: currentSession.id!,
        timestamp: new Date().toISOString(),
        type: v.type,
        description: v.description,
        severity: v.severity,
      };
      
      await db.ruleViolations.add(violation);
      
      // セッションの違反カウントを更新
      const currentViolations = currentSession.ruleViolations || 0;
      updateSession({ ruleViolations: currentViolations + 1 });
      await db.sessions.update(currentSession.id!, { 
        ruleViolations: currentViolations + 1 
      });
    });
  }, [currentPriceIndex]);

  const loadSession = async () => {
    try {
      const session = await db.sessions.get(sessionId);
      if (!session) {
        alert('セッションが見つかりません');
        router.push('/');
        return;
      }

      // 株式情報を取得
      const stock = await db.stocks.where('symbol').equals(session.symbol).first();
      if (stock) {
        setStockInfo({
          name: stock.name,
          symbol: stock.symbol,
          description: stock.description,
          sector: stock.sector,
        });
      }

      // 株価データを読み込み
      const prices = await db.stockPrices
        .where('symbol')
        .equals(session.symbol)
        .and(p => p.date >= session.startDateOfData && p.date <= session.endDateOfData)
        .sortBy('date');

      // ポジションを読み込み
      const positions = await db.positions
        .where('sessionId')
        .equals(sessionId)
        .toArray();
      
      const openPos = positions.filter(p => p.status === 'open');
      const closedPos = positions.filter(p => p.status === 'closed');

      // 取引履歴を読み込み
      const trades = await db.trades
        .where('sessionId')
        .equals(sessionId)
        .toArray();

      // ストアに状態をセット（正しい順序で）
      setSession(session);
      // まず価格データをセット
      setStockPrices(prices);
      // その後に過去データ分を考慮してインデックスを設定（これでvisiblePricesが正しく計算される）
      const practiceStartIndex = session.practiceStartIndex || 0;
      const actualIndex = practiceStartIndex + (session.currentDay || 0);
      setCurrentPriceIndex(actualIndex);
      // ポジションと取引履歴をセット
      setOpenPositions(openPos);
      setClosedPositions(closedPos);
      setTrades(trades);

      setIsLoading(false);
    } catch (error) {
      console.error('セッション読み込みエラー:', error);
      alert('セッションの読み込みに失敗しました');
      router.push('/');
    }
  };

  const handleOrder = async (order: {
    type: 'buy' | 'sell';
    tradingType: 'spot' | 'margin';
    shares: number;
    price: number;
    memo: string;
  }) => {
    if (!currentSession) return;

    try {
      // 再生を一時停止
      pause();

      const { type, tradingType, shares, price, memo } = order;
      const calculation = type === 'buy'
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
        isShort: type === 'sell' && tradingType === 'margin',
        shares,
        price,
        fee: calculation.fee,
        slippage: calculation.slippage,
        totalCost: calculation.totalCost,
        memo,
        capitalAfterTrade: currentSession.currentCapital - (type === 'buy' ? calculation.totalCost : -calculation.totalCost),
      };

      await db.trades.add(trade);

      // 資金を更新
      const newCapital = type === 'buy'
        ? currentSession.currentCapital - calculation.totalCost
        : currentSession.currentCapital + calculation.totalCost;

      updateSession({ currentCapital: newCapital });
      await db.sessions.update(currentSession.id!, { currentCapital: newCapital });

      // ポジションを更新
      if (type === 'buy') {
        // 買い注文 → ロングポジション作成
        const position = {
          id: generatePositionId(),
          sessionId: currentSession.id!,
          openTradeId: trade.id!,
          type: 'long' as const,
          tradingType,
          shares,
          entryPrice: price,
          entryDate: trade.tradeDate,
          status: 'open' as const,
        };

        await db.positions.add(position);
        setOpenPositions([...openPositions, position]);
      } else if (type === 'sell') {
        if (tradingType === 'margin') {
          // 信用売り → ショートポジション作成
          const position = {
            id: generatePositionId(),
            sessionId: currentSession.id!,
            openTradeId: trade.id!,
            type: 'short' as const,
            tradingType: 'margin' as const,
            shares,
            entryPrice: price,
            entryDate: trade.tradeDate,
            status: 'open' as const,
          };

          await db.positions.add(position);
          setOpenPositions([...openPositions, position]);
        } else {
          // 現物売り → エラー（現物売りはポジション決済のみ）
          alert('現物売りはできません。保有ポジションの決済ボタンから売却してください。');
          return;
        }
      }

      // 取引履歴を更新
      const allTrades = await db.trades.where('sessionId').equals(sessionId).toArray();
      setTrades(allTrades);

      // 統計を更新（決済済みポジションのみカウント）
      const allClosedPositions = await db.positions
        .where('sessionId')
        .equals(sessionId)
        .and(p => p.status === 'closed')
        .toArray();

      const winCount = allClosedPositions.filter(p => (p.profit || 0) > 0).length;
      const winRate = allClosedPositions.length > 0 ? (winCount / allClosedPositions.length) * 100 : 0;

      updateSession({
        tradeCount: allClosedPositions.length,
        winCount,
        winRate,
      });
      await db.sessions.update(currentSession.id!, {
        tradeCount: allClosedPositions.length,
        winCount,
        winRate,
      });

      alert('注文が完了しました');
    } catch (error) {
      console.error('注文エラー:', error);
      alert('注文の処理に失敗しました');
    }
  };

  const handleClosePosition = async (positionId: string, memo: string = 'ポジション決済') => {
    console.log('=== handleClosePosition START ===');
    console.log('positionId:', positionId);
    console.log('memo:', memo);
    console.log('currentSession:', currentSession);
    console.log('openPositions:', openPositions);
    console.log('visiblePrices length:', visiblePrices.length);
    
    if (!currentSession) {
      console.error('No current session');
      alert('セッション情報が見つかりません');
      return;
    }

    const position = openPositions.find(p => p.id === positionId);
    if (!position) {
      console.error('Position not found:', positionId);
      alert('ポジションが見つかりません');
      return;
    }

    if (visiblePrices.length === 0) {
      console.error('No visible prices');
      alert('価格データがありません');
      return;
    }

    const currentPrice = visiblePrices[visiblePrices.length - 1].close;
    console.log('Current price:', currentPrice, 'Position:', position);
    console.log('Starting close process...');

    try {
      // 再生を一時停止
      pause();

      // 決済取引を作成
      const calculation = calculateSellOrder(
        currentPrice,
        position.shares,
        position.tradingType
      );

      // 資金変動を計算
      let capitalChange: number;
      if (position.type === 'long') {
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
        type: 'sell' as const,
        tradingType: position.tradingType,
        isShort: false,
        shares: position.shares,
        price: currentPrice,
        fee: calculation.fee,
        slippage: calculation.slippage,
        totalCost: calculation.totalCost,
        memo: memo,
        capitalAfterTrade: currentSession.currentCapital + capitalChange,
      };

      await db.trades.add(trade);

      // 資金を更新
      const newCapital = currentSession.currentCapital + capitalChange;
      updateSession({ currentCapital: newCapital });
      await db.sessions.update(currentSession.id!, { currentCapital: newCapital });

      // ポジションを決済済みに
      let profit: number;
      if (position.type === 'long') {
        // ロング：売却額 - 購入額
        profit = calculation.totalCost - (position.entryPrice * position.shares);
      } else {
        // ショート：売却額（エントリー時） - 買戻額（現在）
        // エントリー時の受取額を再計算
        const entryCalculation = calculateSellOrder(
          position.entryPrice,
          position.shares,
          position.tradingType
        );
        profit = entryCalculation.totalCost - calculation.totalCost;
      }
      const profitRate = (profit / (position.entryPrice * position.shares)) * 100;

      await db.positions.update(positionId, {
        status: 'closed',
        closeTradeId: trade.id,
        exitPrice: currentPrice,
        exitDate: trade.tradeDate,
        profit,
        profitRate,
      });

      // 統計を更新
      const allPositions = await db.positions
        .where('sessionId')
        .equals(sessionId)
        .and(p => p.status === 'closed')
        .toArray();

      const winCount = allPositions.filter(p => (p.profit || 0) > 0).length;
      const winRate = (winCount / allPositions.length) * 100;

      updateSession({
        tradeCount: allPositions.length,
        winCount,
        winRate,
      });
      await db.sessions.update(currentSession.id!, {
        tradeCount: allPositions.length,
        winCount,
        winRate,
      });

      // 状態を更新
      const updatedOpenPositions = openPositions.filter(p => p.id !== positionId);
      setOpenPositions(updatedOpenPositions);

      // 決済済みポジションリストも更新
      const allClosedPositions = await db.positions
        .where('sessionId')
        .equals(sessionId)
        .and(p => p.status === 'closed')
        .toArray();
      setClosedPositions(allClosedPositions);

      const allTrades = await db.trades.where('sessionId').equals(sessionId).toArray();
      setTrades(allTrades);

      console.log('=== handleClosePosition SUCCESS ===');
      alert('ポジションを決済しました');
    } catch (error) {
      console.error('=== handleClosePosition ERROR ===');
      console.error('決済エラー:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
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
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      
      // 2秒後にハイライトを解除
      setTimeout(() => setHighlightedTradeId(null), 2000);
    }
  };

  const completeSession = async () => {
    if (!currentSession) return;

    try {
      updateSession({ status: 'completed', endDate: new Date().toISOString() });
      await db.sessions.update(currentSession.id!, {
        status: 'completed',
        endDate: new Date().toISOString(),
      });

      alert('セッションが完了しました！');
      router.push('/history');
    } catch (error) {
      console.error('セッション完了エラー:', error);
    }
  };

  const handleSaveAndExit = async () => {
    if (!currentSession) return;

    if (confirm('セッションを保存して終了しますか？')) {
      try {
        updateSession({ status: 'paused' });
        await db.sessions.update(currentSession.id!, { status: 'paused' });
        router.push('/');
      } catch (error) {
        console.error('保存エラー:', error);
        alert('保存に失敗しました');
      }
    }
  };

  if (isLoading || !currentSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">セッションを読み込み中...</p>
        </div>
      </div>
    );
  }

  const currentPrice = visiblePrices.length > 0
    ? visiblePrices[visiblePrices.length - 1].close
    : 0;

  const totalPositionValue = openPositions.reduce(
    (sum, p) => sum + p.shares * currentPrice,
    0
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="bg-card border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-2">
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
                    {currentSession.symbol} - {currentSession.stockName}
                  </h1>
                  <p className="text-xs text-muted-foreground">
                    資金: ¥{currentSession.currentCapital.toLocaleString()}
                  </p>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 企業情報モーダル */}
      {isCompanyInfoOpen && stockInfo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsCompanyInfoOpen(false)}>
          <div 
            className="bg-card rounded-xl border max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-card border-b px-6 py-4">
              <h2 className="text-xl font-bold">{stockInfo.symbol}</h2>
              <p className="text-lg text-muted-foreground">{stockInfo.name}</p>
            </div>
            <div className="p-6 space-y-4">
              {stockInfo.sector && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">セクター</h3>
                  <p className="text-base">{stockInfo.sector}</p>
                </div>
              )}
              {stockInfo.description && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-1">企業概要</h3>
                  <p className="text-base leading-relaxed">{stockInfo.description}</p>
                </div>
              )}
              {!stockInfo.description && !stockInfo.sector && (
                <p className="text-muted-foreground text-center py-8">企業情報がありません</p>
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
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* 左カラム - チャートと制御 */}
          <div className="lg:col-span-2 space-y-6">
            <TradingChart
              stockPrices={currentSession.status === 'completed' ? stockPrices : visiblePrices}
              maSettings={currentSession.maSettings}
              trades={trades}
              onTradeClick={handleTradeClick}
            />
            
            {currentSession.status !== 'completed' && (
              <PlaybackControls
                isPlaying={isPlaying}
                currentDay={currentSession.currentDay + 1}
                totalDays={currentSession.periodDays}
                playbackSpeed={currentSession.playbackSpeed}
                onTogglePlay={togglePlayPause}
                onNext={() => {
                  pause();
                  advanceDay();
                }}
                onSpeedChange={(speed) => {
                  updateSession({ playbackSpeed: speed });
                  db.sessions.update(currentSession.id!, { playbackSpeed: speed });
                }}
              />
            )}

            {/* 注文ボタン（スマホ用、セッション進行中のみ） */}
            {currentSession.status !== 'completed' && (
              <button
                onClick={() => setIsOrderModalOpen(true)}
                className="lg:hidden w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold flex items-center justify-center gap-2 transition"
              >
                <Plus className="w-5 h-5" />
                注文
              </button>
            )}

            <PositionList
              positions={openPositions}
              currentPrice={currentPrice}
              onClose={handleClosePosition}
            />

            {/* 取引履歴 */}
            <TradeHistory
              trades={trades || []}
              currentPrice={currentPrice}
              highlightedTradeId={highlightedTradeId}
            />
          </div>

          {/* 右カラム - 統計 */}
          <div className="space-y-6">
            {/* 統計 */}
            <div className="bg-card rounded-lg border p-4">
              <h3 className="font-bold mb-3">セッション統計</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">取引回数</span>
                  <span className="font-medium">{currentSession.tradeCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">勝率</span>
                  <span className="font-medium">{currentSession.winRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">平均増益額</span>
                  <span className="font-medium text-green-500">
                    +¥{profitStats.avgProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">平均損失額</span>
                  <span className="font-medium text-red-500">
                    ¥{profitStats.avgLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">資金増減</span>
                  <span className={`font-medium ${
                    currentSession.currentCapital >= currentSession.initialCapital
                      ? 'text-green-500'
                      : 'text-red-500'
                  }`}>
                    {currentSession.currentCapital >= currentSession.initialCapital ? '+' : ''}
                    {((currentSession.currentCapital - currentSession.initialCapital) / currentSession.initialCapital * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">ルール違反</span>
                  <span className="font-medium text-red-500">
                    {currentSession.ruleViolations}回
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

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
    </div>
  );
}
