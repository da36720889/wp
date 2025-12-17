import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { TransactionService } from '@/lib/services/transaction.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const transactionService = new TransactionService();

/**
 * GET /api/trends
 * 獲取消費趨勢數據
 * Query params: period (day|week|month|year)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'month'; // 默認按月

    if (!['day', 'week', 'month', 'year'].includes(period)) {
      return NextResponse.json({ error: '無效的時間週期' }, { status: 400 });
    }

    const trends = await transactionService.getTrends(session.user.id, period as 'day' | 'week' | 'month' | 'year');

    return NextResponse.json(trends);
  } catch (error) {
    logger.error('Error fetching trends', error as Error);
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 });
  }
}

