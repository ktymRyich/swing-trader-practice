'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, generateSessionId } from '@/lib/db/schema';
import { selectRandomPeriod } from '@/lib/data/stockData';
import { loadCachedStockData } from '@/lib/data/realStockData';
import { ArrowLeft, Play } from 'lucide-react';
import Link from 'next/link';

export default function NewSessionPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
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
        // 初回は実データを自動読み込み
        console.log('実際の株価データを読み込み中...');
        const { stocks, prices, meta } = await loadCachedStockData();
        
        if (stocks.length === 0 || prices.length === 0) {
          throw new Error('キャッシュデータが空です。管理者にデータ更新を依頼してください。');
        }
        
        // データベースに保存
        await db.stocks.bulkAdd(stocks);
        await db.stockPrices.bulkAdd(prices);
        
        setCacheInfo(meta || null);
        console.log(`${stocks.length}銘柄、${prices.length}件の価格データを読み込みました`);
      } else {
        // 既存データがある場合、キャッシュ情報を取得
        try {
          const { meta } = await loadCachedStockData();
          setCacheInfo(meta || null);
        } catch (error) {
          console.log('キャッシュメタ情報の取得をスキップ');
        }
      }
      
      setDataReady(true);
    } catch (error) {
      console.error('データ初期化エラー:', error);
      alert(`データの初期化に失敗しました。\n${error instanceof Error ? error.message : '不明なエラー'}`);
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

      // ランダムな期間を選択（過去60日分も含む）
      const { prices, startDate, endDate, practiceStartIndex } = selectRandomPeriod(
        allPrices,
        randomStock.symbol,
        periodDays,
        60 // 過去60日分を含む
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
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 overflow-hidden">
      {/* ヘッダー */}
      <header className="bg-white shadow-sm border-b flex-shrink-0">
        <div className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-lg font-bold text-gray-900">新規セッション</h1>
          </div>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="bg-white rounded-xl shadow-sm border p-4">
          {/* 設定フォーム */}
          <div className="space-y-4">
            {/* データソース情報（簡潔版） */}
            {cacheInfo && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-xs text-green-700">
                ✓ {cacheInfo.stockCount || 50}銘柄・実データ使用中
              </div>
            )}
            
            {!cacheInfo && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-xs text-gray-600">
                データ読み込み中...
              </div>
            )}

            {/* 期間設定 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                セッション期間
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[20, 40, 60].map((days) => (
                  <button
                    key={days}
                    onClick={() => setPeriodDays(days)}
                    className={`p-3 rounded-lg border-2 transition ${
                      periodDays === days
                        ? 'border-blue-600 bg-blue-50 text-blue-900'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="text-xl font-bold">{days}日</div>
                    <div className="text-xs text-gray-500">
                      {days === 20 && '約1ヶ月'}
                      {days === 40 && '約2ヶ月'}
                      {days === 60 && '約3ヶ月'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 再生速度 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                再生速度: {playbackSpeed}秒/日
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="1"
                  max="30"
                  step="1"
                  value={playbackSpeed}
                  onChange={(e) => setPlaybackSpeed(Number(e.target.value))}
                  className="flex-1"
                />
                <div className="w-16 text-center">
                  <div className="text-lg font-bold text-gray-900">
                    {playbackSpeed}秒
                  </div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>1秒(最速)</span>
                <span>15秒(標準)</span>
                <span>30秒(じっくり)</span>
              </div>
            </div>

            {/* 移動平均線設定 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                移動平均線
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
                    className="px-2 py-2 border rounded-lg text-center text-sm"
                    min="1"
                    max="200"
                  />
                ))}
              </div>
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
