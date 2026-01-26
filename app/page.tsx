'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db/schema';
import { useLiveQuery } from 'dexie-react-hooks';
import { Play, History, Settings, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export default function HomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  // 全セッションを取得
  const sessions = useLiveQuery(() => 
    db.sessions.orderBy('startDate').reverse().toArray()
  );

  // 統計情報を計算
  const stats = sessions ? {
    totalSessions: sessions.length,
    completedSessions: sessions.filter(s => s.status === 'completed').length,
    averageWinRate: sessions.filter(s => s.status === 'completed').length > 0
      ? sessions.filter(s => s.status === 'completed')
          .reduce((sum, s) => sum + s.winRate, 0) / sessions.filter(s => s.status === 'completed').length
      : 0,
    bestWinRate: sessions.filter(s => s.status === 'completed').length > 0
      ? Math.max(...sessions.filter(s => s.status === 'completed').map(s => s.winRate))
      : 0
  } : null;

  const handleNewSession = () => {
    router.push('/session/new');
  };

  const handleContinueSession = async () => {
    // 進行中のセッションを探す
    const ongoingSession = await db.sessions
      .filter(s => s.status === 'playing' || s.status === 'paused')
      .first();
    
    if (ongoingSession) {
      router.push(`/session/${ongoingSession.id}`);
    } else {
      alert('進行中のセッションがありません');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-8 h-8 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">
                スイングトレード練習
              </h1>
            </div>
            <Link
              href="/settings"
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <Settings className="w-6 h-6 text-gray-600" />
            </Link>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* 実データバナー */}
        <div className="mb-8 bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
              <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <div className="font-bold text-green-900 mb-1">実際の株価データで練習可能</div>
              <div className="text-sm text-green-700">
                Yahoo Finance提供の50銘柄・6年分（2020-2026年）の実データを使用。金融、自動車、IT、商社など主要セクターをカバー
              </div>
            </div>
          </div>
        </div>

        {/* 統計カード */}
        {stats && stats.totalSessions > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-white rounded-xl shadow-sm p-6 border">
              <div className="text-sm text-gray-500 mb-1">総セッション数</div>
              <div className="text-3xl font-bold text-gray-900">{stats.totalSessions}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border">
              <div className="text-sm text-gray-500 mb-1">完了</div>
              <div className="text-3xl font-bold text-gray-900">{stats.completedSessions}</div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border">
              <div className="text-sm text-gray-500 mb-1">平均勝率</div>
              <div className="text-3xl font-bold text-blue-600">
                {stats.averageWinRate.toFixed(1)}%
              </div>
            </div>
            <div className="bg-white rounded-xl shadow-sm p-6 border">
              <div className="text-sm text-gray-500 mb-1">最高勝率</div>
              <div className="text-3xl font-bold text-green-600">
                {stats.bestWinRate.toFixed(1)}%
              </div>
            </div>
          </div>
        )}

        {/* アクションボタン */}
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={handleNewSession}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-lg p-8 flex flex-col items-center gap-4 transition transform hover:scale-105"
          >
            <Play className="w-16 h-16" />
            <div>
              <div className="text-2xl font-bold mb-1">新規セッション</div>
              <div className="text-blue-100 text-sm">新しい練習を開始</div>
            </div>
          </button>

          <button
            onClick={handleContinueSession}
            className="bg-white hover:bg-gray-50 text-gray-900 rounded-xl shadow-lg p-8 flex flex-col items-center gap-4 transition transform hover:scale-105 border-2"
          >
            <History className="w-16 h-16" />
            <div>
              <div className="text-2xl font-bold mb-1">続きから再開</div>
              <div className="text-gray-500 text-sm">進行中のセッションを再開</div>
            </div>
          </button>
        </div>

        {/* 最近のセッション */}
        <div className="bg-white rounded-xl shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">最近のセッション</h2>
            <Link
              href="/history"
              className="text-blue-600 hover:text-blue-700 text-sm font-medium"
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
                  className="block p-4 hover:bg-gray-50 rounded-lg border transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {session.stockName} ({session.symbol})
                      </div>
                      <div className="text-sm text-gray-500">
                        {new Date(session.startDate).toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                    <div className="text-right">
                      {session.status === 'completed' ? (
                        <>
                          <div className="text-lg font-bold text-gray-900">
                            勝率 {session.winRate.toFixed(1)}%
                          </div>
                          <div className={`text-sm ${
                            session.currentCapital >= session.initialCapital
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {session.currentCapital >= session.initialCapital ? '+' : ''}
                            {((session.currentCapital - session.initialCapital) / session.initialCapital * 100).toFixed(1)}%
                          </div>
                        </>
                      ) : (
                        <div className="text-sm text-blue-600 font-medium">
                          進行中
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              <History className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>まだセッションがありません</p>
              <p className="text-sm">新規セッションを開始してください</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
