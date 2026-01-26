import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * キャッシュされた株価データを返すAPI
 * サーバー側に保存されたデータを読み込んで返す
 */
export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'lib', 'data', 'cache');
    const stocksPath = path.join(dataDir, 'stocks.json');
    const pricesPath = path.join(dataDir, 'prices.json');
    const metaPath = path.join(dataDir, 'meta.json');
    
    // キャッシュデータが存在するかチェック
    if (!fs.existsSync(stocksPath) || !fs.existsSync(pricesPath)) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'キャッシュデータが見つかりません。管理者にデータ更新を依頼してください。',
          hint: 'npm run update-stocks を実行してください'
        },
        { status: 404 }
      );
    }
    
    // データを読み込み
    const stocks = JSON.parse(fs.readFileSync(stocksPath, 'utf-8'));
    const prices = JSON.parse(fs.readFileSync(pricesPath, 'utf-8'));
    const meta = fs.existsSync(metaPath) 
      ? JSON.parse(fs.readFileSync(metaPath, 'utf-8'))
      : null;
    
    return NextResponse.json({
      success: true,
      stocks,
      prices,
      meta,
      count: prices.length
    });
    
  } catch (error) {
    console.error('キャッシュデータ読み込みエラー:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'データの読み込みに失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
