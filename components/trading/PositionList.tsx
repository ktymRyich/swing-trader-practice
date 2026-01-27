'use client';

import { Position } from '@/lib/db/schema';
import { calculatePositionPnL } from '@/lib/trading/calculator';
import { X } from 'lucide-react';

interface PositionListProps {
  positions: Position[];
  currentPrice: number;
  onClose: (positionId: string, memo: string) => void;
}

export default function PositionList({
  positions,
  currentPrice,
  onClose,
}: PositionListProps) {
  if (positions.length === 0) {
    return (
      <div className="bg-card rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">ポジションがありません</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className="bg-muted px-4 py-3 border-b">
        <h3 className="font-bold">保有ポジション</h3>
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
            <div key={position.id} className="p-4 hover:bg-accent transition">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* ポジション情報 */}
                  <div className="flex items-center gap-2 mb-2">
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        position.type === 'long'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-red-500/20 text-red-500'
                      }`}
                    >
                      {position.type === 'long' ? 'ロング' : 'ショート'}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        position.tradingType === 'spot'
                          ? 'bg-blue-500/20 text-blue-500'
                          : 'bg-purple-500/20 text-purple-500'
                      }`}
                    >
                      {position.tradingType === 'spot' ? '現物' : '信用'}
                    </span>
                  </div>

                  {/* 株数と価格 */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">株数</div>
                      <div className="font-medium">
                        {position.shares.toLocaleString()}株
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">建玉価格</div>
                      <div className="font-medium">
                        ¥{position.entryPrice.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">現在価格</div>
                      <div className="font-medium">
                        ¥{currentPrice.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">建玉日</div>
                      <div className="font-medium text-xs">
                        {new Date(position.entryDate).toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                  </div>

                  {/* 損益 */}
                  <div className="mt-3 p-3 bg-muted rounded">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">含み損益</span>
                      <div className="text-right">
                        <div
                          className={`text-lg font-bold ${
                            isProfitable ? 'text-green-500' : 'text-red-500'
                          }`}
                        >
                          {isProfitable ? '+' : ''}
                          ¥{pnL.toLocaleString()}
                        </div>
                        <div
                          className={`text-sm ${
                            isProfitable ? 'text-green-500' : 'text-red-500'
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
                  onClick={() => {
                    const memo = prompt('決済理由を入力してください:');
                    if (memo && memo.trim()) {
                      onClose(position.id!, memo.trim());
                    } else if (memo !== null) {
                      alert('決済理由を入力してください');
                    }
                  }}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg flex items-center gap-2 transition"
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
