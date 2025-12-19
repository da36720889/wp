'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardHeader,
  CardContent,
  TextField,
  Button,
  ToggleButtonGroup,
  ToggleButton,
  MenuItem,
  Stack,
} from '@mui/material';

export default function TransactionForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    amount: '',
    category: '',
    description: '',
    type: 'expense' as 'income' | 'expense',
    date: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          amount: parseFloat(formData.amount),
        }),
      });

      if (!response.ok) throw new Error('創建失敗');

      // 重置表單
      setFormData({
        amount: '',
        category: '',
        description: '',
        type: 'expense',
        date: new Date().toISOString().split('T')[0],
      });

      // 重新載入頁面以更新列表
      router.refresh();
      window.location.reload();
    } catch (error) {
      alert(error instanceof Error ? error.message : '創建失敗');
    } finally {
      setLoading(false);
    }
  };

  const categories = ['餐飲', '交通', '購物', '娛樂', '醫療', '教育', '房租', '水電', '通訊', '其他'];

  return (
    <Card variant="outlined">
      <CardHeader title="新增記帳" subheader="快速記錄您的收支" />
      <CardContent>
        <Stack component="form" spacing={2} onSubmit={handleSubmit}>
          <ToggleButtonGroup
            value={formData.type}
            exclusive
            onChange={(_, value) => {
              if (value) {
                setFormData({ ...formData, type: value });
              }
            }}
            size="small"
          >
            <ToggleButton value="expense">支出</ToggleButton>
            <ToggleButton value="income">收入</ToggleButton>
          </ToggleButtonGroup>

          <TextField
            label="金額"
            type="number"
            inputProps={{ min: 0, step: 1 }}
            value={formData.amount}
            onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
            required
            fullWidth
          />

          <TextField
            select
            label="類別"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            required
            fullWidth
          >
            {categories.map((cat) => (
              <MenuItem key={cat} value={cat}>
                {cat}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="描述（選填）"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            fullWidth
            placeholder="例如：午餐"
          />

          <TextField
            label="日期"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            InputLabelProps={{ shrink: true }}
            required
            fullWidth
          />

          <Button
            type="submit"
            variant="contained"
            color="primary"
            disabled={loading}
            fullWidth
          >
            {loading ? '創建中...' : '新增記錄'}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

