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

  return (
    <div className="bg-white rounded-lg border p-2">
      <div className="space-y-2">
        {/* プログレスバー */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600">
              {currentDay} / {totalDays}日
            </span>
            <span className="text-gray-600">{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 制御ボタン */}
        <div className="flex items-center justify-center gap-2">
          {/* 再生/一時停止 */}
          <button
            onClick={onTogglePlay}
            className={`p-2 rounded-full transition ${
              isPlaying
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </button>

          {/* 1日進める */}
          <button
            onClick={onNext}
            disabled={isPlaying}
            className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <SkipForward className="w-5 h-5 text-gray-700" />
          </button>

          {/* 速度設定 */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition"
            >
              <Settings className="w-5 h-5 text-gray-700" />
            </button>

            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-white border rounded-lg shadow-lg p-3 w-64 z-10">
                <div className="text-sm font-medium text-gray-700 mb-3 px-1">
                  再生速度: {playbackSpeed}秒/日
                </div>
                <div className="px-1">
                  <input
                    type="range"
                    min="1"
                    max="30"
                    value={playbackSpeed}
                    onChange={(e) => onSpeedChange(Number(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>1秒</span>
                    <span>15秒</span>
                    <span>30秒</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowSpeedMenu(false)}
                  className="w-full mt-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded transition"
                >
                  閉じる
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
