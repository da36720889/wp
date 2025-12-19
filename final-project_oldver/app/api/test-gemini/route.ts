import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

/**
 * GET /api/test-gemini
 * 測試 Gemini API 並列出可用的模型
 */
export async function GET() {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // 測試幾個常見的模型名稱
    const testModels = [
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro-latest',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
      'gemini-pro',
      'gemini-2.5-flash',
    ];

    const results = [];
    for (const modelName of testModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        // 嘗試生成一個簡單的測試請求
        const result = await model.generateContent('test');
        const response = result.response;
        results.push({ 
          model: modelName, 
          status: 'available',
          response: response.text().substring(0, 50) // 只取前50個字符
        });
      } catch (error: any) {
        results.push({
          model: modelName,
          status: 'error',
          error: error.message || String(error),
          statusCode: error.status,
        });
      }
    }

    return NextResponse.json({
      success: true,
      testResults: results,
      currentModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash-latest',
      apiKeyConfigured: !!apiKey,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to test Gemini API',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}

