import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * セッション保存・取得API
 */

const SESSIONS_DIR = path.join(process.cwd(), 'data', 'sessions');

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

// セッション保存
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // sessionsが直接渡された場合（削除処理用）
    if (body.sessions !== undefined && body.nickname) {
      const userSessionsFile = path.join(SESSIONS_DIR, `${body.nickname}.json`);
      fs.writeFileSync(userSessionsFile, JSON.stringify(body.sessions, null, 2));
      return NextResponse.json({ success: true });
    }
    
    // 単一セッションの場合
    const session = body;
    const { nickname } = session;

    if (!nickname) {
      return NextResponse.json(
        { success: false, error: 'ユーザー情報がありません' },
        { status: 400 }
      );
    }

    const userSessionsFile = path.join(SESSIONS_DIR, `${nickname}.json`);
    let sessions = [];

    // 既存のセッションを読み込み
    if (fs.existsSync(userSessionsFile)) {
      sessions = JSON.parse(fs.readFileSync(userSessionsFile, 'utf-8'));
    }

    // 新しいセッションを追加または更新
    const existingIndex = sessions.findIndex((s: any) => s.id === session.id);
    if (existingIndex >= 0) {
      sessions[existingIndex] = session;
    } else {
      sessions.push(session);
    }

    fs.writeFileSync(userSessionsFile, JSON.stringify(sessions, null, 2));

    return NextResponse.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error('セッション保存エラー:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'セッションの保存に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

// セッション一覧取得
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const nickname = searchParams.get('nickname');

    if (!nickname) {
      return NextResponse.json(
        { success: false, error: 'ユーザー情報がありません' },
        { status: 400 }
      );
    }

    const userSessionsFile = path.join(SESSIONS_DIR, `${nickname}.json`);

    if (!fs.existsSync(userSessionsFile)) {
      return NextResponse.json({
        success: true,
        sessions: [],
      });
    }

    const sessions = JSON.parse(fs.readFileSync(userSessionsFile, 'utf-8'));

    return NextResponse.json({
      success: true,
      sessions,
    });
  } catch (error) {
    console.error('セッション取得エラー:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'セッションの取得に失敗しました',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
