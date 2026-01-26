'use client';

import { Position } from '@/lib/db/schema';
import { calculatePositionPnL } from '@/lib/trading/calculator';
import { X } from 'lucide-react';

interface PositionListProps {
  positions: Position[];
  currentPrice: number;
  onClose: (positionId: string) => void;
}

export default function PositionList({
  positions,
  currentPrice,
  onClose,
}: PositionListProps) {
  if (positions.length === 0) {
    return (
      <div className="bg-white rounded-lg border p-8 text-center">
        <p className="text-gray-500">ポジションがありません</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="bg-gray-50 px-4 py-3 border-b">
        <h3 className="font-bold text-gray-900">保有ポジション</h3>
      </div>

      <div className="divide-y">
        {positions.map((position) => {
          const { pnL, pnLPercent } = calculatePositionPnL({
            type: position.type,
            shares: position.shares,
            entryPrice: position.entryPrice,
            currentPrice,
            unrealizedPnL: 0,
            unrealizedPnLPercent: 0,
          });

          const isProfitable = pnL >= 0;

          return (
            <div key={position.id} className="p-4 hover:bg-gray-50 transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* ポジション情報 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        position.type === 'long'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {position.type === 'long' ? 'ロング' : 'ショート'}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        position.tradingType === 'spot'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                    >
                      {position.tradingType === 'spot' ? '現物' : '信用'}
                    </span>
                  </div>

                  {/* 株数と価格 */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-500">株数</div>
                      <div className="font-medium">
                        {position.shares.toLocaleString()}株
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">建玉価格</div>
                      <div className="font-medium">
                        ¥{position.entryPrice.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">現在価格</div>
                      <div className="font-medium">
                        ¥{currentPrice.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">建玉日</div>
                      <div className="font-medium text-xs">
                        {new Date(position.entryDate).toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                  </div>

                  {/* 損益 */}
                  <div className="mt-3 p-3 bg-gray-50 rounded">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">含み損益</span>
                      <div className="text-right">
                        <div
                          className={`text-lg font-bold ${
                            isProfitable ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {isProfitable ? '+' : ''}
                          ¥{pnL.toLocaleString()}
                        </div>
                        <div
                          className={`text-sm ${
                            isProfitable ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {isProfitable ? '+' : ''}
                          {pnLPercent.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 決済ボタン */}
                <button
                  onClick={() => onClose(position.id!)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg flex items-center gap-2 transition"
                >
                  <X className="w-4 h-4" />
                  決済
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
