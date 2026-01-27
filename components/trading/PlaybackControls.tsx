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
    <div className="bg-card rounded-lg border p-2">
      <div className="space-y-2">
        {/* プログレスバー */}
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-muted-foreground">
              {currentDay} / {totalDays}日
            </span>
            <span className="text-muted-foreground">{progress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-primary h-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* 制御ボタン */}
        <div className="flex items-center justify-center gap-2">
          {/* 再生/一時停止 */}
          <button
            onClick={onTogglePlay}
            className={`p-2 rounded-full transition flex items-center justify-center ${
              isPlaying
                ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
                : 'bg-primary hover:bg-primary/90 text-primary-foreground'
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
            className="p-2 rounded-full bg-secondary hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center justify-center"
          >
            <SkipForward className="w-5 h-5" />
          </button>

          {/* 速度設定 */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu(!showSpeedMenu)}
              className="p-2 rounded-full bg-secondary hover:bg-secondary/80 transition flex items-center justify-center"
            >
              <Settings className="w-5 h-5" />
            </button>

            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-2 bg-card border rounded-lg shadow-lg p-3 w-64 z-10">
                <div className="text-sm font-medium mb-3 px-1">
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
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>1秒</span>
                    <span>15秒</span>
                    <span>30秒</span>
                  </div>
                </div>
                <button
                  onClick={() => setShowSpeedMenu(false)}
                  className="w-full mt-3 py-1 text-sm bg-secondary hover:bg-secondary/80 rounded transition"
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
