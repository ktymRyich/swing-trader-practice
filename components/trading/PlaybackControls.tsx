'use client';

import { Play, Pause, SkipForward, Settings } from 'lucide-react';
import { useState } from 'react';

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentDay: number;
  totalDays: number;
  playbackSpeed: number;
  onTogglePlay: () => void;
  onNext: () => void;
  onSpeedChange: (speed: number) => void;
}

export default function PlaybackControls({
  isPlaying,
  currentDay,
  totalDays,
  playbackSpeed,
  onTogglePlay,
  onNext,
  onSpeedChange,
}: PlaybackControlsProps) {
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const progress = (currentDay / totalDays) * 100;
  const speedOptions = [5, 10, 15, 20, 25, 30];

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="space-y-4">
        {/* プログレスバー */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-600">
              {currentDay} / {totalDays}日
            </span>
            <span className="text-gray-600">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 制御ボタン */}
        <div className="flex items-center justify-center gap-3">
          {/* 再生/一時停止 */}
          <button
            onClick={onTogglePlay}
            className={`p-4 rounded-full transition transform hover:scale-110 ${
              isPlaying
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6" />
            )}
          </button>

          {/* 1日進める */}
          <button
            onClick={onNext}
            disabled={isPlaying}
            className="p-4 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <SkipForward className="w-6 h-6 text-gray-700" />
          </button>

          {/* 速度設定 */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="p-4 rounded-full bg-gray-200 hover:bg-gray-300 transition"
            >
              <Settings className="w-6 h-6 text-gray-700" />
            </button>

            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-white border rounded-lg shadow-lg p-2 min-w-[200px] z-10">
                <div className="text-sm font-medium text-gray-700 mb-2 px-2">
                  再生速度（秒/日）
                </div>
                <div className="space-y-1">
                  {speedOptions.map((speed) => (
                    <button
                      key={speed}
                      onClick={() => {
                        onSpeedChange(speed);
                        setShowSpeedMenu(false);
                      }}
                      className={`w-full px-3 py-2 text-left rounded transition ${
                        playbackSpeed === speed
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-gray-100'
                      }`}
                    >
                      {speed}秒
                      {speed === 5 && ' (最速)'}
                      {speed === 15 && ' (標準)'}
                      {speed === 30 && ' (じっくり)'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 状態表示 */}
        <div className="text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-full">
            {isPlaying ? (
              <>
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-gray-700">
                  再生中（{playbackSpeed}秒/日）
                </span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 bg-gray-400 rounded-full" />
                <span className="text-sm font-medium text-gray-700">一時停止</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
