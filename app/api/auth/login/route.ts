import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import bcrypt from "bcryptjs";
import { generateToken } from "@/lib/auth/jwt";

/**
 * ユーザー認証API（パスワード認証付き）
 */

const USER_DATA_DIR = path.join(process.cwd(), "data", "users");

// ユーザーデータディレクトリを作成
if (!fs.existsSync(USER_DATA_DIR)) {
    fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}

interface UserData {
    nickname: string;
    passwordHash?: string; // bcryptハッシュ値
    createdAt: string;
    passwordSetAt?: string;
    sessions: any[];
}

export async function POST(request: Request) {
    try {
        const { nickname, password, isSettingPassword } = await request.json();

        if (!nickname || nickname.trim().length === 0) {
            return NextResponse.json(
                { success: false, error: "ニックネームを入力してください" },
                { status: 400 },
            );
        }

        if (!password || password.length < 4) {
            return NextResponse.json(
                {
                    success: false,
                    error: "パスワードは4文字以上で入力してください",
                },
                { status: 400 },
            );
        }

        const userFile = path.join(USER_DATA_DIR, `${nickname}.json`);

        // ユーザーが存在しない場合は新規作成
        if (!fs.existsSync(userFile)) {
            const passwordHash = await bcrypt.hash(password, 10);
            const newUser: UserData = {
                nickname,
                passwordHash,
                createdAt: new Date().toISOString(),
                passwordSetAt: new Date().toISOString(),
                sessions: [],
            };
            fs.writeFileSync(userFile, JSON.stringify(newUser, null, 2));

            const token = generateToken(nickname);
            return NextResponse.json({
                success: true,
                user: { nickname },
                token,
                message: "新規ユーザーを作成しました",
            });
        }

        // 既存ユーザーの処理
        const userData: UserData = JSON.parse(
            fs.readFileSync(userFile, "utf-8"),
        );

        // パスワード未設定ユーザーの場合、パスワード設定モード
        if (!userData.passwordHash && isSettingPassword) {
            const passwordHash = await bcrypt.hash(password, 10);
            userData.passwordHash = passwordHash;
            userData.passwordSetAt = new Date().toISOString();
            fs.writeFileSync(userFile, JSON.stringify(userData, null, 2));

            const token = generateToken(nickname);
            return NextResponse.json({
                success: true,
                user: { nickname },
                token,
                message: "パスワードを設定しました",
            });
        }

        // パスワード未設定ユーザーの場合、パスワード設定を促す
        if (!userData.passwordHash) {
            return NextResponse.json(
                {
                    success: false,
                    error: "パスワードが未設定です。パスワードを設定してください。",
                    requirePasswordSetup: true,
                },
                { status: 401 },
            );
        }

        // パスワード検証
        const isPasswordValid = await bcrypt.compare(
            password,
            userData.passwordHash,
        );

        if (!isPasswordValid) {
            return NextResponse.json(
                { success: false, error: "パスワードが正しくありません" },
                { status: 401 },
            );
        }

        // 認証成功
        const token = generateToken(nickname);
        return NextResponse.json({
            success: true,
            user: { nickname },
            token,
        });
    } catch (error) {
        console.error("認証エラー:", error);
        return NextResponse.json(
            {
                success: false,
                error: "認証に失敗しました",
                details: error instanceof Error ? error.message : String(error),
            },
            { status: 500 },
        );
    }
}
