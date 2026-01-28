#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { getDatabase } from '../lib/db/sqlite';
import { execSync } from 'child_process';

/**
 * Gitコミット履歴から削除されたセッションを復元するスクリプト
 */

const commits = [
  'd6473a2', // 住友電気工業
  '0502a1c', // マツダ
  '7deefa2', // 資生堂
  'b398fd8', // 日揮ホールディングス (8セッション)
  'd7012ea', // セイコーエプソン
  '10155e1', // HOYA
  '0fcea3f', // 日産自動車
  '56b1b91', // 松竹
  'e1126bc', // パナソニックホールディングス
  '7d7fb5f', // 神戸製鋼所
];

console.log('🔄 Gitコミット履歴からセッションを復元します...\n');

const db = getDatabase();
const allSessions = new Map<string, any>();

// 各コミットからセッションデータを収集
for (const commit of commits) {
  try {
    const jsonData = execSync(
      `git show ${commit}:"data/sessions/りゅち.json"`,
      { encoding: 'utf-8', cwd: process.cwd() }
    );
    
    const sessions = JSON.parse(jsonData);
    console.log(`📦 ${commit}: ${sessions.length}セッション`);
    
    for (const session of sessions) {
      if (!allSessions.has(session.id)) {
        allSessions.set(session.id, session);
        console.log(`   ✓ ${session.stockName} (${session.symbol}) - ${session.status}`);
      }
    }
  } catch (error) {
    console.error(`❌ ${commit}: 取得失敗`);
  }
}

console.log(`\n📊 合計: ${allSessions.size}個のユニークなセッションを発見`);

// 既存のセッションIDを確認
const existingIds = new Set(
  db.prepare('SELECT id FROM sessions WHERE nickname = ?')
    .all('りゅち')
    .map((row: any) => row.id)
);

console.log(`💾 既存のDB内セッション: ${existingIds.size}件\n`);

// 挿入用のprepared statement
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

let restored = 0;
let skipped = 0;

// トランザクションで復元
const restoreTransaction = db.transaction(() => {
  for (const [sessionId, session] of allSessions) {
    if (existingIds.has(sessionId)) {
      console.log(`⏭️  スキップ: ${session.stockName} (既存)`);
      skipped++;
      continue;
    }
    
    // セッションを挿入
    insertSession.run(
      session.id,
      'りゅち',
      session.symbol,
      session.stockName,
      session.initialCapital,
      session.currentCapital,
      session.startDateOfData || session.practiceStartDate || session.startDate,
      session.practiceStartIndex || 0,
      session.endDateOfData || session.practiceEndDate || session.startDate,
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
          position.profitLoss || position.profit || null,
          position.status
        );
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
      }
    }
    
    console.log(`✅ 復元: ${session.stockName} (${session.symbol})`);
    restored++;
  }
});

restoreTransaction();

console.log(`\n🎉 復元完了！`);
console.log(`   新規追加: ${restored}件`);
console.log(`   スキップ: ${skipped}件`);
console.log(`   合計: ${existingIds.size + restored}件`);
