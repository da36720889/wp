import Transaction, { ITransaction } from '@/lib/models/Transaction';
import { CreateTransactionInput, QueryTransactionInput } from '@/lib/schemas/transaction.schema';

export class TransactionRepository {
  async create(data: CreateTransactionInput & { userId: string }): Promise<ITransaction> {
    const transaction = new Transaction({
      ...data,
      date: data.date || new Date(),
    });
    return await transaction.save();
  }

  async findById(transactionId: string, userId: string): Promise<ITransaction | null> {
    return await Transaction.findOne({ _id: transactionId, userId });
  }

  async findByUserId(query: QueryTransactionInput & { search?: string; minAmount?: number; maxAmount?: number }): Promise<{
    transactions: ITransaction[];
    total: number;
  }> {
    const { userId, startDate, endDate, type, category, limit, offset, search, minAmount, maxAmount } = query;

    const filter: Record<string, unknown> = { userId };

    if (startDate || endDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      filter.date = dateFilter;
    }

    if (type) {
      filter.type = type;
    }

    // 搜尋功能：在描述和類別中搜尋
    // 注意：如果同時有 category 和 search，search 會覆蓋 category 條件
    if (search && search.trim()) {
      filter.$or = [
        { description: { $regex: search.trim(), $options: 'i' } },
        { category: { $regex: search.trim(), $options: 'i' } },
      ];
    } else if (category) {
      // 只有在沒有 search 時才使用 category 篩選
      filter.category = category;
    }

    // 金額範圍搜尋
    if (minAmount !== undefined || maxAmount !== undefined) {
      const amountFilter: { $gte?: number; $lte?: number } = {};
      if (minAmount !== undefined) amountFilter.$gte = minAmount;
      if (maxAmount !== undefined) amountFilter.$lte = maxAmount;
      filter.amount = amountFilter;
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter).sort({ date: -1, createdAt: -1 }).limit(limit!).skip(offset!),
      Transaction.countDocuments(filter),
    ]);

    return { transactions, total };
  }

  async update(
    transactionId: string,
    userId: string,
    data: Partial<CreateTransactionInput>
  ): Promise<ITransaction | null> {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: transactionId, userId },
      { $set: data },
      { new: true }
    );
    return transaction;
  }

  async delete(transactionId: string, userId: string): Promise<boolean> {
    const result = await Transaction.deleteOne({ _id: transactionId, userId });
    return result.deletedCount > 0;
  }

  async getSummary(userId: string, startDate?: Date, endDate?: Date): Promise<{
    totalIncome: number;
    totalExpense: number;
    balance: number;
  }> {
    const filter: Record<string, unknown> = { userId };

    if (startDate || endDate) {
      const dateFilter: { $gte?: Date; $lte?: Date } = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;
      filter.date = dateFilter;
    }

    const [incomeResult, expenseResult] = await Promise.all([
      Transaction.aggregate([
        { $match: { ...filter, type: 'income' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { ...filter, type: 'expense' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    const totalIncome = incomeResult[0]?.total || 0;
    const totalExpense = expenseResult[0]?.total || 0;
    const balance = totalIncome - totalExpense;

    return { totalIncome, totalExpense, balance };
  }

  /**
   * 更新交易記錄的 userId（用於合併用戶時遷移記錄）
   */
  async updateUserId(oldUserId: string, newUserId: string): Promise<number> {
    const result = await Transaction.updateMany(
      { userId: oldUserId },
      { $set: { userId: newUserId } }
    );
    return result.modifiedCount;
  }

  /**
   * 獲取消費趨勢數據
   */
  async getTrends(userId: string, period: 'day' | 'week' | 'month' | 'year'): Promise<{
    labels: string[];
    income: number[];
    expense: number[];
  }> {
    const now = new Date();
    let startDate: Date;
    let dateFormat: string;
    let groupFormat: Record<string, unknown>;

    // 根據週期設置日期範圍和分組格式
    switch (period) {
      case 'day':
        // 最近 30 天
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        dateFormat = '%Y-%m-%d';
        groupFormat = {
          year: { $year: '$date' },
          month: { $month: '$date' },
          day: { $dayOfMonth: '$date' },
        };
        break;
      case 'week':
        // 最近 5 週（本週、前一週、前前週等）
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 35); // 5 週
        dateFormat = '%Y-W%V';
        groupFormat = {
          year: { $year: '$date' },
          week: { $week: '$date' },
        };
        break;
      case 'month':
        // 最近 12 個月
        startDate = new Date(now);
        startDate.setMonth(startDate.getMonth() - 12);
        dateFormat = '%Y-%m';
        groupFormat = {
          year: { $year: '$date' },
          month: { $month: '$date' },
        };
        break;
      case 'year':
        // 最近 5 年
        startDate = new Date(now);
        startDate.setFullYear(startDate.getFullYear() - 5);
        dateFormat = '%Y';
        groupFormat = {
          year: { $year: '$date' },
        };
        break;
    }

    const [incomeData, expenseData] = await Promise.all([
      Transaction.aggregate([
        {
          $match: {
            userId,
            type: 'income',
            date: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: groupFormat,
            total: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1, '_id.day': 1 } },
      ]),
      Transaction.aggregate([
        {
          $match: {
            userId,
            type: 'expense',
            date: { $gte: startDate },
          },
        },
        {
          $group: {
            _id: groupFormat,
            total: { $sum: '$amount' },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1, '_id.day': 1 } },
      ]),
    ]);

    // 創建日期標籤和數據映射
    const incomeMap = new Map<string, number>();
    const expenseMap = new Map<string, number>();

    incomeData.forEach((item) => {
      const key = this.formatDateKey(item._id, period);
      incomeMap.set(key, item.total);
    });

    expenseData.forEach((item) => {
      const key = this.formatDateKey(item._id, period);
      expenseMap.set(key, item.total);
    });

    // 生成完整的日期範圍
    const labels: string[] = [];
    const income: number[] = [];
    const expense: number[] = [];

    // 初始化當前日期
    let current = new Date(startDate);
    
    // 根據週期調整起始日期到週期的開始
    if (period === 'week') {
      // 調整到週的開始（週一）
      const dayOfWeek = current.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 週日調整為上週一
      current.setDate(current.getDate() + diff);
    } else if (period === 'month') {
      // 調整到月初
      current.setDate(1);
    } else if (period === 'year') {
      // 調整到年初
      current.setMonth(0);
      current.setDate(1);
    }

    const end = new Date(now);
    
    // 根據週期調整結束日期到週期的結束
    if (period === 'week') {
      // 調整到本週的開始（週一），這樣可以包含本週
      const dayOfWeek = end.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(end);
      weekStart.setDate(end.getDate() + diff);
      // 確保包含本週，所以結束日期設為本週的開始
      end.setTime(weekStart.getTime());
    } else if (period === 'month') {
      // 包含本月，所以不需要調整
    } else if (period === 'year') {
      // 包含今年，所以不需要調整
    }

    while (current <= end) {
      const key = this.formatDateKeyFromDate(current, period);
      const label = this.formatLabel(current, period);
      
      labels.push(label);
      income.push(incomeMap.get(key) || 0);
      expense.push(expenseMap.get(key) || 0);

      // 移動到下一個時間點
      switch (period) {
        case 'day':
          current.setDate(current.getDate() + 1);
          break;
        case 'week':
          current.setDate(current.getDate() + 7);
          break;
        case 'month':
          current.setMonth(current.getMonth() + 1);
          break;
        case 'year':
          current.setFullYear(current.getFullYear() + 1);
          break;
      }
    }

    // 如果是週，重新格式化標籤為「本週」、「1週前」等
    if (period === 'week') {
      const total = labels.length;
      labels.forEach((_, i) => {
        const weeksAgo = total - i - 1;
        if (weeksAgo === 0) {
          labels[i] = '本週';
        } else if (weeksAgo === 1) {
          labels[i] = '1週前';
        } else if (weeksAgo === 2) {
          labels[i] = '2週前';
        } else if (weeksAgo === 3) {
          labels[i] = '3週前';
        } else if (weeksAgo === 4) {
          labels[i] = '4週前';
        }
      });
    }

    return { labels, income, expense };
  }

  private formatDateKey(id: { year: number; month?: number; week?: number; day?: number }, period: string): string {
    if (period === 'year') {
      return `${id.year}`;
    }
    if (period === 'month') {
      return `${id.year}-${String(id.month || 1).padStart(2, '0')}`;
    }
    if (period === 'week') {
      // MongoDB 的 $week 返回 ISO 週數，需要確保格式一致
      const week = id.week || 1;
      return `${id.year}-W${String(week).padStart(2, '0')}`;
    }
    // day
    return `${id.year}-${String(id.month || 1).padStart(2, '0')}-${String(id.day || 1).padStart(2, '0')}`;
  }

  private formatDateKeyFromDate(date: Date, period: string): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    
    if (period === 'year') {
      return `${year}`;
    }
    if (period === 'month') {
      return `${year}-${String(month).padStart(2, '0')}`;
    }
    if (period === 'week') {
      const week = this.getWeekNumber(date);
      return `${year}-W${String(week).padStart(2, '0')}`;
    }
    // day
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  private formatLabel(date: Date, period: string): string {
    if (period === 'year') {
      return `${date.getFullYear()}年`;
    }
    if (period === 'month') {
      return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (period === 'week') {
      const week = this.getWeekNumber(date);
      return `${date.getFullYear()}/W${week}`;
    }
    // day
    return `${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  }

  private getWeekNumber(date: Date): number {
    // 使用 ISO 週數計算，與 MongoDB 的 $week 保持一致
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7; // 週日為 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum); // 調整到週四（ISO 週的基準日）
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNumber = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
    return weekNumber;
  }
}

