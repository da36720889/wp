import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { UserService } from '@/lib/services/user.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const userService = new UserService();

/**
 * GET /api/diagnose-links
 * 診斷當前用戶的連結狀態，檢查是否有重複連結問題
 */
export async function GET() {
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

    const duplicates = await userService.findDuplicateLineLinks();
    
    // 檢查當前用戶是否在重複連結中
    let hasDuplicateIssue = false;
    let duplicateInfo = null;

    if (user.lineUserId) {
      const duplicate = duplicates.find(d => d.lineUserId === user.lineUserId);
      if (duplicate && duplicate.users.length > 1) {
        hasDuplicateIssue = true;
        duplicateInfo = {
          lineUserId: user.lineUserId,
          linkedUsers: duplicate.users.map(u => ({
            email: u.email,
            isCurrentUser: u.userId === session.user.id,
          })),
        };
      }
    }

    return NextResponse.json({
      currentUser: {
        userId: session.user.id,
        email: user.email,
        lineUserId: user.lineUserId || null,
        linked: !!user.lineUserId,
      },
      hasDuplicateIssue,
      duplicateInfo,
      totalDuplicates: duplicates.length,
    });
  } catch (error) {
    logger.error('Error diagnosing links', error as Error);
    return NextResponse.json({ error: '診斷失敗' }, { status: 500 });
  }
}

