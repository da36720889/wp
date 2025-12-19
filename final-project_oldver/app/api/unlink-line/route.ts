import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { UserService } from '@/lib/services/user.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const userService = new UserService();

/**
 * DELETE /api/unlink-line
 * 解除當前 Google 帳號與 LINE 用戶的連結
 */
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const user = await userService.getUserById(session.user.id);
    if (!user) {
      return NextResponse.json({ error: '找不到用戶' }, { status: 404 });
    }

    if (!user.lineUserId) {
      return NextResponse.json({ 
        message: '您的帳號沒有連結 LINE 用戶',
        linked: false 
      });
    }

    const lineUserId = user.lineUserId;
    const success = await userService.unlinkLineUser(session.user.id);

    if (!success) {
      return NextResponse.json({ error: '解除連結失敗' }, { status: 500 });
    }

    logger.info('LINE user unlinked from Google account', {
      googleUserId: session.user.id,
      lineUserId,
    });

    return NextResponse.json({
      message: '已成功解除 LINE 用戶連結',
      lineUserId,
    });
  } catch (error) {
    logger.error('Error unlinking LINE user', error as Error);
    return NextResponse.json({ error: '解除連結失敗' }, { status: 500 });
  }
}

