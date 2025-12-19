import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { TransactionService } from '@/lib/services/transaction.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const transactionService = new TransactionService();

// GET - 匯出 CSV
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
        }
      );
    }

    await connectDB();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate') ? new Date(searchParams.get('startDate')!) : undefined;
    const endDate = searchParams.get('endDate') ? new Date(searchParams.get('endDate')!) : undefined;

    // 獲取所有交易記錄
    const { transactions } = await transactionService.getTransactions({
      userId: session.user.id,
      startDate,
      endDate,
      limit: 10000,
      offset: 0,
    });

    // 生成 CSV 內容
    const headers = ['日期', '類型', '類別', '金額', '描述'];
    const rows = transactions.map((t) => {
      const date = new Date(t.date).toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      const type = t.type === 'income' ? '收入' : '支出';
      return [date, type, t.category, t.amount.toString(), t.description || ''];
    });

    // 組合 CSV
    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    // 添加 BOM 以支援 Excel 正確顯示中文
    const BOM = '\uFEFF';
    const csvWithBOM = BOM + csvContent;

    // 使用 Buffer 確保正確的編碼
    const csvBuffer = Buffer.from(csvWithBOM, 'utf-8');

    return new NextResponse(csvBuffer, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent('記帳記錄')}_${new Date().toISOString().split('T')[0]}.csv`,
      },
    });
  } catch (error) {
    logger.error('Error exporting CSV', error as Error);
    return NextResponse.json(
      { error: 'Export failed', message: error instanceof Error ? error.message : String(error) },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      }
    );
  }
}

