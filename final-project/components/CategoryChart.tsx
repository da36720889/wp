'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, Tabs, Tab, Box, Typography, ToggleButtonGroup, ToggleButton } from '@mui/material';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CategoryStat {
  category: string;
  total: number;
  count: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#8dd1e1', '#d084d0'];

export default function CategoryChart() {
  const [categoryStats, setCategoryStats] = useState<CategoryStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [tabValue, setTabValue] = useState(0);
  const [period, setPeriod] = useState<'month' | 'all'>('month');

  useEffect(() => {
    fetchCategoryStats();
  }, [period]);

  const fetchCategoryStats = async () => {
    try {
      setLoading(true);
      let url = '/api/categories?type=expense';
      
      if (period === 'month') {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        url += `&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`;
      }

      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setCategoryStats(data.categories || []);
      }
    } catch (error) {
      console.error('Error fetching category stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const pieData = categoryStats.map((stat) => ({
    name: stat.category,
    value: stat.total,
  }));

  const barData = categoryStats.map((stat) => ({
    name: stat.category,
    金額: stat.total,
    筆數: stat.count,
  }));

  return (
    <Card variant="outlined">
      <CardHeader
        title="類別分析"
        action={
          <ToggleButtonGroup
            value={period}
            exclusive
            onChange={(_, newValue) => {
              if (newValue) setPeriod(newValue);
            }}
            size="small"
          >
            <ToggleButton value="month">本月</ToggleButton>
            <ToggleButton value="all">全部</ToggleButton>
          </ToggleButtonGroup>
        }
      />
      <CardContent>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <Typography>載入中...</Typography>
          </Box>
        ) : categoryStats.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <Typography color="text.secondary">尚無資料</Typography>
          </Box>
        ) : (
          <Box>
            <Tabs value={tabValue} onChange={(_, newValue) => setTabValue(newValue)} sx={{ mb: 2 }}>
              <Tab label="圓餅圖" />
              <Tab label="長條圖" />
            </Tabs>

            {tabValue === 0 && (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${percent ? (percent * 100).toFixed(0) : 0}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value: number | undefined) => value ? formatCurrency(value) : ''} />
                </PieChart>
              </ResponsiveContainer>
            )}

            {tabValue === 1 && (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(value: number | undefined) => value ? formatCurrency(value) : ''} />
                  <Legend />
                  <Bar dataKey="金額" fill="#8884d8" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

