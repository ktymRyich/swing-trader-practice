import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/db/sqlite";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    try {
        const { sessionId } = await params;
        const nickname = request.nextUrl.searchParams.get("nickname");

        if (!nickname) {
            return NextResponse.json(
                { success: false, error: "Nickname required" },
                { status: 400 },
            );
        }

        const db = getDatabase();

        // セッションを取得
        const session = db
            .prepare(
                `
      SELECT * FROM sessions 
      WHERE id = ? AND nickname = ?
    `,
            )
            .get(sessionId, nickname);

        if (!session) {
            return NextResponse.json(
                { success: false, error: "Session not found" },
                { status: 404 },
            );
        }

        // ポジションとトレードを取得
        const positions = db
            .prepare(
                `
      SELECT * FROM positions 
      WHERE session_id = ? 
      ORDER BY entry_date
    `,
            )
            .all(sessionId);

        const trades = db
            .prepare(
                `
      SELECT * FROM trades 
      WHERE session_id = ? 
      ORDER BY trade_date
    `,
            )
            .all(sessionId);

        // カラム名をキャメルケースに変換
        const sessionData: any = session;
        const result = {
            id: sessionData.id,
            nickname: sessionData.nickname,
            symbol: sessionData.symbol,
            stockName: sessionData.stock_name,
            initialCapital: sessionData.initial_capital,
            currentCapital: sessionData.current_capital,
            startDateOfData: sessionData.practice_start_date, // 株価データの開始日
            practiceStartIndex: sessionData.practice_start_index,
            practiceStartDate: sessionData.practice_replay_date, // 練習開始日（リプレイ開始日）
            endDateOfData: sessionData.practice_end_date, // 株価データの終了日
            status: sessionData.status,
            currentDay: sessionData.current_day || 0,
            periodDays: sessionData.period_days || 60,
            tradeCount: sessionData.trade_count || 0,
            winCount: sessionData.win_count || 0,
            winRate: sessionData.win_rate || 0,
            maxDrawdown: sessionData.max_drawdown || 0,
            ruleViolations: sessionData.rule_violations || 0,
            maSettings: sessionData.ma_settings
                ? JSON.parse(sessionData.ma_settings)
                : [5, 25, 75], // 移動平均線設定
            reflection: sessionData.reflection || null, // 感想・反省
            createdAt: sessionData.created_at,
            updatedAt: sessionData.updated_at,
            positions: positions.map((p: any) => ({
                id: p.id,
                sessionId: p.session_id,
                type: p.type,
                entryDate: p.entry_date,
                entryPrice: p.entry_price,
                shares: p.shares,
                exitDate: p.exit_date,
                exitPrice: p.exit_price,
                profitLoss: p.profit_loss,
                status: p.status,
            })),
            trades: trades.map((t: any) => ({
                id: t.id,
                sessionId: t.session_id,
                positionId: t.position_id,
                type: t.type,
                tradeDate: t.trade_date,
                price: t.price,
                shares: t.shares,
                memo: t.memo,
            })),
        };

        return NextResponse.json({ success: true, session: result });
    } catch (error) {
        console.error("Get session error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to get session" },
            { status: 500 },
        );
    }
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> },
) {
    try {
        const { sessionId } = await params;
        const body = await request.json();
        const { nickname, session } = body;

        if (!nickname) {
            return NextResponse.json(
                { success: false, error: "Nickname required" },
                { status: 400 },
            );
        }

        const db = getDatabase();

        console.log(`[PUT] セッション更新: ${sessionId} (${nickname})`);

        // トランザクションで更新
        const updateTransaction = db.transaction(() => {
            const now = new Date().toISOString();

            // セッションを更新
            db.prepare(
                `
        INSERT OR REPLACE INTO sessions (
          id, nickname, symbol, stock_name, initial_capital, current_capital,
          practice_start_date, practice_start_index, practice_end_date, practice_replay_date, status,
          current_day, period_days, trade_count, win_count, win_rate, max_drawdown, rule_violations,
          ma_settings, reflection, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM sessions WHERE id = ?), ?), ?)
      `,
            ).run(
                session.id,
                nickname,
                session.symbol,
                session.stockName,
                session.initialCapital,
                session.currentCapital,
                session.startDateOfData || session.startDate, // 株価データの開始日
                session.practiceStartIndex || 0,
                session.endDateOfData || session.startDate, // 株価データの終了日
                session.practiceStartDate || null, // 練習開始日（リプレイ開始日）
                session.status,
                session.currentDay || 0,
                session.periodDays || 60,
                session.tradeCount || 0,
                session.winCount || 0,
                session.winRate || 0,
                session.maxDrawdown || 0,
                session.ruleViolations || 0,
                session.maSettings ? JSON.stringify(session.maSettings) : null, // 移動平均線設定
                session.reflection || null, // 感想・反省
                session.id,
                now,
                now,
            );

            // 既存のポジションとトレードを削除
            db.prepare("DELETE FROM positions WHERE session_id = ?").run(
                session.id,
            );
            db.prepare("DELETE FROM trades WHERE session_id = ?").run(
                session.id,
            );

            // ポジションを保存
            if (session.positions && Array.isArray(session.positions)) {
                const insertPosition = db.prepare(`
          INSERT INTO positions (
            id, session_id, type, entry_date, entry_price, shares,
            exit_date, exit_price, profit_loss, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

                for (const position of session.positions) {
                    insertPosition.run(
                        position.id,
                        session.id,
                        position.type,
                        position.entryDate,
                        position.entryPrice,
                        position.shares,
                        position.exitDate || null,
                        position.exitPrice || null,
                        position.profitLoss || null,
                        position.status,
                    );
                }
            }

            // トレードを保存
            if (session.trades && Array.isArray(session.trades)) {
                const insertTrade = db.prepare(`
          INSERT INTO trades (
            id, session_id, position_id, type, trade_date, price, shares, memo
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

                for (const trade of session.trades) {
                    insertTrade.run(
                        trade.id,
                        session.id,
                        trade.positionId || null,
                        trade.type,
                        trade.tradeDate,
                        trade.price,
                        trade.shares,
                        trade.memo || null,
                    );
                }
            }
        });

        updateTransaction();

        console.log(`[PUT] セッション更新完了: ${sessionId}`);

        // セッション完了時にGitコミットを作成（既存の処理を維持）
        if (session.status === "completed") {
            // Git commit logic here (from original code)
            try {
                const { exec } = require("child_process");
                const { promisify } = require("util");
                const execAsync = promisify(exec);
                const workDir = process.cwd();

                try {
                    await execAsync(
                        `cd "${workDir}" && git rev-parse --git-dir`,
                    );
                } catch {
                    console.log(`[GIT] リポジトリ未初期化のためスキップ`);
                    return NextResponse.json({ success: true });
                }

                const profitPercent = (
                    ((session.currentCapital - session.initialCapital) /
                        session.initialCapital) *
                    100
                ).toFixed(2);
                const profitSign = profitPercent.startsWith("-") ? "" : "+";
                const message = `Session completed: ${session.stockName} (${session.symbol}) - ${profitSign}${profitPercent}%`;

                await execAsync(`cd "${workDir}" && git add data/sessions.db`);
                await execAsync(
                    `cd "${workDir}" && git commit -m "${message}"`,
                );

                console.log(
                    `[GIT] ✓ コミット作成: ${session.id}, 利益: ${profitSign}${profitPercent}%`,
                );
            } catch (error: any) {
                if (error.message?.includes("nothing to commit")) {
                    console.log(`[GIT] 変更なし、コミットスキップ`);
                } else {
                    console.error(
                        `[GIT] コミット失敗 (非ブロッキング):`,
                        error.message,
                    );
                }
            }
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Update session error:", error);
        return NextResponse.json(
            { success: false, error: "Failed to update session" },
            { status: 500 },
        );
    }
}
