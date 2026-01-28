import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * 特定銘柄の株価データを取得するAPI
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ symbol: string }> }
) {
  try {
    const { symbol } = await params;
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const dataDir = path.join(process.cwd(), 'lib', 'data', 'cache');
    const pricesPath = path.join(dataDir, 'prices.json');

    if (!fs.existsSync(pricesPath)) {
      return NextResponse.json(
        { success: false, error: '株価データが見つかりません' },
        { status: 404 }
      );
    }

    // 全価格データを読み込み
    const allPrices = JSON.parse(fs.readFileSync(pricesPath, 'utf-8'));

    // 指定銘柄の価格データをフィルタ
    let stockPrices = allPrices
      .filter((p: any) => p.symbol === symbol)
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

    // 日付範囲でフィルタ
    if (startDate) {
      stockPrices = stockPrices.filter((p: any) => p.date >= startDate);
    }
    if (endDate) {
      stockPrices = stockPrices.filter((p: any) => p.date <= endDate);
    }

    console.log(`[GET /api/stocks/prices/${symbol}] ${stockPrices.length}件取得 (${startDate || '開始'} 〜 ${endDate || '終了'})`);

    return NextResponse.json({
      success: true,
      prices: stockPrices,
    });
  } catch (error) {
    console.error('株価データ取得エラー:', error);
    return NextResponse.json(
      { success: false, error: '株価データの取得に失敗しました' },
      { status: 500 }
    );
  }
}
