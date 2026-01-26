/**
 * 株価データ更新スクリプト
 * サーバー起動時または手動実行で、Yahoo Financeから最新データを取得してキャッシュする
 */

import fs from 'fs';
import path from 'path';

interface StockPrice {
  symbol: string;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Stock {
  symbol: string;
  name: string;
  sector: string;
}

const POPULAR_STOCKS = [
  // 既存の主要10銘柄
  { symbol: '7203', name: 'トヨタ自動車', sector: '自動車' },
  { symbol: '9984', name: 'ソフトバンクグループ', sector: 'IT・通信' },
  { symbol: '6758', name: 'ソニーグループ', sector: '電機' },
  { symbol: '9983', name: 'ファーストリテイリング', sector: '小売' },
  { symbol: '7974', name: '任天堂', sector: 'ゲーム' },
  { symbol: '6861', name: 'キーエンス', sector: '電機' },
  { symbol: '4063', name: '信越化学工業', sector: '化学' },
  { symbol: '6098', name: 'リクルートホールディングス', sector: 'サービス' },
  { symbol: '9434', name: 'ソフトバンク', sector: 'IT・通信' },
  { symbol: '4502', name: '武田薬品工業', sector: '医薬品' },
  
  // 金融（7銘柄）
  { symbol: '8306', name: '三菱UFJフィナンシャル・グループ', sector: '金融' },
  { symbol: '8316', name: '三井住友フィナンシャルグループ', sector: '金融' },
  { symbol: '8411', name: 'みずほフィナンシャルグループ', sector: '金融' },
  { symbol: '8601', name: '大和証券グループ本社', sector: '金融' },
  { symbol: '8604', name: '野村ホールディングス', sector: '金融' },
  { symbol: '8766', name: '東京海上ホールディングス', sector: '金融' },
  { symbol: '8725', name: 'MS&ADインシュアランスグループHD', sector: '金融' },
  
  // 自動車・輸送機器（6銘柄）
  { symbol: '7267', name: 'ホンダ', sector: '自動車' },
  { symbol: '7201', name: '日産自動車', sector: '自動車' },
  { symbol: '7261', name: 'マツダ', sector: '自動車' },
  { symbol: '7269', name: 'スズキ', sector: '自動車' },
  { symbol: '6902', name: 'デンソー', sector: '自動車部品' },
  { symbol: '5108', name: 'ブリヂストン', sector: '自動車部品' },
  
  // 電機（8銘柄）
  { symbol: '6752', name: 'パナソニックホールディングス', sector: '電機' },
  { symbol: '6501', name: '日立製作所', sector: '電機' },
  { symbol: '6503', name: '三菱電機', sector: '電機' },
  { symbol: '6702', name: '富士通', sector: '電機' },
  { symbol: '6971', name: '京セラ', sector: '電機' },
  { symbol: '6954', name: 'ファナック', sector: '電機' },
  { symbol: '6981', name: '村田製作所', sector: '電機' },
  { symbol: '6762', name: 'TDK', sector: '電機' },
  
  // 通信（2銘柄）
  { symbol: '9432', name: '日本電信電話', sector: 'IT・通信' },
  { symbol: '9433', name: 'KDDI', sector: 'IT・通信' },
  
  // 小売（3銘柄）
  { symbol: '3382', name: 'セブン&アイ・ホールディングス', sector: '小売' },
  { symbol: '8267', name: 'イオン', sector: '小売' },
  { symbol: '4755', name: '楽天グループ', sector: 'IT・通信' },
  
  // 食品（3銘柄）
  { symbol: '2502', name: 'アサヒグループホールディングス', sector: '食品' },
  { symbol: '2503', name: 'キリンホールディングス', sector: '食品' },
  { symbol: '2802', name: '味の素', sector: '食品' },
  
  // 医薬品（3銘柄）
  { symbol: '4568', name: '第一三共', sector: '医薬品' },
  { symbol: '4523', name: 'エーザイ', sector: '医薬品' },
  { symbol: '4503', name: 'アステラス製薬', sector: '医薬品' },
  
  // 化学（2銘柄）
  { symbol: '4188', name: '三菱ケミカルグループ', sector: '化学' },
  { symbol: '4452', name: '花王', sector: '化学' },
  
  // 商社（5銘柄）
  { symbol: '8058', name: '三菱商事', sector: '商社' },
  { symbol: '8031', name: '三井物産', sector: '商社' },
  { symbol: '8001', name: '伊藤忠商事', sector: '商社' },
  { symbol: '8053', name: '住友商事', sector: '商社' },
  { symbol: '8002', name: '丸紅', sector: '商社' },
  
  // 不動産（1銘柄）
  { symbol: '8801', name: '三井不動産', sector: '不動産' },
];

async function downloadStockData(symbol: string, startDate: string, endDate: string): Promise<StockPrice[]> {
  const period1 = Math.floor(new Date(startDate).getTime() / 1000);
  const period2 = Math.floor(new Date(endDate).getTime() / 1000);
  
  // Yahoo Finance v7 APIを使用（v7は認証不要）
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${symbol}.T?period1=${period1}&period2=${period2}&interval=1d&events=history`;
  
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      }
    });
    
    if (!response.ok) {
      console.error(`${symbol}: HTTP ${response.status}`);
      return [];
    }
    
    const data = await response.json();
    const result = data?.chart?.result?.[0];
    
    if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
      console.error(`${symbol}: データ構造が不正`);
      return [];
    }
    
    const timestamps = result.timestamp;
    const quote = result.indicators.quote[0];
    const prices: StockPrice[] = [];
    
    for (let i = 0; i < timestamps.length; i++) {
      const date = new Date(timestamps[i] * 1000).toISOString().split('T')[0];
      const open = quote.open[i];
      const high = quote.high[i];
      const low = quote.low[i];
      const close = quote.close[i];
      const volume = quote.volume[i];
      
      if (open && high && low && close && volume) {
        prices.push({
          symbol,
          date,
          open,
          high,
          low,
          close,
          volume,
        });
      }
    }
    
    return prices;
  } catch (error) {
    console.error(`${symbol}: ダウンロードエラー`, error);
    return [];
  }
}

async function updateAllStockData() {
  console.log('📊 株価データ更新を開始...');
  
  const startDate = '2020-01-01';
  const endDate = new Date().toISOString().split('T')[0];
  
  const allStocks: Stock[] = [];
  const allPrices: StockPrice[] = [];
  
  for (let i = 0; i < POPULAR_STOCKS.length; i++) {
    const stock = POPULAR_STOCKS[i];
    console.log(`[${i + 1}/${POPULAR_STOCKS.length}] ${stock.name} (${stock.symbol}) をダウンロード中...`);
    
    const prices = await downloadStockData(stock.symbol, startDate, endDate);
    
    if (prices.length > 0) {
      allStocks.push(stock);
      allPrices.push(...prices);
      console.log(`  ✓ ${prices.length}件取得完了`);
    } else {
      console.log(`  ✗ データ取得失敗`);
    }
    
    // レート制限対策
    if (i < POPULAR_STOCKS.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // データをファイルに保存
  const dataDir = path.join(process.cwd(), 'lib', 'data', 'cache');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const stocksPath = path.join(dataDir, 'stocks.json');
  const pricesPath = path.join(dataDir, 'prices.json');
  const metaPath = path.join(dataDir, 'meta.json');
  
  fs.writeFileSync(stocksPath, JSON.stringify(allStocks, null, 2));
  fs.writeFileSync(pricesPath, JSON.stringify(allPrices, null, 2));
  fs.writeFileSync(metaPath, JSON.stringify({
    lastUpdated: new Date().toISOString(),
    stockCount: allStocks.length,
    priceCount: allPrices.length,
    dateRange: { start: startDate, end: endDate }
  }, null, 2));
  
  console.log('\n✅ 更新完了！');
  console.log(`   銘柄数: ${allStocks.length}`);
  console.log(`   価格データ: ${allPrices.length}件`);
  console.log(`   保存先: ${dataDir}`);
}

// スクリプトとして実行された場合
if (require.main === module) {
  updateAllStockData()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('❌ エラーが発生しました:', error);
      process.exit(1);
    });
}

export { updateAllStockData };
