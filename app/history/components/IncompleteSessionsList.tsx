import Link from "next/link";
import { Clock, Trash2 } from "lucide-react";

interface IncompleteSession {
    id: string;
    stockName: string;
    symbol: string;
    createdAt: string;
    startDate: string;
    periodDays: number;
    currentDay?: number;
    tradeCount?: number;
    practiceStartDate?: string;
    startDateOfData?: string;
}

interface IncompleteSessionsListProps {
    sessions: IncompleteSession[];
    onDelete: (
        sessionId: string,
        sessionName: string,
        e: React.MouseEvent,
    ) => void;
}

export default function IncompleteSessionsList({
    sessions,
    onDelete,
}: IncompleteSessionsListProps) {
    if (sessions.length === 0) {
        return null;
    }

    return (
        <div className="mt-12">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Clock className="w-5 h-5 text-muted-foreground" />
                未完了セッション ({sessions.length}件)
            </h2>
            <div className="grid gap-3">
                {sessions.map((session) => (
                    <div
                        key={session.id}
                        className="relative bg-card rounded-lg border hover:bg-accent transition"
                    >
                        {/* 削除ボタン */}
                        <button
                            onClick={(e) =>
                                onDelete(
                                    session.id,
                                    `${session.stockName} (${session.symbol})`,
                                    e,
                                )
                            }
                            className="absolute top-3 right-3 p-2 hover:bg-destructive/20 rounded-lg transition z-10"
                            title="削除"
                        >
                            <Trash2 className="w-4 h-4 text-destructive" />
                        </button>

                        <Link
                            href={`/session/${session.id}`}
                            className="block p-4 pr-14"
                        >
                            <div className="flex items-center justify-between gap-4">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="font-medium">
                                            {session.stockName}
                                        </span>
                                        <span className="text-sm text-muted-foreground">
                                            ({session.symbol})
                                        </span>
                                    </div>
                                    <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                                        <span>
                                            {new Date(
                                                session.createdAt ||
                                                    session.startDate,
                                            ).toLocaleDateString("ja-JP", {
                                                month: "short",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit",
                                            })}
                                        </span>
                                        <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                                            {session.periodDays}日間
                                        </span>
                                        {(session.practiceStartDate ||
                                            session.startDateOfData) && (
                                            <span className="text-xs">
                                                (
                                                {new Date(
                                                    (session.practiceStartDate ||
                                                        session.startDateOfData)!,
                                                ).toLocaleDateString("ja-JP", {
                                                    year: "numeric",
                                                    month: "short",
                                                    day: "numeric",
                                                })}
                                                〜)
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm font-medium text-primary">
                                        進行中 ({session.currentDay || 0}/
                                        {session.periodDays}日)
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                        {session.tradeCount || 0}回取引
                                    </div>
                                </div>
                            </div>
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}
