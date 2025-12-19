import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { SavingsGoalService } from '@/lib/services/savingsGoal.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const savingsGoalService = new SavingsGoalService();

// PUT - 更新儲蓄目標
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;
    const body = await request.json();
    const { title, targetAmount, deadline } = body;

    const goal = await savingsGoalService.updateGoal(id, session.user.id, {
      title,
      targetAmount: targetAmount ? parseFloat(targetAmount) : undefined,
      deadline: deadline ? new Date(deadline) : undefined,
    });

    if (!goal) {
      return NextResponse.json({ error: '找不到目標' }, { status: 404 });
    }

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
    logger.error('Error updating savings goal', error as Error);
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
}

// DELETE - 刪除儲蓄目標
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const { id } = await params;
    const success = await savingsGoalService.deleteGoal(id, session.user.id);

    if (!success) {
      return NextResponse.json({ error: '找不到目標' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting savings goal', error as Error);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}

