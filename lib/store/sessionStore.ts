import { create } from 'zustand';
import { Session, Position, Trade, StockPrice, RuleViolation } from '../db/schema';

// ===== 型定義 =====

export interface SessionState {
  // セッション情報
  currentSession: Session | null;
  stockPrices: StockPrice[];
  visiblePrices: StockPrice[]; // 現在表示されている（未来が見えない）価格データ
  
  // ポジションと取引
  openPositions: Position[];
  closedPositions: Position[];
  trades: Trade[];
  ruleViolations: RuleViolation[];
  
  // UI状態
  isPlaying: boolean;
  currentPriceIndex: number; // 現在表示している価格データのインデックス
  
  // アクション
  setSession: (session: Session) => void;
  setStockPrices: (prices: StockPrice[]) => void;
  setOpenPositions: (positions: Position[]) => void;
  setClosedPositions: (positions: Position[]) => void;
  setTrades: (trades: Trade[]) => void;
  setRuleViolations: (violations: RuleViolation[]) => void;
  
  // 再生制御
  play: () => void;
  pause: () => void;
  togglePlayPause: () => void;
  advanceDay: () => void;
  setCurrentPriceIndex: (index: number) => void;
  
  // セッション更新
  updateSession: (updates: Partial<Session>) => void;
  
  // リセット
  reset: () => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  // 初期状態
  currentSession: null,
  stockPrices: [],
  visiblePrices: [],
  openPositions: [],
  closedPositions: [],
  trades: [],
  ruleViolations: [],
  isPlaying: false,
  currentPriceIndex: 0,
  
  // セッター
  setSession: (session) => set({ currentSession: session }),
  
  setStockPrices: (prices) => {
    // visiblePricesの更新はsetCurrentPriceIndexで行うため、ここでは単にpricesをセットするだけ
    set({ stockPrices: prices });
  },
  
  setOpenPositions: (positions) => set({ openPositions: positions }),
  setClosedPositions: (positions) => set({ closedPositions: positions }),
  setTrades: (trades) => set({ trades: trades }),
  setRuleViolations: (violations) => set({ ruleViolations: violations }),
  
  // 再生制御
  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  togglePlayPause: () => set((state) => ({ isPlaying: !state.isPlaying })),
  
  advanceDay: () => {
    const state = get();
    const nextIndex = state.currentPriceIndex + 1;
    const practiceStartIndex = state.currentSession?.practiceStartIndex || 0;
    
    if (nextIndex < state.stockPrices.length) {
      const visiblePrices = state.stockPrices.slice(0, nextIndex + 1);
      set({ 
        currentPriceIndex: nextIndex,
        visiblePrices,
      });
      
      // セッションの現在日を更新（練習期間内での日数）
      if (state.currentSession) {
        const currentDay = Math.max(0, nextIndex - practiceStartIndex);
        const updatedSession = {
          ...state.currentSession,
          currentDay
        };
        set({ currentSession: updatedSession });
      }
    } else {
      // セッション終了
      set({ isPlaying: false });
    }
  },
  
  setCurrentPriceIndex: (index) => {
    const state = get();
    const visiblePrices = state.stockPrices.slice(0, index + 1);
    set({ currentPriceIndex: index, visiblePrices });
  },
  
  // セッション更新
  updateSession: (updates) => {
    const currentSession = get().currentSession;
    if (currentSession) {
      set({ currentSession: { ...currentSession, ...updates } });
    }
  },
  
  // リセット
  reset: () => set({
    currentSession: null,
    stockPrices: [],
    visiblePrices: [],
    openPositions: [],
    closedPositions: [],
    trades: [],
    ruleViolations: [],
    isPlaying: false,
    currentPriceIndex: 0,
  }),
}));
