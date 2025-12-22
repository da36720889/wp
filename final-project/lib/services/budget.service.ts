import Budget, { IBudget } from '@/lib/models/Budget';
import { TransactionRepository } from '@/lib/repositories/transaction.repository';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

export class BudgetService {
  private transactionRepository: TransactionRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository();
  }

  /**
   * 獲取或創建當月預算
   */
  async getOrCreateBudget(userId: string, month?: string): Promise<IBudget> {
    await connectDB();

    const targetMonth = month || this.getCurrentMonth();
    let budget = await Budget.findOne({ userId, month: targetMonth });

    if (!budget) {
      budget = await Budget.create({
        userId,
        month: targetMonth,
        totalBudget: undefined,
        categoryBudgets: new Map(),
      });
    }

    return budget;
  }

  /**
   * 更新預算（使用 findOneAndUpdate 確保字段正確寫入 DB）
   */
  async updateBudget(
    userId: string,
    month: string,
    data: {
      totalBudget?: number;
      categoryBudgets?: Record<string, number>;
      dailyBudget?: number;
      weeklyBudget?: number;
      monthlyBudget?: number;
    }
  ): Promise<IBudget> {
    await connectDB();

    logger.info('Updating budget', {
      userId,
      month,
      dataReceived: {
        dailyBudget: data.dailyBudget,
        weeklyBudget: data.weeklyBudget,
        monthlyBudget: data.monthlyBudget,
        totalBudget: data.totalBudget,
      },
    });

    // 構建 $set 物件，只包含有定義的字段
    const updateData: Record<string, unknown> = {};
    
    if (data.totalBudget !== undefined) {
      updateData.totalBudget = data.totalBudget;
    }
    if (data.categoryBudgets) {
      updateData.categoryBudgets = new Map(Object.entries(data.categoryBudgets));
    }
    if (data.dailyBudget !== undefined) {
      updateData.dailyBudget = data.dailyBudget;
    }
    if (data.weeklyBudget !== undefined) {
      updateData.weeklyBudget = data.weeklyBudget;
    }
    if (data.monthlyBudget !== undefined) {
      updateData.monthlyBudget = data.monthlyBudget;
    }

    logger.info('Update data prepared', {
      userId,
      month,
      updateData,
      updateKeys: Object.keys(updateData),
    });

    // 使用 findOneAndUpdate + $set，upsert: true, new: true
    const budget = await Budget.findOneAndUpdate(
      { userId, month },
      { $set: updateData },
      { 
        upsert: true, 
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    if (!budget) {
      throw new Error('Failed to update budget');
    }

    // 強制 debug log：打印 findOneAndUpdate 返回的物件
    const budgetObj = budget.toObject ? budget.toObject() : budget;
    logger.info('Budget updated - raw object (from findOneAndUpdate)', {
      userId,
      month,
      budgetId: budget._id?.toString(),
      keys: Object.keys(budgetObj),
      raw: budgetObj,
      dailyBudget: budget.dailyBudget,
      weeklyBudget: budget.weeklyBudget,
      monthlyBudget: budget.monthlyBudget,
      dailyBudgetType: typeof budget.dailyBudget,
      weeklyBudgetType: typeof budget.weeklyBudget,
      monthlyBudgetType: typeof budget.monthlyBudget,
    });

    // 立即重新查詢確認字段已寫入 DB
    const verifiedBudget = await Budget.findOne({ userId, month });
    if (!verifiedBudget) {
      throw new Error('Failed to verify budget after update');
    }

    const verifiedObj = verifiedBudget.toObject ? verifiedBudget.toObject() : verifiedBudget;
    logger.info('Budget verified - raw object (from findOne)', {
      userId,
      month,
      budgetId: verifiedBudget._id?.toString(),
      keys: Object.keys(verifiedObj),
      raw: verifiedObj,
      dailyBudget: verifiedBudget.dailyBudget,
      weeklyBudget: verifiedBudget.weeklyBudget,
      monthlyBudget: verifiedBudget.monthlyBudget,
      dailyBudgetType: typeof verifiedBudget.dailyBudget,
      weeklyBudgetType: typeof verifiedBudget.weeklyBudget,
      monthlyBudgetType: typeof verifiedBudget.monthlyBudget,
    });

    // 如果重新查詢後字段仍然不存在，記錄警告
    if (!verifiedBudget.dailyBudget && !verifiedBudget.weeklyBudget && !verifiedBudget.monthlyBudget) {
      logger.error('Budget fields not saved to DB!', {
        userId,
        month,
        updateData,
        verifiedKeys: Object.keys(verifiedObj),
      });
    }

    return verifiedBudget;
  }

  /**
   * 獲取預算使用情況
   */
  async getBudgetStatus(userId: string, month?: string): Promise<{
    budget: IBudget;
    totalSpent: number;
    categorySpent: Map<string, number>;
    totalRemaining?: number;
    categoryRemaining: Map<string, number>;
  }> {
    await connectDB();

    const targetMonth = month || this.getCurrentMonth();
    const budget = await this.getOrCreateBudget(userId, targetMonth);

    // 計算當月開始和結束日期
    const [year, monthNum] = targetMonth.split('-').map(Number);
    const startDate = new Date(year, monthNum - 1, 1);
    const endDate = new Date(year, monthNum, 0, 23, 59, 59, 999);

    // 獲取當月所有支出
    const { transactions } = await this.transactionRepository.findByUserId({
      userId,
      startDate,
      endDate,
      type: 'expense',
      limit: 10000,
      offset: 0,
    });

    // 計算總支出
    const totalSpent = transactions.reduce((sum, t) => sum + t.amount, 0);

    // 計算各類別支出
    const categorySpent = new Map<string, number>();
    transactions.forEach((t) => {
      const current = categorySpent.get(t.category) || 0;
      categorySpent.set(t.category, current + t.amount);
    });

    // 計算剩餘預算
    const totalRemaining = budget.totalBudget ? budget.totalBudget - totalSpent : undefined;
    const categoryRemaining = new Map<string, number>();

    if (budget.categoryBudgets) {
      budget.categoryBudgets.forEach((budgetAmount, category) => {
        const spent = categorySpent.get(category) || 0;
        categoryRemaining.set(category, budgetAmount - spent);
      });
    }

    return {
      budget,
      totalSpent,
      categorySpent,
      totalRemaining,
      categoryRemaining,
    };
  }

  /**
   * 檢查是否超過預算（優先級：月 > 周 > 日）
   * 如果檢測到超支，立即返回，不再繼續檢查
   * 返回超過的預算類型和詳細信息，如果沒有超過則返回 null
   */
  async checkBudgetExceeded(userId: string): Promise<{
    period: 'daily' | 'weekly' | 'monthly';
    limit: number;
    current: number;
  } | null> {
    await connectDB();

    const now = new Date();
    const currentMonth = this.getCurrentMonth();
    
    // 直接查詢預算，不使用 getOrCreateBudget（避免創建空記錄）
    const budgetDoc = await Budget.findOne({ userId, month: currentMonth });
    
    if (!budgetDoc) {
      logger.info('No budget document found', { userId, currentMonth });
      return null;
    }

    // 強制 debug log：打印原始物件和所有 keys
    const budgetObj = budgetDoc.toObject ? budgetDoc.toObject() : budgetDoc;
    logger.info('Budget raw object (checkBudgetExceeded)', {
      userId,
      budgetId: budgetDoc._id?.toString(),
      keys: Object.keys(budgetObj),
      raw: JSON.stringify(budgetObj, null, 2),
    });

    // 直接讀取 budget.dailyBudget / budget.weeklyBudget / budget.monthlyBudget
    // 保留 fallback 兼容舊資料（如果字段名不同）
    const daily = budgetDoc.dailyBudget ?? (budgetObj as any).daily ?? null;
    const weekly = budgetDoc.weeklyBudget ?? (budgetObj as any).weekly ?? null;
    const monthly = budgetDoc.monthlyBudget ?? (budgetObj as any).monthly ?? null;

    logger.info('Budget values extracted', {
      userId,
      daily,
      weekly,
      monthly,
      dailyType: typeof daily,
      weeklyType: typeof weekly,
      monthlyType: typeof monthly,
      dailyFromDoc: budgetDoc.dailyBudget,
      weeklyFromDoc: budgetDoc.weeklyBudget,
      monthlyFromDoc: budgetDoc.monthlyBudget,
    });

    // 修正判斷：只要任一個是 number 且 >0 就視為已設定預算
    const hasBudget = [daily, weekly, monthly].some(v => typeof v === 'number' && v > 0);
    
    if (!hasBudget) {
      logger.warn('No valid budget set', { 
        userId,
        currentMonth,
        budgetExists: !!budgetDoc._id,
        daily,
        weekly,
        monthly,
      });
      return null;
    }

    // 修正優先級邏輯：月 > 周 > 日（如果檢測到超支，立即返回）
    // 1. 先檢查當月預算
    if (typeof monthly === 'number' && monthly > 0) {
      const [year, monthNum] = currentMonth.split('-').map(Number);
      const monthStart = new Date(year, monthNum - 1, 1);
      monthStart.setHours(0, 0, 0, 0);
      const monthEnd = new Date(year, monthNum, 0, 23, 59, 59, 999);

      const { transactions: monthTransactions } = await this.transactionRepository.findByUserId({
        userId,
        startDate: monthStart,
        endDate: monthEnd,
        type: 'expense',
        limit: 10000,
        offset: 0,
      });
      const monthlySpent = monthTransactions.reduce((sum, t) => sum + t.amount, 0);

      logger.info('Monthly budget check', {
        userId,
        monthlySpent,
        monthlyLimit: monthly,
        transactionCount: monthTransactions.length,
      });

      if (monthlySpent > monthly) {
        logger.info('Monthly budget exceeded', {
          userId,
          current: monthlySpent,
          limit: monthly,
        });
        return {
          period: 'monthly',
          limit: monthly,
          current: monthlySpent,
        };
      }
    }

    // 2. 再檢查當週預算（只有當月未超支時才檢查）
    if (typeof weekly === 'number' && weekly > 0) {
      const weekStart = new Date(now);
      const dayOfWeek = weekStart.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 調整到週一
      weekStart.setDate(weekStart.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(now);
      weekEnd.setHours(23, 59, 59, 999);

      const { transactions: weekTransactions } = await this.transactionRepository.findByUserId({
        userId,
        startDate: weekStart,
        endDate: weekEnd,
        type: 'expense',
        limit: 10000,
        offset: 0,
      });
      const weeklySpent = weekTransactions.reduce((sum, t) => sum + t.amount, 0);

      logger.info('Weekly budget check', {
        userId,
        weeklySpent,
        weeklyLimit: weekly,
        transactionCount: weekTransactions.length,
      });

      if (weeklySpent > weekly) {
        logger.info('Weekly budget exceeded', {
          userId,
          current: weeklySpent,
          limit: weekly,
        });
        return {
          period: 'weekly',
          limit: weekly,
          current: weeklySpent,
        };
      }
    }

    // 3. 最後檢查當日預算（只有當月、當週都未超支時才檢查）
    if (typeof daily === 'number' && daily > 0) {
      const dayStart = new Date(now);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(now);
      dayEnd.setHours(23, 59, 59, 999);

      const { transactions: dayTransactions } = await this.transactionRepository.findByUserId({
        userId,
        startDate: dayStart,
        endDate: dayEnd,
        type: 'expense',
        limit: 10000,
        offset: 0,
      });
      const dailySpent = dayTransactions.reduce((sum, t) => sum + t.amount, 0);

      logger.info('Daily budget check', {
        userId,
        dailySpent,
        dailyLimit: daily,
        transactionCount: dayTransactions.length,
      });

      if (dailySpent > daily) {
        logger.info('Daily budget exceeded', {
          userId,
          current: dailySpent,
          limit: daily,
        });
        return {
          period: 'daily',
          limit: daily,
          current: dailySpent,
        };
      }
    }

    logger.info('No budget exceeded', { userId });
    return null;
  }

  /**
   * 獲取當前月份（YYYY-MM 格式）
   */
  private getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}

