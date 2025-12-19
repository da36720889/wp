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
   * 更新預算
   */
  async updateBudget(
    userId: string,
    month: string,
    data: {
      totalBudget?: number;
      categoryBudgets?: Record<string, number>;
    }
  ): Promise<IBudget> {
    await connectDB();

    let budget = await Budget.findOne({ userId, month });
    if (!budget) {
      budget = await Budget.create({
        userId,
        month,
        totalBudget: data.totalBudget,
        categoryBudgets: data.categoryBudgets ? new Map(Object.entries(data.categoryBudgets)) : new Map(),
      });
    } else {
      if (data.totalBudget !== undefined) {
        budget.totalBudget = data.totalBudget;
      }
      if (data.categoryBudgets) {
        budget.categoryBudgets = new Map(Object.entries(data.categoryBudgets));
      }
      await budget.save();
    }

    return budget;
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
   * 獲取當前月份（YYYY-MM 格式）
   */
  private getCurrentMonth(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}

