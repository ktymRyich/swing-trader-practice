import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/db/sqlite';

/**
 * セッション保存・取得API（SQLite版）
 */

// セッション取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nickname = searchParams.get('nickname');

    if (!nickname) {
      return NextResponse.json(
        { success: false, error: 'ユーザー情報がありません' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // セッション一覧を取得
    const sessions = db.prepare(`
      SELECT * FROM sessions 
      WHERE nickname = ? 
      ORDER BY created_at DESC
    `).all(nickname);

    // 各セッションのポジションとトレードを取得
    const sessionsWithData = sessions.map((session: any) => {
      const positions = db.prepare(`
        SELECT * FROM positions 
        WHERE session_id = ? 
        ORDER BY entry_date
      `).all(session.id);

      const trades = db.prepare(`
        SELECT * FROM trades 
        WHERE session_id = ? 
        ORDER BY trade_date
      `).all(session.id);

      // カラム名をキャメルケースに変換
      return {
        id: session.id,
        nickname: session.nickname,
        symbol: session.symbol,
        stockName: session.stock_name,
        initialCapital: session.initial_capital,
        currentCapital: session.current_capital,
        startDateOfData: session.practice_start_date, // 株価データの開始日
        practiceStartIndex: session.practice_start_index,
        practiceStartDate: session.practice_replay_date, // 練習開始日（リプレイ開始日）
        endDateOfData: session.practice_end_date, // 株価データの終了日
        status: session.status,
        currentDay: session.current_day || 0,
        periodDays: session.period_days || 60,
        tradeCount: session.trade_count || 0,
        winCount: session.win_count || 0,
        winRate: session.win_rate || 0,
        maxDrawdown: session.max_drawdown || 0,
        ruleViolations: session.rule_violations || 0,
        maSettings: session.ma_settings ? JSON.parse(session.ma_settings) : [5, 10, 20, 50, 100], // 移動平均線設定
        createdAt: session.created_at,
        updatedAt: session.updated_at,
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
    });

    console.log(`[GET] セッション取得: ${nickname}, 件数: ${sessionsWithData.length}`);

    return NextResponse.json({
      success: true,
      sessions: sessionsWithData,
    });
  } catch (error) {
    console.error('セッション取得エラー:', error);
    return NextResponse.json(
      { success: false, error: 'セッションの取得に失敗しました' },
      { status: 500 }
    );
  }
}

// セッション保存
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // sessionsが直接渡された場合（削除処理用）
    if (body.sessions !== undefined && body.nickname) {
      const db = getDatabase();
      const nickname = body.nickname;
      const newSessions = body.sessions;
      
      console.log(`[DELETE] 削除処理: ${nickname}`);
      
      // 既存のセッション一覧を取得
      const currentSessions = db.prepare(`
        SELECT id FROM sessions WHERE nickname = ?
      `).all(nickname);
      
      const currentIds = new Set(currentSessions.map((s: any) => s.id));
      const newIds = new Set(newSessions.map((s: any) => s.id));
      
      // 削除されたセッションIDを特定
      const deletedIds = [...currentIds].filter(id => !newIds.has(id));
      
      console.log(`[DELETE] 削除前: ${currentIds.size}件, 削除後: ${newIds.size}件, 削除対象: ${deletedIds.length}件`);
      
      if (deletedIds.length > 1) {
        console.warn(`[DELETE] 警告: ${deletedIds.length}件のセッションが削除されます！`);
      }
      
      // トランザクションで削除実行
      const deleteTransaction = db.transaction(() => {
        for (const id of deletedIds) {
          db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
          // CASCADE設定により、関連するpositionsとtradesも自動削除される
        }
      });
      
      deleteTransaction();
      
      console.log(`[DELETE] 削除完了: ${deletedIds.length}件`);
      return NextResponse.json({ success: true });
    }
    
    // 単一セッションの保存
    const session = body;
    const { nickname } = session;

    if (!nickname) {
      return NextResponse.json(
        { success: false, error: 'ユーザー情報がありません' },
        { status: 400 }
      );
    }

    const db = getDatabase();
    
    // トランザクションで保存
    const saveTransaction = db.transaction(() => {
      const now = new Date().toISOString();
      
      // セッションを保存（既存なら更新）
      db.prepare(`
        INSERT OR REPLACE INTO sessions (
          id, nickname, symbol, stock_name, initial_capital, current_capital,
          practice_start_date, practice_start_index, practice_end_date, practice_replay_date, status,
          current_day, period_days, trade_count, win_count, win_rate, max_drawdown, rule_violations,
          ma_settings, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE((SELECT created_at FROM sessions WHERE id = ?), ?), ?)
      `).run(
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
        session.id, // created_atの既存値チェック用
        now, // 新規作成時のcreated_at
        now  // updated_at
      );
      
      // 既存のポジションとトレードを削除（更新のため）
      db.prepare('DELETE FROM positions WHERE session_id = ?').run(session.id);
      db.prepare('DELETE FROM trades WHERE session_id = ?').run(session.id);
      
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
            position.status
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
            trade.memo || null
          );
        }
      }
    });
    
    saveTransaction();
    
    console.log(`[POST] セッション保存完了: ${session.id} (${nickname})`);

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('セッション保存エラー:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'セッションの保存に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
