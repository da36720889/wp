import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SavingsGoalService } from '@/lib/services/savingsGoal.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const savingsGoalService = new SavingsGoalService();

// GET - 獲取所有儲蓄目標
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const includeCompleted = searchParams.get('includeCompleted') !== 'false';

    const goals = await savingsGoalService.getGoals(session.user.id, includeCompleted);

    return NextResponse.json({
      goals: goals.map((goal) => ({
        _id: goal._id.toString(),
        title: goal.title,
        targetAmount: goal.targetAmount,
        currentAmount: goal.currentAmount,
        deadline: goal.deadline,
        completed: goal.completed,
        completedAt: goal.completedAt,
        progress: savingsGoalService.calculateProgress(goal),
        createdAt: goal.createdAt,
        updatedAt: goal.updatedAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching savings goals', error as Error);
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 });
  }
}

// POST - 創建儲蓄目標
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { title, targetAmount, deadline } = body;

    if (!title || !targetAmount || targetAmount <= 0) {
      return NextResponse.json({ error: '請提供有效的目標名稱和金額' }, { status: 400 });
    }

    const goal = await savingsGoalService.createGoal(session.user.id, {
      title,
      targetAmount: parseFloat(targetAmount),
      deadline: deadline ? new Date(deadline) : undefined,
    });

    const progress = savingsGoalService.calculateProgress(goal);

    return NextResponse.json({
      _id: goal._id.toString(),
      title: goal.title,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      deadline: goal.deadline,
      completed: goal.completed,
      progress,
    });
  } catch (error) {
    logger.error('Error creating savings goal', error as Error);
    return NextResponse.json({ error: '創建失敗' }, { status: 500 });
  }
}

