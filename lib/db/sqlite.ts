import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DB_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DB_DIR, 'sessions.db');

// データディレクトリが存在しない場合は作成
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR, { recursive: true });
}

// データベース接続（シングルトン）
let db: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL'); // Write-Ahead Logging（パフォーマンス向上）
    db.pragma('foreign_keys = ON'); // 外部キー制約を有効化
    initializeDatabase(db);
  }
  return db;
}

// データベーススキーマの初期化
function initializeDatabase(db: Database.Database) {
  // セッションテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      nickname TEXT NOT NULL,
      symbol TEXT NOT NULL,
      stock_name TEXT NOT NULL,
      initial_capital REAL NOT NULL,
      current_capital REAL NOT NULL,
      practice_start_date TEXT NOT NULL,
      practice_start_index INTEGER NOT NULL,
      practice_end_date TEXT NOT NULL,
      status TEXT NOT NULL,
      current_day INTEGER DEFAULT 0,
      period_days INTEGER DEFAULT 60,
      trade_count INTEGER DEFAULT 0,
      win_count INTEGER DEFAULT 0,
      win_rate REAL DEFAULT 0,
      max_drawdown REAL DEFAULT 0,
      rule_violations INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `);

  // ポジションテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      type TEXT NOT NULL,
      entry_date TEXT NOT NULL,
      entry_price REAL NOT NULL,
      shares INTEGER NOT NULL,
      exit_date TEXT,
      exit_price REAL,
      profit_loss REAL,
      status TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    )
  `);

  // トレードテーブル
  db.exec(`
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      position_id TEXT,
      type TEXT NOT NULL,
      trade_date TEXT NOT NULL,
      price REAL NOT NULL,
      shares INTEGER NOT NULL,
      memo TEXT,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (position_id) REFERENCES positions(id) ON DELETE SET NULL
    )
  `);

  // インデックスの作成
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_sessions_nickname ON sessions(nickname);
    CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);
    CREATE INDEX IF NOT EXISTS idx_positions_session_id ON positions(session_id);
    CREATE INDEX IF NOT EXISTS idx_trades_session_id ON trades(session_id);
    CREATE INDEX IF NOT EXISTS idx_trades_position_id ON trades(position_id);
  `);

  console.log('✓ Database initialized');
}

// データベース接続を閉じる（通常は不要だが、テストやシャットダウン時に使用）
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}
