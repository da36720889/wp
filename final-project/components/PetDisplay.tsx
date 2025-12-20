'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, LinearProgress, Typography, TextField, Button, Box, IconButton, Stack } from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';
import PetPixelArt from './PetPixelArt';

interface PetData {
  _id: string;
  name: string;
  stage: string;
  state: string;
  hunger: number;
  happiness: number;
  health: number;
  experience: number;
  level: number;
  consecutiveDays: number;
  totalTransactions: number;
  evolutionType?: string;
  statusMessage: string;
}

export default function PetDisplay() {
  const [pet, setPet] = useState<PetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPet();
    
    // 監聽自定義事件，當記帳完成時刷新寵物狀態
    const handleTransactionCreated = () => {
      console.log('📝 Transaction created, refreshing pet...');
      // 延遲一下，確保後端已經更新了 pet 狀態
      setTimeout(() => {
        fetchPet();
      }, 500);
    };
    
    window.addEventListener('transactionCreated', handleTransactionCreated);
    
    return () => {
      window.removeEventListener('transactionCreated', handleTransactionCreated);
    };
  }, []);

  const fetchPet = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/pet');
      const data = await response.json();
      
      if (response.ok) {
        console.log('Pet data loaded:', data);
        setPet(data);
        setNewName(data.name);
        setError(null);
      } else {
        console.error('Failed to fetch pet:', response.status, response.statusText, data);
        setPet(null);
        setError(data.error || data.details || `HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching pet:', error);
      setPet(null);
      setError(error instanceof Error ? error.message : '未知錯誤');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateName = async () => {
    try {
      const response = await fetch('/api/pet', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });

      if (response.ok) {
        const data = await response.json();
        setPet(data);
        setEditingName(false);
      }
    } catch (error) {
      console.error('Error updating pet name:', error);
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

  if (!pet) {
    return (
      <Card variant="outlined">
        <CardContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            無法載入電子雞資料
          </Typography>
          {error && (
            <Typography variant="caption" color="error" sx={{ mb: 1, display: 'block', fontFamily: 'monospace' }}>
              錯誤: {error}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
            請檢查瀏覽器控制台的錯誤訊息（F12）
          </Typography>
          <Button 
            variant="outlined" 
            size="small" 
            onClick={fetchPet}
            disabled={loading}
          >
            {loading ? '載入中...' : '重新載入'}
          </Button>
        </CardContent>
      </Card>
    );
  }


  // 計算經驗值進度
  const expForNextLevel = pet.level * 100;
  const expProgress = (pet.experience / expForNextLevel) * 100;

  return (
    <Card variant="outlined">
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {editingName ? (
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flex: 1 }}>
                <TextField
                  size="small"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') handleUpdateName();
                  }}
                />
                <Button size="small" onClick={handleUpdateName}>
                  儲存
                </Button>
                <Button size="small" onClick={() => setEditingName(false)}>
                  取消
                </Button>
              </Box>
            ) : (
              <>
                <Typography variant="h6">{pet.name}</Typography>
                <IconButton size="small" onClick={() => setEditingName(true)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </>
            )}
          </Box>
        }
        subheader={`等級 ${pet.level} · ${pet.stage === 'egg' ? '蛋' : pet.stage === 'baby' ? '嬰兒期' : pet.stage === 'child' ? '兒童期' : pet.stage === 'adult' ? '成年期' : pet.stage === 'sick' ? '生病' : pet.stage === 'dying' ? '垂死' : '死亡'}`}
      />
      <CardContent>
        {/* 寵物圖片 */}
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 3 }}>
          <PetPixelArt 
            stage={pet.stage} 
            state={pet.state} 
            hunger={pet.hunger}
            health={pet.health}
            level={pet.level}
            size={150} 
          />
        </Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {pet.statusMessage}
          </Typography>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2">飽食度</Typography>
            <Typography variant="body2">{pet.hunger}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={pet.hunger}
            color={pet.hunger > 50 ? 'success' : pet.hunger > 20 ? 'warning' : 'error'}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2">心情值</Typography>
            <Typography variant="body2">{pet.happiness}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={pet.happiness}
            color="primary"
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2">健康度</Typography>
            <Typography variant="body2">{pet.health}%</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={pet.health}
            color={pet.health > 70 ? 'success' : pet.health > 40 ? 'warning' : 'error'}
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>

        <Box sx={{ mb: 2 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2">經驗值 (Lv.{pet.level} → Lv.{pet.level + 1})</Typography>
            <Typography variant="body2">{pet.experience} / {expForNextLevel}</Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={expProgress}
            color="secondary"
            sx={{ height: 8, borderRadius: 1 }}
          />
        </Box>

        <Box sx={{ display: 'flex', gap: 2, mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">連續記帳</Typography>
            <Typography variant="body2" fontWeight="bold">
              {pet.consecutiveDays} 天
            </Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">總記帳筆數</Typography>
            <Typography variant="body2" fontWeight="bold">
              {pet.totalTransactions} 筆
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

