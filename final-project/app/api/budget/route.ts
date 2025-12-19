import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { BudgetService } from '@/lib/services/budget.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const budgetService = new BudgetService();

// GET - 獲取預算狀態
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month') || undefined;

    const status = await budgetService.getBudgetStatus(session.user.id, month);

    return NextResponse.json({
      budget: {
        _id: status.budget._id.toString(),
        month: status.budget.month,
        totalBudget: status.budget.totalBudget,
        categoryBudgets: status.budget.categoryBudgets
          ? Object.fromEntries(status.budget.categoryBudgets)
          : {},
      },
      totalSpent: status.totalSpent,
      categorySpent: Object.fromEntries(status.categorySpent),
      totalRemaining: status.totalRemaining,
      categoryRemaining: Object.fromEntries(status.categoryRemaining),
    });
  } catch (error) {
    logger.error('Error fetching budget status', error as Error);
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 });
  }
}

// PUT - 更新預算
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { month, totalBudget, categoryBudgets } = body;

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: '月份格式錯誤，應為 YYYY-MM' }, { status: 400 });
    }

    if (totalBudget !== undefined && (typeof totalBudget !== 'number' || totalBudget < 0)) {
      return NextResponse.json({ error: '總預算必須為非負數' }, { status: 400 });
    }

    const budget = await budgetService.updateBudget(session.user.id, month, {
      totalBudget,
      categoryBudgets,
    });

    return NextResponse.json({
      _id: budget._id.toString(),
      month: budget.month,
      totalBudget: budget.totalBudget,
      categoryBudgets: budget.categoryBudgets
        ? Object.fromEntries(budget.categoryBudgets)
        : {},
    });
  } catch (error) {
    logger.error('Error updating budget', error as Error);
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
}

