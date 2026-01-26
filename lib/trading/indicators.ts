import { StockPrice } from '../db/schema';

// ===== 移動平均線 =====

/**
 * 単純移動平均線（SMA）を計算
 */
export function calculateSMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  
  return result;
}

/**
 * 複数の移動平均線を計算
 */
export function calculateMultipleSMA(
  prices: number[],
  periods: number[]
): Record<number, (number | null)[]> {
  const result: Record<number, (number | null)[]> = {};
  
  for (const period of periods) {
    result[period] = calculateSMA(prices, period);
  }
  
  return result;
}

/**
 * 指数移動平均線（EMA）を計算
 */
export function calculateEMA(prices: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  const multiplier = 2 / (period + 1);
  
  // 最初の値はSMAを使用
  let ema = 0;
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const sum = prices.slice(0, period).reduce((a, b) => a + b, 0);
      ema = sum / period;
      result.push(ema);
    } else {
      ema = (prices[i] - ema) * multiplier + ema;
      result.push(ema);
    }
  }
  
  return result;
}

// ===== チャートデータ変換 =====

/**
 * StockPriceデータをLightweight Chartsの形式に変換
 */
export interface CandlestickData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface VolumeData {
  time: string;
  value: number;
  color?: string;
}

export interface LineData {
  time: string;
  value: number;
}

export function convertToChartData(stockPrices: StockPrice[]): {
  candlestickData: CandlestickData[];
  volumeData: VolumeData[];
} {
  const candlestickData: CandlestickData[] = [];
  const volumeData: VolumeData[] = [];
  const seenTimes = new Set<string>();
  
  for (const price of stockPrices) {
    // 重複したタイムスタンプをスキップ
    if (seenTimes.has(price.date)) {
      continue;
    }
    seenTimes.add(price.date);
    
    candlestickData.push({
      time: price.date,
      open: price.open,
      high: price.high,
      low: price.low,
      close: price.close
    });
    
    // 出来高の色（前日比で決定）
    let color = '#26a69a'; // デフォルトは緑
    if (candlestickData.length > 1) {
      const prevClose = stockPrices[candlestickData.length - 2]?.close;
      if (prevClose && price.close < prevClose) {
        color = '#ef5350'; // 下落は赤
      }
    }
    
    volumeData.push({
      time: price.date,
      value: price.volume,
      color
    });
  }
  
  return { candlestickData, volumeData };
}

/**
 * 移動平均線データをLightweight Chartsの形式に変換
 */
export function convertMAToLineData(
  dates: string[],
  maValues: (number | null)[]
): LineData[] {
  const lineData: LineData[] = [];
  
  for (let i = 0; i < dates.length; i++) {
    if (maValues[i] !== null) {
      lineData.push({
        time: dates[i],
        value: maValues[i]!
      });
    }
  }
  
  // 重複を除去（最後の値を保持）
  const uniqueData = new Map<string, number>();
  for (const item of lineData) {
    uniqueData.set(item.time, item.value);
  }
  
  return Array.from(uniqueData.entries()).map(([time, value]) => ({ time, value }));
}

// ===== その他の指標 =====

/**
 * ボリンジャーバンドを計算
 */
export interface BollingerBands {
  upper: (number | null)[];
  middle: (number | null)[];
  lower: (number | null)[];
}

export function calculateBollingerBands(
  prices: number[],
  period: number = 20,
  stdDev: number = 2
): BollingerBands {
  const sma = calculateSMA(prices, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1 || sma[i] === null) {
      upper.push(null);
      lower.push(null);
    } else {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = sma[i]!;
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const sd = Math.sqrt(variance);
      
      upper.push(mean + sd * stdDev);
      lower.push(mean - sd * stdDev);
    }
  }
  
  return {
    upper,
    middle: sma,
    lower
  };
}

/**
 * RSI（相対力指数）を計算
 */
export function calculateRSI(prices: number[], period: number = 14): (number | null)[] {
  const result: (number | null)[] = [null]; // 最初の値はnull
  
  const changes: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    changes.push(prices[i] - prices[i - 1]);
  }
  
  for (let i = 0; i < changes.length; i++) {
    if (i < period - 1) {
      result.push(null);
    } else {
      const slice = changes.slice(i - period + 1, i + 1);
      const gains = slice.filter(c => c > 0).reduce((sum, val) => sum + val, 0) / period;
      const losses = Math.abs(slice.filter(c => c < 0).reduce((sum, val) => sum + val, 0)) / period;
      
      if (losses === 0) {
        result.push(100);
      } else {
        const rs = gains / losses;
        const rsi = 100 - (100 / (1 + rs));
        result.push(rsi);
      }
    }
  }
  
  return result;
}
