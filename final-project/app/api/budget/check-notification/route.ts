import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { BudgetNotificationService } from '@/lib/services/budgetNotification.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const notificationService = new BudgetNotificationService();

// POST - 手動觸發預算檢查（通常由定時任務調用）
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json().catch(() => ({}));
    const month = body.month || undefined;

    // 檢查並發送預算提醒
    await notificationService.checkAndNotifyBudget(session.user.id, month);

    return NextResponse.json({ success: true, message: '預算檢查完成' });
  } catch (error) {
    logger.error('Error checking budget notification', error as Error);
    return NextResponse.json({ error: '檢查失敗' }, { status: 500 });
  }
}

// GET - 手動觸發預算檢查（用於測試）
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || undefined;

    await notificationService.checkAndNotifyBudget(session.user.id, month);

    return NextResponse.json({ success: true, message: '預算檢查完成，如有需要會發送 LINE 通知' });
  } catch (error) {
    logger.error('Error checking budget notification', error as Error);
    return NextResponse.json({ error: '檢查失敗' }, { status: 500 });
  }
}

