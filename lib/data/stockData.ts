import { Stock, StockPrice } from '../db/schema';
import { addDays, format } from 'date-fns';

// ===== 日本株銘柄リスト（東証プライム主要100銘柄） =====

export const JAPANESE_STOCKS: Omit<Stock, 'id'>[] = [
  // 自動車
  { symbol: '7203', name: 'トヨタ自動車', sector: '自動車', description: '世界最大級の自動車メーカー' },
  { symbol: '7267', name: 'ホンダ', sector: '自動車', description: '二輪車・四輪車・航空機エンジンメーカー' },
  { symbol: '7201', name: '日産自動車', sector: '自動車', description: '大手自動車メーカー' },
  
  // エレクトロニクス
  { symbol: '6758', name: 'ソニーグループ', sector: 'エレクトロニクス', description: '総合エレクトロニクス・エンターテインメント企業' },
  { symbol: '6861', name: 'キーエンス', sector: '電気機器', description: 'FAセンサー・測定器メーカー' },
  { symbol: '6954', name: 'ファナック', sector: '電気機器', description: '工作機械用NC装置・産業用ロボットメーカー' },
  { symbol: '6752', name: 'パナソニック ホールディングス', sector: 'エレクトロニクス', description: '総合エレクトロニクスメーカー' },
  { symbol: '6971', name: '京セラ', sector: 'エレクトロニクス', description: 'セラミック・電子部品メーカー' },
  
  // 通信
  { symbol: '9432', name: '日本電信電話', sector: '通信', description: '日本最大の通信事業者' },
  { symbol: '9433', name: 'KDDI', sector: '通信', description: '大手通信事業者' },
  { symbol: '9434', name: 'ソフトバンク', sector: '通信', description: '移動通信事業者' },
  
  // 金融
  { symbol: '8306', name: '三菱UFJフィナンシャル・グループ', sector: '銀行', description: '日本最大の金融グループ' },
  { symbol: '8316', name: '三井住友フィナンシャルグループ', sector: '銀行', description: '大手金融グループ' },
  { symbol: '8411', name: 'みずほフィナンシャルグループ', sector: '銀行', description: '大手金融グループ' },
  
  // 商社
  { symbol: '8058', name: '三菱商事', sector: '商社', description: '総合商社最大手' },
  { symbol: '8001', name: '伊藤忠商事', sector: '商社', description: '大手総合商社' },
  { symbol: '8031', name: '三井物産', sector: '商社', description: '大手総合商社' },
  
  // 小売
  { symbol: '9983', name: 'ファーストリテイリング', sector: '小売', description: 'ユニクロ・GU運営' },
  { symbol: '3382', name: 'セブン&アイ・ホールディングス', sector: '小売', description: 'セブンイレブン運営' },
  { symbol: '8267', name: 'イオン', sector: '小売', description: '総合小売大手' },
  
  // 製薬
  { symbol: '4502', name: '武田薬品工業', sector: '医薬品', description: '国内製薬最大手' },
  { symbol: '4503', name: 'アステラス製薬', sector: '医薬品', description: '大手製薬会社' },
  { symbol: '4568', name: '第一三共', sector: '医薬品', description: '大手製薬会社' },
  
  // ゲーム・エンタメ
  { symbol: '7974', name: '任天堂', sector: 'ゲーム', description: '世界的ゲームメーカー' },
  { symbol: '9697', name: 'カプコン', sector: 'ゲーム', description: 'ゲームソフト開発' },
  { symbol: '9684', name: 'スクウェア・エニックス・ホールディングス', sector: 'ゲーム', description: 'ゲームソフト開発' },
];

// ===== ランダムな株価データ生成 =====

/**
 * ランダムウォークで株価データを生成
 */
export function generateRandomStockPrices(
  symbol: string,
  startDate: Date,
  days: number,
  initialPrice: number = 2000,
  volatility: number = 0.02
): StockPrice[] {
  const prices: StockPrice[] = [];
  let currentPrice = initialPrice;
  
  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // ランダムな変動
    const change = (Math.random() - 0.5) * 2 * volatility;
    currentPrice = currentPrice * (1 + change);
    
    // OHLC生成
    const open = currentPrice * (1 + (Math.random() - 0.5) * 0.01);
    const close = currentPrice * (1 + (Math.random() - 0.5) * 0.01);
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    
    // 出来高生成（100万〜1000万株）
    const volume = Math.floor(Math.random() * 9000000) + 1000000;
    
    prices.push({
      symbol,
      date: dateStr,
      open: Math.round(open),
      high: Math.round(high),
      low: Math.round(low),
      close: Math.round(close),
      volume
    });
  }
  
  return prices;
}

