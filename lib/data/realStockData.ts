import { Stock, StockPrice } from "../db/schema";
import { getCachedStockData } from "@/lib/localApi";

/**
 * サーバーにキャッシュされた実際の株価データを読み込む
 * Yahoo Finance APIへの直接アクセスは避け、事前にダウンロードされたデータを使用
 */
export async function loadCachedStockData(): Promise<{
    stocks: Stock[];
    prices: StockPrice[];
    meta?: {
        lastUpdated: string;
        stockCount: number;
        priceCount: number;
        dateRange: { start: string; end: string };
    };
}> {
    try {
        const data = await getCachedStockData();

        return {
            stocks: data.stocks || [],
            prices: data.prices || [],
            meta: data.meta,
        };
    } catch (error) {
        console.error("キャッシュデータ読み込みエラー:", error);
        throw error;
    }
}
