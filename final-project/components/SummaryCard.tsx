'use client';

import { useEffect, useState } from 'react';

interface Summary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

export default function SummaryCard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch('/api/summary');
        if (!response.ok) throw new Error('載入失敗');
        const data = await response.json();
        setSummary(data);
      } catch (error) {
        console.error('Error fetching summary:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="text-center text-gray-500">載入中...</div>
      </div>
    );
  }

  if (!summary) {
    return null;
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-2 text-sm font-medium text-gray-500">總收入</div>
        <div className="text-2xl font-semibold text-gray-900">{formatCurrency(summary.totalIncome)}</div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-2 text-sm font-medium text-gray-500">總支出</div>
        <div className="text-2xl font-semibold text-gray-900">{formatCurrency(summary.totalExpense)}</div>
      </div>
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-2 text-sm font-medium text-gray-500">餘額</div>
        <div className={`text-2xl font-semibold ${summary.balance >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
          {formatCurrency(summary.balance)}
        </div>
      </div>
    </div>
  );
}

