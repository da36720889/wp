import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { TransactionService } from '@/lib/services/transaction.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';
import { CreateTransactionInput } from '@/lib/schemas/transaction.schema';

const transactionService = new TransactionService();

// PUT - 更新記帳記錄
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

    // 驗證並準備更新數據
    const updateData: Partial<CreateTransactionInput> = {};
    if (body.amount !== undefined) updateData.amount = body.amount;
    if (body.category !== undefined) updateData.category = body.category;
    if (body.description !== undefined) updateData.description = body.description;
    if (body.type !== undefined) updateData.type = body.type;
    if (body.date !== undefined) updateData.date = new Date(body.date);

    const updated = await transactionService.updateTransaction(id, session.user.id, updateData);

    if (!updated) {
      return NextResponse.json({ error: '記錄不存在或無權限' }, { status: 404 });
    }

    return NextResponse.json({ success: true, transaction: updated });
  } catch (error) {
    logger.error('Error updating transaction', error as Error);
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
}

// DELETE - 刪除記帳記錄
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
    const deleted = await transactionService.deleteTransaction(id, session.user.id);

    if (!deleted) {
      return NextResponse.json({ error: '記錄不存在或無權限' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting transaction', error as Error);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}

