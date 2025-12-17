import { NextRequest, NextResponse } from 'next/server';
import { validateSignature, WebhookEvent } from '@line/bot-sdk';
import { getLineMiddlewareConfig } from '@/lib/services/line.service';
import { LineService } from '@/lib/services/line.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

const lineService = new LineService();

export async function POST(request: NextRequest) {
  try {
    // 連接資料庫
    await connectDB();

    // 處理 LINE Webhook
    const body = await request.text();
    const signature = request.headers.get('x-line-signature');

    if (!signature) {
      return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
    }

    // 驗證簽名
    const lineMiddlewareConfig = getLineMiddlewareConfig();
    const isValid = validateSignature(body, lineMiddlewareConfig.channelSecret!, signature);

    if (!isValid) {
      // 開發環境允許跳過驗證
      if (process.env.NODE_ENV === 'development') {
        logger.warn('Signature validation failed in development mode, proceeding anyway');
      } else {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    // 解析事件
    const parsed = JSON.parse(body) as { events?: WebhookEvent[]; destination?: string };
    const events = parsed.events || [];

    logger.info('Received webhook request', { 
      eventCount: events.length,
      destination: parsed.destination,
      hasEvents: events.length > 0
    });

    // 如果沒有事件，這是正常的（可能是驗證請求或空請求）
    if (events.length === 0) {
      return NextResponse.json({ success: true, message: 'No events to process' });
    }

    // 處理每個事件
    const promises = events.map(async (event) => {
      try {
        logger.info('Processing event', { 
          type: event.type, 
          sourceType: event.source?.type,
          userId: event.source?.userId 
        });

        if (event.type === 'message' && event.message.type === 'text') {
          await lineService.handleMessage(event);
        } else {
          logger.info('Skipping event', { type: event.type });
        }
      } catch (error) {
        logger.error('Error processing event', error as Error, { eventType: event.type });
        // 不拋出錯誤，繼續處理其他事件
      }
    });

    await Promise.all(promises);

    return NextResponse.json({ success: true, processedEvents: events.length });
  } catch (error) {
    logger.error('Webhook error', error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// 處理 GET 請求（用於 LINE Webhook 驗證）
export async function GET() {
  return NextResponse.json({ message: 'LINE Bot Webhook is running' });
}
