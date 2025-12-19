'use client';

import { useEffect, useState } from 'react';
import { ITransaction } from '@/lib/models/Transaction';

export default function TransactionList() {
  const [transactions, setTransactions] = useState<ITransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<{
    amount: string;
    category: string;
    description: string;
    type: 'income' | 'expense';
    date: string;
  } | null>(null);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/transactions?limit=20');
      if (!response.ok) throw new Error('載入失敗');
      const data = await response.json();
      setTransactions(data.transactions || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '載入失敗');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const handleEdit = (transaction: ITransaction) => {
    setEditingId(transaction._id.toString());
    setEditFormData({
      amount: transaction.amount.toString(),
      category: transaction.category,
      description: transaction.description || '',
      type: transaction.type,
      date: new Date(transaction.date).toISOString().split('T')[0],
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditFormData(null);
  };

  const handleUpdate = async (id: string) => {
    if (!editFormData) return;

    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(editFormData.amount),
          category: editFormData.category,
          description: editFormData.description,
          type: editFormData.type,
          date: editFormData.date,
        }),
      });

      if (!response.ok) throw new Error('更新失敗');

      setEditingId(null);
      setEditFormData(null);
      await fetchTransactions();
    } catch (err) {
      alert(err instanceof Error ? err.message : '更新失敗');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('確定要刪除這筆記錄嗎？')) return;

    try {
      const response = await fetch(`/api/transactions/${id}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('刪除失敗');
      await fetchTransactions();
    } catch (err) {
      alert(err instanceof Error ? err.message : '刪除失敗');
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">記帳記錄</h2>
        <div className="text-center text-gray-500">載入中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">記帳記錄</h2>
        <div className="text-center text-red-600">{error}</div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  /**
   * 將日期顯示為「YYYY/MM/DD」，使用瀏覽器所在時區避免時差造成日期錯誤。
   */
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const categories = ['餐飲', '交通', '購物', '娛樂', '醫療', '教育', '房租', '水電', '通訊', '其他'];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">記帳記錄</h2>
        <button
          onClick={fetchTransactions}
          className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
          title="重新整理"
        >
          🔄
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="py-12 text-center text-gray-500">尚無記帳記錄</div>
      ) : (
        <div className="space-y-1">
          {transactions.map((transaction) => {
            const isEditing = editingId === transaction._id.toString();
            
            if (isEditing && editFormData) {
              return (
                <div
                  key={transaction._id.toString()}
                  className="rounded-xl border-2 border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 shadow-md"
                >
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setEditFormData({ ...editFormData, type: 'expense' })
                        }
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                          editFormData.type === 'expense'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        支出
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditFormData({ ...editFormData, type: 'income' })
                        }
                        className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                          editFormData.type === 'income'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        收入
                      </button>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">金額</label>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={editFormData.amount}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, amount: e.target.value })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-lg focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">類別</label>
                      <select
                        value={editFormData.category}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, category: e.target.value })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      >
                        <option value="">選擇類別</option>
                        {categories.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">
                        描述（選填）
                      </label>
                      <input
                        type="text"
                        value={editFormData.description}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, description: e.target.value })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        placeholder="例如：午餐"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">日期</label>
                      <input
                        type="date"
                        value={editFormData.date}
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, date: e.target.value })
                        }
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        required
                      />
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUpdate(transaction._id.toString())}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                      >
                        儲存
                      </button>
                      <button
                        onClick={handleCancelEdit}
                        className="flex-1 rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-300"
                      >
                        取消
                      </button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={transaction._id.toString()}
                className="group flex items-center justify-between rounded-md border border-gray-200 p-4 hover:bg-gray-50"
              >
                <div className="flex flex-1 items-center gap-3">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-md ${
                      transaction.type === 'income' ? 'bg-green-100' : 'bg-red-100'
                    }`}
                  >
                    {transaction.type === 'income' ? '💰' : '💸'}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{transaction.category}</span>
                      <span className="text-xs text-gray-500">{formatDate(transaction.date)}</span>
                    </div>
                    {transaction.description && (
                      <div className="mt-0.5 text-sm text-gray-600">{transaction.description}</div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`font-semibold ${
                      transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {transaction.type === 'income' ? '+' : '-'}
                    {formatCurrency(transaction.amount)}
                  </span>
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => handleEdit(transaction)}
                      className="rounded-md px-2 py-1 text-sm text-gray-600 hover:bg-gray-100"
                      title="編輯"
                    >
                      編輯
                    </button>
                    <button
                      onClick={() => handleDelete(transaction._id.toString())}
                      className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50"
                      title="刪除"
                    >
                      刪除
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

