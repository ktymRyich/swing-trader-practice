/**
 * チャート用カラー定義
 * テーマ変更時はここを編集すれば全体に反映される
 */

// ローソク足の色
export const CHART_COLORS = {
  // ローソク足
  candlestick: {
    up: '#ef4444',      // 上昇（赤）
    down: '#06b6d4',    // 下落（シアン）
  },
  
  // 出来高
  volume: {
    up: '#ef4444',      // 上昇時の出来高（赤）
    down: '#06b6d4',    // 下落時の出来高（シアン）
  },
  
  // 移動平均線（MA）
  ma: [
    '#ef4444',  // MA1（赤）
    '#22c55e',  // MA2（緑）
    '#3b82f6',  // MA3（青）
    '#a855f7',  // MA4（紫）
    '#f97316',  // MA5（オレンジ）
  ],
  
  // 取引マーカー
  trade: {
    buy: '#ef4444',     // 買いマーカー（赤）
    sell: '#06b6d4',    // 売りマーカー（シアン）
  },
  
  // チャート背景・グリッド
  background: {
    chart: 'transparent',
    text: '#e5e5e5',
    grid: '#262626',
    border: '#d1d4dc',
  },
} as const;

// カラーの説明（ヘルプ表示用）
export const COLOR_DESCRIPTIONS = {
  candlestick: {
    up: { color: CHART_COLORS.candlestick.up, label: '陽線（上昇）', description: '終値が始値より高い' },
    down: { color: CHART_COLORS.candlestick.down, label: '陰線（下落）', description: '終値が始値より低い' },
  },
  volume: {
    up: { color: CHART_COLORS.volume.up, label: '出来高（上昇）', description: '前日より株価が上昇した日の出来高' },
    down: { color: CHART_COLORS.volume.down, label: '出来高（下落）', description: '前日より株価が下落した日の出来高' },
  },
  ma: [
    { color: CHART_COLORS.ma[0], label: '5日移動平均線', description: '過去5日間の平均株価' },
    { color: CHART_COLORS.ma[1], label: '10日移動平均線', description: '過去10日間の平均株価' },
    { color: CHART_COLORS.ma[2], label: '20日移動平均線', description: '過去20日間の平均株価' },
    { color: CHART_COLORS.ma[3], label: '50日移動平均線', description: '過去50日間の平均株価' },
    { color: CHART_COLORS.ma[4], label: '100日移動平均線', description: '過去100日間の平均株価' },
  ],
  trade: {
    buy: { color: CHART_COLORS.trade.buy, label: '買いマーカー（▲）', description: 'その日に買い注文を実行' },
    sell: { color: CHART_COLORS.trade.sell, label: '売りマーカー（▼）', description: 'その日に売り注文を実行' },
  },
} as const;
