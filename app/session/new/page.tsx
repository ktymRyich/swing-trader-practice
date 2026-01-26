'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, generateSessionId } from '@/lib/db/schema';
import { JAPANESE_STOCKS, selectRandomPeriod, generateSampleData } from '@/lib/data/stockData';
import { loadCachedStockData } from '@/lib/data/realStockData';
import { ArrowLeft, Play, Download } from 'lucide-react';
import Link from 'next/link';

export default function NewSessionPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const [useRealData, setUseRealData] = useState(false);
  const [isLoadingReal, setIsLoadingReal] = useState(false);
  const [cacheInfo, setCacheInfo] = useState<{ 
    lastUpdated?: string; 
    stockCount?: number;
    priceCount?: number;
  } | null>(null);
  
  // 設定
  const [periodDays, setPeriodDays] = useState(40);
  const [playbackSpeed, setPlaybackSpeed] = useState(5);
  const [maSettings, setMaSettings] = useState([5, 10, 20, 50, 100]);

  // データ初期化
  useEffect(() => {
    checkAndInitializeData();
  }, []);

  const checkAndInitializeData = async () => {
    try {
      // 既にデータがあるかチェック
      const stockCount = await db.stocks.count();
      
      if (stockCount === 0) {
        // 初回はダミーデータを生成
        console.log('サンプルデータを生成中...');
        const { stocks, prices } = await generateSampleData(100, 500);
        
        // データベースに保存
        await db.stocks.bulkAdd(stocks);
        await db.stockPrices.bulkAdd(prices);
        
        console.log(`${stocks.length}銘柄、${prices.length}件の価格データを生成しました`);
      }
      
      setDataReady(true);
    } catch (error) {
      console.error('データ初期化エラー:', error);
      alert('データの初期化に失敗しました');
    }
  };

  const handleLoadRealData = async () => {
    if (!confirm('実際の株価データを読み込みますか？\n既存のデータは上書きされます。')) {
      return;
    }

    setIsLoadingReal(true);
    
    try {
      // 既存データを削除
      await db.stockPrices.clear();
      await db.stocks.clear();
      
      // キャッシュされたデータを読み込み
      const { stocks, prices, meta } = await loadCachedStockData();
      
      if (stocks.length === 0 || prices.length === 0) {
        throw new Error('データが空です。管理者にデータ更新を依頼してください。');
      }
      
      // データベースに保存
      await db.stocks.bulkAdd(stocks);
      await db.stockPrices.bulkAdd(prices);
      
      setCacheInfo(meta || null);
      alert(`実データの読み込み完了！\n${stocks.length}銘柄、${prices.length}件の価格データ`);
      setUseRealData(true);
      
    } catch (error) {
      console.error('データ読み込みエラー:', error);
      alert(`データの読み込みに失敗しました。\n${error instanceof Error ? error.message : '不明なエラー'}`);
    } finally {
      setIsLoadingReal(false);
    }
  };

  const handleStartSession = async () => {
    if (!dataReady) {
      alert('データの準備ができていません');
      return;
    }

    setIsLoading(true);

    try {
      // ランダムに銘柄を選択
      const stocks = await db.stocks.toArray();
      const randomStock = stocks[Math.floor(Math.random() * stocks.length)];

      // 全ての価格データを取得
      const allPrices = await db.stockPrices
        .where('symbol')
        .equals(randomStock.symbol)
        .toArray();

      // ランダムな期間を選択（過去180日分も含む）
      const { prices, startDate, endDate, practiceStartIndex } = selectRandomPeriod(
        allPrices,
        randomStock.symbol,
        periodDays,
        180 // 過去180日分を含む
      );

      // セッションを作成
      const sessionId = generateSessionId();
      const session = {
        id: sessionId,
        startDate: new Date().toISOString(),
        symbol: randomStock.symbol,
        stockName: randomStock.name,
        periodDays,
        initialCapital: 1000000,
        currentCapital: 1000000,
        playbackSpeed,
        status: 'paused' as const,
        currentDay: 0, // 練習期間の進捗は0から
        practiceStartIndex, // 過去データの日数を記録
        startDateOfData: startDate,
        endDateOfData: endDate,
        tradeCount: 0,
        winCount: 0,
        winRate: 0,
        maxDrawdown: 0,
        ruleViolations: 0,
        maSettings
      };

      await db.sessions.add(session);

      // セッションページに移動
      router.push(`/session/${sessionId}`);
    } catch (error) {
      console.error('セッション作成エラー:', error);
      alert('セッションの作成に失敗しました');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-6 h-6" />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">新規セッション</h1>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-sm border p-8">
          {/* 説明 */}
          <div className="mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h2 className="font-bold text-blue-900 mb-2">セッションについて</h2>
            <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
              <li>初期資金100万円でスタート</li>
              <li>実際の株価データまたはダミーデータで練習可能</li>
              <li>過去180営業日分のチャートを確認しながら取引</li>
              <li>未来のデータは見えません（リアルなシミュレーション）</li>
              <li>手数料・スリッページも考慮されます</li>
            </ul>
          </div>

          {/* 設定フォーム */}
          <div className="space-y-6">
            {/* データソース選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                📊 データソース選択
              </label>
              
              <div className="grid grid-cols-2 gap-3 mb-4">
                {/* ダミーデータ */}
                <div className={`p-4 rounded-lg border-2 transition ${
                  !useRealData ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      !useRealData ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                    }`}>
                      {!useRealData && <div className="w-full h-full rounded-full bg-white scale-50"></div>}
                    </div>
                    <div className="font-medium text-gray-900">ダミーデータ</div>
                  </div>
                  <div className="text-xs text-gray-600 leading-relaxed">
                    • ランダム生成データ<br/>
                    • 100銘柄 / 500日分<br/>
                    • 即座に開始可能
                  </div>
                </div>

                {/* 実データ */}
                <div className={`p-4 rounded-lg border-2 transition ${
                  useRealData ? 'border-green-500 bg-green-50' : 'border-gray-200 bg-white'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      useRealData ? 'border-green-500 bg-green-500' : 'border-gray-300'
                    }`}>
                      {useRealData && <div className="w-full h-full rounded-full bg-white scale-50"></div>}
                    </div>
                    <div className="font-medium text-gray-900">実際の株価</div>
                  </div>
                  <div className="text-xs text-gray-600 leading-relaxed">
                    • Yahoo Finance提供<br/>
                    • 50銘柄 / 6年分<br/>
                    • 2020〜2026年の実データ
                  </div>
                </div>
              </div>

              {/* 実データ読み込みボタン */}
              {!useRealData && (
                <button
                  onClick={handleLoadRealData}
                  disabled={isLoadingReal}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:from-green-700 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition shadow-sm"
                >
                  <Download className="w-5 h-5" />
                  <span className="font-medium">
                    {isLoadingReal ? '読み込み中...' : '実データに切り替える'}
                  </span>
                </button>
              )}

              {/* 実データ読み込み済み表示 */}
              {useRealData && cacheInfo && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-green-900 mb-1">実データ読み込み済み</div>
                      <div className="text-sm text-green-700 space-y-1">
                        <div>• {cacheInfo.stockCount || 50}銘柄の実際の株価データ</div>
                        <div>• {cacheInfo.priceCount?.toLocaleString() || '74,000'}件の価格データ</div>
                        {cacheInfo.lastUpdated && (
                          <div className="text-xs text-green-600 mt-2">
                            最終更新: {new Date(cacheInfo.lastUpdated).toLocaleDateString('ja-JP', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* 期間設定 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                セッション期間
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[20, 40, 60].map((days) => (
                  <button
                    key={days}
                    onClick={() => setPeriodDays(days)}
                    className={`p-4 rounded-lg border-2 transition ${
                      periodDays === days
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-2xl font-bold">{days}日</div>
                    <div className="text-xs text-gray-500">
                      {days === 20 && '約1ヶ月'}
                      {days === 40 && '約2ヶ月'}
                      {days === 60 && '約3ヶ月'}
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                推奨時間: {Math.floor((periodDays * playbackSpeed) / 60)}分
              </p>
            </div>

            {/* 再生速度 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                再生速度（1日あたりの秒数）
              </label>
              <div className="flex items-center gap-4">
                <input
                  type="range"
                  min="5"
                  max="30"
                  step="5"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="flex-1"
                />
                <div className="w-20 text-center">
                  <div className="text-2xl font-bold text-gray-900">
                    {playbackSpeed}秒
                  </div>
                  <div className="text-xs text-gray-500">/ 1日</div>
                </div>
              </div>
              <p className="mt-2 text-sm text-gray-500">
                遅い方がじっくり考えられます（5秒〜30秒）
              </p>
            </div>

            {/* 移動平均線設定 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                移動平均線の期間
              </label>
              <div className="grid grid-cols-5 gap-2">
                {maSettings.map((period, index) => (
                  <input
                    key={index}
                    type="number"
                    value={period}
                    onChange={(e) => {
                      const newSettings = [...maSettings];
                      newSettings[index] = Number(e.target.value);
                      setMaSettings(newSettings);
                    }}
                    className="px-3 py-2 border rounded-lg text-center"
                    min="1"
                    max="200"
                  />
                ))}
              </div>
              <p className="mt-2 text-sm text-gray-500">
                デフォルト: 5, 25, 75, 100, 200日線
              </p>
            </div>
          </div>

          {/* 開始ボタン */}
          <button
            onClick={handleStartSession}
            disabled={isLoading || !dataReady}
            className="w-full mt-8 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition transform hover:scale-105 disabled:transform-none"
          >
            {isLoading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                セッション作成中...
              </>
            ) : !dataReady ? (
              <>データ準備中...</>
            ) : (
              <>
                <Play className="w-6 h-6" />
                セッション開始
              </>
            )}
          </button>
        </div>
      </main>
    </div>
  );
}
