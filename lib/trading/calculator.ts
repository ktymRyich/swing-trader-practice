// 取引に関する計算ロジック

// ===== 定数 =====

// 手数料率（楽天証券の手数料を参考）
export const FEES = {
  spot: {
    // 現物取引手数料（約定代金に応じて）
    calculate: (amount: number): number => {
      if (amount <= 50000) return 55;
      if (amount <= 100000) return 99;
      if (amount <= 200000) return 115;
      if (amount <= 500000) return 275;
      if (amount <= 1000000) return 535;
      if (amount <= 1500000) return 640;
      if (amount <= 30000000) return 1013;
      return amount * 0.0011; // 3000万円超
    }
  },
  margin: {
    // 信用取引手数料
    calculate: (amount: number): number => {
      if (amount <= 100000) return 99;
      if (amount <= 200000) return 148;
      if (amount <= 500000) return 198;
      return 385; // 50万円超は一律
    }
  }
};

// スリッページ率（0.1% = 成行注文の想定）
export const SLIPPAGE_RATE = 0.001;

// 信用取引のレバレッジ上限
export const MAX_LEVERAGE = 3.0;

// ルール違反の閾値
export const RULE_LIMITS = {
  stopLossPercent: -10,      // 損切りライン -10%
  maxPositionSizePercent: 30, // 1銘柄への最大投資比率 30%
  maxPositions: 3,           // 最大同時保有ポジション数
  maxLeverage: 2.0          // 推奨最大レバレッジ
};

// ===== 型定義 =====

export interface TradeCalculation {
  shares: number;
  price: number;
  fee: number;
  slippage: number;
  totalCost: number;
}

export interface PositionInfo {
  type: 'long' | 'short';
  shares: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
}

// ===== 計算関数 =====

/**
 * 買い注文の計算
 */
export function calculateBuyOrder(
  price: number,
  shares: number,
  tradingType: 'spot' | 'margin'
): TradeCalculation {
  const baseAmount = price * shares;
  const slippage = baseAmount * SLIPPAGE_RATE; // 買いは価格が上がる
  const fee = tradingType === 'spot' 
    ? FEES.spot.calculate(baseAmount)
    : FEES.margin.calculate(baseAmount);
  
  const totalCost = baseAmount + slippage + fee;
  
  return {
    shares,
    price,
    fee,
    slippage,
    totalCost
  };
}

/**
 * 売り注文の計算
 */
export function calculateSellOrder(
  price: number,
  shares: number,
  tradingType: 'spot' | 'margin'
): TradeCalculation {
  const baseAmount = price * shares;
  const slippage = baseAmount * SLIPPAGE_RATE; // 売りは価格が下がる
  const fee = tradingType === 'spot'
    ? FEES.spot.calculate(baseAmount)
    : FEES.margin.calculate(baseAmount);
  
  // 売りの場合は受け取り金額から手数料とスリッページを引く
  const totalCost = baseAmount - slippage - fee;
  
  return {
    shares,
    price,
    fee,
    slippage,
    totalCost
  };
}

/**
 * 購入可能な最大株数を計算
 */
export function calculateMaxShares(
  availableCapital: number,
  price: number,
  tradingType: 'spot' | 'margin',
  leverage: number = 1.0
): number {
  // レバレッジを考慮した利用可能資金
  const effectiveCapital = availableCapital * leverage;
  
  // 概算の手数料とスリッページを考慮
  const estimatedFeeRate = tradingType === 'spot' ? 0.005 : 0.004;
  const totalCostRate = 1 + SLIPPAGE_RATE + estimatedFeeRate;
  
  const maxShares = Math.floor(effectiveCapital / (price * totalCostRate));
  
  // 最低単元数（100株）に丸める
  return Math.floor(maxShares / 100) * 100;
}

/**
 * ポジションの含み損益を計算
 */
export function calculatePositionPnL(
  position: PositionInfo
): { pnL: number; pnLPercent: number } {
  const { type, shares, entryPrice, currentPrice } = position;
  
  let pnL: number;
  if (type === 'long') {
    pnL = (currentPrice - entryPrice) * shares;
  } else {
    // ショートの場合は逆
    pnL = (entryPrice - currentPrice) * shares;
  }
  
  const pnLPercent = (pnL / (entryPrice * shares)) * 100;
  
  return { pnL, pnLPercent };
}

/**
 * 最大ドローダウンを計算
 */
export function calculateMaxDrawdown(capitalHistory: number[]): number {
  if (capitalHistory.length === 0) return 0;
  
  let maxCapital = capitalHistory[0];
  let maxDrawdown = 0;
  
  for (const capital of capitalHistory) {
    if (capital > maxCapital) {
      maxCapital = capital;
    }
    
    const drawdown = ((capital - maxCapital) / maxCapital) * 100;
    if (drawdown < maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  
  return Math.abs(maxDrawdown);
}

/**
 * 勝率を計算
 */
export function calculateWinRate(
  winCount: number,
  totalCount: number
): number {
  if (totalCount === 0) return 0;
  return (winCount / totalCount) * 100;
}

/**
 * 現在のレバレッジを計算
 */
export function calculateCurrentLeverage(
  totalPositionValue: number,
  availableCapital: number
): number {
  if (availableCapital === 0) return 0;
  return totalPositionValue / availableCapital;
}

/**
 * ポジションサイズ（資金に対する比率）を計算
 */
export function calculatePositionSize(
  positionValue: number,
  totalCapital: number
): number {
  if (totalCapital === 0) return 0;
  return (positionValue / totalCapital) * 100;
}
