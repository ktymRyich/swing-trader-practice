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
      
      // 既存データを読み込んでバックアップを作成
      if (fs.existsSync(userSessionsFile)) {
        try {
          const currentContent = fs.readFileSync(userSessionsFile, 'utf-8');
          const currentSessions = JSON.parse(currentContent);
          console.log(`[DELETE] 削除前セッション数: ${currentSessions.length}, 削除後: ${body.sessions.length}`);
          
          // バックアップを作成（重要！）
          if (currentSessions.length > 0) {
            const backupFile = path.join(SESSIONS_DIR, `${body.nickname}.backup.json`);
            fs.writeFileSync(backupFile, currentContent);
            console.log(`[DELETE] バックアップ作成: ${backupFile}`);
          }
          
          // 削除数を確認（異常検知）
          const deletedCount = currentSessions.length - body.sessions.length;
          if (deletedCount > 1) {
            console.warn(`[DELETE] 警告: ${deletedCount}件のセッションが削除されます！`);
          }
          if (body.sessions.length === 0 && currentSessions.length > 1) {
            console.error(`[DELETE] 危険: 全${currentSessions.length}件が削除されます！`);
          }
        } catch (error) {
          console.error(`[DELETE] バックアップ作成エラー:`, error);
        }
      }
      
      fs.writeFileSync(userSessionsFile, JSON.stringify(body.sessions, null, 2));
      console.log(`[DELETE] 削除完了: ${body.nickname}, 残存セッション数: ${body.sessions.length}`);
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
      try {
        const fileContent = fs.readFileSync(userSessionsFile, 'utf-8');
        sessions = JSON.parse(fileContent);
        console.log(`[POST] 既存セッション読み込み: ${nickname}, 件数: ${sessions.length}`);
        
        // バックアップを作成（1件以上ある場合のみ）
        if (sessions.length > 0) {
          const backupFile = path.join(SESSIONS_DIR, `${nickname}.backup.json`);
          fs.writeFileSync(backupFile, fileContent);
        }
      } catch (parseError) {
        console.error(`[POST] JSONパースエラー: ${nickname}`, parseError);
        // パースエラーの場合、バックアップから復元を試みる
        const backupFile = path.join(SESSIONS_DIR, `${nickname}.backup.json`);
        if (fs.existsSync(backupFile)) {
          try {
            sessions = JSON.parse(fs.readFileSync(backupFile, 'utf-8'));
            console.log(`[POST] バックアップから復元: ${sessions.length}件`);
          } catch (backupError) {
            console.error(`[POST] バックアップも破損`);
            sessions = [];
          }
        } else {
          sessions = [];
        }
      }
    } else {
      console.log(`[POST] 新規ユーザー: ${nickname}`);
    }

    // 新しいセッションを追加または更新
    const existingIndex = sessions.findIndex((s: any) => s.id === session.id);
    if (existingIndex >= 0) {
      console.log(`[POST] セッション更新: ${session.id}, 総数: ${sessions.length}`);
      sessions[existingIndex] = session;
    } else {
      console.log(`[POST] セッション追加: ${session.id}, 新総数: ${sessions.length + 1}`);
      sessions.push(session);
    }

    fs.writeFileSync(userSessionsFile, JSON.stringify(sessions, null, 2));
    console.log(`[POST] 保存完了: ${nickname}, ファイル内セッション数: ${sessions.length}`);

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
