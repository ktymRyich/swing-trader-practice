"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LogIn, Eye, EyeOff } from "lucide-react";
import { setAuthToken } from "@/lib/utils/authFetch";

export default function LoginPage() {
    const router = useRouter();
    const [nickname, setNickname] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [isPasswordSetup, setIsPasswordSetup] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // 既にログイン済みかチェック
    useEffect(() => {
        const savedNickname = localStorage.getItem("userNickname");
        if (savedNickname) {
            router.push("/");
        }
    }, [router]);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!nickname.trim()) {
            alert("ニックネームを入力してください");
            return;
        }

        if (!password) {
            alert("パスワードを入力してください");
            return;
        }

        if (password.length < 4) {
            alert("パスワードは4文字以上で入力してください");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch("/api/auth/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    nickname: nickname.trim(),
                    password,
                    isSettingPassword: isPasswordSetup,
                }),
            });

            const data = await response.json();

            if (data.success) {
                // トークンとニックネームをローカルストレージに保存
                setAuthToken(data.token);
                localStorage.setItem("userNickname", data.user.nickname);
                if (data.message) {
                    alert(data.message);
                }
                router.push("/");
            } else if (data.requirePasswordSetup) {
                // パスワード設定モードに切り替え
                setIsPasswordSetup(true);
                alert("既存ユーザーです。新しくパスワードを設定してください。");
            } else {
                alert(data.error || "ログインに失敗しました");
            }
        } catch (error) {
            console.error("ログインエラー:", error);
            alert("ログインに失敗しました");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
            <div className="bg-card rounded-xl border p-8 max-w-md w-full">
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/10 rounded-full mb-4">
                        <LogIn className="w-8 h-8 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">
                        Swing Trading Practice
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {isPasswordSetup
                            ? "パスワードを設定してください"
                            : "ログインしてください"}
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label
                            htmlFor="nickname"
                            className="block text-sm font-medium mb-2"
                        >
                            ニックネーム
                        </label>
                        <input
                            id="nickname"
                            type="text"
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            placeholder="例: トレーダー太郎"
                            className="w-full px-4 py-3 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                            disabled={isLoading}
                            maxLength={20}
                            autoComplete="username"
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="password"
                            className="block text-sm font-medium mb-2"
                        >
                            パスワード{" "}
                            {isPasswordSetup && (
                                <span className="text-primary">(新規設定)</span>
                            )}
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder={
                                    isPasswordSetup
                                        ? "新しいパスワード（4文字以上）"
                                        : "パスワード"
                                }
                                className="w-full px-4 py-3 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary pr-12"
                                disabled={isLoading}
                                autoComplete={
                                    isPasswordSetup
                                        ? "new-password"
                                        : "current-password"
                                }
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                                tabIndex={-1}
                            >
                                {showPassword ? (
                                    <EyeOff className="w-5 h-5" />
                                ) : (
                                    <Eye className="w-5 h-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-lg font-medium transition disabled:opacity-50"
                    >
                        {isLoading
                            ? "処理中..."
                            : isPasswordSetup
                              ? "パスワードを設定"
                              : "ログイン"}
                    </button>
                </form>

                <div className="mt-6 text-center text-xs text-muted-foreground">
                    <p>※ 新規ユーザーは自動的に作成されます</p>
                    <p>パスワードはbcryptで安全にハッシュ化されます</p>
                </div>
            </div>
        </div>
    );
}
