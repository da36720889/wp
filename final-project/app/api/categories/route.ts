import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { TransactionRepository } from '@/lib/repositories/transaction.repository';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';
import Transaction from '@/lib/models/Transaction';

const transactionRepository = new TransactionRepository();

// GET - 獲取類別統計（用於圖表）
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
    const type = searchParams.get('type') as 'income' | 'expense' | null;

    // 建立查詢條件
    const filter: Record<string, unknown> = {
      userId: session.user.id,
    };

    if (startDate || endDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      filter.date = dateFilter;
    }

    if (type) {
      filter.type = type;
    }

    // 使用聚合查詢統計各類別金額
    const categoryStats = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
    ]);

    const result = categoryStats.map((stat) => ({
      category: stat._id,
      total: stat.total,
      count: stat.count,
    }));

    return NextResponse.json({ categories: result });
  } catch (error) {
    logger.error('Error fetching category stats', error as Error);
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 });
  }
}

