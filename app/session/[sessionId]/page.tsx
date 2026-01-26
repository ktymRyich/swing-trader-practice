'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { db, generateTradeId, generatePositionId, generateViolationId } from '@/lib/db/schema';
import { useSessionStore } from '@/lib/store/sessionStore';
import { useLiveQuery } from 'dexie-react-hooks';
import TradingChart from '@/components/chart/TradingChart';
import OrderForm from '@/components/trading/OrderForm';
import PositionList from '@/components/trading/PositionList';
import PlaybackControls from '@/components/trading/PlaybackControls';
import { ArrowLeft, Save } from 'lucide-react';
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

  const handleClosePosition = async (positionId: string) => {
    console.log('=== handleClosePosition START ===');
    console.log('positionId:', positionId);
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
        memo: 'ポジション決済',
        capitalAfterTrade: currentSession.currentCapital + calculation.totalCost,
      };

      await db.trades.add(trade);

      // 資金を更新
      const newCapital = currentSession.currentCapital + calculation.totalCost;
      updateSession({ currentCapital: newCapital });
      await db.sessions.update(currentSession.id!, { currentCapital: newCapital });

      // ポジションを決済済みに
      const profit = calculation.totalCost - (position.entryPrice * position.shares);
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600">セッションを読み込み中...</p>
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
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg">
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div>
                <h1 className="text-xl font-bold">
                  {currentSession.stockName} ({currentSession.symbol})
                </h1>
                <p className="text-sm text-gray-500">
                  資金: ¥{currentSession.currentCapital.toLocaleString()}
                </p>
              </div>
            </div>
            <button
              onClick={handleSaveAndExit}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
            >
              <Save className="w-4 h-4" />
              保存して終了
            </button>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* 左カラム - チャートと制御 */}
          <div className="lg:col-span-2 space-y-6">
            <TradingChart
              stockPrices={visiblePrices}
              maSettings={currentSession.maSettings}
              height={400}
            />
            
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

            <PositionList
              positions={openPositions}
              currentPrice={currentPrice}
              onClose={handleClosePosition}
            />
          </div>

          {/* 右カラム - 注文フォームと統計 */}
          <div className="space-y-6">
            <OrderForm
              currentPrice={currentPrice}
              availableCapital={currentSession.currentCapital}
              openPositionCount={openPositions.length}
              totalPositionValue={totalPositionValue}
              onSubmit={handleOrder}
            />

            {/* 統計 */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-bold mb-3">セッション統計</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">取引回数</span>
                  <span className="font-medium">{currentSession.tradeCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">勝率</span>
                  <span className="font-medium">{currentSession.winRate.toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">資金増減</span>
                  <span className={`font-medium ${
                    currentSession.currentCapital >= currentSession.initialCapital
                      ? 'text-green-600'
                      : 'text-red-600'
                  }`}>
                    {currentSession.currentCapital >= currentSession.initialCapital ? '+' : ''}
                    {((currentSession.currentCapital - currentSession.initialCapital) / currentSession.initialCapital * 100).toFixed(2)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ルール違反</span>
                  <span className="font-medium text-red-600">
                    {currentSession.ruleViolations}回
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
