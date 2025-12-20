'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Box, AppBar, Toolbar, Typography, Button, Menu, MenuItem } from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import TransactionList from '@/components/TransactionList';
import TransactionForm from '@/components/TransactionForm';
import TemplateManager from '@/components/TemplateManager';
import TrendChart from '@/components/TrendChart';
import BudgetCard from '@/components/BudgetCard';
import CategoryChart from '@/components/CategoryChart';
import SavingsGoalCard from '@/components/SavingsGoalCard';
import PetDisplay from '@/components/PetDisplay';
import Sidebar, { SidebarPage } from '@/components/Sidebar';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState<SidebarPage>('home');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [exportMenuAnchor, setExportMenuAnchor] = useState<null | HTMLElement>(null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin');
    }
  }, [status, router]);

  const handleMobileToggle = () => {
    setMobileOpen(!mobileOpen);
  };

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

  // 渲染當前頁面內容
  const renderPageContent = () => {
    switch (currentPage) {
      case 'home':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {/* 電子雞 */}
            <PetDisplay />
            
            {/* 記帳和模板（中間並排） */}
            <Box sx={{ display: 'grid', gap: 3, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
              <TransactionForm />
              <TemplateManager onUseTemplate={(template) => {
                // 觸發自定義事件，讓 TransactionForm 接收模板數據
                window.dispatchEvent(new CustomEvent('useTemplate', { detail: template }));
              }} />
            </Box>
            
            {/* 記帳記錄（最下方） */}
            <TransactionList />
          </Box>
        );
      case 'analytics':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <TrendChart />
            <CategoryChart />
          </Box>
        );
      case 'budget':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <BudgetCard />
          </Box>
        );
      case 'savings':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <SavingsGoalCard />
          </Box>
        );
      default:
        return null;
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#f9fafb' }}>
      {/* 側邊欄 */}
      <Sidebar
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        mobileOpen={mobileOpen}
        onMobileToggle={handleMobileToggle}
      />

      {/* 主內容區 */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: '100%', md: 'calc(100% - 240px)' },
          ml: { xs: 0, md: '240px' },
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          overflowX: 'hidden',
        }}
      >
        {/* 頂部導航欄 */}
        <AppBar
          position="static"
          elevation={0}
          sx={{
            bgcolor: 'white',
            borderBottom: '1px solid #e5e7eb',
            color: '#111827',
            zIndex: 1100,
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between', px: { xs: 2, md: 3 } }}>
            <Typography variant="h6" sx={{ fontWeight: 600, color: '#111827' }}>
              {currentPage === 'home' ? '首頁' :
               currentPage === 'analytics' ? '統計分析' :
               currentPage === 'budget' ? '預算管理' :
               currentPage === 'savings' ? '儲蓄目標' : '記帳助手'}
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={(e) => setExportMenuAnchor(e.currentTarget)}
                sx={{ display: { xs: 'none', sm: 'flex' } }}
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
            </Box>
          </Toolbar>
        </AppBar>

        {/* 頁面內容 */}
        <Box sx={{ flexGrow: 1, p: { xs: 2, md: 3 }, mt: { xs: 8, md: 0 } }}>
          {renderPageContent()}
        </Box>
      </Box>
    </Box>
  );
}

