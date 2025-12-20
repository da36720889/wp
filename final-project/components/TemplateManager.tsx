'use client';

import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Typography,
  IconButton,
  MenuItem,
  Chip,
} from '@mui/material';
import { Add as AddIcon, Edit as EditIcon, Delete as DeleteIcon } from '@mui/icons-material';

interface Template {
  _id: string;
  name: string;
  amount: number;
  category: string;
  description?: string;
  type: 'income' | 'expense';
}

export default function TemplateManager({ onUseTemplate }: { onUseTemplate: (template: Template) => void }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDialog, setOpenDialog] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    amount: '',
    category: '',
    description: '',
    type: 'expense' as 'income' | 'expense',
  });

  const categories = ['餐飲', '交通', '購物', '娛樂', '醫療', '教育', '房租', '水電', '通訊', '其他'];

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/templates');
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (template?: Template) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        amount: template.amount.toString(),
        category: template.category,
        description: template.description || '',
        type: template.type,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        amount: '',
        category: '',
        description: '',
        type: 'expense',
      });
    }
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setEditingTemplate(null);
    setFormData({
      name: '',
      amount: '',
      category: '',
      description: '',
      type: 'expense',
    });
  };

  const handleSave = async () => {
    try {
      const url = editingTemplate ? `/api/templates/${editingTemplate._id}` : '/api/templates';
      const method = editingTemplate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          amount: parseFloat(formData.amount),
          category: formData.category,
          description: formData.description,
          type: formData.type,
        }),
      });

      if (response.ok) {
        handleCloseDialog();
        await fetchTemplates();
      } else {
        alert('儲存失敗');
      }
    } catch (error) {
      console.error('Error saving template:', error);
      alert('儲存失敗');
    }
  };

  const handleDelete = async (templateId: string) => {
    if (!confirm('確定要刪除這個模板嗎？')) return;

    try {
      const response = await fetch(`/api/templates/${templateId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        await fetchTemplates();
      } else {
        alert('刪除失敗');
      }
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('刪除失敗');
    }
  };

  const handleUse = (template: Template) => {
    onUseTemplate(template);
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
          title="快速模板"
          action={
            <Button size="small" startIcon={<AddIcon />} onClick={() => handleOpenDialog()}>
              新增
            </Button>
          }
        />
        <CardContent>
          {templates.length === 0 ? (
            <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
              點擊「新增」建立常用交易模板
            </Typography>
          ) : (
            <Stack spacing={1}>
              {templates.map((template) => (
                <div
                  key={template._id}
                  className="group flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3 transition-all hover:border-gray-300 hover:shadow-sm"
                >
                  <div 
                    className="flex-1 cursor-pointer"
                    onClick={() => handleUse(template)}
                  >
                    <div className="flex items-center gap-2">
                      <Typography variant="body2" fontWeight="medium">
                        {template.name}
                      </Typography>
                      <Chip
                        label={template.type === 'income' ? '收入' : '支出'}
                        size="small"
                        color={template.type === 'income' ? 'success' : 'error'}
                      />
                    </div>
                    <Typography variant="caption" color="text.secondary">
                      {template.category} · {template.amount} 元
                    </Typography>
                  </div>
                  <Stack direction="row" spacing={0.5} alignItems="center">
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleUse(template)}
                      sx={{ 
                        minWidth: 'auto',
                        px: 1.5,
                        textTransform: 'none',
                        fontSize: '0.75rem',
                        borderColor: 'gray.300',
                        color: 'text.primary',
                        '&:hover': {
                          borderColor: 'gray.400',
                          backgroundColor: 'gray.50'
                        }
                      }}
                    >
                      使用
                    </Button>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenDialog(template);
                      }}
                      title="編輯"
                    >
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(template._id);
                      }}
                      color="error"
                      title="刪除"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Stack>
                </div>
              ))}
            </Stack>
          )}
        </CardContent>
      </Card>

      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{editingTemplate ? '編輯模板' : '新增模板'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="模板名稱"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              fullWidth
              required
              placeholder="例如：早餐"
            />
            <TextField
              select
              label="類型"
              value={formData.type}
              onChange={(e) => setFormData({ ...formData, type: e.target.value as 'income' | 'expense' })}
              fullWidth
              required
            >
              <MenuItem value="expense">支出</MenuItem>
              <MenuItem value="income">收入</MenuItem>
            </TextField>
            <TextField
              label="金額"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              fullWidth
              required
              inputProps={{ min: 0, step: 1 }}
            />
            <TextField
              select
              label="類別"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              fullWidth
              required
            >
              <MenuItem value="">選擇類別</MenuItem>
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
              placeholder="例如：早餐"
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

