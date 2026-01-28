#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { getDatabase } from '../lib/db/sqlite';

/**
 * 既存のJSONファイルからSQLiteデータベースへデータを移行するスクリプト
 */

const SESSIONS_DIR = path.join(process.cwd(), 'data', 'sessions');

console.log('🔄 JSONからSQLiteへのデータ移行を開始します...\n');

const db = getDatabase();

// トランザクション開始
const insertSession = db.prepare(`
  INSERT OR REPLACE INTO sessions (
    id, nickname, symbol, stock_name, initial_capital, current_capital,
    practice_start_date, practice_start_index, practice_end_date, status,
    current_day, period_days, trade_count, win_count, win_rate, max_drawdown, rule_violations,
    created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertPosition = db.prepare(`
  INSERT OR REPLACE INTO positions (
    id, session_id, type, entry_date, entry_price, shares,
    exit_date, exit_price, profit_loss, status
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertTrade = db.prepare(`
  INSERT OR REPLACE INTO trades (
    id, session_id, position_id, type, trade_date, price, shares, memo
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

let totalSessions = 0;
let totalPositions = 0;
let totalTrades = 0;

if (!fs.existsSync(SESSIONS_DIR)) {
  console.log('⚠️  セッションディレクトリが見つかりません');
  process.exit(0);
}

// すべてのJSONファイルを読み込み
const files = fs.readdirSync(SESSIONS_DIR).filter(f => f.endsWith('.json') && !f.endsWith('.backup.json'));

console.log(`📁 ${files.length}個のJSONファイルを検出\n`);

const migrate = db.transaction(() => {
  for (const file of files) {
    const nickname = path.basename(file, '.json');
    const filePath = path.join(SESSIONS_DIR, file);
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const sessions = JSON.parse(content);
      
      console.log(`📝 ${nickname}: ${sessions.length}セッション`);
      
      for (const session of sessions) {
        // pricesフィールドをスキップ（株価データは別途APIから取得）
        if (session.prices) {
          console.log(`  ⚠️  ${session.id}: 株価データ(${session.prices.length}件)をスキップ`);
        }
        
        // セッションを挿入
        insertSession.run(
          session.id,
          nickname,
          session.symbol,
          session.stockName,
          session.initialCapital,
          session.currentCapital,
          session.startDateOfData || session.practiceStartDate || session.startDate, // 互換性対応
          session.practiceStartIndex || 0,
          session.endDateOfData || session.practiceEndDate || session.startDate, // 互換性対応
          session.status,
          session.currentDay || 0,
          session.periodDays || 60,
          session.tradeCount || 0,
          session.winCount || 0,
          session.winRate || 0,
          session.maxDrawdown || 0,
          session.ruleViolations || 0,
          session.createdAt || session.startDate || new Date().toISOString(),
          session.updatedAt || session.startDate || new Date().toISOString()
        );
        totalSessions++;
        
        // ポジションを挿入
        if (session.positions && Array.isArray(session.positions)) {
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
            totalPositions++;
          }
        }
        
        // トレードを挿入
        if (session.trades && Array.isArray(session.trades)) {
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
            totalTrades++;
          }
        }
      }
    } catch (error) {
      console.error(`❌ ${file}の移行に失敗:`, error);
    }
  }
});

// 移行実行
try {
  migrate();
  console.log('\n✅ 移行完了！');
  console.log(`   セッション: ${totalSessions}件`);
  console.log(`   ポジション: ${totalPositions}件`);
  console.log(`   トレード: ${totalTrades}件`);
  console.log(`\n💾 データベース: data/sessions.db`);
} catch (error) {
  console.error('\n❌ 移行に失敗しました:', error);
  process.exit(1);
}
