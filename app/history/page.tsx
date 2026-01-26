'use client';

import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db/schema';
import Link from 'next/link';
import { ArrowLeft, TrendingUp, TrendingDown } from 'lucide-react';
import { useState } from 'react';

export default function HistoryPage() {
  const [sortBy, setSortBy] = useState<'date' | 'winRate' | 'profit'>('date');

  const sessions = useLiveQuery(() =>
    db.sessions.filter(s => s.status === 'completed').toArray()
  );

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
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2 hover:bg-gray-100 rounded-lg">
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
            <div className="bg-white rounded-lg shadow-sm p-6 border">
              <div className="text-sm text-gray-500 mb-1">完了セッション</div>
              <div className="text-3xl font-bold">{stats.total}</div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border">
              <div className="text-sm text-gray-500 mb-1">平均勝率</div>
              <div className="text-3xl font-bold text-blue-600">
                {stats.avgWinRate.toFixed(1)}%
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border">
              <div className="text-sm text-gray-500 mb-1">利益セッション</div>
              <div className="text-3xl font-bold text-green-600">
                {stats.profitableSessions}
              </div>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-6 border">
              <div className="text-sm text-gray-500 mb-1">累計損益</div>
              <div
                className={`text-3xl font-bold ${
                  stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {stats.totalProfit >= 0 ? '+' : ''}
                {stats.totalProfit.toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        {/* ソート */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700">並び替え:</span>
            <div className="flex gap-2">
              <button
                onClick={() => setSortBy('date')}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  sortBy === 'date'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                日付
              </button>
              <button
                onClick={() => setSortBy('winRate')}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  sortBy === 'winRate'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                勝率
              </button>
              <button
                onClick={() => setSortBy('profit')}
                className={`px-4 py-2 rounded-lg text-sm transition ${
                  sortBy === 'profit'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200'
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
                <Link
                  key={session.id}
                  href={`/session/${session.id}`}
                  className="block bg-white rounded-lg border hover:shadow-md transition p-6"
                >
                  <div className="flex items-start justify-between gap-4">
                    {/* 左側 - 基本情報 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {session.stockName}
                        </h3>
                        <span className="text-gray-500">({session.symbol})</span>
                      </div>
                      
                      <div className="text-sm text-gray-600 mb-4">
                        {new Date(session.startDate).toLocaleDateString('ja-JP', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <div className="text-xs text-gray-500">期間</div>
                          <div className="font-medium">{session.periodDays}日</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">取引回数</div>
                          <div className="font-medium">{session.tradeCount}回</div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">勝率</div>
                          <div className="font-medium text-blue-600">
                            {session.winRate.toFixed(1)}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">違反</div>
                          <div className="font-medium text-red-600">
                            {session.ruleViolations}回
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* 右側 - 損益 */}
                    <div className="text-right">
                      <div className="flex items-center justify-end gap-2 mb-2">
                        {isProfitable ? (
                          <TrendingUp className="w-6 h-6 text-green-600" />
                        ) : (
                          <TrendingDown className="w-6 h-6 text-red-600" />
                        )}
                      </div>
                      <div
                        className={`text-3xl font-bold ${
                          isProfitable ? 'text-green-600' : 'text-red-600'
                        }`}
                      >
                        {isProfitable ? '+' : ''}
                        {profit.toFixed(2)}%
                      </div>
                      <div className="text-sm text-gray-600 mt-1">
                        ¥{session.currentCapital.toLocaleString()}
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-lg border p-12 text-center">
            <div className="text-gray-400 mb-4">
              <TrendingUp className="w-16 h-16 mx-auto opacity-50" />
            </div>
            <p className="text-gray-600 mb-2">完了したセッションがありません</p>
            <p className="text-sm text-gray-500">
              セッションを完了すると、ここに履歴が表示されます
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
