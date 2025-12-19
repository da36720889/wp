import { GoogleGenerativeAI } from '@google/generative-ai';
import { EmailMessage } from './gmail.service';
import { ParsedTransaction } from './llm.service';
import { logger } from '@/lib/utils/logger';

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

export class EmailParserService {
  /**
   * 使用 LLM 解析郵件內容，提取交易資訊
   */
  async parseEmail(email: EmailMessage): Promise<ParsedTransaction | null> {
    try {
      const genAI = getGeminiClient();
      if (!genAI) {
        logger.warn('Gemini API key not configured, skipping email parsing');
        return null;
      }

      const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: '你是一個記帳助手，專門從郵件內容（發票、帳單、收據）中提取交易資訊並回傳 JSON 格式的資料。只回傳 JSON，不要其他文字。',
      });

      const prompt = `請分析以下郵件內容，判斷是否為帳單、發票或收據：

標題：${email.subject}
發件人：${email.from}
日期：${email.date.toISOString()}
內容：
${email.body.substring(0, 2000)}${email.body.length > 2000 ? '...' : ''}

如果這是帳單、發票或收據，請提取以下資訊並以 JSON 格式返回：
{
  "isTransaction": true,
  "amount": 金額（數字，例如：100）,
  "description": "交易描述/商家名稱",
  "category": "分類（餐飲、交通、購物、娛樂、醫療、教育、房租、水電、通訊、其他）",
  "type": "income 或 expense",
  "date": "交易日期（ISO 8601 格式，如果郵件中有日期則使用，否則使用郵件日期）",
  "confidence": 0.0-1.0（解析的置信度）
}

如果不是交易相關郵件，返回：
{
  "isTransaction": false,
  "confidence": 0.0
}

只返回 JSON，不要其他文字。`;

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
      let transactionDate: Date;
      if (parsed.date) {
        transactionDate = new Date(parsed.date);
        if (isNaN(transactionDate.getTime())) {
          transactionDate = email.date; // 如果日期無效，使用郵件日期
        }
      } else {
        transactionDate = email.date;
      }

      return {
        amount,
        description: parsed.description || email.subject,
        category: parsed.category || '其他',
        type: parsed.type === 'income' ? 'income' : 'expense',
        date: transactionDate,
      };
    } catch (error) {
      logger.error('Error parsing email', error as Error, { emailId: email.id });
      return null;
    }
  }

  /**
   * 快速判斷郵件是否可能是帳單（避免不必要的 LLM 調用）
   */
  isLikelyReceipt(email: EmailMessage): boolean {
    const receiptKeywords = [
      '發票',
      '帳單',
      '收據',
      'receipt',
      'invoice',
      'bill',
      'payment',
      '付款',
      '消費',
      '交易',
      '金額',
      '元',
      'NT$',
      'TWD',
    ];

    const text = `${email.subject} ${email.snippet}`.toLowerCase();
    return receiptKeywords.some((keyword) => text.includes(keyword.toLowerCase()));
  }
}

