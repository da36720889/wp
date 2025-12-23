'use client';

import { useState, useEffect } from 'react';
import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Divider, IconButton, Tooltip, Avatar, Menu, MenuItem, Typography, TextField, Button, Alert } from '@mui/material';
import {
  Home as HomeIcon,
  Analytics as AnalyticsIcon,
  AccountBalanceWallet as BudgetIcon,
  Savings as SavingsIcon,
  Menu as MenuIcon,
  Close as CloseIcon,
  Logout as LogoutIcon,
  CheckCircle as CheckCircleIcon,
  Link as LinkIcon,
  LinkOff as LinkOffIcon,
} from '@mui/icons-material';
import { signOut } from 'next-auth/react';
import { useSession } from 'next-auth/react';

export type SidebarPage = 'home' | 'analytics' | 'budget' | 'savings';

interface SidebarProps {
  currentPage: SidebarPage;
  onPageChange: (page: SidebarPage) => void;
  mobileOpen: boolean;
  onMobileToggle: () => void;
}

const menuItems: Array<{ id: SidebarPage; label: string; icon: React.ReactNode }> = [
  { id: 'home', label: '首頁', icon: <HomeIcon /> },
  { id: 'analytics', label: '統計分析', icon: <AnalyticsIcon /> },
  { id: 'budget', label: '預算管理', icon: <BudgetIcon /> },
  { id: 'savings', label: '儲蓄目標', icon: <SavingsIcon /> },
];

