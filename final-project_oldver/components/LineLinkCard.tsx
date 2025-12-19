'use client';

import { useState, useEffect } from 'react';

interface LinkStatus {
  linked: boolean;
  lineUserId: string | null;
}

interface DiagnoseResult {
  currentUser: {
    userId: string;
    email: string;
    lineUserId: string | null;
    linked: boolean;
  };
  hasDuplicateIssue: boolean;
  duplicateInfo: {
    lineUserId: string;
    linkedUsers: Array<{
      email: string;
      isCurrentUser: boolean;
    }>;
  } | null;
  totalDuplicates: number;
}

export default function LineLinkCard() {
  const [linkStatus, setLinkStatus] = useState<LinkStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [lineUserId, setLineUserId] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [diagnoseResult, setDiagnoseResult] = useState<DiagnoseResult | null>(null);
  const [showDiagnose, setShowDiagnose] = useState(false);

  useEffect(() => {
    fetchLinkStatus();
    fetchDiagnose();
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
    } finally {
      setLoading(false);
    }
  };

  const fetchDiagnose = async () => {
    try {
      const response = await fetch('/api/diagnose-links');
      if (response.ok) {
        const data = await response.json();
        setDiagnoseResult(data);
        if (data.hasDuplicateIssue) {
          setShowDiagnose(true);
        }
      }
    } catch (error) {
      console.error('Error diagnosing links:', error);
    }
  };

  const handleLink = async () => {
    if (!lineUserId.trim()) {
      setMessage({ type: 'error', text: '請輸入 LINE 用戶 ID' });
      return;
    }

    setLinking(true);
    setMessage(null);

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
        setMessage({
          type: 'success',
          text: data.message || '成功關聯 LINE 用戶！',
        });
        setLineUserId('');
        await fetchLinkStatus();
        await fetchDiagnose();
        // 刷新頁面以顯示新的交易記錄
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setMessage({
          type: 'error',
          text: data.error || '關聯失敗',
        });
      }
    } catch (error) {
      setMessage({
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
    setMessage(null);

    try {
      const response = await fetch('/api/unlink-line', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (response.ok) {
        setMessage({
          type: 'success',
          text: data.message || '已成功解除連結',
        });
        await fetchLinkStatus();
        await fetchDiagnose();
        // 刷新頁面
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setMessage({
          type: 'error',
          text: data.error || '解除連結失敗',
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: '解除連結時發生錯誤，請稍後再試',
      });
    } finally {
      setUnlinking(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="text-sm text-gray-500">載入中...</div>
      </div>
    );
  }

  if (linkStatus?.linked) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6">
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-xl">✅</span>
            <div className="flex-1">
              <h3 className="font-semibold text-green-900">已連接</h3>
              <p className="mt-1 text-sm text-green-700">
                您的 LINE Bot 記帳記錄已同步到此帳號
              </p>
              {linkStatus.lineUserId && (
                <p className="mt-1 text-xs text-green-600">
                  LINE ID: {linkStatus.lineUserId.substring(0, 8)}...
                </p>
              )}
            </div>
          </div>

          {diagnoseResult?.hasDuplicateIssue && (
            <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3">
              <div className="flex items-start gap-2">
                <span className="text-lg">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-yellow-900">
                    檢測到連結問題
                  </p>
                  <p className="mt-1 text-xs text-yellow-800">
                    此 LINE 用戶已被多個 Google 帳號連結。建議解除連結後重新連結正確的帳號。
                  </p>
                  {diagnoseResult.duplicateInfo && (
                    <div className="mt-2 text-xs text-yellow-700">
                      <p className="font-medium">已連結的帳號：</p>
                      <ul className="mt-1 list-inside list-disc space-y-1">
                        {diagnoseResult.duplicateInfo.linkedUsers.map((u, idx) => (
                          <li key={idx}>
                            {u.email} {u.isCurrentUser && '(當前帳號)'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {message && (
            <div
              className={`rounded-lg p-3 text-sm ${
                message.type === 'success'
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handleUnlink}
              disabled={unlinking}
              className="flex-1 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 transition-all hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {unlinking ? '解除中...' : '解除連結'}
            </button>
            <button
              onClick={() => {
                setShowDiagnose(!showDiagnose);
                if (!showDiagnose) {
                  fetchDiagnose();
                }
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-all hover:bg-gray-50"
            >
              {showDiagnose ? '隱藏' : '診斷'}
            </button>
          </div>

          {showDiagnose && diagnoseResult && (
            <div className="rounded-lg border border-gray-200 bg-white p-3 text-xs">
              <p className="font-medium text-gray-900">診斷結果：</p>
              <ul className="mt-2 space-y-1 text-gray-700">
                <li>• 當前帳號：{diagnoseResult.currentUser.email}</li>
                <li>• LINE ID：{diagnoseResult.currentUser.lineUserId || '未連結'}</li>
                <li>• 重複連結問題：{diagnoseResult.hasDuplicateIssue ? '是' : '否'}</li>
                <li>• 系統中總重複數：{diagnoseResult.totalDuplicates}</li>
              </ul>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-3 font-semibold text-gray-900">連結 LINE Bot</h3>
      <p className="mb-4 text-sm text-gray-600">
        輸入您的 LINE 用戶 ID 以同步 LINE Bot 的記帳記錄
      </p>

      <div className="space-y-3">
        <div>
          <label htmlFor="lineUserId" className="mb-1 block text-sm font-medium text-gray-700">
            LINE 用戶 ID
          </label>
          <input
            id="lineUserId"
            type="text"
            value={lineUserId}
            onChange={(e) => setLineUserId(e.target.value)}
            placeholder="在 LINE Bot 中輸入 /myid 獲取"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            disabled={linking}
          />
        </div>

        {message && (
          <div
            className={`rounded-lg p-3 text-sm ${
              message.type === 'success'
                ? 'bg-green-50 text-green-800'
                : 'bg-red-50 text-red-800'
            }`}
          >
            {message.text}
          </div>
        )}

        <button
          onClick={handleLink}
          disabled={linking || !lineUserId.trim()}
          className="w-full rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {linking ? '連結中...' : '連結 LINE 用戶'}
        </button>

        <p className="text-xs text-gray-500">
          💡 提示：在 LINE Bot 中輸入 <code className="rounded bg-gray-100 px-1">/myid</code>{' '}
          可獲取您的用戶 ID
        </p>
      </div>
    </div>
  );
}

