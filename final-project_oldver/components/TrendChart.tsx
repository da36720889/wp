'use client';

import { useEffect, useState } from 'react';

interface TrendData {
  labels: string[];
  income: number[];
  expense: number[];
}

type Period = 'day' | 'week' | 'month' | 'year';

export default function TrendChart() {
  const [period, setPeriod] = useState<Period>('month');
  const [data, setData] = useState<TrendData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrends();
  }, [period]);

  const fetchTrends = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/trends?period=${period}`);
      if (!response.ok) throw new Error('載入失敗');
      const trendData = await response.json();
      setData(trendData);
    } catch (error) {
      console.error('Error fetching trends:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="text-center text-gray-500">載入中...</div>
      </div>
    );
  }

  if (!data || data.labels.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">消費趨勢</h2>
        <div className="py-12 text-center text-gray-500">尚無數據</div>
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.income,
    ...data.expense,
    1000 // 最小顯示範圍
  );

  const chartHeight = 300;
  // 根據週期計算圖表寬度
  // 週、月、年使用相同的固定寬度（基於月視圖的寬度：12個月 * 80 + 110 = 1070）
  let chartWidth: number;
  
  if (period === 'day') {
    // 日視圖：30天，使用動態計算
    const minDataPointWidth = 35;
    const calculatedWidth = data.labels.length * minDataPointWidth + 110;
    chartWidth = Math.min(1200, Math.max(900, calculatedWidth));
  } else {
    // 週、月、年：使用相同的固定寬度，確保長度一致
    // 月視圖：12個月 * 80 + 110 = 1070
    // 週和年也使用相同的寬度
    const fixedWidth = 12 * 80 + 110; // 1070，與月視圖一致
    chartWidth = fixedWidth;
  }
  const padding = { top: 20, right: 40, bottom: 50, left: 70 };
  const graphWidth = chartWidth - padding.left - padding.right;
  const graphHeight = chartHeight - padding.top - padding.bottom;

  const getX = (index: number) => {
    return padding.left + (index / (data.labels.length - 1 || 1)) * graphWidth;
  };

  const getY = (value: number) => {
    return padding.top + graphHeight - (value / maxValue) * graphHeight;
  };

  // 生成收入折線路徑
  const incomePath = data.income
    .map((value, index) => {
      const x = getX(index);
      const y = getY(value);
      return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  // 生成支出折線路徑
  const expensePath = data.expense
    .map((value, index) => {
      const x = getX(index);
      const y = getY(value);
      return index === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
    })
    .join(' ');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const periodLabels: Record<Period, string> = {
    day: '日',
    week: '週',
    month: '月',
    year: '年',
  };

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">消費趨勢</h2>
        <div className="flex gap-2">
          {(['day', 'week', 'month', 'year'] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {periodLabels[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto overflow-y-visible">
        <svg 
          width={chartWidth} 
          height={chartHeight} 
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          className="w-full max-w-full"
          style={{ minWidth: chartWidth }}
        >
          {/* 網格線 */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + graphHeight - graphHeight * ratio;
            const value = maxValue * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + graphWidth}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  className="text-xs fill-gray-500"
                >
                  {formatCurrency(value)}
                </text>
              </g>
            );
          })}

          {/* X 軸標籤 */}
          {data.labels.map((label, index) => {
            const x = getX(index);
            // 日、週、月：顯示所有標籤；年：顯示所有標籤
            const showLabel = true;
            
            return (
              <text
                key={index}
                x={x}
                y={chartHeight - padding.bottom + 20}
                textAnchor="middle"
                className="text-xs fill-gray-600"
                transform={
                  data.labels.length > 15 && period !== 'week'
                    ? `rotate(-45 ${x} ${chartHeight - padding.bottom + 20})`
                    : ''
                }
              >
                {label}
              </text>
            );
          })}

          {/* 收入折線 */}
          <path
            d={incomePath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 支出折線 */}
          <path
            d={expensePath}
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* 收入數據點 */}
          {data.income.map((value, index) => {
            if (value === 0) return null;
            const x = getX(index);
            const y = getY(value);
            return (
              <circle
                key={`income-${index}`}
                cx={x}
                cy={y}
                r="4"
                fill="#10b981"
                className="hover:r-6 transition-all"
              />
            );
          })}

          {/* 支出數據點 */}
          {data.expense.map((value, index) => {
            if (value === 0) return null;
            const x = getX(index);
            const y = getY(value);
            return (
              <circle
                key={`expense-${index}`}
                cx={x}
                cy={y}
                r="4"
                fill="#ef4444"
                className="hover:r-6 transition-all"
              />
            );
          })}
        </svg>
      </div>

      {/* 圖例 */}
      <div className="mt-4 flex items-center justify-center gap-6">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-green-500"></div>
          <span className="text-sm text-gray-600">收入</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500"></div>
          <span className="text-sm text-gray-600">支出</span>
        </div>
      </div>
    </div>
  );
}

