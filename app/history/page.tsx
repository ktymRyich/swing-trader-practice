'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/schema';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import { useState } from 'react';

export default function HistoryPage() {
  const [sortBy, setSortBy] = useState<'date' | 'winRate' | 'profit'>('date');

  const sessions = useLiveQuery(() =>
    db.sessions.filter(s => s.status === 'completed').toArray()
  );

  const handleDelete = async (sessionId: string, sessionName: string, e: React.MouseEvent) => {
    e.preventDefault(); // Linkのナビゲーションを防ぐ
    e.stopPropagation();

    if (!confirm(`「${sessionName}」のセッションを削除しますか？\nこの操作は元に戻せません。`)) {
      return;
    }

    try {
      // 関連データを全て削除
      await db.transaction('rw', [db.sessions, db.positions, db.trades, db.ruleViolations], async () => {
        await db.positions.where('sessionId').equals(sessionId).delete();
        await db.trades.where('sessionId').equals(sessionId).delete();
        await db.ruleViolations.where('sessionId').equals(sessionId).delete();
        await db.sessions.delete(sessionId);
      });

      alert('セッションを削除しました');
    } catch (error) {
      console.error('削除エラー:', error);
      alert('削除に失敗しました');
    }
  };

  const sortedSessions = sessions?.sort((a, b) => {
    switch (sortBy) {
      case 'date':
        return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      case 'winRate':
        return b.winRate - a.winRate;
      case 'profit':
        const profitA = ((a.currentCapital - a.initialCapital) / a.initialCapital) * 100;
        const profitB = ((b.currentCapital - b.initialCapital) / b.initialCapital) * 100;
        return profitB - profitA;
      default:
        return 0;
    }
  });

  // 統計計算
  const stats = sessions
    ? {
        total: sessions.length,
        avgWinRate:
          sessions.length > 0
            ? sessions.reduce((sum, s) => sum + s.winRate, 0) / sessions.length
            : 0,
        profitableSessions: sessions.filter(
          s => s.currentCapital > s.initialCapital
        ).length,
        totalProfit: sessions.reduce(
          (sum, s) =>
            sum + ((s.currentCapital - s.initialCapital) / s.initialCapital) * 100,
          0
        ),
      }
    : null;

  return (
    <div className="min-h-screen bg-background">
      {/* ヘッダー */}
      <header className="bg-card border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-accent rounded-lg">
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-2xl font-bold">セッション履歴</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 統計カード */}
        {stats && stats.total > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-card rounded-lg border p-6">
              <div className="text-sm text-muted-foreground mb-1">完了セッション</div>
              <div className="text-3xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-card rounded-lg border p-6">
              <div className="text-sm text-muted-foreground mb-1">平均勝率</div>
              <div className="text-3xl font-bold">
                {stats.avgWinRate.toFixed(1)}%
              </div>
            </div>
            <div className="bg-card rounded-lg border p-6">
              <div className="text-sm text-muted-foreground mb-1">利益セッション</div>
              <div className="text-3xl font-bold text-green-500">
                {stats.profitableSessions}
              </div>
            </div>
            <div className="bg-card rounded-lg border p-6">
              <div className="text-sm text-muted-foreground mb-1">累計損益</div>
              <div
                className={`text-3xl font-bold ${
                  stats.totalProfit >= 0 ? 'text-green-500' : 'text-red-500'
                }`}
              >
                {stats.totalProfit >= 0 ? '+' : ''}
                {stats.totalProfit.toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        {/* ソート */}
        <div className="bg-card rounded-lg border p-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">並び替え:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('date')}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  sortBy === 'date'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                日付
              </button>
              <button
                onClick={() => setSortBy('winRate')}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  sortBy === 'winRate'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                勝率
              </button>
              <button
                onClick={() => setSortBy('profit')}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  sortBy === 'profit'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-secondary hover:bg-secondary/80'
                }`}
              >
                損益
              </button>
            </div>
          </div>
        </div>

        {/* セッション一覧 */}
        {sortedSessions && sortedSessions.length > 0 ? (
          <div className="grid gap-4">
            {sortedSessions.map((session) => {
              const profit =
                ((session.currentCapital - session.initialCapital) /
                  session.initialCapital) *
                100;
              const isProfitable = profit >= 0;

              return (
                <div key={session.id} className="relative bg-card rounded-lg border hover:bg-accent transition">
                  {/* 削除ボタン */}
                  <button
                    onClick={(e) => handleDelete(session.id!, `${session.stockName} (${session.symbol})`, e)}
                    className="absolute top-4 right-4 p-2 hover:bg-destructive/20 rounded-lg transition z-10"
                    title="削除"
                  >
                    <Trash2 className="w-5 h-5 text-destructive" />
                  </button>

                  <Link
                    href={`/session/${session.id}`}
                    className="block p-6 pr-16"
                  >
                    <div className="flex items-start justify-between gap-4">
                      {/* 左側 - 基本情報 */}
                      <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold">
                          {session.stockName}
                        </h3>
                        <span className="text-muted-foreground">({session.symbol})</span>
                      </div>
                      
                      <div className="text-sm text-muted-foreground mb-4">
                        {new Date(session.startDate).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground">期間</div>
                          <div className="font-medium">{session.periodDays}日</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">取引回数</div>
                          <div className="font-medium">{session.tradeCount}回</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">勝率</div>
                          <div className="font-medium">
                            {session.winRate.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">違反</div>
                          <div className="font-medium text-red-500">
                            {session.ruleViolations}回
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 右側 - 損益 */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2 mb-2">
                        {isProfitable ? (
                          <TrendingUp className="w-6 h-6 text-green-500" />
                        ) : (
                          <TrendingDown className="w-6 h-6 text-red-500" />
                        )}
                      </div>
                      <div
                        className={`text-3xl font-bold ${
                          isProfitable ? 'text-green-500' : 'text-red-500'
                        }`}
                      >
                        {isProfitable ? '+' : ''}
                        {profit.toFixed(2)}%
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        ¥{session.currentCapital.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
            })}
          </div>
        ) : (
          <div className="bg-card rounded-lg border p-12 text-center">
            <div className="text-muted-foreground mb-4">
              <TrendingUp className="w-16 h-16 mx-auto opacity-50" />
            </div>
            <p className="text-muted-foreground mb-2">完了したセッションがありません</p>
            <p className="text-sm text-muted-foreground">
              セッションを完了すると、ここに履歴が表示されます
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
