import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';
import TransactionTemplate from '@/lib/models/TransactionTemplate';

// PUT - 更新模板
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
    const { name, amount, category, description, type } = body;

    const template = await TransactionTemplate.findOne({ _id: id, userId: session.user.id });
    if (!template) {
      return NextResponse.json({ error: '找不到模板' }, { status: 404 });
    }

    if (name) template.name = name;
    if (amount !== undefined) template.amount = parseFloat(amount);
    if (category) template.category = category;
    if (description !== undefined) template.description = description;
    if (type && (type === 'income' || type === 'expense')) template.type = type;

    await template.save();

    return NextResponse.json({
      _id: template._id.toString(),
      name: template.name,
      amount: template.amount,
      category: template.category,
      description: template.description,
      type: template.type,
    });
  } catch (error) {
    logger.error('Error updating template', error as Error);
    return NextResponse.json({ error: '更新失敗' }, { status: 500 });
  }
}

// DELETE - 刪除模板
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
    const result = await TransactionTemplate.deleteOne({ _id: id, userId: session.user.id });

    if (result.deletedCount === 0) {
      return NextResponse.json({ error: '找不到模板' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Error deleting template', error as Error);
    return NextResponse.json({ error: '刪除失敗' }, { status: 500 });
  }
}

