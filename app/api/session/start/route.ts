import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * セッション開始API
 * ランダムに銘柄を選んで、その銘柄のデータを返す
 */

export async function POST(request: Request) {
    try {
        const { periodDays, historicalDays = 120 } = await request.json();

        const dataDir = path.join(process.cwd(), "lib", "data", "cache");
        const stocksPath = path.join(dataDir, "stocks.json");
        const pricesPath = path.join(dataDir, "prices.json");

        if (!fs.existsSync(stocksPath) || !fs.existsSync(pricesPath)) {
            return NextResponse.json(
                { success: false, error: "データが見つかりません" },
                { status: 404 },
            );
        }

        // 全銘柄を読み込み
        const stocks = JSON.parse(fs.readFileSync(stocksPath, "utf-8"));
        const allPrices = JSON.parse(fs.readFileSync(pricesPath, "utf-8"));

        const totalDaysNeeded = historicalDays + periodDays;
        let selectedStock = null;
        let selectedPrices = null;
        let practiceStartIndex = 0;
        let practiceStartDate = "";
        let startDate = "";
        let endDate = "";
        let attempts = 0;
        const maxAttempts = 100;

        // 十分なデータがある銘柄が見つかるまで再抽選
        while (!selectedStock && attempts < maxAttempts) {
            attempts++;

            // ランダムに銘柄を選択
            const randomStock =
                stocks[Math.floor(Math.random() * stocks.length)];

            // その銘柄の価格データだけを取得
            const stockPrices = allPrices
                .filter((p: any) => p.symbol === randomStock.symbol)
                .sort((a: any, b: any) => a.date.localeCompare(b.date));

            // 必要な期間のデータがあるかチェック
            if (stockPrices.length < totalDaysNeeded) {
                continue; // データ不足の場合は次の銘柄へ
            }

            // ランダムな開始位置を選択（練習期間が確保できる範囲内）
            const maxStartIndex = stockPrices.length - totalDaysNeeded;
            if (maxStartIndex < 0) {
                continue; // データ不足の場合は次の銘柄へ
            }

            const startIndex = Math.floor(Math.random() * (maxStartIndex + 1));
            practiceStartIndex = startIndex + historicalDays;
            practiceStartDate = stockPrices[practiceStartIndex]?.date;

            // 練習期間開始日までの全ての過去データを含める
            selectedPrices = stockPrices.slice(
                0,
                practiceStartIndex + periodDays,
            );
            startDate = selectedPrices[0].date;
            endDate = selectedPrices[selectedPrices.length - 1].date;

            // 練習期間が確保できることを最終確認
            if (practiceStartIndex + periodDays <= stockPrices.length) {
                selectedStock = randomStock;
                console.log(
                    `セッション開始(試行${attempts}回): 銘柄=${randomStock.symbol}, データ総数=${stockPrices.length}, 練習開始位置=${practiceStartIndex}, 全データ期間=${startDate}〜${endDate}`,
                );
            }
        }

        if (!selectedStock) {
            return NextResponse.json(
                { success: false, error: "適切な銘柄が見つかりませんでした" },
                { status: 400 },
            );
        }

        return NextResponse.json({
            success: true,
            stock: selectedStock,
            // 株価データは返さない（後でAPIから取得）
            practiceStartIndex,
            practiceStartDate, // 練習開始日（リプレイ開始日）
            startDate,
            endDate,
        });
    } catch (error) {
        console.error("セッション開始エラー:", error);
        return NextResponse.json(
            {
                success: false,
                error: "セッション開始に失敗しました",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
