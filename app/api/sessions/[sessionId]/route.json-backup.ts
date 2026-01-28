import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

// セッション完了時にGitコミットを作成する関数
async function commitSessionData(nickname: string, session: any) {
  try {
    const workDir = process.cwd();
    const fileName = `data/sessions/${nickname}.json`;
    
    // Gitリポジトリが初期化されているか確認
    try {
      await execAsync(`cd "${workDir}" && git rev-parse --git-dir`);
    } catch {
      console.log(`[GIT] リポジトリ未初期化のためスキップ`);
      return;
    }

    // ファイルをステージング
    await execAsync(`cd "${workDir}" && git add "${fileName}"`);
    
    // 利益率を計算
    const profitPercent = ((session.currentCapital - session.initialCapital) / session.initialCapital * 100).toFixed(2);
    const profitSign = profitPercent.startsWith('-') ? '' : '+';
    
    // コミットメッセージを作成
    const message = `Session completed: ${session.stockName} (${session.symbol}) - ${profitSign}${profitPercent}%`;
    
    // コミット作成
    await execAsync(`cd "${workDir}" && git commit -m "${message}"`);
    
    console.log(`[GIT] ✓ コミット作成: ${session.id}, 利益: ${profitSign}${profitPercent}%`);
  } catch (error: any) {
    // Gitエラーは非ブロッキング（セッション保存は成功とする）
    if (error.message?.includes('nothing to commit')) {
      console.log(`[GIT] 変更なし、コミットスキップ`);
    } else {
      console.error(`[GIT] コミット失敗 (非ブロッキング):`, error.message);
    }
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const nickname = request.nextUrl.searchParams.get('nickname');

    if (!nickname) {
      return NextResponse.json({ success: false, error: 'Nickname required' }, { status: 400 });
    }

    const filePath = path.join(DATA_DIR, `${nickname}.json`);

    try {
      const data = await fs.readFile(filePath, 'utf-8');
      const sessions = JSON.parse(data);
      const session = sessions.find((s: any) => s.id === sessionId);

      if (!session) {
        return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, session });
    } catch (error) {
      return NextResponse.json({ success: false, error: 'Session not found' }, { status: 404 });
    }
  } catch (error) {
    console.error('Get session error:', error);
    return NextResponse.json({ success: false, error: 'Failed to get session' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const { nickname, session } = body;

    if (!nickname) {
      return NextResponse.json({ success: false, error: 'Nickname required' }, { status: 400 });
    }

    await fs.mkdir(DATA_DIR, { recursive: true });
    const filePath = path.join(DATA_DIR, `${nickname}.json`);

    let sessions = [];
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      sessions = JSON.parse(data);
      console.log(`[PUT] 既存セッション読み込み: ${nickname}, 件数: ${sessions.length}`);
      
      // バックアップを作成
      if (sessions.length > 0) {
        const backupPath = path.join(DATA_DIR, `${nickname}.backup.json`);
        await fs.writeFile(backupPath, data);
      }
    } catch (error) {
      console.log(`[PUT] セッションファイル未存在または読み込みエラー: ${nickname}`);
      // ファイルが存在しない場合は新規作成
    }

    // セッションを更新または追加
    const index = sessions.findIndex((s: any) => s.id === sessionId);
    if (index >= 0) {
      console.log(`セッション更新: ${sessionId} (${nickname})`);
      sessions[index] = session;
    } else {
      console.log(`新規セッション追加: ${sessionId} (${nickname}), 現在の総数: ${sessions.length + 1}`);
      sessions.push(session);
    }

    await fs.writeFile(filePath, JSON.stringify(sessions, null, 2));
    console.log(`セッション保存完了: ${nickname}, 総セッション数: ${sessions.length}`);

    // セッション完了時にGitコミットを作成
    if (session.status === 'completed') {
      await commitSessionData(nickname, session);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update session error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update session' }, { status: 500 });
  }
}