export default function Sidebar({ currentPage, onPageChange, mobileOpen, onMobileToggle }: SidebarProps) {
  const drawerWidth = 240;
  const { data: session } = useSession();
  const [userMenuAnchor, setUserMenuAnchor] = useState<null | HTMLElement>(null);
  const [linkStatus, setLinkStatus] = useState<{ linked: boolean; lineUserId: string | null } | null>(null);
  const [lineUserId, setLineUserId] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [linkMessage, setLinkMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch LINE link status
  useEffect(() => {
    fetchLinkStatus();
  }, []);

  const fetchLinkStatus = async () => {
    try {
      const response = await fetch('/api/link-line');
      if (response.ok) {
        const data = await response.json();
        setLinkStatus(data);
      }
    } catch (error) {
      console.error('Error fetching link status:', error);
    }
  };

  const handleLink = async () => {
    if (!lineUserId.trim()) {
      setLinkMessage({ type: 'error', text: '請輸入 LINE 用戶 ID' });
      return;
    }

    setLinking(true);
    setLinkMessage(null);

    try {
      const response = await fetch('/api/link-line', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ lineUserId: lineUserId.trim() }),
      });

      const data = await response.json();

      if (response.ok) {
        setLinkMessage({
          type: 'success',
          text: data.message || '成功關聯 LINE 用戶！',
        });
        setLineUserId('');
        await fetchLinkStatus();
        // 刷新頁面以顯示新的交易記錄
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setLinkMessage({
          type: 'error',
          text: data.error || '關聯失敗',
        });
      }
    } catch (error) {
      setLinkMessage({
        type: 'error',
        text: '關聯時發生錯誤，請稍後再試',
      });
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    if (!confirm('確定要解除 LINE 用戶連結嗎？解除後需要重新連結才能同步 LINE Bot 的記帳記錄。')) {
      return;
    }

    setUnlinking(true);
    setLinkMessage(null);

    try {
      const response = await fetch('/api/unlink-line', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setLinkMessage({
          type: 'success',
          text: data.message || '已成功解除連結',
        });
        await fetchLinkStatus();
        // 刷新頁面
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setLinkMessage({
          type: 'error',
          text: data.error || '解除連結失敗',
        });
      }
    } catch (error) {
      setLinkMessage({
        type: 'error',
        text: '解除連結時發生錯誤，請稍後再試',
      });
    } finally {
      setUnlinking(false);
    }
  };

  const drawerContent = (
    <Box sx={{ width: drawerWidth, height: '100%', bgcolor: '#1f2937', display: 'flex', flexDirection: 'column' }}>
      {/* Logo/Title */}
      <Box sx={{ p: 2, borderBottom: '1px solid #374151' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ color: 'white', fontSize: '16px', fontWeight: 600 }}>記帳助手</Box>
          </Box>
          <IconButton
            onClick={onMobileToggle}
            sx={{ color: 'white', display: { md: 'none' } }}
            size="small"
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Menu Items */}
      <List sx={{ pt: 2, px: 1, flexGrow: 1 }}>
        {menuItems.map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
            <ListItemButton
              onClick={() => {
                onPageChange(item.id);
                if (mobileOpen) {
                  onMobileToggle(); // Close mobile menu after selection
                }
              }}
              sx={{
                borderRadius: '8px',
                py: 1.5,
                px: 2,
                bgcolor: currentPage === item.id ? '#3b82f6' : 'transparent',
                color: currentPage === item.id ? 'white' : '#d1d5db',
                '&:hover': {
                  bgcolor: currentPage === item.id ? '#3b82f6' : '#374151',
                  color: 'white',
                },
                transition: 'all 0.2s',
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 40,
                  color: currentPage === item.id ? 'white' : '#9ca3af',
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontSize: '14px',
                  fontWeight: currentPage === item.id ? 600 : 400,
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      {/* Bottom Section: LINE Link Status and User Account */}
      <Box sx={{ borderTop: '1px solid #374151', p: 2 }}>
        {/* LINE Link Status */}
        {linkStatus?.linked ? (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ mb: 1.5, p: 1.5, bgcolor: '#065f46', borderRadius: '8px' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <CheckCircleIcon sx={{ fontSize: 16, color: '#10b981' }} />
                <Typography variant="caption" sx={{ color: 'white', fontSize: '12px', fontWeight: 500 }}>
                  已連接
                </Typography>
              </Box>
              {linkStatus.lineUserId && (
                <Typography variant="caption" sx={{ color: '#d1d5db', fontSize: '11px', display: 'block' }}>
                  LINE ID: {linkStatus.lineUserId.substring(0, 12)}...
                </Typography>
              )}
            </Box>
            {linkMessage && (
              <Alert 
                severity={linkMessage.type} 
                sx={{ mb: 1, fontSize: '11px', py: 0.5 }}
                onClose={() => setLinkMessage(null)}
              >
                {linkMessage.text}
              </Alert>
            )}
            <Button
              fullWidth
              size="small"
              variant="outlined"
              startIcon={<LinkOffIcon />}
              onClick={handleUnlink}
              disabled={unlinking}
              sx={{
                borderColor: '#ef4444',
                color: '#ef4444',
                fontSize: '12px',
                py: 0.75,
                '&:hover': {
                  borderColor: '#dc2626',
                  bgcolor: 'rgba(239, 68, 68, 0.1)',
                },
                '&:disabled': {
                  borderColor: '#6b7280',
                  color: '#6b7280',
                },
              }}
            >
              {unlinking ? '解除中...' : '解除連結'}
            </Button>
          </Box>
        ) : (
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: '11px', mb: 1, display: 'block' }}>
              LINE Bot 連接
            </Typography>
            {linkMessage && (
              <Alert 
                severity={linkMessage.type} 
                sx={{ mb: 1, fontSize: '11px', py: 0.5 }}
                onClose={() => setLinkMessage(null)}
              >
                {linkMessage.text}
              </Alert>
            )}
            <TextField
              fullWidth
              size="small"
              placeholder="輸入 LINE 用戶 ID"
              value={lineUserId}
              onChange={(e) => setLineUserId(e.target.value)}
              disabled={linking}
              sx={{
                mb: 1,
                '& .MuiOutlinedInput-root': {
                  bgcolor: '#374151',
                  color: 'white',
                  '& fieldset': {
                    borderColor: '#4b5563',
                  },
                  '&:hover fieldset': {
                    borderColor: '#6b7280',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#3b82f6',
                  },
                },
                '& .MuiInputBase-input': {
                  fontSize: '12px',
                  py: 1,
                },
                '& .MuiInputBase-input::placeholder': {
                  color: '#9ca3af',
                  opacity: 1,
                },
              }}
            />
            <Button
              fullWidth
              size="small"
              variant="contained"
              startIcon={<LinkIcon />}
              onClick={handleLink}
              disabled={linking || !lineUserId.trim()}
              sx={{
                bgcolor: '#3b82f6',
                color: 'white',
                fontSize: '12px',
                py: 0.75,
                '&:hover': {
                  bgcolor: '#2563eb',
                },
                '&:disabled': {
                  bgcolor: '#374151',
                  color: '#6b7280',
                },
              }}
            >
              {linking ? '連接中...' : '連接'}
            </Button>
            <Typography variant="caption" sx={{ color: '#6b7280', fontSize: '10px', mt: 0.5, display: 'block' }}>
              在 LINE Bot 輸入 /myid 獲取 ID
            </Typography>
          </Box>
        )}

        {/* User Account */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer' }} onClick={(e) => setUserMenuAnchor(e.currentTarget)}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: '#3b82f6' }}>
            {session?.user?.email?.charAt(0).toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ color: 'white', fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {session?.user?.email || '用戶'}
            </Typography>
            <Typography variant="caption" sx={{ color: '#9ca3af', fontSize: '11px' }}>
              點擊查看選單
            </Typography>
          </Box>
        </Box>
        <Menu
          anchorEl={userMenuAnchor}
          open={Boolean(userMenuAnchor)}
          onClose={() => setUserMenuAnchor(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        >
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">
              {session?.user?.email}
            </Typography>
          </MenuItem>
          <MenuItem
            onClick={() => {
              setUserMenuAnchor(null);
              signOut({ callbackUrl: '/auth/signin' });
            }}
          >
            <LogoutIcon sx={{ mr: 1 }} fontSize="small" />
            登出
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );

  return (
    <>
      {/* Mobile menu button */}
      <Tooltip title="選單">
        <IconButton
          onClick={onMobileToggle}
          sx={{
            position: 'fixed',
            top: 16,
            left: 16,
            zIndex: 1300,
            bgcolor: 'white',
            boxShadow: 2,
            display: { md: 'none' },
            '&:hover': {
              bgcolor: 'white',
            },
          }}
        >
          <MenuIcon />
        </IconButton>
      </Tooltip>

      {/* Mobile drawer */}
      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={onMobileToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile
        }}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            bgcolor: '#1f2937',
          },
        }}
      >
        {drawerContent}
      </Drawer>

      {/* Desktop drawer */}
      <Box
        sx={{
          display: { xs: 'none', md: 'block' },
          width: drawerWidth,
          flexShrink: 0,
          position: 'fixed',
          top: 0,
          left: 0,
          height: '100vh',
          zIndex: 1200,
        }}
      >
        {drawerContent}
      </Box>
    </>
  );
}

