'use client';

import { Trade } from '@/lib/db/schema';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface TradeHistoryProps {
  trades: Trade[];
  currentPrice: number;
  highlightedTradeId?: string | null;
}

export default function TradeHistory({ trades, currentPrice, highlightedTradeId }: TradeHistoryProps) {
  if (trades.length === 0) {
    return (
      <div className="bg-card rounded-lg border p-8 text-center">
        <p className="text-muted-foreground">取引履歴がありません</p>
      </div>
    );
  }

  // 日付でソート（新しい順）
  const sortedTrades = [...trades].sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  return (
    <div className="bg-card rounded-lg border overflow-hidden">
      <div className="bg-muted px-4 py-3 border-b">
        <h3 className="font-bold">取引履歴</h3>
      </div>

      <div className="divide-y max-h-[500px] overflow-y-auto">
        {sortedTrades.map((trade) => {
          const isBuy = trade.type === 'buy';
          const isShort = trade.isShort;
          const isHighlighted = highlightedTradeId === trade.id;

          return (
            <div 
              key={trade.id} 
              id={`trade-${trade.id}`}
              className={`p-4 transition ${
                isHighlighted 
                  ? 'bg-primary/20 border-l-4 border-primary' 
                  : 'hover:bg-accent'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  {/* 取引種別 */}
                  <div className="flex items-center gap-2 mb-2">
                    {isBuy ? (
                      <TrendingUp className="w-4 h-4 text-cyan-500" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-500" />
                    )}
                    <span
                      className={`px-2 py-1 rounded text-xs font-bold ${
                        isBuy
                          ? 'bg-cyan-500/20 text-cyan-500'
                          : isShort
                          ? 'bg-red-500/20 text-red-500'
                          : 'bg-green-500/20 text-green-500'
                      }`}
                    >
                      {isBuy ? '買い' : isShort ? '空売り' : '売却'}
                    </span>
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        trade.tradingType === 'spot'
                          ? 'bg-blue-500/20 text-blue-500'
                          : 'bg-purple-500/20 text-purple-500'
                      }`}
                    >
                      {trade.tradingType === 'spot' ? '現物' : '信用'}
                    </span>
                  </div>

                  {/* 取引詳細 */}
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground">日付</div>
                      <div className="font-medium text-xs">
                        {new Date(trade.tradeDate).toLocaleDateString('ja-JP')}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">株数</div>
                      <div className="font-medium">
                        {trade.shares.toLocaleString()}株
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">価格</div>
                      <div className="font-medium">
                        ¥{trade.price.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground">約定代金</div>
                      <div className="font-medium">
                        ¥{(trade.price * trade.shares).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  {/* メモ */}
                  {trade.memo && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {trade.memo}
                    </div>
                  )}
                </div>

                {/* 取引後の資金 */}
                <div className="text-right">
                  <div className="text-xs text-muted-foreground mb-1">取引後資金</div>
                  <div className="font-bold">
                    ¥{trade.capitalAfterTrade.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
