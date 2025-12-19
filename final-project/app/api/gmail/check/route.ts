import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { GmailService } from '@/lib/services/gmail.service';
import { EmailParserService } from '@/lib/services/emailParser.service';
import { TransactionService } from '@/lib/services/transaction.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const gmailService = new GmailService();
const emailParserService = new EmailParserService();
const transactionService = new TransactionService();

// POST - 檢查 Gmail 並匯入帳單
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    // 檢查是否已授權 Gmail
    const isAuthorized = await gmailService.isGmailAuthorized(session.user.id);
    if (!isAuthorized) {
      return NextResponse.json({ error: '尚未授權 Gmail 存取' }, { status: 400 });
    }

    // 獲取最近的郵件
    const emails = await gmailService.getRecentEmails(session.user.id, 20);

    let importedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    for (const email of emails) {
      try {
        // 快速判斷是否可能是帳單
        if (!emailParserService.isLikelyReceipt(email)) {
          skippedCount++;
          continue;
        }

        // 使用 LLM 解析郵件
        const parsed = await emailParserService.parseEmail(email);
        if (!parsed) {
          skippedCount++;
          continue;
        }

        // 檢查是否已經匯入過（根據郵件 ID）
        // 這裡可以建立一個 EmailImport 記錄來追蹤已匯入的郵件
        // 暫時跳過重複檢查，直接創建交易

        // 創建交易記錄
        await transactionService.createTransaction(session.user.id, {
          amount: parsed.amount,
          category: parsed.category,
          description: `${parsed.description} (來自 Gmail: ${email.subject})`,
          type: parsed.type,
          date: parsed.date || new Date(),
        });

        importedCount++;
        logger.info('Imported transaction from email', {
          userId: session.user.id,
          emailId: email.id,
          amount: parsed.amount,
        });
      } catch (error) {
        logger.error('Error processing email', error as Error, { emailId: email.id });
        errors.push(`郵件 ${email.subject}: ${error instanceof Error ? error.message : '未知錯誤'}`);
      }
    }

    return NextResponse.json({
      success: true,
      imported: importedCount,
      skipped: skippedCount,
      total: emails.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    logger.error('Error checking Gmail', error as Error);
    return NextResponse.json(
      {
        error: '檢查失敗',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

// GET - 檢查 Gmail 授權狀態
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授權' }, { status: 401 });
    }

    await connectDB();

    const isAuthorized = await gmailService.isGmailAuthorized(session.user.id);
    const user = await import('@/lib/models/User').then((m) => m.default);
    const dbUser = await user.findById(session.user.id);

    return NextResponse.json({
      authorized: isAuthorized,
      enabled: dbUser?.gmailEnabled || false,
    });
  } catch (error) {
    logger.error('Error checking Gmail status', error as Error);
    return NextResponse.json({ error: '查詢失敗' }, { status: 500 });
  }
}

