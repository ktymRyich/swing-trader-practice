import Dexie, { Table } from "dexie";

// ===== 型定義 =====

export interface Stock {
    id?: number;
    symbol: string; // 証券コード
    name: string; // 銘柄名
    description?: string; // 企業概要
    sector?: string; // セクター
}

export interface StockPrice {
    id?: number;
    symbol: string;
    date: string; // YYYY-MM-DD
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjustedClose?: number;
}

export interface Session {
    id?: string;
    startDate: string; // セッション開始日時
    endDate?: string; // セッション終了日時
    symbol: string; // 銘柄コード
    stockName: string; // 銘柄名
    periodDays: number; // セッション期間（日数）
    initialCapital: number; // 初期資金
    currentCapital: number; // 現在の資金
    playbackSpeed: number; // 再生速度（秒/日）
    status: "playing" | "paused" | "completed"; // セッション状態
    currentDay: number; // 現在の日数（練習期間内での進捗）
    practiceStartIndex?: number; // 練習開始位置（過去データの日数）
    startDateOfData: string; // データの開始日（YYYY-MM-DD）
    endDateOfData: string; // データの終了日（YYYY-MM-DD）
    reflection?: string; // セッションの感想・反省

    // 統計情報
    tradeCount: number;
    winCount: number;
    winRate: number;
    maxDrawdown: number;
    ruleViolations: number;

    // 設定
    maSettings: number[]; // 移動平均線の期間設定
}

export interface Trade {
    id?: string;
    sessionId: string;
    timestamp: string; // 取引日時
    tradeDate: string; // 取引日（YYYY-MM-DD）
    type: "buy" | "sell"; // 売買区分
    tradingType: "spot" | "margin"; // 現物/信用
    isShort: boolean; // 空売りかどうか
    shares: number; // 株数
    price: number; // 取引価格
    fee: number; // 手数料
    slippage: number; // スリッページ
    totalCost: number; // 総コスト（手数料・スリッページ込み）
    memo: string; // 取引理由メモ
    capitalAfterTrade: number; // 取引後の資金
}

export interface Position {
    id?: string;
    sessionId: string;
    openTradeId: string; // 建玉の取引ID
    closeTradeId?: string; // 決済の取引ID
    type: "long" | "short"; // ロング/ショート
    tradingType: "spot" | "margin"; // 現物/信用
    shares: number; // 株数
    entryPrice: number; // 建玉価格
    entryDate: string; // 建玉日
    exitPrice?: number; // 決済価格
    exitDate?: string; // 決済日
    profit?: number; // 損益
    profitRate?: number; // 損益率
    status: "open" | "closed"; // ポジション状態
}

export interface RuleViolation {
    id?: string;
    sessionId: string;
    timestamp: string;
    type: "stop_loss" | "position_size" | "max_positions" | "leverage"; // 違反種類
    description: string; // 違反内容
    severity: "warning" | "critical"; // 深刻度
}

// ===== データベースクラス =====

export class TradingDB extends Dexie {
    stocks!: Table<Stock>;
    stockPrices!: Table<StockPrice>;
    sessions!: Table<Session>;
    trades!: Table<Trade>;
    positions!: Table<Position>;
    ruleViolations!: Table<RuleViolation>;

    constructor() {
        super("TradingDB");

        this.version(1).stores({
            stocks: "++id, symbol, name",
            stockPrices: "++id, symbol, date, [symbol+date]",
            sessions: "id, status, startDate, symbol",
            trades: "++id, sessionId, timestamp, tradeDate",
            positions: "++id, sessionId, status, openTradeId",
            ruleViolations: "++id, sessionId, timestamp, type",
        });
    }
}

// クライアントサイドでのみDBを初期化
export const db =
    typeof window !== "undefined" ? new TradingDB() : ({} as TradingDB);

// ===== ヘルパー関数 =====

export const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateTradeId = () => {
    return `trade_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generatePositionId = () => {
    return `position_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const generateViolationId = () => {
    return `violation_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};
