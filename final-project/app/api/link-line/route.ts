import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { UserService } from '@/lib/services/user.service';
import { TransactionRepository } from '@/lib/repositories/transaction.repository';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const userService = new UserService();
const transactionRepository = new TransactionRepository();

/**
 * POST /api/link-line
 * 手動關聯 LINE 用戶到當前 Google 帳號
 * Body: { lineUserId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { lineUserId } = body;

    if (!lineUserId || typeof lineUserId !== 'string') {
      return NextResponse.json({ error: '請提供有效的 LINE 用戶 ID' }, { status: 400 });
    }

    // 查找當前 Google 用戶
    const googleUser = await userService.getUserById(session.user.id);
    if (!googleUser) {
      return NextResponse.json({ error: '找不到用戶' }, { status: 404 });
    }

    // 如果已經有關聯的 LINE 用戶
    if (googleUser.lineUserId) {
      if (googleUser.lineUserId === lineUserId) {
        return NextResponse.json({ 
          message: '此 LINE 用戶已經與您的帳號關聯',
          linked: true 
        });
      } else {
        return NextResponse.json({ 
          error: '您的帳號已經關聯了另一個 LINE 用戶',
          currentLineUserId: googleUser.lineUserId
        }, { status: 400 });
      }
    }

    // 查找要關聯的 LINE 用戶
    const lineUser = await userService.findByLineUserId(lineUserId);
    if (!lineUser) {
      return NextResponse.json({ error: '找不到指定的 LINE 用戶' }, { status: 404 });
    }

    // 如果 LINE 用戶已經關聯到其他 Google 帳號
    if (lineUser.googleId && !lineUser.googleId.startsWith('line_')) {
      return NextResponse.json({ 
        error: '此 LINE 用戶已經關聯到另一個 Google 帳號' 
      }, { status: 400 });
    }

    // 執行合併
    const mergeResult = await userService.mergeLineUserToGoogle(
      lineUserId,
      session.user.id
    );

    if (!mergeResult) {
      return NextResponse.json({ error: '關聯失敗' }, { status: 500 });
    }

    // 遷移交易記錄
    const migratedCount = await transactionRepository.updateUserId(
      mergeResult.oldUserId,
      mergeResult.newUserId
    );

    // 刪除舊的 LINE 用戶記錄
    const oldUser = await userService.getUserById(mergeResult.oldUserId);
    if (oldUser) {
      await oldUser.deleteOne();
    }

    logger.info('LINE user linked to Google account', {
      googleUserId: session.user.id,
      lineUserId,
      migratedTransactions: migratedCount,
    });

    return NextResponse.json({
      message: '成功關聯 LINE 用戶',
      migratedTransactions: migratedCount,
    });
  } catch (error) {
    logger.error('Error linking LINE user', error as Error);
    return NextResponse.json({ error: '關聯失敗' }, { status: 500 });
  }
}

/**
 * GET /api/link-line
 * 獲取當前用戶的 LINE 用戶關聯狀態
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

    return NextResponse.json({
      linked: !!user.lineUserId,
      lineUserId: user.lineUserId || null,
    });
  } catch (error) {
    logger.error('Error getting link status', error as Error);
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 });
  }
}

