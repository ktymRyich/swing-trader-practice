import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Basic認証ミドルウェア
 * AWS等の本番環境でアプリ全体を保護
 */

export function middleware(request: NextRequest) {
    // 開発環境ではBasic認証をスキップ（オプション）
    if (
        process.env.NODE_ENV === "development" &&
        process.env.SKIP_BASIC_AUTH === "true"
    ) {
        return NextResponse.next();
    }

    // Basic認証の認証情報を環境変数から取得
    const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || "admin";
    const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD || "password";

    // Basic認証が無効化されている場合はスキップ
    if (process.env.BASIC_AUTH_ENABLED === "false") {
        return NextResponse.next();
    }

    // Authorizationヘッダーを取得
    const basicAuth = request.headers.get("authorization");

    if (basicAuth) {
        const authValue = basicAuth.split(" ")[1];
        try {
            const [user, pwd] = atob(authValue).split(":");

            // 認証情報が一致すればアクセス許可
            if (user === BASIC_AUTH_USER && pwd === BASIC_AUTH_PASSWORD) {
                return NextResponse.next();
            }
        } catch (error) {
            // Base64デコードエラーの場合
            console.error("Basic認証エラー:", error);
        }
    }

    // 認証失敗時は401を返す
    return new NextResponse("認証が必要です", {
        status: 401,
        headers: {
            "WWW-Authenticate": 'Basic realm="Secure Area"',
        },
    });
}

// ミドルウェアを適用するパスを指定
export const config = {
    matcher: [
        /*
         * 以下を除くすべてのパスに適用:
         * - api (APIルート)
         * - _next/static (静的ファイル)
         * - _next/image (画像最適化ファイル)
         * - favicon.ico (ファビコン)
         * - manifest.json (PWAマニフェスト)
         */
        "/((?!_next/static|_next/image|favicon.ico|manifest.json).*)",
    ],
};
