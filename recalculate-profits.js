const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "sessions.db");
const db = new Database(DB_PATH);

try {
    console.log("=== 損益の再計算を開始 ===\n");

    // 決済済みポジションを取得（profit_lossがNULLまたは0のもの）
    const positionsToUpdate = db
        .prepare(
            `
        SELECT * FROM positions 
        WHERE status = 'closed' 
        AND exit_price IS NOT NULL 
        AND entry_price IS NOT NULL
        AND shares IS NOT NULL
    `,
        )
        .all();

    console.log(`対象ポジション数: ${positionsToUpdate.length}\n`);

    let updatedCount = 0;
    let alreadyCorrectCount = 0;
    let nullOrZeroCount = 0;

    const updateStmt = db.prepare(`
        UPDATE positions 
        SET profit_loss = ? 
        WHERE id = ?
    `);

    const transaction = db.transaction(() => {
        for (const position of positionsToUpdate) {
            // 損益を計算
            let calculatedProfit;

            if (position.type === "long") {
                // ロング（買い）: (売却価格 - 購入価格) × 株数
                calculatedProfit =
                    (position.exit_price - position.entry_price) *
                    position.shares;
            } else if (position.type === "short") {
                // ショート（売り）: (購入価格 - 売却価格) × 株数
                calculatedProfit =
                    (position.entry_price - position.exit_price) *
                    position.shares;
            } else {
                console.warn(
                    `⚠️  不明なタイプ: ${position.type} (ID: ${position.id})`,
                );
                continue;
            }

            // 既存の値をチェック
            const currentProfit = position.profit_loss || 0;
            const isNullOrZero =
                position.profit_loss === null || position.profit_loss === 0;

            if (isNullOrZero) {
                nullOrZeroCount++;
            }

            // 計算値と既存値の差が小さければスキップ（すでに正しい）
            const diff = Math.abs(calculatedProfit - currentProfit);
            if (diff < 0.01 && !isNullOrZero) {
                alreadyCorrectCount++;
                continue;
            }

            // 更新
            updateStmt.run(calculatedProfit, position.id);
            updatedCount++;

            if (updatedCount <= 10) {
                console.log(`更新: ${position.id}`);
                console.log(`  タイプ: ${position.type}`);
                console.log(
                    `  建玉: ¥${position.entry_price} × ${position.shares}株`,
                );
                console.log(`  決済: ¥${position.exit_price}`);
                console.log(
                    `  損益: ¥${currentProfit.toLocaleString()} → ¥${calculatedProfit.toLocaleString()}`,
                );
                console.log("");
            }
        }
    });

    transaction();

    console.log("\n=== 更新完了 ===");
    console.log(`総ポジション数: ${positionsToUpdate.length}`);
    console.log(`NULLまたは0だった数: ${nullOrZeroCount}`);
    console.log(`更新済み: ${updatedCount}`);
    console.log(`すでに正しい値: ${alreadyCorrectCount}`);

    // 更新後の統計を確認
    console.log("\n=== 更新後の統計確認 ===");

    const stats = db
        .prepare(
            `
        SELECT 
            COUNT(*) as total,
            COUNT(CASE WHEN profit_loss > 0 THEN 1 END) as profit_count,
            COUNT(CASE WHEN profit_loss < 0 THEN 1 END) as loss_count,
            COUNT(CASE WHEN profit_loss = 0 OR profit_loss IS NULL THEN 1 END) as zero_count,
            SUM(profit_loss) as total_profit,
            AVG(profit_loss) as avg_profit
        FROM positions
        WHERE status = 'closed'
    `,
        )
        .get();

    console.log(`決済済みポジション: ${stats.total}`);
    console.log(
        `利益: ${stats.profit_count}, 損失: ${stats.loss_count}, ゼロ/NULL: ${stats.zero_count}`,
    );
    console.log(`合計損益: ¥${(stats.total_profit || 0).toLocaleString()}`);
    console.log(
        `平均損益: ¥${(stats.avg_profit || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`,
    );
} catch (error) {
    console.error("エラー:", error);
} finally {
    db.close();
}
