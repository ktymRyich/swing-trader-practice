import { Position } from '../db/schema';
import { RULE_LIMITS, calculatePositionPnL, calculateCurrentLeverage, calculatePositionSize } from './calculator';

// ===== 型定義 =====

export interface RuleViolationCheck {
  violated: boolean;
  type: 'stop_loss' | 'position_size' | 'max_positions' | 'leverage';
  description: string;
  severity: 'warning' | 'critical';
}

export interface PositionWithPrice {
  type: 'long' | 'short';
  shares: number;
  entryPrice: number;
  currentPrice: number;
}

// ===== ルール違反チェック関数 =====

/**
 * 損切りルール違反をチェック
 * 含み損が-10%を超えても決済していない場合に違反
 */
export function checkStopLossViolation(
  position: PositionWithPrice
): RuleViolationCheck | null {
  const { pnLPercent } = calculatePositionPnL({
    type: position.type,
    shares: position.shares,
    entryPrice: position.entryPrice,
    currentPrice: position.currentPrice,
    unrealizedPnL: 0,
    unrealizedPnLPercent: 0
  });
  
  if (pnLPercent < RULE_LIMITS.stopLossPercent) {
    return {
      violated: true,
      type: 'stop_loss',
      description: `含み損が${pnLPercent.toFixed(2)}%に達しています（損切りライン: ${RULE_LIMITS.stopLossPercent}%）`,
      severity: 'critical'
    };
  }
  
  return null;
}

/**
 * ポジションサイズ違反をチェック
 * 1銘柄に資金の30%以上を投入している場合に違反
 */
export function checkPositionSizeViolation(
  positionValue: number,
  totalCapital: number
): RuleViolationCheck | null {
  const sizePercent = calculatePositionSize(positionValue, totalCapital);
  
  if (sizePercent > RULE_LIMITS.maxPositionSizePercent) {
    return {
      violated: true,
      type: 'position_size',
      description: `ポジションサイズが${sizePercent.toFixed(1)}%です（上限: ${RULE_LIMITS.maxPositionSizePercent}%）`,
      severity: 'warning'
    };
  }
  
  return null;
}

/**
 * 同時保有数違反をチェック
 * 3銘柄以上を同時保有している場合に違反
 */
export function checkMaxPositionsViolation(
  openPositionCount: number
): RuleViolationCheck | null {
  if (openPositionCount > RULE_LIMITS.maxPositions) {
    return {
      violated: true,
      type: 'max_positions',
      description: `${openPositionCount}銘柄を同時保有しています（上限: ${RULE_LIMITS.maxPositions}銘柄）`,
      severity: 'warning'
    };
  }
  
  return null;
}

/**
 * レバレッジ違反をチェック
 * レバレッジが2倍以上の場合に違反
 */
export function checkLeverageViolation(
  totalPositionValue: number,
  availableCapital: number
): RuleViolationCheck | null {
  const leverage = calculateCurrentLeverage(totalPositionValue, availableCapital);
  
  if (leverage > RULE_LIMITS.maxLeverage) {
    return {
      violated: true,
      type: 'leverage',
      description: `レバレッジが${leverage.toFixed(2)}倍です（推奨上限: ${RULE_LIMITS.maxLeverage}倍）`,
      severity: 'critical'
    };
  }
  
  return null;
}

/**
 * 全てのルール違反をチェック
 */
export function checkAllRules(params: {
  openPositions: PositionWithPrice[];
  currentCapital: number;
  totalPositionValue: number;
}): RuleViolationCheck[] {
  const violations: RuleViolationCheck[] = [];
  const { openPositions, currentCapital, totalPositionValue } = params;
  
  // 各ポジションの損切りルールをチェック
  for (const position of openPositions) {
    const violation = checkStopLossViolation(position);
    if (violation) {
      violations.push(violation);
    }
  }
  
  // 各ポジションのサイズをチェック
  for (const position of openPositions) {
    const positionValue = position.shares * position.currentPrice;
    const violation = checkPositionSizeViolation(positionValue, currentCapital);
    if (violation) {
      violations.push(violation);
    }
  }
  
  // 同時保有数をチェック
  const maxPositionsViolation = checkMaxPositionsViolation(openPositions.length);
  if (maxPositionsViolation) {
    violations.push(maxPositionsViolation);
  }
  
  // レバレッジをチェック
  const leverageViolation = checkLeverageViolation(totalPositionValue, currentCapital);
  if (leverageViolation) {
    violations.push(leverageViolation);
  }
  
  return violations;
}

/**
 * 新規ポジションを建てる前のチェック
 */
export function checkBeforeOpenPosition(params: {
  openPositionCount: number;
  newPositionValue: number;
  currentCapital: number;
  totalPositionValue: number;
  tradingType: 'spot' | 'margin';
}): RuleViolationCheck[] {
  const violations: RuleViolationCheck[] = [];
  const { 
    openPositionCount, 
    newPositionValue, 
    currentCapital, 
    totalPositionValue,
    tradingType
  } = params;
  
  // 新規ポジション後の同時保有数をチェック
  if (openPositionCount + 1 > RULE_LIMITS.maxPositions) {
    violations.push({
      violated: true,
      type: 'max_positions',
      description: `既に${openPositionCount}銘柄を保有しています。新規建玉は推奨されません（上限: ${RULE_LIMITS.maxPositions}銘柄）`,
      severity: 'warning'
    });
  }
  
  // 新規ポジションのサイズをチェック
  const sizeViolation = checkPositionSizeViolation(newPositionValue, currentCapital);
  if (sizeViolation) {
    violations.push(sizeViolation);
  }
  
  // 信用取引の場合、レバレッジをチェック
  if (tradingType === 'margin') {
    const newTotalValue = totalPositionValue + newPositionValue;
    const leverageViolation = checkLeverageViolation(newTotalValue, currentCapital);
    if (leverageViolation) {
      violations.push(leverageViolation);
    }
  }
  
  return violations;
}
