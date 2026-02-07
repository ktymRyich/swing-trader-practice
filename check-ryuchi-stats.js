const Database = require("better-sqlite3");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "sessions.db");
const db = new Database(DB_PATH);

try {
    // りゅちのセッション取得
    const sessions = db
        .prepare(
            `
        SELECT * FROM sessions 
        WHERE nickname = ? 
        ORDER BY created_at DESC
    `,
        )
        .all("りゅち");

    console.log(`\n=== りゅちのセッション数: ${sessions.length} ===\n`);

    if (sessions.length === 0) {
        console.log("セッションが見つかりません");
        process.exit(0);
    }

    // 各セッションのポジションを取得
    let allClosedPositions = [];

    sessions.forEach((session, idx) => {
        const positions = db
            .prepare(
                `
            SELECT * FROM positions 
            WHERE session_id = ? AND status = 'closed'
            ORDER BY entry_date
        `,
            )
            .all(session.id);

        console.log(`セッション ${idx + 1}: ${session.symbol} (${session.id})`);
        console.log(`  決済済みポジション数: ${positions.length}`);

        if (positions.length > 0) {
            const profitsInSession = positions.filter(
                (p) => p.profit_loss && p.profit_loss > 0,
            );
            const lossesInSession = positions.filter(
                (p) => p.profit_loss && p.profit_loss < 0,
            );
            const totalProfitLoss = positions.reduce(
                (sum, p) => sum + (p.profit_loss || 0),
                0,
            );

            console.log(`  利益ポジション: ${profitsInSession.length}`);
            console.log(`  損失ポジション: ${lossesInSession.length}`);
            console.log(
                `  セッション合計損益: ¥${totalProfitLoss.toLocaleString()}`,
            );

            // いくつかのサンプルを表示
            console.log(`  サンプルポジション:`);
            positions.slice(0, 3).forEach((p) => {
                console.log(`    - ${p.entry_date}: ¥${p.profit_loss || 0}`);
            });
        }
        console.log("");

        allClosedPositions.push(...positions);
    });

    console.log(`\n=== 全体統計 ===`);
    console.log(`総決済済みポジション数: ${allClosedPositions.length}`);

    if (allClosedPositions.length === 0) {
        console.log("決済済みポジションがありません");
        process.exit(0);
    }

    // 利益・損失に分類
    const profits = allClosedPositions.filter(
        (p) => p.profit_loss && p.profit_loss > 0,
    );
    const losses = allClosedPositions.filter(
        (p) => p.profit_loss && p.profit_loss < 0,
    );
    const zeros = allClosedPositions.filter(
        (p) => !p.profit_loss || p.profit_loss === 0,
    );

    console.log(`利益ポジション: ${profits.length}`);
    console.log(`損失ポジション: ${losses.length}`);
    console.log(`損益ゼロ: ${zeros.length}`);

    // 平均損益の計算
    const totalProfitLoss = allClosedPositions.reduce(
        (sum, p) => sum + (p.profit_loss || 0),
        0,
    );
    const avgProfitLoss = totalProfitLoss / allClosedPositions.length;

    console.log(`\n【平均損益の計算】`);
    console.log(`式: (全ポジションの損益合計) ÷ (ポジション数)`);
    console.log(
        `  = (${totalProfitLoss.toLocaleString()}) ÷ ${allClosedPositions.length}`,
    );
    console.log(
        `  = ¥${avgProfitLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    );

    // 平均利益の計算
    if (profits.length > 0) {
        const totalProfit = profits.reduce(
            (sum, p) => sum + (p.profit_loss || 0),
            0,
        );
        const avgProfit = totalProfit / profits.length;
        console.log(`\n【平均利益の計算】`);
        console.log(`式: (利益ポジションの合計) ÷ (利益ポジション数)`);
        console.log(
            `  = (${totalProfit.toLocaleString()}) ÷ ${profits.length}`,
        );
        console.log(
            `  = ¥${avgProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        );
    }

    // 平均損失の計算
    if (losses.length > 0) {
        const totalLoss = losses.reduce(
            (sum, p) => sum + (p.profit_loss || 0),
            0,
        );
        const avgLoss = totalLoss / losses.length;
        console.log(`\n【平均損失の計算】`);
        console.log(`式: (損失ポジションの合計) ÷ (損失ポジション数)`);
        console.log(`  = (${totalLoss.toLocaleString()}) ÷ ${losses.length}`);
        console.log(
            `  = ¥${avgLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
        );
    }

    // 最大利益
    const maxProfit = allClosedPositions.reduce(
        (max, p) => Math.max(max, p.profit_loss || 0),
        0,
    );
    console.log(`\n【最大利益】`);
    console.log(`¥${maxProfit.toLocaleString()}`);
} catch (error) {
    console.error("エラー:", error);
} finally {
    db.close();
}
