import { GoogleGenerativeAI } from '@google/generative-ai';

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

export interface ParsedTransaction {
  amount: number;
  description: string;
  category: string;
  transactionDate?: Date;
  merchantName?: string;
  paymentMethod?: 'line_pay' | 'cash' | 'card' | 'other';
  confidence: number; // 0-1，解析的置信度
}

export class NotificationParserService {
  /**
   * 使用 LLM 解析通知內容，提取交易資訊
   */
  async parseNotification(notificationText: string): Promise<ParsedTransaction | null> {
    const prompt = `請分析以下通知訊息，判斷是否為消費/交易通知，並提取相關資訊。

通知內容：「${notificationText}」

請判斷這是否為一筆消費或交易通知（例如：LINE Pay 付款、電子發票、信用卡消費等）。

如果是交易通知，請提取以下資訊並以 JSON 格式返回：
{
  "isTransaction": true/false,
  "amount": 金額（數字，例如：100）,
  "description": "交易描述/商家名稱",
  "category": "分類（餐飲、交通、購物、娛樂、醫療、教育、房租、水電、通訊、其他）",
  "merchantName": "商家名稱（如果有）",
  "paymentMethod": "付款方式（line_pay、cash、card、other）",
  "transactionDate": "交易日期（ISO 8601 格式，如果沒有則使用今天）",
  "confidence": 0.0-1.0（解析的置信度）
}

如果不是交易通知，返回：
{
  "isTransaction": false,
  "confidence": 0.0
}

只返回 JSON，不要其他文字。`;

    try {
      // 使用 LLM 解析通知
      const genAI = getGeminiClient();
      if (!genAI) {
        return null;
      }

      const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: '你是一個記帳助手，專門解析通知訊息並回傳 JSON 格式的資料。只回傳 JSON，不要其他文字。',
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      });

      const response = result.response;
      const content = response.text();
      if (!content) {
        return null;
      }

      const parsed = JSON.parse(content);

      if (!parsed.isTransaction || parsed.confidence < 0.5) {
        return null;
      }

      // 驗證金額
      const amount = parseFloat(parsed.amount);
      if (isNaN(amount) || amount <= 0) {
        return null;
      }

      // 解析日期
      let transactionDate: Date | undefined;
      if (parsed.transactionDate) {
        transactionDate = new Date(parsed.transactionDate);
        if (isNaN(transactionDate.getTime())) {
          transactionDate = new Date(); // 如果日期無效，使用今天
        }
      } else {
        transactionDate = new Date(); // 預設為今天
      }

      return {
        amount,
        description: parsed.description || '未命名交易',
        category: parsed.category || '其他',
        transactionDate,
        merchantName: parsed.merchantName,
        paymentMethod: parsed.paymentMethod || 'line_pay',
        confidence: parsed.confidence || 0.5,
      };
    } catch (error: any) {
      console.error('[NotificationParserService] Parse error:', error);
      return null;
    }
  }

  /**
   * 判斷通知是否可能是交易通知（快速檢查，避免不必要的 LLM 調用）
   */
  isLikelyTransaction(notificationText: string): boolean {
    const lowerText = notificationText.toLowerCase();

    // 交易相關關鍵字
    const transactionKeywords = [
      '付款',
      '消費',
      '支出',
      '扣款',
      '交易',
      '發票',
      'invoice',
      'payment',
      'paid',
      'charged',
      '元',
      'nt$',
      '$',
      'line pay',
      '信用卡',
      '電子發票',
      '已付款',
      '付款成功',
      '消費通知',
    ];

    // 金額模式（數字 + 元/NT$/NTD）
    const amountPattern = /\d+[元萬千]|nt\$\d+|\$\d+|ntd\s*\d+/i;

    // 檢查是否包含交易關鍵字或金額模式
    const hasKeyword = transactionKeywords.some((keyword) => lowerText.includes(keyword));
    const hasAmount = amountPattern.test(notificationText);

    return hasKeyword || hasAmount;
  }

  /**
   * 常用分類列表
   */
  getCommonCategories(): string[] {
    return [
      '餐飲',
      '交通',
      '購物',
      '娛樂',
      '醫療',
      '教育',
      '房租',
      '水電',
      '通訊',
      '其他',
    ];
  }
}

export const notificationParserService = new NotificationParserService();

