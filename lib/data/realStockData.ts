import { Stock, StockPrice } from '../db/schema';

/**
 * サーバーにキャッシュされた実際の株価データを読み込む
 * Yahoo Finance APIへの直接アクセスは避け、事前にダウンロードされたデータを使用
 */
export async function loadCachedStockData(): Promise<{ 
  stocks: Stock[], 
  prices: StockPrice[],
  meta?: {
    lastUpdated: string;
    stockCount: number;
    priceCount: number;
    dateRange: { start: string; end: string };
  }
}> {
  try {
    const response = await fetch('/api/stocks/cached');
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'データの取得に失敗しました');
    }
    
    const data = await response.json();
    
    if (!data.success) {
      throw new Error(data.error || 'データが見つかりません');
    }
    
    return {
      stocks: data.stocks || [],
      prices: data.prices || [],
      meta: data.meta
    };
  } catch (error) {
    console.error('キャッシュデータ読み込みエラー:', error);
    throw error;
  }
}