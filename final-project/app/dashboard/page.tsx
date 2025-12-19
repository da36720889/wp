'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import TransactionList from '@/components/TransactionList';
import TransactionForm from '@/components/TransactionForm';
import SummaryCard from '@/components/SummaryCard';
import LineLinkCard from '@/components/LineLinkCard';
import TrendChart from '@/components/TrendChart';
import BudgetCard from '@/components/BudgetCard';
import CategoryChart from '@/components/CategoryChart';
import SavingsGoalCard from '@/components/SavingsGoalCard';
import PetDisplay from '@/components/PetDisplay';
import { Button, Menu, MenuItem } from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);

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
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={(e) => setExportMenuAnchor(e.currentTarget)}
              >
                匯出
              </Button>
              <Menu
                anchorEl={exportMenuAnchor}
                open={Boolean(exportMenuAnchor)}
                onClose={() => setExportMenuAnchor(null)}
              >
                <MenuItem
                  onClick={() => {
                    window.location.href = '/api/export';
                    setExportMenuAnchor(null);
                  }}
                >
                  <DownloadIcon sx={{ mr: 1 }} fontSize="small" />
                  CSV 格式
                </MenuItem>
              </Menu>
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

        {/* 預算和類別分析 */}
        <div className="mb-6 grid gap-6 md:grid-cols-2">
          <BudgetCard />
          <CategoryChart />
        </div>

        {/* 儲蓄目標 */}
        <div className="mb-6">
          <SavingsGoalCard />
        </div>

        {/* 電子雞 */}
        <div className="mb-6">
          <PetDisplay />
        </div>

        {/* 交易列表和側邊欄 */}
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <TransactionList />
          </div>
          <div className="lg:col-span-1 space-y-6">
            <LineLinkCard />
            <div>
              <TransactionForm />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