/**
 * トレンドのある株価データを生成
 */
export function generateTrendingStockPrices(
  symbol: string,
  startDate: Date,
  days: number,
  initialPrice: number = 2000,
  trend: 'up' | 'down' | 'sideways' = 'up',
  volatility: number = 0.02
): StockPrice[] {
  const prices: StockPrice[] = [];
  let currentPrice = initialPrice;
  
  // トレンドの傾き
  const trendFactor = trend === 'up' ? 0.001 : trend === 'down' ? -0.001 : 0;
  
  for (let i = 0; i < days; i++) {
    const date = addDays(startDate, i);
    const dateStr = format(date, 'yyyy-MM-dd');
    
    // トレンド + ランダム変動
    const change = trendFactor + (Math.random() - 0.5) * 2 * volatility;
    currentPrice = currentPrice * (1 + change);
    
    // OHLC生成
    const open = currentPrice * (1 + (Math.random() - 0.5) * 0.01);
    const close = currentPrice * (1 + (Math.random() - 0.5) * 0.01);
    const high = Math.max(open, close) * (1 + Math.random() * 0.02);
    const low = Math.min(open, close) * (1 - Math.random() * 0.02);
    
    // 出来高生成
    const volume = Math.floor(Math.random() * 9000000) + 1000000;
    
    prices.push({
      symbol,
      date: dateStr,
      open: Math.round(open),
      high: Math.round(high),
      low: Math.round(low),
      close: Math.round(close),
      volume
    });
  }
  
  return prices;
}

/**
 * 複数銘柄のサンプルデータを生成
 */
export async function generateSampleData(
  numberOfStocks: number = 10,
  days: number = 500
): Promise<{ stocks: Stock[]; prices: StockPrice[] }> {
  const stocks: Stock[] = [];
  const allPrices: StockPrice[] = [];
  
  const selectedStocks = JAPANESE_STOCKS.slice(0, numberOfStocks);
  const startDate = new Date('2020-01-01');
  
  for (const stockData of selectedStocks) {
    stocks.push(stockData as Stock);
    
    // ランダムにトレンドを決定
    const trends: Array<'up' | 'down' | 'sideways'> = ['up', 'down', 'sideways'];
    const trend = trends[Math.floor(Math.random() * trends.length)];
    
    // 初期価格をランダムに設定（1000〜5000円）
    const initialPrice = Math.floor(Math.random() * 4000) + 1000;
    
    const prices = generateTrendingStockPrices(
      stockData.symbol,
      startDate,
      days,
      initialPrice,
      trend,
      0.02
    );
    
    allPrices.push(...prices);
  }
  
  return { stocks, prices: allPrices };
}

/**
 * ランダムな期間を選択（過去データ180日分も含む）
 */
export function selectRandomPeriod(
  allPrices: StockPrice[],
  symbol: string,
  periodDays: number,
  historicalDays: number = 180
): { prices: StockPrice[]; startDate: string; endDate: string; practiceStartIndex: number } {
  const stockPrices = allPrices.filter(p => p.symbol === symbol);
  
  const totalDaysNeeded = historicalDays + periodDays;
  if (stockPrices.length < totalDaysNeeded) {
    throw new Error('期間が長すぎます');
  }
  
  // ランダムな開始位置を選択（過去60日分も考慮）
  const maxStartIndex = stockPrices.length - totalDaysNeeded;
  const startIndex = Math.floor(Math.random() * (maxStartIndex + 1));
  
  // 過去60日 + 練習期間のデータを取得
  const selectedPrices = stockPrices.slice(startIndex, startIndex + totalDaysNeeded);
  
  return {
    prices: selectedPrices,
    startDate: selectedPrices[0].date,
    endDate: selectedPrices[selectedPrices.length - 1].date,
    practiceStartIndex: historicalDays // 練習開始位置（過去60日分をスキップ）
  };
}
