'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, LinearProgress, TextField, Button, Stack, Typography, Chip } from '@mui/material';
import { Edit as EditIcon, Save as SaveIcon, Cancel as CancelIcon } from '@mui/icons-material';

interface BudgetStatus {
  budget: {
    _id: string;
    month: string;
    totalBudget?: number;
    categoryBudgets: Record<string, number>;
  };
  totalSpent: number;
  categorySpent: Record<string, number>;
  totalRemaining?: number;
  categoryRemaining: Record<string, number>;
}

export default function BudgetCard() {
  const [budgetStatus, setBudgetStatus] = useState<BudgetStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [totalBudget, setTotalBudget] = useState<string>('');
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchBudgetStatus();
  }, []);

  const fetchBudgetStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/budget');
      if (response.ok) {
        const data = await response.json();
        setBudgetStatus(data);
        setTotalBudget(data.budget.totalBudget?.toString() || '');
        setCategoryBudgets(
          Object.fromEntries(
            Object.entries(data.budget.categoryBudgets || {}).map(([k, v]) => [k, String(v)])
          )
        );
      }
    } catch (error) {
      console.error('Error fetching budget status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const month = budgetStatus?.budget.month || new Date().toISOString().slice(0, 7);
      const response = await fetch('/api/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          totalBudget: totalBudget ? parseFloat(totalBudget) : undefined,
          categoryBudgets: Object.fromEntries(
            Object.entries(categoryBudgets)
              .filter(([_, v]) => v)
              .map(([k, v]) => [k, parseFloat(v)])
          ),
        }),
      });

      if (response.ok) {
        setEditing(false);
        await fetchBudgetStatus();
      }
    } catch (error) {
      console.error('Error saving budget:', error);
      alert('儲存失敗');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0,
    }).format(amount);
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

  if (!budgetStatus) {
    return null;
  }

  const { budget, totalSpent, totalRemaining, categorySpent, categoryRemaining } = budgetStatus;
  const totalBudgetValue = budget.totalBudget || 0;
  const usagePercent = totalBudgetValue > 0 ? (totalSpent / totalBudgetValue) * 100 : 0;

  const categories = ['餐飲', '交通', '購物', '娛樂', '醫療', '教育', '房租', '水電', '通訊', '其他'];

  return (
    <Card variant="outlined">
      <CardHeader
        title="預算管理"
        subheader={`${budget.month} 月份`}
        action={
          editing ? (
            <Stack direction="row" spacing={1}>
              <Button size="small" startIcon={<SaveIcon />} onClick={handleSave}>
                儲存
              </Button>
              <Button size="small" startIcon={<CancelIcon />} onClick={() => setEditing(false)}>
                取消
              </Button>
            </Stack>
          ) : (
            <Button size="small" startIcon={<EditIcon />} onClick={() => setEditing(true)}>
              編輯
            </Button>
          )
        }
      />
      <CardContent>
        {editing ? (
          <Stack spacing={2}>
            <TextField
              label="總預算"
              type="number"
              value={totalBudget}
              onChange={(e) => setTotalBudget(e.target.value)}
              fullWidth
              helperText="設定當月總預算金額"
            />
            <Typography variant="subtitle2">類別預算（選填）</Typography>
            {categories.map((cat) => (
              <TextField
                key={cat}
                label={cat}
                type="number"
                value={categoryBudgets[cat] || ''}
                onChange={(e) => setCategoryBudgets({ ...categoryBudgets, [cat]: e.target.value })}
                fullWidth
                size="small"
              />
            ))}
          </Stack>
        ) : (
          <Stack spacing={2}>
            {totalBudgetValue > 0 && (
              <div>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="body2">總預算</Typography>
                  <Typography variant="body2" color={totalRemaining && totalRemaining < 0 ? 'error' : 'text.secondary'}>
                    {formatCurrency(totalSpent)} / {formatCurrency(totalBudgetValue)}
                    {totalRemaining !== undefined && (
                      <span> ({totalRemaining >= 0 ? '剩餘' : '超支'} {formatCurrency(Math.abs(totalRemaining))})</span>
                    )}
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(usagePercent, 100)}
                  color={usagePercent > 100 ? 'error' : usagePercent > 80 ? 'warning' : 'primary'}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </div>
            )}

            {Object.keys(budget.categoryBudgets || {}).length > 0 && (
              <div>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  類別預算
                </Typography>
                <Stack spacing={1}>
                  {Object.entries(budget.categoryBudgets || {}).map(([category, budgetAmount]) => {
                    const spent = categorySpent[category] || 0;
                    const remaining = categoryRemaining[category] || 0;
                    const percent = (spent / budgetAmount) * 100;

                    return (
                      <div key={category}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.5 }}>
                          <Typography variant="body2">{category}</Typography>
                          <Chip
                            label={`${formatCurrency(spent)} / ${formatCurrency(budgetAmount)}`}
                            size="small"
                            color={remaining < 0 ? 'error' : percent > 80 ? 'warning' : 'default'}
                          />
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(percent, 100)}
                          color={percent > 100 ? 'error' : percent > 80 ? 'warning' : 'primary'}
                          sx={{ height: 6, borderRadius: 1 }}
                        />
                      </div>
                    );
                  })}
                </Stack>
              </div>
            )}

            {totalBudgetValue === 0 && Object.keys(budget.categoryBudgets || {}).length === 0 && (
              <Typography variant="body2" color="text.secondary" align="center">
                點擊「編輯」設定預算
              </Typography>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

