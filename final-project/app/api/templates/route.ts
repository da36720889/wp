import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';
import TransactionTemplate from '@/lib/models/TransactionTemplate';

// GET - 獲取所有模板
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') as 'income' | 'expense' | null;

    const filter: { userId: string; type?: string } = { userId: session.user.id };
    if (type === 'income' || type === 'expense') {
      filter.type = type;
    }

    const templates = await TransactionTemplate.find(filter).sort({ createdAt: -1 });

    return NextResponse.json({
      templates: templates.map((t) => ({
        _id: t._id.toString(),
        name: t.name,
        amount: t.amount,
        category: t.category,
        description: t.description,
        type: t.type,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    });
  } catch (error) {
    logger.error('Error fetching templates', error as Error);
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 });
  }
}

// POST - 創建模板
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const body = await request.json();
    const { name, amount, category, description, type } = body;

    if (!name || !amount || !category || !type) {
      return NextResponse.json({ error: '請提供完整的模板資訊' }, { status: 400 });
    }

    if (type !== 'income' && type !== 'expense') {
      return NextResponse.json({ error: '類型必須是 income 或 expense' }, { status: 400 });
    }

    const template = await TransactionTemplate.create({
      userId: session.user.id,
      name,
      amount: parseFloat(amount),
      category,
      description: description || '',
      type,
    });

    return NextResponse.json({
      _id: template._id.toString(),
      name: template.name,
      amount: template.amount,
      category: template.category,
      description: template.description,
      type: template.type,
    });
  } catch (error) {
    logger.error('Error creating template', error as Error);
    return NextResponse.json({ error: '創建失敗' }, { status: 500 });
  }
}

