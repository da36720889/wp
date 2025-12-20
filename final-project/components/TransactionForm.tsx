'use client';

import { useState, useEffect } from 'react';
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

interface Template {
  _id: string;
  name: string;
  amount: number;
  category: string;
  description?: string;
  type: 'income' | 'expense';
}

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

  const handleUseTemplate = (template: Template) => {
    setFormData({
      amount: template.amount.toString(),
      category: template.category,
      description: template.description || '',
      type: template.type,
      date: new Date().toISOString().split('T')[0],
    });
  };

  // 監聽來自 TemplateManager 的模板使用事件
  useEffect(() => {
    const handleTemplateEvent = (e: Event) => {
      const customEvent = e as CustomEvent<Template>;
      const template = customEvent.detail;
      setFormData({
        amount: template.amount.toString(),
        category: template.category,
        description: template.description || '',
        type: template.type,
        date: new Date().toISOString().split('T')[0],
      });
    };
    window.addEventListener('useTemplate', handleTemplateEvent);
    return () => {
      window.removeEventListener('useTemplate', handleTemplateEvent);
    };
  }, []);

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

      const data = await response.json();
      
      // 觸發自定義事件，通知 PetDisplay 和其他組件刷新
      window.dispatchEvent(new CustomEvent('transactionCreated', { detail: data }));
      
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

