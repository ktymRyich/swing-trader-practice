/**
 * 認証付きAPIリクエストのヘルパー関数
 */

/**
 * ローカルストレージからトークンを取得
 */
export function getAuthToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("authToken");
}

/**
 * トークンをローカルストレージに保存
 */
export function setAuthToken(token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem("authToken", token);
}

/**
 * トークンをローカルストレージから削除
 */
export function removeAuthToken(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem("authToken");
    localStorage.removeItem("userNickname");
}

/**
 * 認証ヘッダーを含むfetchオプションを生成
 */
export function getAuthHeaders(): HeadersInit {
    const token = getAuthToken();
    if (!token) {
        return {};
    }

    return {
        Authorization: `Bearer ${token}`,
    };
}

/**
 * 認証付きGETリクエスト
 */
export async function authFetch(
    url: string,
    options: RequestInit = {},
): Promise<Response> {
    const headers = {
        ...getAuthHeaders(),
        ...options.headers,
    };

    const response = await fetch(url, {
        ...options,
        headers,
    });

    // 認証エラーの場合、ログイン画面にリダイレクト
    if (response.status === 401) {
        removeAuthToken();
        if (typeof window !== "undefined") {
            window.location.href = "/login";
        }
    }

    return response;
}

/**
 * 認証付きPOSTリクエスト（JSON）
 */
export async function authPost(url: string, data: any): Promise<Response> {
    return authFetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });
}

/**
 * 認証付きPUTリクエスト（JSON）
 */
export async function authPut(url: string, data: any): Promise<Response> {
    return authFetch(url, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
    });
}

/**
 * 認証付きDELETEリクエスト
 */
export async function authDelete(url: string): Promise<Response> {
    return authFetch(url, {
        method: "DELETE",
    });
}
