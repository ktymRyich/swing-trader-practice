'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, History, Settings, TrendingUp, HelpCircle, X, Info, LogOut } from 'lucide-react';
import Link from 'next/link';
import { COLOR_DESCRIPTIONS } from '@/lib/constants/colors';

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [isStatsInfoOpen, setIsStatsInfoOpen] = useState(false);
  const [nickname, setNickname] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);

  // ログインチェック
  useEffect(() => {
    const savedNickname = localStorage.getItem('userNickname');
    if (!savedNickname) {
      router.push('/login');
    } else {
      setNickname(savedNickname);
      loadSessions(savedNickname);
    }
  }, [router]);

  const loadSessions = async (nickname: string) => {
    try {
      const response = await fetch(`/api/sessions?nickname=${nickname}`);
      const data = await response.json();
      
      if (data.success) {
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error('セッション読み込みエラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    if (confirm('ログアウトしますか？')) {
      localStorage.removeItem('userNickname');
      router.push('/login');
    }
  };

  // 統計情報を計算
  const stats = sessions.length > 0 ? (() => {
    const completed = sessions.filter((s: any) => s.status === 'completed').sort((a: any, b: any) => 
      new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
    );
    
    if (completed.length === 0) {
      return null;
    }

    // 各セッションの損益率を計算
    const profitRates = completed.map((s: any) => 
      ((s.currentCapital - s.initialCapital) / s.initialCapital) * 100
    );
    
    // 累積損益率
    let cumulativeProfit = 0;
    const cumulativeProfits = completed.map((s: any) => {
      const profit = ((s.currentCapital - s.initialCapital) / s.initialCapital) * 100;
      cumulativeProfit += profit;
      return cumulativeProfit;
    });

    // 収益性の計算
    const profitableSessions = completed.filter((s: any) => s.currentCapital > s.initialCapital);
    const lossSessions = completed.filter((s: any) => s.currentCapital < s.initialCapital);
    
    const totalProfit = profitableSessions.reduce((sum: number, s: any) => 
      sum + (s.currentCapital - s.initialCapital), 0
    );
    const totalLoss = Math.abs(lossSessions.reduce((sum: number, s: any) => 
      sum + (s.currentCapital - s.initialCapital), 0
    ));
    
    const profitFactor = totalLoss > 0 ? totalProfit / totalLoss : totalProfit > 0 ? 999 : 0;
    
    // 期待値（平均損益率）
    const expectancy = profitRates.reduce((sum, r) => sum + r, 0) / profitRates.length;
    
    // 最大ドローダウン
    let maxDrawdown = 0;
    let peak = cumulativeProfits[0] || 0;
    for (const profit of cumulativeProfits) {
      if (profit > peak) {
        peak = profit;
      }
      const drawdown = peak - profit;
      if (drawdown > maxDrawdown) {
        maxDrawdown = drawdown;
      }
    }

    // 全取引の統計（allClosedPositionsを使用）
    const allProfitTrades = allClosedPositions?.filter(p => (p.profit || 0) > 0).length || 0;
    const allTotalTrades = allClosedPositions?.length || 0;
    const tradeWinRate = allTotalTrades > 0 ? (allProfitTrades / allTotalTrades) * 100 : 0;

    // 平均取引回数
    const avgTradesPerSession = completed.reduce((sum, s) => sum + s.tradeCount, 0) / completed.length;

    // 最大連勝・最大連敗
    let currentStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;
    for (const s of completed) {
      const isProfit = s.currentCapital > s.initialCapital;
      if (isProfit) {
        currentStreak = currentStreak > 0 ? currentStreak + 1 : 1;
        maxWinStreak = Math.max(maxWinStreak, currentStreak);
      } else {
        currentStreak = currentStreak < 0 ? currentStreak - 1 : -1;
        maxLossStreak = Math.max(maxLossStreak, Math.abs(currentStreak));
      }
    }

    // リスクリワード比（平均利益÷平均損失）
    const profits = allClosedPositions?.filter(p => (p.profit || 0) > 0) || [];
    const losses = allClosedPositions?.filter(p => (p.profit || 0) < 0) || [];
    const avgProfit = profits.length > 0 ? profits.reduce((sum, p) => sum + (p.profit || 0), 0) / profits.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((sum, p) => sum + (p.profit || 0), 0) / losses.length) : 0;
    const riskRewardRatio = avgLoss > 0 ? avgProfit / avgLoss : avgProfit > 0 ? 999 : 0;

    return {
      totalSessions: sessions.length,
      completedSessions: completed.length,
      profitableSessions: profitableSessions.length,
      sessionWinRate: (profitableSessions.length / completed.length) * 100,
      tradeWinRate,
      allTotalTrades,
      profitFactor,
      expectancy,
      totalProfitRate: profitRates.reduce((sum, r) => sum + r, 0),
      averageProfitRate: expectancy,
      maxDrawdown,
      avgTradesPerSession,
      maxWinStreak,
      maxLossStreak,
      riskRewardRatio,
      averageProfitRate: expectancy,
      maxDrawdown,
      chartData: completed.map((s, i) => ({
        session: i + 1,
        profitRate: profitRates[i],
        cumulativeProfit: cumulativeProfits[i],
        date: s.startDate,
      })),
    };
  })() : null;

  const handleNewSession = () => {
    router.push('/session/new');
  };

  const handleContinueSession = () => {
    // 進行中のセッションを探す
    const ongoingSession = sessions.find((s: any) => s.status === 'playing' || s.status === 'paused');
    
    if (ongoingSession) {
      router.push(`/session/${ongoingSession.id}`);
    } else {
      alert('進行中のセッションがありません');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-8 h-8" />
              <h1 className="text-2xl font-bold">
                Swing Trading Practice
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground mr-2">{nickname}</span>
              <button
                onClick={() => setIsHelpOpen(true)}
                className="p-2 hover:bg-accent rounded-lg transition"
                title="チャートの見方"
              >
                <HelpCircle className="w-6 h-6" />
              </button>
              <button
                onClick={handleLogout}
                className="p-2 hover:bg-accent rounded-lg transition"
                title="ログアウト"
              >
                <LogOut className="w-6 h-6" />
              </button>
              <Link
                href="/history"
                className="p-2 hover:bg-accent rounded-lg transition"
              >
                <History className="w-6 h-6" />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* アクションボタン */}
        <div className="grid md:grid-cols-2 gap-3 mb-8">
          <button
            onClick={handleNewSession}
            className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg p-4 flex items-center justify-center gap-3 transition border"
          >
            <Play className="w-5 h-5" />
            <div className="text-lg font-bold">新規セッション</div>
          </button>

          <button
            onClick={handleContinueSession}
            className="bg-card hover:bg-accent rounded-lg p-4 flex items-center justify-center gap-3 transition border-2"
          >
            <History className="w-5 h-5" />
            <div className="text-lg font-bold">続きから再開</div>
          </button>
        </div>

        {/* 統計セクション */}
        {stats && (
          <>
            {/* 統計ヘッダー */}
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">統計情報</h2>
              <button 
                onClick={() => setIsStatsInfoOpen(true)}
                className="flex items-center gap-2 hover:bg-accent rounded-lg px-3 py-1.5 transition"
              >
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">指標の説明</span>
              </button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {/* セッション勝率 */}
              <div className="bg-card rounded-lg border p-3">
                <div className="text-xs text-muted-foreground mb-1">セッション勝率</div>
                <div className="text-2xl font-bold">
                  {stats.sessionWinRate.toFixed(1)}%
                </div>
              </div>

              {/* 取引勝率 */}
              <div className="bg-card rounded-lg border p-3">
                <div className="text-xs text-muted-foreground mb-1">取引勝率</div>
                <div className="text-2xl font-bold">
                  {stats.tradeWinRate.toFixed(1)}%
                </div>
              </div>

              {/* 期待値 */}
              <div className="bg-card rounded-lg border p-3">
                <div className="text-xs text-muted-foreground mb-1">期待値</div>
                <div className={`text-2xl font-bold ${stats.expectancy >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {stats.expectancy >= 0 ? '+' : ''}
                  {stats.expectancy.toFixed(2)}%
                </div>
              </div>

              {/* プロフィットファクター */}
              <div className="bg-card rounded-lg border p-3">
                <div className="text-xs text-muted-foreground mb-1">PF</div>
                <div className="text-2xl font-bold">
                  {stats.profitFactor.toFixed(2)}
                </div>
              </div>

              {/* 累積損益 */}
              <div className="bg-card rounded-lg border p-3">
                <div className="text-xs text-muted-foreground mb-1">累積損益</div>
                <div className={`text-2xl font-bold ${stats.totalProfitRate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {stats.totalProfitRate >= 0 ? '+' : ''}
                  {stats.totalProfitRate.toFixed(1)}%
                </div>
              </div>

              {/* 最大ドローダウン */}
              <div className="bg-card rounded-lg border p-3">
                <div className="text-xs text-muted-foreground mb-1">最大DD</div>
                <div className="text-2xl font-bold text-red-500">
                  {stats.maxDrawdown.toFixed(1)}%
                </div>
              </div>

              {/* リスクリワード比 */}
              <div className="bg-card rounded-lg border p-3">
                <div className="text-xs text-muted-foreground mb-1">RR比</div>
                <div className={`text-2xl font-bold ${stats.riskRewardRatio >= 1 ? 'text-green-500' : 'text-red-500'}`}>
                  {stats.riskRewardRatio >= 999 ? '∞' : stats.riskRewardRatio.toFixed(2)}
                </div>
              </div>

              {/* 平均取引回数 */}
              <div className="bg-card rounded-lg border p-3">
                <div className="text-xs text-muted-foreground mb-1">平均取引回数</div>
                <div className="text-2xl font-bold">
                  {stats.avgTradesPerSession.toFixed(1)}
                </div>
              </div>

              {/* 最大連勝 */}
              <div className="bg-card rounded-lg border p-3">
                <div className="text-xs text-muted-foreground mb-1">最大連勝</div>
                <div className="text-2xl font-bold text-green-500">
                  {stats.maxWinStreak}
                </div>
              </div>

              {/* 最大連敗 */}
              <div className="bg-card rounded-lg border p-3">
                <div className="text-xs text-muted-foreground mb-1">最大連敗</div>
                <div className="text-2xl font-bold text-red-500">
                  {stats.maxLossStreak}
                </div>
              </div>
            </div>

            {/* パフォーマンスグラフ */}
            {stats.chartData.length > 0 && (
              <div className="bg-card rounded-xl border p-6 mb-8">
                <h2 className="text-lg font-bold mb-4">パフォーマンス推移</h2>
                <div className="space-y-8">
                  {/* 累積損益グラフ */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">累積損益率</h3>
                    <div className="relative h-48">
                      <svg className="w-full h-full" viewBox="0 0 800 200" preserveAspectRatio="none">
                        {/* グリッド線 */}
                        <line x1="0" y1="100" x2="800" y2="100" stroke="currentColor" strokeWidth="1" className="text-border" strokeDasharray="4" />
                        
                        {/* 累積損益の折れ線 */}
                        <polyline
                          points={stats.chartData.map((d, i) => {
                            const x = (i / (stats.chartData.length - 1)) * 800;
                            const maxAbs = Math.max(...stats.chartData.map(d => Math.abs(d.cumulativeProfit)));
                            const y = 100 - (d.cumulativeProfit / (maxAbs || 1)) * 80;
                            return `${x},${y}`;
                          }).join(' ')}
                          fill="none"
                          stroke={stats.chartData[stats.chartData.length - 1].cumulativeProfit >= 0 ? '#22c55e' : '#ef4444'}
                          strokeWidth="3"
                        />
                        
                        {/* データポイント */}
                        {stats.chartData.map((d, i) => {
                          const x = (i / (stats.chartData.length - 1)) * 800;
                          const maxAbs = Math.max(...stats.chartData.map(d => Math.abs(d.cumulativeProfit)));
                          const y = 100 - (d.cumulativeProfit / (maxAbs || 1)) * 80;
                          return (
                            <circle
                              key={i}
                              cx={x}
                              cy={y}
                              r="4"
                              fill={d.cumulativeProfit >= 0 ? '#22c55e' : '#ef4444'}
                            />
                          );
                        })}
                      </svg>
                      {/* Y軸ラベル */}
                      <div className="absolute left-0 top-0 text-xs text-muted-foreground">
                        +{Math.max(...stats.chartData.map(d => Math.abs(d.cumulativeProfit))).toFixed(0)}%
                      </div>
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        0%
                      </div>
                      <div className="absolute left-0 bottom-0 text-xs text-muted-foreground">
                        -{Math.max(...stats.chartData.map(d => Math.abs(d.cumulativeProfit))).toFixed(0)}%
                      </div>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>セッション #1</span>
                      <span>セッション #{stats.chartData.length}</span>
                    </div>
                  </div>

                  {/* セッション別損益グラフ */}
                  <div>
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">セッション別損益率</h3>
                    <div className="relative h-48 flex items-end gap-1">
                      {stats.chartData.map((d, i) => {
                        const maxAbs = Math.max(...stats.chartData.map(d => Math.abs(d.profitRate)));
                        const heightPercent = Math.abs(d.profitRate) / (maxAbs || 1) * 100;
                        const isPositive = d.profitRate >= 0;
                        return (
                          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full">
                            <div 
                              className={`w-full rounded-t transition-all hover:opacity-80 ${isPositive ? 'bg-green-500' : 'bg-red-500'}`}
                              style={{ 
                                height: `${heightPercent}%`,
                                minHeight: '2px'
                              }}
                              title={`#${i + 1}: ${d.profitRate.toFixed(2)}%`}
                            />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground mt-2">
                      <span>#1</span>
                      <span>#{stats.chartData.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* 最近のセッション */}
        <div className="bg-card rounded-xl border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">最近のセッション</h2>
            <Link
              href="/history"
              className="text-sm font-medium hover:underline"
            >
              すべて見る →
            </Link>
          </div>

          {sessions && sessions.length > 0 ? (
            <div className="space-y-3">
              {sessions.slice(0, 5).map((session) => (
                <Link
                  key={session.id}
                  href={`/session/${session.id}`}
                  className="block p-4 hover:bg-accent rounded-lg border transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">
                        {session.stockName} ({session.symbol})
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(session.startDate).toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                    <div className="text-right">
                      {session.status === 'completed' ? (
                        <>
                          <div className="text-lg font-bold">
                            勝率 {session.winRate.toFixed(1)}%
                          </div>
                          <div className={`text-sm ${
                            session.currentCapital >= session.initialCapital
                              ? 'text-green-500'
                              : 'text-red-500'
                          }`}>
                            {session.currentCapital >= session.initialCapital ? '+' : ''}
                            {((session.currentCapital - session.initialCapital) / session.initialCapital * 100).toFixed(1)}%
                          </div>
                        </>
                      ) : (
                        <div className="text-sm font-medium">
                          進行中
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>まだセッションがありません</p>
              <p className="text-sm">新規セッションを開始してください</p>
            </div>
          )}
        </div>
      </main>

      {/* ヘルプモーダル */}
      {isHelpOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsHelpOpen(false)}>
          <div className="bg-card rounded-xl border max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">チャートの見方</h2>
              <button
                onClick={() => setIsHelpOpen(false)}
                className="p-2 hover:bg-accent rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* ローソク足 */}
              <div>
                <h3 className="text-lg font-bold mb-3">ローソク足</h3>
                <div className="space-y-2">
                  {Object.entries(COLOR_DESCRIPTIONS.candlestick).map(([key, item]) => (
                    <div key={key} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <div
                        className="w-8 h-8 rounded"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-sm text-muted-foreground">{item.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 出来高 */}
              <div>
                <h3 className="text-lg font-bold mb-3">出来高</h3>
                <div className="space-y-2">
                  {Object.entries(COLOR_DESCRIPTIONS.volume).map(([key, item]) => (
                    <div key={key} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <div
                        className="w-8 h-8 rounded"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-sm text-muted-foreground">{item.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 移動平均線 */}
              <div>
                <h3 className="text-lg font-bold mb-3">移動平均線（MA）</h3>
                <div className="space-y-2">
                  {COLOR_DESCRIPTIONS.ma.map((item, index) => (
                    <div key={index} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <div
                        className="w-8 h-1 rounded"
                        style={{ backgroundColor: item.color }}
                      />
                      <div className="flex-1">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-sm text-muted-foreground">{item.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 取引マーカー */}
              <div>
                <h3 className="text-lg font-bold mb-3">取引マーカー</h3>
                <div className="space-y-2">
                  {Object.entries(COLOR_DESCRIPTIONS.trade).map(([key, item]) => (
                    <div key={key} className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: item.color }}
                      >
                        {key === 'buy' ? '▲' : '▼'}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{item.label}</div>
                        <div className="text-sm text-muted-foreground">{item.description}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 操作方法 */}
              <div>
                <h3 className="text-lg font-bold mb-3">操作方法</h3>
                <div className="space-y-2 text-sm">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium mb-1">マーカーをクリック</div>
                    <div className="text-muted-foreground">チャート上のマーカーをクリックすると、取引履歴の該当取引に自動スクロールします</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium mb-1">チャートのズーム</div>
                    <div className="text-muted-foreground">マウスホイールやピンチ操作でチャートをズームできます</div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="font-medium mb-1">チャートのスクロール</div>
                    <div className="text-muted-foreground">ドラッグ操作でチャートを左右にスクロールできます</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 統計情報の説明モーダル */}
      {isStatsInfoOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setIsStatsInfoOpen(false)}>
          <div className="bg-card rounded-xl border max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 bg-card border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold">統計指標の説明</h2>
              <button
                onClick={() => setIsStatsInfoOpen(false)}
                className="p-2 hover:bg-accent rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* セッション勝率 */}
              <div className="border-l-4 border-green-500 pl-4 py-2">
                <h3 className="font-bold mb-2">セッション勝率</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  利益を出したセッション数の割合を示します。
                </p>
                <div className="text-sm">
                  <span className="font-medium">計算式：</span> (利益セッション数 ÷ 完了セッション数) × 100
                </div>
                <div className="text-sm mt-1">
                  <span className="font-medium">目安：</span> 50%以上を目指しましょう
                </div>
              </div>

              {/* 取引勝率 */}
              <div className="border-l-4 border-cyan-500 pl-4 py-2">
                <h3 className="font-bold mb-2">取引勝率</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  全ての取引の中で利益を出した取引の割合です。セッション勝率とは異なり、個々の取引レベルでの成功率を示します。
                </p>
                <div className="text-sm">
                  <span className="font-medium">計算式：</span> (利益取引数 ÷ 全取引数) × 100
                </div>
                <div className="text-sm mt-1">
                  <span className="font-medium">目安：</span> 40%以上あれば十分（RR比が高ければ30%台でも利益が出る）
                </div>
              </div>

              {/* 期待値 */}
              <div className="border-l-4 border-blue-500 pl-4 py-2">
                <h3 className="font-bold mb-2">期待値</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  1セッションあたりの平均損益率。プラスなら技術が成長している証拠です。
                </p>
                <div className="text-sm">
                  <span className="font-medium">計算式：</span> 全セッションの損益率の平均
                </div>
                <div className="text-sm mt-1">
                  <span className="font-medium">重要度：</span> ★★★★★ 最も重要な指標の一つ
                </div>
              </div>

              {/* プロフィットファクター */}
              <div className="border-l-4 border-purple-500 pl-4 py-2">
                <h3 className="font-bold mb-2">プロフィットファクター（PF）</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  総利益を総損失で割った値。1.0以上で利益が出ている状態を示します。
                </p>
                <div className="text-sm">
                  <span className="font-medium">計算式：</span> 総利益 ÷ 総損失
                </div>
                <div className="text-sm mt-1">
                  <span className="font-medium">目安：</span> 1.5以上が良好、2.0以上が優秀
                </div>
              </div>

              {/* 累積損益 */}
              <div className="border-l-4 border-orange-500 pl-4 py-2">
                <h3 className="font-bold mb-2">累積損益</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  全セッションの損益率を合計した値。全体的な成長を示す指標です。
                </p>
                <div className="text-sm">
                  <span className="font-medium">計算式：</span> 全セッションの損益率の合計
                </div>
                <div className="text-sm mt-1">
                  <span className="font-medium">意味：</span> グラフで右肩上がりになっていれば成長中
                </div>
              </div>

              {/* 最大ドローダウン */}
              <div className="border-l-4 border-red-500 pl-4 py-2">
                <h3 className="font-bold mb-2">最大ドローダウン（DD）</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  資金が最も減少した時の率。リスク管理の優秀さを示します。
                </p>
                <div className="text-sm">
                  <span className="font-medium">計算式：</span> ピークからの最大下落率
                </div>
                <div className="text-sm mt-1">
                  <span className="font-medium">目安：</span> 20%以下が理想的、30%を超えると危険
                </div>
              </div>

              {/* リスクリワード比 */}
              <div className="border-l-4 border-yellow-500 pl-4 py-2">
                <h3 className="font-bold mb-2">リスクリワード比率（RR比）</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  平均利益を平均損失で割った値。効率的なトレードをしているかの指標です。
                </p>
                <div className="text-sm">
                  <span className="font-medium">計算式：</span> 平均利益 ÷ 平均損失
                </div>
                <div className="text-sm mt-1">
                  <span className="font-medium">目安：</span> 1.5以上が良好、2.0以上なら勝率が低くても利益が出る
                </div>
              </div>

              {/* 平均取引回数 */}
              <div className="border-l-4 border-pink-500 pl-4 py-2">
                <h3 className="font-bold mb-2">平均取引回数</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  1セッションあたりの平均取引回数。トレードスタイルの一貫性を測定します。
                </p>
                <div className="text-sm">
                  <span className="font-medium">計算式：</span> 全取引数 ÷ セッション数
                </div>
                <div className="text-sm mt-1">
                  <span className="font-medium">意味：</span> 安定していれば一貫したスタイルの証拠
                </div>
              </div>

              {/* 最大連勝・連敗 */}
              <div className="border-l-4 border-indigo-500 pl-4 py-2">
                <h3 className="font-bold mb-2">最大連勝・最大連敗</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  連続して利益/損失を出したセッション数の記録。精神的耐久力の指標です。
                </p>
                <div className="text-sm mt-1">
                  <span className="font-medium">意味：</span> 連敗記録が長いと精神的に厳しい。メンタル管理の重要性を示す
                </div>
              </div>

              {/* 総合評価の目安 */}
              <div className="bg-muted rounded-lg p-4 mt-6">
                <h3 className="font-bold mb-3">総合評価の目安</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-green-500 font-bold">◎</span>
                    <div>
                      <div className="font-medium">優秀：</div>
                      <div className="text-muted-foreground">期待値 +3%以上、PF 2.0以上、勝率 50%以上</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold">○</span>
                    <div>
                      <div className="font-medium">良好：</div>
                      <div className="text-muted-foreground">期待値 +1%以上、PF 1.5以上、勝率 40%以上</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-yellow-500 font-bold">△</span>
                    <div>
                      <div className="font-medium">改善の余地：</div>
                      <div className="text-muted-foreground">期待値 0%前後、PF 1.0前後</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-red-500 font-bold">×</span>
                    <div>
                      <div className="font-medium">要見直し：</div>
                      <div className="text-muted-foreground">期待値 マイナス、PF 1.0未満、または最大DD 30%超</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
