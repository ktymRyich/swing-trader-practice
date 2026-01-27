'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [nickname, setNickname] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 既にログイン済みかチェック
  useEffect(() => {
    const savedNickname = localStorage.getItem('userNickname');
    if (savedNickname) {
      router.push('/');
    }
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nickname.trim()) {
      alert('ニックネームを入力してください');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim() }),
      });

      const data = await response.json();

      if (data.success) {
        // ローカルストレージに保存
        localStorage.setItem('userNickname', data.user.nickname);
        router.push('/');
      } else {
        alert(data.error || 'ログインに失敗しました');
      }
    } catch (error) {
      console.error('ログインエラー:', error);
      alert('ログインに失敗しました');
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
          <h1 className="text-2xl font-bold mb-2">Swing Trading Practice</h1>
          <p className="text-muted-foreground text-sm">
            ニックネームを入力してログイン
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="nickname" className="block text-sm font-medium mb-2">
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
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 rounded-lg font-medium transition disabled:opacity-50"
          >
            {isLoading ? 'ログイン中...' : 'ログイン'}
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p>※ ニックネームは自由に設定できます</p>
          <p>パスワードは不要です</p>
        </div>
      </div>
    </div>
  );
}
