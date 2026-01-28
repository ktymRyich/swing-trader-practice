'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { generateTradeId, generatePositionId, generateViolationId } from '@/lib/db/schema';
import { useSessionStore } from '@/lib/store/sessionStore';
import TradingChart from '@/components/chart/TradingChart';
import OrderFormModal from '@/components/trading/OrderFormModal';
import PositionList from '@/components/trading/PositionList';
import PlaybackControls from '@/components/trading/PlaybackControls';
import TradeHistory from '@/components/trading/TradeHistory';
import { ArrowLeft, Plus } from 'lucide-react';
import Link from 'next/link';
import { calculateBuyOrder, calculateSellOrder, calculatePositionPnL } from '@/lib/trading/calculator';

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

  const [nickname, setNickname] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isCompanyInfoOpen, setIsCompanyInfoOpen] = useState(false);
  const [highlightedTradeId, setHighlightedTradeId] = useState<string | null>(null);
  const [stockInfo, setStockInfo] = useState<{ 
    name: string; 
    symbol: string; 
    description?: string; 
    sector?: string;
    marketCapEstimate?: string;
  } | null>(null);
  const [closedPositions, setLocalClosedPositions] = useState<any[]>([]);
  const [trades, setLocalTrades] = useState<any[]>([]);

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
    const savedNickname = localStorage.getItem('userNickname');
    if (!savedNickname) {
      router.push('/login');
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

  // 既に記録済みの違反を追跡（ポジションID + 違反タイプ）
  const [recordedViolations, setRecordedViolations] = useState<Set<string>>(new Set());

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
      severity: 'warning' | 'critical';
    }> = [];

    for (const position of openPositions) {
      // 損切りルール違反チェック
      const { pnLPercent } = calculatePositionPnL({
        type: position.type,
        shares: position.shares,
        entryPrice: position.entryPrice,
        currentPrice: currentPrice,
        unrealizedPnL: 0,
        unrealizedPnLPercent: 0
      });

      const positionId = position.id || `pos_${position.entryDate}_${position.shares}`;

      if (pnLPercent < -10) {
        const violationKey = `${positionId}_stop_loss`;
        if (!recordedViolations.has(violationKey)) {
          newViolations.push({
            positionId,
            type: 'stop_loss',
            description: `含み損が${pnLPercent.toFixed(2)}%に達しています（損切りライン: -10%）`,
            severity: 'critical',
          });
        }
      }

      // ポジションサイズ違反チェック
      const positionValue = position.shares * currentPrice;
      const sizePercent = (positionValue / currentSession.currentCapital) * 100;
      if (sizePercent > 30) {
        const violationKey = `${positionId}_position_size`;
        if (!recordedViolations.has(violationKey)) {
          newViolations.push({
            positionId,
            type: 'position_size',
            description: `ポジションサイズが${sizePercent.toFixed(1)}%です（上限: 30%）`,
            severity: 'warning',
          });
        }
      }
    }

    // 同時保有数違反チェック（セッション単位で1回のみ）
    if (openPositions.length > 3) {
      const violationKey = 'session_max_positions';
      if (!recordedViolations.has(violationKey)) {
        newViolations.push({
          positionId: 'session',
          type: 'max_positions',
          description: `${openPositions.length}銘柄を同時保有しています（上限: 3銘柄）`,
          severity: 'warning',
        });
      }
    }

    // レバレッジ違反チェック（セッション単位で1回のみ）
    const totalPositionValue = openPositions.reduce(
      (sum, p) => sum + p.shares * currentPrice,
      0
    );
    const leverage = totalPositionValue / currentSession.currentCapital;
    if (leverage > 2) {
      const violationKey = 'session_leverage';
      if (!recordedViolations.has(violationKey)) {
        newViolations.push({
          positionId: 'session',
          type: 'leverage',
          description: `レバレッジが${leverage.toFixed(2)}倍です（推奨上限: 2倍）`,
          severity: 'critical',
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
        violations: updatedViolations
      });

      // サーバーに保存
      saveSession({
        ...currentSession,
        ruleViolations: violationCount,
        violations: updatedViolations
      });
    }
  }, [currentPriceIndex, openPositions.length]);

  const saveSession = async (session: any) => {
    if (!nickname) return;
    
    try {
      // 株価データを除外してセッションを保存
      const { prices, ...sessionWithoutPrices } = session;
      
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname, session: sessionWithoutPrices })
      });
    } catch (error) {
      console.error('セッション保存エラー:', error);
    }
  };

  const loadSession = async (userNickname: string) => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}?nickname=${userNickname}`);
      const data = await response.json();

      if (!data.success) {
        alert('セッションが見つかりません');
        router.push('/');
        return;
      }

      const session = data.session;

      // 株価データを動的に読み込む
      const pricesResponse = await fetch(`/api/stocks/prices/${session.symbol}?startDate=${session.startDateOfData}&endDate=${session.endDateOfData}`);
      const pricesData = await pricesResponse.json();
      
      if (!pricesData.success || !pricesData.prices || pricesData.prices.length === 0) {
        alert('株価データの読み込みに失敗しました');
        router.push('/');
        return;
      }

      // 株式情報を設定（セッションデータになければstocks.jsonから取得）
      let stockDescription = session.stockDescription;
      let stockMarketCapEstimate = session.stockMarketCapEstimate;
      
      if (!stockDescription || !stockMarketCapEstimate) {
        try {
          const stocksResponse = await fetch('/api/stocks/cached');
          const stocksData = await stocksResponse.json();
          if (stocksData.success) {
            const stock = stocksData.stocks.find((s: any) => s.symbol === session.symbol);
            if (stock) {
              stockDescription = stock.description || stockDescription;
              stockMarketCapEstimate = stock.marketCapEstimate || stockMarketCapEstimate;
            }
          }
        } catch (error) {
          console.error('株式情報の取得エラー:', error);
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
      const actualIndex = practiceStartIndex + (session.currentDay || 0);
      setCurrentPriceIndex(actualIndex);
      // ポジションと取引履歴をセット
      const openPos = (session.positions || []).filter((p: any) => p.status === 'open');
      const closedPos = (session.positions || []).filter((p: any) => p.status === 'closed');
      setOpenPositions(openPos);
      setClosedPositions(closedPos);
      setLocalClosedPositions(closedPos);
      setTrades(session.trades || []);
      setLocalTrades(session.trades || []);

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
    if (!currentSession || !nickname) return;

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

      // 資金を更新
      const newCapital = type === 'buy'
        ? currentSession.currentCapital - calculation.totalCost
        : currentSession.currentCapital + calculation.totalCost;

      let updatedPositions = [...(currentSession.positions || [])];
      let updatedOpenPositions = [...openPositions];

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

        updatedPositions.push(position);
        updatedOpenPositions.push(position);
        setOpenPositions(updatedOpenPositions);
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

          updatedPositions.push(position);
          updatedOpenPositions.push(position);
          setOpenPositions(updatedOpenPositions);
        } else {
          // 現物売り → エラー（現物売りはポジション決済のみ）
          alert('現物売りはできません。保有ポジションの決済ボタンから売却してください。');
          return;
        }
      }

      // 取引履歴を更新
      const updatedTrades = [...(currentSession.trades || []), trade];
      setTrades(updatedTrades);
      setLocalTrades(updatedTrades);

      // 統計を更新（決済済みポジションのみカウント）
      const allClosedPositions = updatedPositions.filter(p => p.status === 'closed');
      const winCount = allClosedPositions.filter(p => (p.profit || 0) > 0).length;
      const winRate = allClosedPositions.length > 0 ? (winCount / allClosedPositions.length) * 100 : 0;

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
    
    if (!currentSession || !nickname) {
      console.error('No current session or nickname');
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

      // 資金を更新
      const newCapital = currentSession.currentCapital + capitalChange;

      // 利益を計算
      let profit: number;
      if (position.type === 'long') {
        // ロング：売却額 - 購入額
        profit = calculation.totalCost - (position.entryPrice * position.shares);
      } else {
        // ショート：売却額（エントリー時） - 買戻額（現在）
        const entryCalculation = calculateSellOrder(
          position.entryPrice,
          position.shares,
          position.tradingType
        );
        profit = entryCalculation.totalCost - calculation.totalCost;
      }
      const profitRate = (profit / (position.entryPrice * position.shares)) * 100;

      // ポジションを更新
      let updatedPositions = [...(currentSession.positions || [])];
      const posIndex = updatedPositions.findIndex(p => p.id === positionId);
      if (posIndex >= 0) {
        updatedPositions[posIndex] = {
          ...updatedPositions[posIndex],
          status: 'closed',
          closeTradeId: trade.id,
          exitPrice: currentPrice,
          exitDate: trade.tradeDate,
          profit,
          profitRate,
        };
      }

      // 統計を更新
      const allClosedPositions = updatedPositions.filter(p => p.status === 'closed');
      const winCount = allClosedPositions.filter(p => (p.profit || 0) > 0).length;
      const winRate = allClosedPositions.length > 0 ? (winCount / allClosedPositions.length) * 100 : 0;

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
      const updatedOpenPositions = openPositions.filter(p => p.id !== positionId);
      setOpenPositions(updatedOpenPositions);
      
      const closedPos = updatedPositions.filter(p => p.status === 'closed');
      setClosedPositions(closedPos);
      setLocalClosedPositions(closedPos);
      
      setTrades(updatedTrades);
      setLocalTrades(updatedTrades);

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
    if (!currentSession || !nickname) return;

    try {
      const updatedSession = {
        ...currentSession,
        status: 'completed',
        endDate: new Date().toISOString(),
      };
      
      updateSession(updatedSession);
      await saveSession(updatedSession);

      alert('セッションが完了しました！');
      router.push('/history');
    } catch (error) {
      console.error('セッション完了エラー:', error);
    }
  };

  const handleSaveAndExit = async () => {
    if (!currentSession || !nickname) return;

    // 完了済みセッションは確認なしで戻る
    if (currentSession.status === 'completed') {
      router.push('/');
      return;
    }

    if (confirm('セッションを保存して終了しますか？')) {
      try {
        const updatedSession = {
          ...currentSession,
          status: 'paused',
          currentDay: currentPriceIndex - (currentSession.practiceStartIndex || 0),
        };
        
        updateSession(updatedSession);
        await saveSession(updatedSession);
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
        <div className="max-w-[1600px] mx-auto px-4 py-2">
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
            className="bg-card rounded-xl border max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-card border-b px-6 py-4">
              <h2 className="text-xl font-bold">{stockInfo.symbol}</h2>
              <p className="text-lg text-muted-foreground">{stockInfo.name}</p>
            </div>
            <div className="p-6 space-y-6">
              {/* 基本情報 */}
              <div className="grid grid-cols-2 gap-4">
                {stockInfo.sector && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">セクター</h3>
                    <p className="text-base">{stockInfo.sector}</p>
                  </div>
                )}
                {stockInfo.marketCapEstimate && (
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-1">時価総額</h3>
                    <p className="text-base font-semibold">
                      {stockInfo.marketCapEstimate}
                    </p>
                  </div>
                )}
              </div>

              {/* 企業概要 */}
              {stockInfo.description && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">企業概要</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap">
                    {stockInfo.description}
                  </p>
                </div>
              )}

              {!stockInfo.description && !stockInfo.sector && !stockInfo.marketCapEstimate && (
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
      <main className="max-w-[1600px] mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* 左カラム - チャートと制御 */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-card rounded-lg border p-2">
              <TradingChart
                stockPrices={currentSession.status === 'completed' ? stockPrices : visiblePrices}
                maSettings={currentSession.maSettings}
                trades={trades}
                onTradeClick={handleTradeClick}
                height={600}
              />
            </div>
            
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
            {/* 注文ボタン（PC用、セッション進行中のみ） */}
            {currentSession.status !== 'completed' && (
              <button
                onClick={() => setIsOrderModalOpen(true)}
                className="hidden lg:flex w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg font-bold items-center justify-center gap-2 transition"
              >
                <Plus className="w-5 h-5" />
                注文
              </button>
            )}

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
