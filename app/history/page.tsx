'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';

export default function HistoryPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState<string | null>(null);
  const [sessions, setSessions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'date' | 'winRate' | 'profit'>('date');

  useEffect(() => {
    const savedNickname = localStorage.getItem('userNickname');
    if (!savedNickname) {
      router.push('/login');
      return;
    }
    setNickname(savedNickname);
    loadSessions(savedNickname);
  }, [router]);

  const loadSessions = async (userNickname: string) => {
    try {
      const response = await fetch(`/api/sessions?nickname=${userNickname}`);
      const data = await response.json();
      
      if (data.success) {
        const completedSessions = (data.sessions || []).filter((s: any) => s.status === 'completed');
        setSessions(completedSessions);
      }
    } catch (error) {
      console.error('セッション読み込みエラー:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (sessionId: string, sessionName: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!nickname) return;

    if (!confirm(`「${sessionName}」のセッションを削除しますか？\nこの操作は元に戻せません。`)) {
      return;
    }

    try {
      // セッション一覧を取得して該当セッションを除外
      const response = await fetch(`/api/sessions?nickname=${nickname}`);
      const data = await response.json();
      
      if (data.success) {
        const allSessions = data.sessions || [];
        console.log(`削除前のセッション数: ${allSessions.length}`);
        
        // 該当セッションが存在するか確認
        const targetSession = allSessions.find((s: any) => s.id === sessionId);
        if (!targetSession) {
          alert('指定されたセッションが見つかりませんでした');
          return;
        }
        
        const updatedSessions = allSessions.filter((s: any) => s.id !== sessionId);
        console.log(`削除後のセッション数: ${updatedSessions.length}`);
        
        // 削除数の確認（安全チェック）
        const deletedCount = allSessions.length - updatedSessions.length;
        if (deletedCount !== 1) {
          console.error(`異常: ${deletedCount}件のセッションが削除されます`);
          alert(`エラー: 削除対象は1件ですが、${deletedCount}件が削除されようとしています。削除を中止しました。`);
          return;
        }
        
        // 更新後のセッション一覧を保存
        const saveResponse = await fetch('/api/sessions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nickname,
            sessions: updatedSessions
          })
        });

        const saveData = await saveResponse.json();
        if (saveData.success) {
          alert('セッションを削除しました');
          loadSessions(nickname);
        } else {
          throw new Error('削除に失敗しました');
        }
      }
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
  const stats = sessions.length > 0
    ? {
        total: sessions.length,
        avgWinRate:
          sessions.reduce((sum, s) => sum + s.winRate, 0) / sessions.length,
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
                        {new Date(session.createdAt || session.startDate).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })} 開始
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                          <div className="text-xs text-muted-foreground">練習期間</div>
                          <div className="font-medium">{session.periodDays}日</div>
                          {(session.practiceStartDate || session.startDateOfData) && (
                            <div className="text-xs text-muted-foreground mt-0.5">
                              {new Date(session.practiceStartDate || session.startDateOfData).toLocaleDateString('ja-JP', { year: 'numeric', month: 'short', day: 'numeric' })}〜
                            </div>
                          )}
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
