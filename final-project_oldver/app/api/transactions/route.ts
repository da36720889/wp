import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { TransactionService } from '@/lib/services/transaction.service';
import { createTransactionSchema, queryTransactionSchema } from '@/lib/schemas/transaction.schema';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const transactionService = new TransactionService();

// GET - 查詢記帳記錄
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    
    // 安全地處理 type 參數，確保只接受 'income' 或 'expense'
    const typeParam = searchParams.get('type');
    let type: 'income' | 'expense' | undefined = undefined;
    if (typeParam === 'income' || typeParam === 'expense') {
      type = typeParam;
    }

    const query = {
      userId: session.user.id,
      startDate: searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined,
      endDate: searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined,
      type,
      category: searchParams.get('category') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : 0,
    };

    const validated = queryTransactionSchema.parse(query);
    const result = await transactionService.getTransactions(validated);

    return NextResponse.json(result);
  } catch (error) {
    logger.error('Error fetching transactions', error as Error);
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 });
  }
}

// POST - 創建記帳記錄
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const validated = createTransactionSchema.parse(body);

    const transaction = await transactionService.createTransaction(session.user.id, validated);

    return NextResponse.json(transaction, { status: 201 });
  } catch (error) {
    logger.error('Error creating transaction', error as Error);
    return NextResponse.json({ error: '創建失敗' }, { status: 500 });
  }
}

