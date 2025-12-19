'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Switch,
  FormControlLabel,
  Typography,
  Alert,
  CircularProgress,
  Stack,
} from '@mui/material';
import { Email as EmailIcon, Refresh as RefreshIcon } from '@mui/icons-material';

export default function GmailImportCard() {
  const [authorized, setAuthorized] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/gmail/check');
      if (response.ok) {
        const data = await response.json();
        setAuthorized(data.authorized);
        setEnabled(data.enabled);
      }
    } catch (error) {
      console.error('Error fetching Gmail status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (newEnabled: boolean) => {
    try {
      const response = await fetch('/api/gmail/enable', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newEnabled }),
      });

      if (response.ok) {
        setEnabled(newEnabled);
        setMessage({
          type: 'success',
          text: newEnabled ? '已啟用 Gmail 自動匯入' : '已停用 Gmail 自動匯入',
        });
      } else {
        const data = await response.json();
        setMessage({ type: 'error', text: data.error || '設定失敗' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '設定失敗，請稍後再試' });
    }
  };

  const handleCheck = async () => {
    try {
      setChecking(true);
      setMessage(null);
      const response = await fetch('/api/gmail/check', {
        method: 'POST',
      });

      const data = await response.json();
      if (response.ok) {
        setMessage({
          type: 'success',
          text: `成功匯入 ${data.imported} 筆交易，跳過 ${data.skipped} 封郵件`,
        });
        // 刷新交易列表
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setMessage({ type: 'error', text: data.error || '檢查失敗' });
      }
    } catch (error) {
      setMessage({ type: 'error', text: '檢查失敗，請稍後再試' });
    } finally {
      setChecking(false);
    }
  };

  if (loading) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography>載入中...</Typography>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card variant="outlined">
      <CardHeader
        title="Gmail 自動匯入"
        subheader="自動從 Gmail 匯入帳單和發票"
        avatar={<EmailIcon />}
      />
      <CardContent>
        <Stack spacing={2}>
          {!authorized ? (
            <Alert severity="warning">
              <Typography variant="body2" sx={{ mb: 1 }}>
                尚未授權 Gmail 存取。請重新登入以授權 Gmail 讀取權限。
              </Typography>
              <Button
                variant="outlined"
                size="small"
                onClick={() => {
                  window.location.href = '/api/auth/signin';
                }}
              >
                重新登入
              </Button>
            </Alert>
          ) : (
            <>
              <FormControlLabel
                control={
                  <Switch checked={enabled} onChange={(e) => handleToggle(e.target.checked)} />
                }
                label="啟用自動匯入"
              />
              <Typography variant="body2" color="text.secondary">
                啟用後，系統會自動檢查 Gmail 中的帳單和發票郵件，並匯入記帳記錄。
              </Typography>
              <Button
                variant="contained"
                startIcon={checking ? <CircularProgress size={16} /> : <RefreshIcon />}
                onClick={handleCheck}
                disabled={checking}
                fullWidth
              >
                {checking ? '檢查中...' : '立即檢查郵件'}
              </Button>
            </>
          )}

          {message && (
            <Alert severity={message.type} onClose={() => setMessage(null)}>
              {message.text}
            </Alert>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

