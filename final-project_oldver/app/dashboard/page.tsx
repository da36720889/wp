'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import TransactionList from '@/components/TransactionList';
import TransactionForm from '@/components/TransactionForm';
import SummaryCard from '@/components/SummaryCard';
import LineLinkCard from '@/components/LineLinkCard';
import TrendChart from '@/components/TrendChart';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-lg">載入中...</div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 導航欄 */}
      <nav className="sticky top-0 z-50 border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">記帳助手</h1>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden text-sm text-gray-600 sm:block">{session.user?.email}</span>
              <button
                onClick={() => signOut({ callbackUrl: '/auth/signin' })}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                登出
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* 主內容區 */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        {/* 摘要卡片 */}
        <div className="mb-6">
          <SummaryCard />
        </div>

        {/* 趨勢圖表 */}
        <div className="mb-6">
          <TrendChart />
        </div>

        {/* 交易列表和側邊欄 */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TransactionList />
          </div>
          <div className="lg:col-span-1 space-y-6">
            <LineLinkCard />
            <TransactionForm />
          </div>
        </div>
      </main>
    </div>
  );
}

