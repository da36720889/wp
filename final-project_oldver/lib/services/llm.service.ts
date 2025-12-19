import { GoogleGenerativeAI } from '@google/generative-ai';

function getGeminiClient(): GoogleGenerativeAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenerativeAI(apiKey);
}

export interface ParsedTransaction {
  amount: number;
  category: string;
  description?: string;
  type: 'income' | 'expense';
  date?: Date;
}

export class LLMService {
  /**
   * 使用正則表達式解析記帳訊息（備用方案）
   */
  private parseWithRegex(message: string): ParsedTransaction | null {
    // 移除多餘空格
    const cleaned = message.trim().replace(/\s+/g, ' ');
    
    // 匹配金額（支持各種格式：150、150元、150 元、NT$150等）
    const amountMatch = cleaned.match(/(\d+(?:\.\d+)?)\s*[元塊]?/);
    if (!amountMatch) {
      return null;
    }
    
    const amount = parseFloat(amountMatch[1]);
    if (isNaN(amount) || amount <= 0) {
      return null;
    }
    
    // 判斷是否為收入（包含「收入」、「薪資」、「薪水」等關鍵字）
    const isIncome = /收入|薪資|薪水|獎金|紅利/i.test(cleaned);
    const type: 'income' | 'expense' = isIncome ? 'income' : 'expense';
    
    // 提取類別和描述
    // 移除金額部分
    let description = cleaned.replace(/(\d+(?:\.\d+)?)\s*[元塊]?/g, '').trim();
    description = description.replace(/^(收入|支出|花了|花了|買了|付了|收到|獲得)\s*/i, '').trim();
    
    // 常見類別映射
    const categoryMap: Record<string, string> = {
      '午餐': '餐飲',
      '晚餐': '餐飲',
      '早餐': '餐飲',
      '餐飲': '餐飲',
      '吃飯': '餐飲',
      '交通': '交通',
      '車費': '交通',
      '捷運': '交通',
      '公車': '交通',
      '計程車': '交通',
      '購物': '購物',
      '買': '購物',
      '書': '購物',
      '衣服': '購物',
      '娛樂': '娛樂',
      '電影': '娛樂',
      '遊戲': '娛樂',
      '醫療': '醫療',
      '看病': '醫療',
      '藥': '醫療',
      '教育': '教育',
      '學費': '教育',
      '房租': '房租',
      '水電': '水電',
      '電費': '水電',
      '水費': '水電',
      '通訊': '通訊',
      '電話': '通訊',
      '網路': '通訊',
      '薪資': '薪資',
      '薪水': '薪資',
      '收入': '薪資',
    };
    
    // 查找類別
    let category = '其他';
    for (const [key, value] of Object.entries(categoryMap)) {
      if (description.includes(key)) {
        category = value;
        break;
      }
    }
    
    // 如果沒有找到類別，使用描述的前幾個字作為類別
    if (category === '其他' && description) {
      category = description.substring(0, 4) || '其他';
    }
    
    return {
      amount,
      category,
      type,
      description: description || undefined,
    };
  }

  async parseTransactionMessage(message: string): Promise<ParsedTransaction | null> {
    // 先嘗試使用正則表達式解析（快速且可靠）
    const regexResult = this.parseWithRegex(message);
    if (regexResult) {
      console.log('Parsed with regex:', regexResult);
      return regexResult;
    }
    
    // 如果正則解析失敗，嘗試使用 LLM（如果可用）
    try {
      const genAI = getGeminiClient();
      if (!genAI) {
        console.warn('Gemini API key not configured - check GEMINI_API_KEY environment variable');
        return null;
      }

      const systemInstruction =
        '你是一個記帳助手，專門解析記帳訊息並回傳 JSON 格式的資料。只回傳 JSON，不要其他文字。';

      const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction,
      });

      const prompt = `你是一個記帳助手。請從以下訊息中提取記帳資訊，並以 JSON 格式回傳。
規則：
1. 金額必須是正數
2. 類型：收入用 "income"，支出用 "expense"（預設為 "expense"）
3. 類別：簡短的中文類別名稱（如：餐飲、交通、購物、薪資等）
4. 描述：可選，如果訊息中有額外說明則包含
5. 日期：如果訊息中有日期，解析為 ISO 格式；否則省略此欄位

重要：即使訊息格式不完整，也要盡可能提取資訊。例如：
- "午餐 150" -> {"amount": 150, "category": "餐飲", "type": "expense", "description": "午餐"}
- "150元 午餐" -> {"amount": 150, "category": "餐飲", "type": "expense", "description": "午餐"}
- "午餐 150元" -> {"amount": 150, "category": "餐飲", "type": "expense", "description": "午餐"}

訊息範例：
- "今天午餐花了 150 元" -> {"amount": 150, "category": "餐飲", "type": "expense", "description": "午餐"}
- "收入 5000 元薪資" -> {"amount": 5000, "category": "薪資", "type": "income"}
- "買書 300 元" -> {"amount": 300, "category": "購物", "type": "expense", "description": "買書"}

請解析以下訊息：
"${message}"

只回傳 JSON 格式，不要其他文字。`;

      console.log('Calling Gemini API to parse message:', message);
      
      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.3,
          responseMimeType: 'application/json',
        },
      });

      const response = result.response;
      const content = response.text();
      
      console.log('Gemini API response:', content);
      
      if (!content) {
        console.warn('Gemini API returned empty response');
        return null;
      }

      // 嘗試清理可能的 markdown 代碼塊
      let cleanedContent = content.trim();
      if (cleanedContent.startsWith('```json')) {
        cleanedContent = cleanedContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
      } else if (cleanedContent.startsWith('```')) {
        cleanedContent = cleanedContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const parsed = JSON.parse(cleanedContent) as ParsedTransaction;
      
      // 驗證解析結果
      if (!parsed.amount || parsed.amount <= 0) {
        console.warn('Invalid amount in parsed result:', parsed);
        return null;
      }
      
      if (!parsed.category) {
        console.warn('Missing category in parsed result:', parsed);
        return null;
      }
      
      if (!parsed.type || (parsed.type !== 'income' && parsed.type !== 'expense')) {
        // 預設為支出
        parsed.type = 'expense';
      }
      
      console.log('Successfully parsed transaction:', parsed);
      return parsed;
    } catch (error) {
      console.error('LLM parsing error:', error);
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }
      return null;
    }
  }

  async generateResponse(
    context: string,
    userMessage: string
  ): Promise<string> {
    try {
      const genAI = getGeminiClient();
      if (!genAI) {
        return '抱歉，LLM 服務未配置。';
      }

      const systemInstruction = `你是一個友善的記帳機器人助手。以下是使用者的記帳摘要：\n${context}\n\n請用簡短、友善的中文回覆使用者。`;

      const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest';
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction,
      });

      const result = await model.generateContent({
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 200,
        },
      });

      const response = result.response;
      return response.text() || '抱歉，我無法理解您的訊息。';
    } catch (error) {
      console.error('LLM response generation error:', error);
      return '抱歉，處理您的請求時發生錯誤。';
    }
  }
}

