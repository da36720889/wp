import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { TransactionService } from '@/lib/services/transaction.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const transactionService = new TransactionService();

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    const summary = await transactionService.getSummary(session.user.id, startDate, endDate);

    return NextResponse.json(summary);
  } catch (error) {
    logger.error('Error fetching summary', error as Error);
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 });
  }
}

