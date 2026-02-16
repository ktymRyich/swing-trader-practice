import { getDatabase } from "../lib/db/sqlite";

const TODAY = "2026-02-12";

function updateYakoDates() {
    const db = getDatabase();

    console.log("ヤコさんのデータの日付を更新中...");

    try {
        // トランザクション開始
        db.exec("BEGIN TRANSACTION");

        // ヤコさんのセッションを取得
        const sessions = db
            .prepare("SELECT id FROM sessions WHERE nickname = ?")
            .all("ヤコ") as Array<{ id: string }>;

        if (sessions.length === 0) {
            console.log("ヤコさんのセッションが見つかりませんでした。");
            db.exec("ROLLBACK");
            return;
        }

        console.log(`${sessions.length}件のセッションを見つけました。`);

        // セッションの日付を更新
        const updateSessionStmt = db.prepare(`
            UPDATE sessions 
            SET practice_start_date = ?,
                practice_end_date = ?,
                practice_replay_date = ?,
                created_at = ?,
                updated_at = ?
            WHERE id = ?
        `);

        for (const session of sessions) {
            updateSessionStmt.run(
                TODAY,
                TODAY,
                TODAY,
                TODAY,
                TODAY,
                session.id,
            );
        }

        console.log(`✓ ${sessions.length}件のセッションの日付を更新しました。`);

        // ポジションの日付を更新（ヤコさんのセッションに紐づくもの）
        const sessionIds = sessions.map((s) => s.id);
        const placeholders = sessionIds.map(() => "?").join(",");

        const updatePositionsStmt = db.prepare(`
            UPDATE positions 
            SET entry_date = ?,
                exit_date = CASE 
                    WHEN exit_date IS NOT NULL THEN ?
                    ELSE NULL 
                END
            WHERE session_id IN (${placeholders})
        `);

        const positionsResult = updatePositionsStmt.run(
            TODAY,
            TODAY,
            ...sessionIds,
        );
        console.log(
            `✓ ${positionsResult.changes}件のポジションの日付を更新しました。`,
        );

        // トレードの日付を更新（ヤコさんのセッションに紐づくもの）
        const updateTradesStmt = db.prepare(`
            UPDATE trades 
            SET trade_date = ?
            WHERE session_id IN (${placeholders})
        `);

        const tradesResult = updateTradesStmt.run(TODAY, ...sessionIds);
        console.log(
            `✓ ${tradesResult.changes}件のトレードの日付を更新しました。`,
        );

        // コミット
        db.exec("COMMIT");

        console.log("\n✅ すべての日付を今日（2026-02-12）に更新しました！");

        // 確認のため、更新後のデータを表示
        console.log("\n--- 更新後のセッション ---");
        const updatedSessions = db
            .prepare(
                `
            SELECT id, symbol, stock_name, practice_start_date, practice_end_date, created_at, status
            FROM sessions 
            WHERE nickname = ?
            ORDER BY created_at DESC
            LIMIT 5
        `,
            )
            .all("ヤコ");

        console.table(updatedSessions);
    } catch (error) {
        console.error("エラーが発生しました:", error);
        db.exec("ROLLBACK");
        throw error;
    }
}

// スクリプトを実行
updateYakoDates();
