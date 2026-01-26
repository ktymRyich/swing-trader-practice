'use client';

import { useState } from 'react';
import { TrendingUp, TrendingDown, AlertCircle } from 'lucide-react';
import {
  calculateBuyOrder,
  calculateSellOrder,
  calculateMaxShares,
} from '@/lib/trading/calculator';
import { checkBeforeOpenPosition } from '@/lib/trading/rules';

interface OrderFormProps {
  currentPrice: number;
  availableCapital: number;
  openPositionCount: number;
  totalPositionValue: number;
  onSubmit: (order: {
    type: 'buy' | 'sell';
    tradingType: 'spot' | 'margin';
    shares: number;
    price: number;
    memo: string;
  }) => void;
}

export default function OrderForm({
  currentPrice,
  availableCapital,
  openPositionCount,
  totalPositionValue,
  onSubmit,
}: OrderFormProps) {
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [tradingType, setTradingType] = useState<'spot' | 'margin'>('spot');
  const [shares, setShares] = useState<number>(100);
  const [memo, setMemo] = useState('');
  const [showWarnings, setShowWarnings] = useState(false);

  // 購入可能な最大株数を計算
  const maxShares = calculateMaxShares(
    availableCapital,
    currentPrice,
    tradingType,
    tradingType === 'margin' ? 3.0 : 1.0
  );

  // 注文計算
  const calculation = orderType === 'buy'
    ? calculateBuyOrder(currentPrice, shares, tradingType)
    : calculateSellOrder(currentPrice, shares, tradingType);

  // ルール違反チェック
  const violations = orderType === 'buy'
    ? checkBeforeOpenPosition({
        openPositionCount,
        newPositionValue: shares * currentPrice,
        currentCapital: availableCapital,
        totalPositionValue,
        tradingType,
      })
    : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (shares <= 0 || shares % 100 !== 0) {
      alert('株数は100株単位で入力してください');
      return;
    }

    // 現物売りを禁止
    if (orderType === 'sell' && tradingType === 'spot') {
      alert('現物売りはできません。保有ポジションの決済ボタンから売却してください。');
      return;
    }

    if (orderType === 'buy' && calculation.totalCost > availableCapital) {
      alert('資金が不足しています');
      return;
    }

    if (!memo.trim()) {
      alert('取引理由を入力してください');
      return;
    }

    onSubmit({
      type: orderType,
      tradingType,
      shares,
      price: currentPrice,
      memo: memo.trim(),
    });

    // フォームリセット
    setShares(100);
    setMemo('');
    setShowWarnings(false);
  };

  return (
    <div className="bg-white rounded-lg border p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 注文種別 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            注文種別
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setOrderType('buy')}
              className={`p-4 rounded-lg border-2 transition flex items-center justify-center gap-2 ${
                orderType === 'buy'
                  ? 'border-green-600 bg-green-50 text-green-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              <span className="font-medium">買い</span>
            </button>
            <button
              type="button"
              onClick={() => setOrderType('sell')}
              className={`p-4 rounded-lg border-2 transition flex items-center justify-center gap-2 ${
                orderType === 'sell'
                  ? 'border-red-600 bg-red-50 text-red-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <TrendingDown className="w-5 h-5" />
              <span className="font-medium">売り</span>
            </button>
          </div>
        </div>

        {/* 取引区分 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            取引区分
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setTradingType('spot')}
              className={`p-3 rounded-lg border-2 transition ${
                tradingType === 'spot'
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">現物</div>
              <div className="text-xs text-gray-500">手持ち資金の範囲</div>
            </button>
            <button
              type="button"
              onClick={() => setTradingType('margin')}
              className={`p-3 rounded-lg border-2 transition ${
                tradingType === 'margin'
                  ? 'border-blue-600 bg-blue-50 text-blue-900'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="font-medium">信用</div>
              <div className="text-xs text-gray-500">最大3倍のレバレッジ</div>
            </button>
          </div>
        </div>

        {/* 株数入力 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            株数（100株単位）
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              value={shares}
              onChange={(e) => setShares(Number(e.target.value))}
              step="100"
              min="100"
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <button
              type="button"
              onClick={() => setShares(maxShares)}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium transition"
            >
              MAX
            </button>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            最大: {maxShares.toLocaleString()}株
          </p>
        </div>

        {/* 計算結果 */}
        <div className="bg-gray-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">現在価格</span>
            <span className="font-medium">¥{currentPrice.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">株数</span>
            <span className="font-medium">{shares.toLocaleString()}株</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">約定金額</span>
            <span className="font-medium">
              ¥{(currentPrice * shares).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">手数料</span>
            <span className="font-medium">¥{calculation.fee.toLocaleString()}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">スリッページ</span>
            <span className="font-medium">¥{calculation.slippage.toLocaleString()}</span>
          </div>
          <div className="border-t pt-2 flex justify-between font-bold">
            <span>合計</span>
            <span className={orderType === 'buy' ? 'text-red-600' : 'text-green-600'}>
              {orderType === 'buy' ? '-' : '+'}
              ¥{Math.abs(calculation.totalCost).toLocaleString()}
            </span>
          </div>
        </div>

        {/* ルール違反警告 */}
        {violations.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="font-medium text-yellow-900 mb-1">
                  ルール違反の可能性
                </div>
                <ul className="text-sm text-yellow-800 space-y-1">
                  {violations.map((v, i) => (
                    <li key={i}>• {v.description}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* メモ入力 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            取引理由 <span className="text-red-500">*</span>
          </label>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="なぜこの取引を行うのか理由を記録しましょう..."
            rows={3}
            className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
            required
          />
        </div>

        {/* 送信ボタン */}
        <button
          type="submit"
          className={`w-full py-3 rounded-lg font-bold text-white transition ${
            orderType === 'buy'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          }`}
        >
          {orderType === 'buy' ? '買い注文' : '売り注文'}を実行
        </button>
      </form>
    </div>
  );
}
