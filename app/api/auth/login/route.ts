import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * ユーザー認証API（簡易版：ニックネームのみ）
 */

const USER_DATA_DIR = path.join(process.cwd(), 'data', 'users');

// ユーザーデータディレクトリを作成
if (!fs.existsSync(USER_DATA_DIR)) {
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });
}

export async function POST(request: Request) {
  try {
    const { nickname } = await request.json();

    if (!nickname || nickname.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'ニックネームを入力してください' },
        { status: 400 }
      );
    }

    const userFile = path.join(USER_DATA_DIR, `${nickname}.json`);
    
    // ユーザーが存在しない場合は作成
    if (!fs.existsSync(userFile)) {
      const newUser = {
        nickname,
        createdAt: new Date().toISOString(),
        sessions: [],
      };
      fs.writeFileSync(userFile, JSON.stringify(newUser, null, 2));
    }

    // セッショントークン（簡易版：ニックネームをそのまま使用）
    return NextResponse.json({
      success: true,
      user: { nickname },
      token: nickname, // 本番環境では適切なトークン生成が必要
    });
  } catch (error) {
    console.error('認証エラー:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: '認証に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
