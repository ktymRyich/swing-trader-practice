import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * セッション開始API
 * ランダムに銘柄を選んで、その銘柄のデータを返す
 */

export async function POST(request: Request) {
  try {
    const { periodDays, historicalDays = 120 } = await request.json();

    const dataDir = path.join(process.cwd(), 'lib', 'data', 'cache');
    const stocksPath = path.join(dataDir, 'stocks.json');
    const pricesPath = path.join(dataDir, 'prices.json');

    if (!fs.existsSync(stocksPath) || !fs.existsSync(pricesPath)) {
      return NextResponse.json(
        { success: false, error: 'データが見つかりません' },
        { status: 404 }
      );
    }

    // 全銘柄を読み込み
    const stocks = JSON.parse(fs.readFileSync(stocksPath, 'utf-8'));
    const allPrices = JSON.parse(fs.readFileSync(pricesPath, 'utf-8'));

    // ランダムに銘柄を選択
    const randomStock = stocks[Math.floor(Math.random() * stocks.length)];

    // その銘柄の価格データだけを取得
    const stockPrices = allPrices
      .filter((p: any) => p.symbol === randomStock.symbol)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    // 必要な期間のデータを選択
    const totalDaysNeeded = historicalDays + periodDays;
    if (stockPrices.length < totalDaysNeeded) {
      return NextResponse.json(
        { success: false, error: '期間が長すぎます' },
        { status: 400 }
      );
    }

    // ランダムな開始位置を選択
    const maxStartIndex = stockPrices.length - totalDaysNeeded;
    const startIndex = Math.floor(Math.random() * (maxStartIndex + 1));
    const selectedPrices = stockPrices.slice(startIndex, startIndex + totalDaysNeeded);

    console.log(`セッション開始: 銘柄=${randomStock.symbol}, データ総数=${stockPrices.length}, 開始位置=${startIndex}/${maxStartIndex}, 期間=${selectedPrices[0].date}〜${selectedPrices[selectedPrices.length - 1].date}`);

    return NextResponse.json({
      success: true,
      stock: randomStock,
      prices: selectedPrices,
      practiceStartIndex: historicalDays,
      startDate: selectedPrices[0].date,
      endDate: selectedPrices[selectedPrices.length - 1].date,
    });
  } catch (error) {
    console.error('セッション開始エラー:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'セッション開始に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
