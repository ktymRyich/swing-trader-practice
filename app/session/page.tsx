"use client";

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SessionPage } from "./[sessionId]/page";

export default function SessionPageFromQuery() {
    const searchParams = useSearchParams();
    const sessionId = searchParams.get("sessionId");

    if (!sessionId) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background p-6">
                <div className="bg-card rounded-xl border p-6 text-center max-w-md w-full">
                    <h1 className="text-lg font-bold mb-2">
                        セッションが指定されていません
                    </h1>
                    <p className="text-sm text-muted-foreground mb-4">
                        セッション一覧から開いてください。
                    </p>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition"
                    >
                        ホームへ戻る
                    </Link>
                </div>
            </div>
        );
    }

    return <SessionPage sessionId={sessionId} />;
}
