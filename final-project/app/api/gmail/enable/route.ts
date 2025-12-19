import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { GmailService } from '@/lib/services/gmail.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const gmailService = new GmailService();

// PUT - 啟用或停用 Gmail 自動匯入
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { enabled } = body;

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: '請提供有效的 enabled 值' }, { status: 400 });
    }

    // 檢查是否已授權
    if (enabled) {
      const isAuthorized = await gmailService.isGmailAuthorized(session.user.id);
      if (!isAuthorized) {
        return NextResponse.json(
          { error: '尚未授權 Gmail 存取，請先重新登入以授權 Gmail' },
          { status: 400 }
        );
      }
    }

    await gmailService.setGmailEnabled(session.user.id, enabled);

    return NextResponse.json({ success: true, enabled });
  } catch (error) {
    logger.error('Error setting Gmail enabled', error as Error);
    return NextResponse.json({ error: '設定失敗' }, { status: 500 });
  }
}

