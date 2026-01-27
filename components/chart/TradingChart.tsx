'use client';

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData, HistogramData, SeriesMarker, Time } from 'lightweight-charts';
import { StockPrice, Trade } from '@/lib/db/schema';
import { convertToChartData, convertMAToLineData, calculateMultipleSMA } from '@/lib/trading/indicators';
import { CHART_COLORS } from '@/lib/constants/colors';

interface TradingChartProps {
  stockPrices: StockPrice[];
  maSettings: number[];
  trades?: Trade[];
  onTradeClick?: (tradeId: string) => void;
  width?: number;
  height?: number;
}

export default function TradingChart({
  stockPrices,
  maSettings,
  trades = [],
  onTradeClick,
  width,
  height = 500
}: TradingChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candlestickSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maSeriesRefs = useRef<ISeriesApi<'Line'>[]>([]);
  const lastDataLengthRef = useRef<number>(0);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // チャート初期化
    const chart = createChart(chartContainerRef.current, {
      width: width || chartContainerRef.current.clientWidth,
      height,
      layout: {
        background: { color: 'transparent' },
        textColor: '#e5e5e5',
      },
      grid: {
        vertLines: { color: '#262626' },
        horzLines: { color: '#262626' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#d1d4dc',
        scaleMargins: {
          top: 0.15,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: '#d1d4dc',
        timeVisible: true,
      },
    });

    chartRef.current = chart;

    // ローソク足シリーズ
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: CHART_COLORS.candlestick.up,
      downColor: CHART_COLORS.candlestick.down,
      borderVisible: false,
      wickUpColor: CHART_COLORS.candlestick.up,
      wickDownColor: CHART_COLORS.candlestick.down,
    });
    candlestickSeriesRef.current = candlestickSeries;

    // 出来高シリーズ
    const volumeSeries = chart.addHistogramSeries({
      color: CHART_COLORS.volume.up,
      priceFormat: {
        type: 'volume',
      },
      priceScaleId: 'volume',
    });
    volumeSeriesRef.current = volumeSeries;

    // 出来高用のスケール設定
    chart.priceScale('volume').applyOptions({
      scaleMargins: {
        top: 0.8,
        bottom: 0,
      },
    });

    // 移動平均線シリーズ
    maSeriesRefs.current = maSettings.map((period, index) => {
      return chart.addLineSeries({
        color: CHART_COLORS.ma[index % CHART_COLORS.ma.length],
        lineWidth: 2,
        lastValueVisible: false,
        priceLineVisible: false,
      });
    });

    // リサイズハンドラ
    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({
          width: width || chartContainerRef.current.clientWidth,
        });
      }
    };

    window.addEventListener('resize', handleResize);

    // クリックイベントを追加（マーカークリック用）
    const handleClick = (param: any) => {
      if (!param.time || !onTradeClick || !trades) return;
      
      // クリックした位置の日付を取得
      const clickedDate = param.time;
      
      // その日付の取引を探す（最初の取引をスクロール対象にする）
      const dayTrades = trades.filter(t => t.tradeDate === clickedDate);
      if (dayTrades.length > 0 && dayTrades[0]?.id) {
        onTradeClick(dayTrades[0].id);
      }
    };
    
    chart.subscribeClick(handleClick);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.unsubscribeClick(handleClick);
      chart.remove();
    };
  }, [width, height, maSettings]);

  // データ更新
  useEffect(() => {
    if (!stockPrices || stockPrices.length === 0) return;
    if (!candlestickSeriesRef.current || !volumeSeriesRef.current) return;

    // チャートデータに変換
    const { candlestickData, volumeData } = convertToChartData(stockPrices);

    // データ長が変わった場合（新しいデータが追加された場合）
    const isNewData = stockPrices.length !== lastDataLengthRef.current;
    lastDataLengthRef.current = stockPrices.length;

    if (isNewData && candlestickData.length > 0) {
      // 最新の1件だけを更新（パフォーマンス向上）
      const latestCandle = candlestickData[candlestickData.length - 1];
      candlestickSeriesRef.current.update(latestCandle as CandlestickData);

      // 出来高も更新
      const latestVolume = volumeData[volumeData.length - 1];
      const volumeHistogramData: HistogramData = {
        time: latestVolume.time,
        value: latestVolume.value,
        color: latestVolume.color,
      };
      volumeSeriesRef.current.update(volumeHistogramData);

      // 移動平均線も更新
      // 重複除去後のデータから終値と日付を抽出
      const closePrices = candlestickData.map(d => d.close);
      const dates = candlestickData.map(d => d.time as string);
      const maData = calculateMultipleSMA(closePrices, maSettings);

      maSettings.forEach((period, index) => {
        if (maSeriesRefs.current[index]) {
          const lineData = convertMAToLineData(dates, maData[period]);
          if (lineData.length > 0) {
            const latestMA = lineData[lineData.length - 1];
            maSeriesRefs.current[index].update(latestMA as LineData);
          }
        }
      });

      // 表示範囲を自動調整
      if (chartRef.current) {
        chartRef.current.timeScale().scrollToRealTime();
      }
    } else {
      // 初回またはリセット時は全データをセット
      candlestickSeriesRef.current.setData(candlestickData as CandlestickData[]);

      const volumeHistogramData: HistogramData[] = volumeData.map(v => ({
        time: v.time,
        value: v.value,
        color: v.color,
      }));
      volumeSeriesRef.current.setData(volumeHistogramData);

      // 重複除去後のデータから終値と日付を抽出
      const closePrices = candlestickData.map(d => d.close);
      const dates = candlestickData.map(d => d.time as string);
      const maData = calculateMultipleSMA(closePrices, maSettings);

      maSettings.forEach((period, index) => {
        if (maSeriesRefs.current[index]) {
          const lineData = convertMAToLineData(dates, maData[period]);
          maSeriesRefs.current[index].setData(lineData as LineData[]);
        }
      });

      if (chartRef.current) {
        // 最新30データのみを表示するように設定
        if (candlestickData.length > 0) {
          const visibleDataCount = Math.min(50, candlestickData.length);
          const from = candlestickData.length - visibleDataCount;
          chartRef.current.timeScale().setVisibleLogicalRange({
            from: from,
            to: candlestickData.length - 1,
          });
        } else {
          chartRef.current.timeScale().fitContent();
        }

        // 取引マーカーを追加
        if (trades && trades.length > 0 && candlestickSeriesRef.current) {
          // 同じ日付の取引をグループ化
          const tradesByDate = trades.reduce((acc, trade) => {
            const date = trade.tradeDate;
            if (!acc[date]) {
              acc[date] = [];
            }
            acc[date].push(trade);
            return acc;
          }, {} as Record<string, typeof trades>);

          const markers: SeriesMarker<Time>[] = [];
          
          Object.entries(tradesByDate).forEach(([date, dayTrades]) => {
            // 買いと売りを分ける
            const buyTrades = dayTrades.filter(t => t.type === 'buy');
            const sellTrades = dayTrades.filter(t => t.type === 'sell');

            // 買いマーカー
            if (buyTrades.length > 0) {
              const totalShares = buyTrades.reduce((sum, t) => sum + t.shares, 0);
              const shareText = totalShares >= 1000 
                ? `${(totalShares / 1000).toFixed(1)}k` 
                : totalShares.toString();
              markers.push({
                time: date as Time,
                position: 'belowBar',
                color: CHART_COLORS.trade.buy,
                shape: 'circle',
                text: `▲${shareText}`,
                size: 0.5,
              });
            }

            // 売りマーカー
            if (sellTrades.length > 0) {
              const totalShares = sellTrades.reduce((sum, t) => sum + t.shares, 0);
              const shareText = totalShares >= 1000 
                ? `${(totalShares / 1000).toFixed(1)}k` 
                : totalShares.toString();
              markers.push({
                time: date as Time,
                position: 'aboveBar',
                color: CHART_COLORS.trade.sell,
                shape: 'circle',
                text: `▼${shareText}`,
                size: 0.5,
              });
            }
          });
          
          candlestickSeriesRef.current.setMarkers(markers);
        }
      }
    }
  }, [stockPrices, maSettings, trades]);

  return (
    <div className="w-full">
      {/* チャート */}
      <div ref={chartContainerRef} className="rounded-lg overflow-hidden border" />
    </div>
  );
}
