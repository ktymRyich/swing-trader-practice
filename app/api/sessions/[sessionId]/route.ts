import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data', 'sessions');

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
    } catch (error) {
      // ファイルが存在しない場合は新規作成
    }

    // セッションを更新または追加
    const index = sessions.findIndex((s: any) => s.id === sessionId);
    if (index >= 0) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }

    await fs.writeFile(filePath, JSON.stringify(sessions, null, 2));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update session error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update session' }, { status: 500 });
  }
}
