import jwt from "jsonwebtoken";

const JWT_SECRET =
    process.env.JWT_SECRET || "fallback-secret-key-for-development";

if (!process.env.JWT_SECRET) {
    console.warn(
        "⚠️ JWT_SECRET が設定されていません。.env.local ファイルで設定してください。",
    );
}

export interface JWTPayload {
    nickname: string;
    iat?: number;
    exp?: number;
}

/**
 * JWTトークンを生成
 */
export function generateToken(nickname: string): string {
    return jwt.sign(
        { nickname } as JWTPayload,
        JWT_SECRET,
        { expiresIn: "30d" }, // 30日間有効
    );
}

/**
 * JWTトークンを検証
 */
export function verifyToken(token: string): JWTPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        return decoded;
    } catch (error) {
        console.error("トークン検証エラー:", error);
        return null;
    }
}

/**
 * Authorizationヘッダーからトークンを抽出
 */
export function extractTokenFromHeader(
    authHeader: string | null,
): string | null {
    if (!authHeader) return null;

    // "Bearer {token}" 形式を想定
    const parts = authHeader.split(" ");
    if (parts.length === 2 && parts[0] === "Bearer") {
        return parts[1];
    }

    return null;
}

/**
 * Requestからニックネームを取得（認証チェック付き）
 */
export function authenticateRequest(
    request: Request,
):
    | { success: true; nickname: string }
    | { success: false; error: string; status: number } {
    const authHeader = request.headers.get("Authorization");
    const token = extractTokenFromHeader(authHeader);

    if (!token) {
        return {
            success: false,
            error: "認証トークンが必要です",
            status: 401,
        };
    }

    const payload = verifyToken(token);

    if (!payload) {
        return {
            success: false,
            error: "無効な認証トークンです",
            status: 401,
        };
    }

    return {
        success: true,
        nickname: payload.nickname,
    };
}
