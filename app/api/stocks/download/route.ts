import { NextResponse } from 'next/server';

/**
 * Yahoo Finance APIから日本株の過去データを取得
 * 実際にはyfinanceやその他のAPIを使用する
 */
export async function POST(request: Request) {
  try {
    const { symbol, startDate, endDate } = await request.json();
    
    // Yahoo Finance APIのエンドポイント（証券コード.T形式）
    const yahooSymbol = `${symbol}.T`;
    const period1 = Math.floor(new Date(startDate).getTime() / 1000);
    const period2 = Math.floor(new Date(endDate).getTime() / 1000);
    
    const url = `https://query1.finance.yahoo.com/v7/finance/download/${yahooSymbol}?period1=${period1}&period2=${period2}&interval=1d&events=history`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Failed to fetch data: ${response.statusText}`);
    }
    
    const csvData = await response.text();
    
    // CSVをパース
    const lines = csvData.split('\n');
    const headers = lines[0].split(',');
    const prices = [];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      
      const values = line.split(',');
      if (values.length < 6) continue;
      
      prices.push({
        symbol,
        date: values[0],
        open: Math.round(parseFloat(values[1])),
        high: Math.round(parseFloat(values[2])),
        low: Math.round(parseFloat(values[3])),
        close: Math.round(parseFloat(values[4])),
        volume: parseInt(values[6] || values[5]),
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      count: prices.length,
      prices 
    });
    
  } catch (error) {
    console.error('Stock data download error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
