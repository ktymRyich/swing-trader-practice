'use client';

import { useEffect, useRef } from 'react';
import { createChart, IChartApi, ISeriesApi, CandlestickData, LineData, HistogramData } from 'lightweight-charts';
import { StockPrice } from '@/lib/db/schema';
import { convertToChartData, convertMAToLineData, calculateMultipleSMA } from '@/lib/trading/indicators';

interface TradingChartProps {
  stockPrices: StockPrice[];
  maSettings: number[];
  width?: number;
  height?: number;
}

const MA_COLORS = [
  '#FF1744', // 赤
  '#00C853', // 緑
  '#2962FF', // 青
  '#D500F9', // 紫
  '#FF6D00', // オレンジ
];

export default function TradingChart({
  stockPrices,
  maSettings,
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
        background: { color: '#ffffff' },
        textColor: '#333',
      },
      grid: {
        vertLines: { color: '#f0f0f0' },
        horzLines: { color: '#f0f0f0' },
      },
      crosshair: {
        mode: 1,
      },
      rightPriceScale: {
        borderColor: '#d1d4dc',
      },
      timeScale: {
        borderColor: '#d1d4dc',
        timeVisible: true,
      },
    });

    chartRef.current = chart;

    // ローソク足シリーズ
    const candlestickSeries = chart.addCandlestickSeries({
      upColor: '#26a69a',
      downColor: '#ef5350',
      borderVisible: false,
      wickUpColor: '#26a69a',
      wickDownColor: '#ef5350',
    });
    candlestickSeriesRef.current = candlestickSeries;

    // 出来高シリーズ
    const volumeSeries = chart.addHistogramSeries({
      color: '#26a69a',
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
        color: MA_COLORS[index % MA_COLORS.length],
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

    return () => {
      window.removeEventListener('resize', handleResize);
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
        chartRef.current.timeScale().fitContent();
      }
    }
  }, [stockPrices, maSettings]);

  return (
    <div className="w-full">
      {/* チャート */}
      <div ref={chartContainerRef} className="rounded-lg overflow-hidden border" />
    </div>
  );
}
