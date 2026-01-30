"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { generateSessionId } from "@/lib/db/schema";
import { ArrowLeft, Play } from "lucide-react";
import Link from "next/link";

export default function NewSessionPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [nickname, setNickname] = useState<string | null>(null);

    // 設定
    const [periodDays, setPeriodDays] = useState(40);
    const [playbackSpeed, setPlaybackSpeed] = useState(5);
    const [maSettings, setMaSettings] = useState([5, 10, 20, 50, 100]);

    // コンディション情報
    const [physicalCondition, setPhysicalCondition] = useState<number | null>(
        null,
    );
    const [sleepCondition, setSleepCondition] = useState<number | null>(null);
    const [concentrationLevel, setConcentrationLevel] = useState<number | null>(
        null,
    );
    const [stressLevel, setStressLevel] = useState<number | null>(null);
    const [preSessionNotes, setPreSessionNotes] = useState("");

    // ログインチェック
    useEffect(() => {
        const savedNickname = localStorage.getItem("userNickname");
        if (!savedNickname) {
            router.push("/login");
        } else {
            setNickname(savedNickname);
        }
    }, [router]);

    const handleStartSession = async () => {
        if (!nickname) {
            alert("ログインが必要です");
            return;
        }

        setIsLoading(true);

        try {
            // サーバーからランダムな銘柄と期間のデータを取得
            const response = await fetch("/api/session/start", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    periodDays,
                    historicalDays: 120, // 100日線表示用に120日分の過去データ
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || "セッションの開始に失敗しました");
            }

            // セッションを作成
            const sessionId = generateSessionId();
            const session = {
                id: sessionId,
                nickname,
                startDate: new Date().toISOString(),
                symbol: data.stock.symbol,
                stockName: data.stock.name,
                stockSector: data.stock.sector,
                stockDescription: data.stock.description,
                stockMarketCapEstimate: data.stock.marketCapEstimate,
                periodDays,
                initialCapital: 1500000,
                currentCapital: 1500000,
                playbackSpeed,
                status: "paused" as const,
                currentDay: 0,
                practiceStartIndex: data.practiceStartIndex,
                practiceStartDate: data.practiceStartDate, // 練習開始日（リプレイ開始の株価日付）
                startDateOfData: data.startDate,
                endDateOfData: data.endDate,
                tradeCount: 0,
                winCount: 0,
                winRate: 0,
                maxDrawdown: 0,
                ruleViolations: 0,
                maSettings,
                positions: [],
                trades: [],
                violations: [],
                // コンディション情報
                physicalCondition: physicalCondition ?? undefined,
                sleepCondition: sleepCondition ?? undefined,
                concentrationLevel: concentrationLevel ?? undefined,
                stressLevel: stressLevel ?? undefined,
                preSessionNotes: preSessionNotes || undefined,
                // 株価データは保存しない（後で動的に読み込む）
            };

            // サーバーに保存
            const saveResponse = await fetch("/api/sessions", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(session),
            });

            const saveData = await saveResponse.json();

            if (!saveData.success) {
                throw new Error("セッションの保存に失敗しました");
            }

            // セッションページに移動
            router.push(`/session/${sessionId}`);
        } catch (error) {
            console.error("セッション作成エラー:", error);
            alert(
                error instanceof Error
                    ? error.message
                    : "セッションの作成に失敗しました",
            );
            setIsLoading(false);
        }
    };

    return (
        <div className="h-screen flex flex-col bg-background overflow-hidden">
            {/* ヘッダー */}
            <header className="bg-card border-b flex-shrink-0">
                <div className="px-4 py-3">
                    <div className="flex items-center gap-3">
                        <Link
                            href="/"
                            className="p-2 hover:bg-accent rounded-lg transition"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <h1 className="text-lg font-bold">新規セッション</h1>
                    </div>
                </div>
            </header>

            {/* メインコンテンツ */}
            <main className="flex-1 overflow-y-auto px-4 py-4">
                <div className="bg-card rounded-xl border p-4">
                    {/* 設定フォーム */}
                    <div className="space-y-4">
                        {/* 期間設定 */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                セッション期間
                            </label>
                            <div className="grid grid-cols-3 gap-2">
                                {[20, 40, 60].map((days) => (
                                    <button
                                        key={days}
                                        onClick={() => setPeriodDays(days)}
                                        className={`p-3 rounded-lg border-2 transition ${
                                            periodDays === days
                                                ? "border-primary bg-primary/10"
                                                : "border-border hover:border-primary/50"
                                        }`}
                                    >
                                        <div className="text-xl font-bold">
                                            {days}日
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {days === 20 && "約1ヶ月"}
                                            {days === 40 && "約2ヶ月"}
                                            {days === 60 && "約3ヶ月"}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 再生速度 */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                再生速度: {playbackSpeed}秒/日
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min="1"
                                    max="10"
                                    step="1"
                                    value={playbackSpeed}
                                    onChange={(e) =>
                                        setPlaybackSpeed(Number(e.target.value))
                                    }
                                    className="flex-1"
                                />
                                <div className="w-16 text-center">
                                    <div className="text-lg font-bold">
                                        {playbackSpeed}秒
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-between text-xs text-muted-foreground mt-1">
                                <span>1秒(最速)</span>
                                <span>5秒(標準)</span>
                                <span>10秒(じっくり)</span>
                            </div>
                        </div>

                        {/* 移動平均線設定 */}
                        <div>
                            <label className="block text-sm font-medium mb-2">
                                移動平均線
                            </label>
                            <div className="grid grid-cols-5 gap-2">
                                {maSettings.map((period, index) => (
                                    <input
                                        key={index}
                                        type="number"
                                        value={period}
                                        onChange={(e) => {
                                            const newSettings = [...maSettings];
                                            newSettings[index] = Number(
                                                e.target.value,
                                            );
                                            setMaSettings(newSettings);
                                        }}
                                        className="px-2 py-2 border rounded-lg text-center text-sm bg-background"
                                        min="1"
                                        max="200"
                                    />
                                ))}
                            </div>
                        </div>

                        {/* コンディション入力 */}
                        <div className="pt-4 border-t">
                            <h3 className="text-sm font-medium mb-3">
                                今日のコンディション
                            </h3>

                            {/* 体調 */}
                            <div className="mb-3">
                                <label className="block text-sm mb-2">
                                    体調
                                </label>
                                <div className="grid grid-cols-5 gap-2">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                        <button
                                            key={level}
                                            onClick={() =>
                                                setPhysicalCondition(level)
                                            }
                                            className={`p-2 rounded-lg border-2 transition ${
                                                physicalCondition === level
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border hover:border-primary/50"
                                            }`}
                                        >
                                            <div className="text-lg font-bold">
                                                {level}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {level === 1 && "悪い"}
                                                {level === 3 && "普通"}
                                                {level === 5 && "良い"}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 睡眠 */}
                            <div className="mb-3">
                                <label className="block text-sm mb-2">
                                    睡眠
                                </label>
                                <div className="grid grid-cols-5 gap-2">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                        <button
                                            key={level}
                                            onClick={() =>
                                                setSleepCondition(level)
                                            }
                                            className={`p-2 rounded-lg border-2 transition ${
                                                sleepCondition === level
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border hover:border-primary/50"
                                            }`}
                                        >
                                            <div className="text-lg font-bold">
                                                {level}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {level === 1 && "不足"}
                                                {level === 3 && "普通"}
                                                {level === 5 && "充分"}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* 集中力 */}
                            <div className="mb-3">
                                <label className="block text-sm mb-2">
                                    集中力
                                </label>
                                <div className="grid grid-cols-5 gap-2">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                        <button
                                            key={level}
                                            onClick={() =>
                                                setConcentrationLevel(level)
                                            }
                                            className={`p-2 rounded-lg border-2 transition ${
                                                concentrationLevel === level
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border hover:border-primary/50"
                                            }`}
                                        >
                                            <div className="text-lg font-bold">
                                                {level}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {level === 1 && "低い"}
                                                {level === 3 && "普通"}
                                                {level === 5 && "高い"}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* ストレス */}
                            <div className="mb-3">
                                <label className="block text-sm mb-2">
                                    ストレス
                                </label>
                                <div className="grid grid-cols-5 gap-2">
                                    {[1, 2, 3, 4, 5].map((level) => (
                                        <button
                                            key={level}
                                            onClick={() =>
                                                setStressLevel(level)
                                            }
                                            className={`p-2 rounded-lg border-2 transition ${
                                                stressLevel === level
                                                    ? "border-primary bg-primary/10"
                                                    : "border-border hover:border-primary/50"
                                            }`}
                                        >
                                            <div className="text-lg font-bold">
                                                {level}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {level === 1 && "低い"}
                                                {level === 3 && "普通"}
                                                {level === 5 && "高い"}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* メモ */}
                            <div>
                                <label className="block text-sm mb-2">
                                    メモ（任意）
                                </label>
                                <textarea
                                    value={preSessionNotes}
                                    onChange={(e) =>
                                        setPreSessionNotes(e.target.value)
                                    }
                                    placeholder="今日の気分や特記事項など..."
                                    className="w-full px-3 py-2 border rounded-lg text-sm bg-background resize-none"
                                    rows={3}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 開始ボタン */}
                    <button
                        onClick={handleStartSession}
                        disabled={isLoading || !nickname}
                        className="w-full mt-8 bg-primary hover:bg-primary/90 disabled:bg-muted text-primary-foreground font-bold py-4 px-6 rounded-lg flex items-center justify-center gap-3 transition disabled:opacity-50"
                    >
                        {isLoading ? (
                            <>
                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                                セッション作成中...
                            </>
                        ) : (
                            <>
                                <Play className="w-6 h-6" />
                                セッション開始
                            </>
                        )}
                    </button>
                </div>
            </main>
        </div>
    );
}
