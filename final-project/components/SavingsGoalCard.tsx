'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  LinearProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Typography,
  IconButton,
  Chip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';

interface SavingsGoal {
  _id: string;
  title: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  completed: boolean;
  progress: {
    percentage: number;
    remaining: number;
    daysRemaining?: number;
  };
}

export default function SavingsGoalCard() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    targetAmount: '',
    deadline: '',
  });

  useEffect(() => {
    fetchGoals();
    
    // 監聽自定義事件，當記帳完成時刷新儲蓄目標
    const handleTransactionCreated = () => {
      console.log('💰 Transaction created, refreshing savings goals...');
      // 延遲一下，確保後端已經更新了數據
      setTimeout(() => {
        fetchGoals();
      }, 500);
    };
    
    window.addEventListener('transactionCreated', handleTransactionCreated);
    
    return () => {
      window.removeEventListener('transactionCreated', handleTransactionCreated);
    };
  }, []);

  const fetchGoals = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/savings-goals');
      if (response.ok) {
        const data = await response.json();
        setGoals(data.goals || []);
      }
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (goal?: SavingsGoal) => {
    if (goal) {
      setEditingGoal(goal);
      setFormData({
        title: goal.title,
        targetAmount: goal.targetAmount.toString(),
        deadline: goal.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : '',
      });
    } else {
      setEditingGoal(null);
      setFormData({ title: '', targetAmount: '', deadline: '' });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingGoal(null);
    setFormData({ title: '', targetAmount: '', deadline: '' });
  };

  const handleSave = async () => {
    try {
      const url = editingGoal
        ? `/api/savings-goals/${editingGoal._id}`
        : '/api/savings-goals';
      const method = editingGoal ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: formData.title,
          targetAmount: parseFloat(formData.targetAmount),
          deadline: formData.deadline || undefined,
        }),
      });

      if (response.ok) {
        handleCloseDialog();
        await fetchGoals();
      } else {
        alert('儲存失敗');
      }
    } catch (error) {
      console.error('Error saving goal:', error);
      alert('儲存失敗');
    }
  };

  const handleDelete = async (goalId: string) => {
    if (!confirm('確定要刪除這個目標嗎？')) return;

    try {
      const response = await fetch(`/api/savings-goals/${goalId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchGoals();
      } else {
        alert('刪除失敗');
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('刪除失敗');
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

  return (
    <>
      <Card variant="outlined">
        <CardHeader
          title="儲蓄目標"
          action={
            <Button
              size="small"
              startIcon={<AddIcon />}
              onClick={() => handleOpenDialog()}
            >
              新增
            </Button>
          }
        />
        <CardContent>
          {goals.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
              點擊「新增」設定儲蓄目標
            </Typography>
          ) : (
            <Stack spacing={3}>
              {goals.map((goal) => (
                <div key={goal._id}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="h6">{goal.title}</Typography>
                    <Stack direction="row" spacing={1}>
                      {goal.completed && <Chip label="已完成" color="success" size="small" />}
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(goal)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(goal._id)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  </Stack>

                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      {formatCurrency(goal.currentAmount)} / {formatCurrency(goal.targetAmount)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      剩餘 {formatCurrency(goal.progress.remaining)}
                    </Typography>
                  </Stack>

                  <LinearProgress
                    variant="determinate"
                    value={goal.progress.percentage}
                    color={goal.completed ? 'success' : 'primary'}
                    sx={{ height: 8, borderRadius: 1, mb: 1 }}
                  />

                  {goal.deadline && goal.progress.daysRemaining !== undefined && (
                    <Typography variant="caption" color="text.secondary">
                      {goal.progress.daysRemaining > 0
                        ? `距離目標還有 ${goal.progress.daysRemaining} 天`
                        : goal.progress.daysRemaining === 0
                        ? '今天是最後一天'
                        : '已超過截止日期'}
                    </Typography>
                  )}
                </div>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingGoal ? '編輯目標' : '新增儲蓄目標'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="目標名稱"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="目標金額"
              type="number"
              value={formData.targetAmount}
              onChange={(e) => setFormData({ ...formData, targetAmount: e.target.value })}
              fullWidth
              required
              inputProps={{ min: 0, step: 1 }}
            />
            <TextField
              label="截止日期（選填）"
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
              fullWidth
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>取消</Button>
          <Button onClick={handleSave} variant="contained">
            儲存
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

