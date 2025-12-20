import SavingsGoal, { ISavingsGoal } from '@/lib/models/SavingsGoal';
import { TransactionRepository } from '@/lib/repositories/transaction.repository';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

export class SavingsGoalService {
  private transactionRepository: TransactionRepository;

  constructor() {
    this.transactionRepository = new TransactionRepository();
  }

  /**
   * 創建儲蓄目標
   */
  async createGoal(
    userId: string,
    data: {
      title: string;
      targetAmount: number;
      deadline?: Date;
    }
  ): Promise<ISavingsGoal> {
    await connectDB();

    const goal = await SavingsGoal.create({
      userId,
      title: data.title,
      targetAmount: data.targetAmount,
      currentAmount: 0,
      deadline: data.deadline,
      completed: false,
    });

    // 計算當前金額（從淨儲蓄：收入 - 支出）
    await this.updateGoalProgress(userId, goal._id.toString());

    return goal;
  }

  /**
   * 獲取用戶的所有目標
   */
  async getGoals(userId: string, includeCompleted: boolean = true): Promise<ISavingsGoal[]> {
    await connectDB();

    const filter: { userId: string; completed?: boolean } = { userId };
    if (!includeCompleted) {
      filter.completed = false;
    }

    return await SavingsGoal.find(filter).sort({ createdAt: -1 });
  }

  /**
   * 獲取單一目標
   */
  async getGoal(goalId: string, userId: string): Promise<ISavingsGoal | null> {
    await connectDB();
    const goal = await SavingsGoal.findOne({ _id: goalId, userId });
    if (goal) {
      await this.updateGoalProgress(userId, goalId);
      return await SavingsGoal.findById(goalId);
    }
    return null;
  }

  /**
   * 更新目標進度（從淨儲蓄計算：收入 - 支出）
   */
  async updateGoalProgress(userId: string, goalId: string): Promise<void> {
    await connectDB();

    const goal = await SavingsGoal.findOne({ _id: goalId, userId });
    if (!goal) return;

    // 獲取所有收入
    const { transactions: incomeTransactions } = await this.transactionRepository.findByUserId({
      userId,
      type: 'income',
      limit: 10000,
      offset: 0,
    });

    // 獲取所有支出
    const { transactions: expenseTransactions } = await this.transactionRepository.findByUserId({
      userId,
      type: 'expense',
      limit: 10000,
      offset: 0,
    });

    // 計算淨儲蓄：總收入 - 總支出
    const totalIncome = incomeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = expenseTransactions.reduce((sum, t) => sum + t.amount, 0);
    const currentAmount = Math.max(0, totalIncome - totalExpense); // 確保不為負數

    goal.currentAmount = currentAmount;

    // 檢查是否完成
    if (!goal.completed && currentAmount >= goal.targetAmount) {
      goal.completed = true;
      goal.completedAt = new Date();
    }

    await goal.save();
  }

  /**
   * 更新目標
   */
  async updateGoal(
    goalId: string,
    userId: string,
    data: {
      title?: string;
      targetAmount?: number;
      deadline?: Date;
    }
  ): Promise<ISavingsGoal | null> {
    await connectDB();

    const goal = await SavingsGoal.findOne({ _id: goalId, userId });
    if (!goal) return null;

    if (data.title) goal.title = data.title;
    if (data.targetAmount !== undefined) goal.targetAmount = data.targetAmount;
    if (data.deadline !== undefined) goal.deadline = data.deadline;

    await goal.save();
    await this.updateGoalProgress(userId, goalId);

    return goal;
  }

  /**
   * 刪除目標
   */
  async deleteGoal(goalId: string, userId: string): Promise<boolean> {
    await connectDB();

    const result = await SavingsGoal.deleteOne({ _id: goalId, userId });
    return result.deletedCount > 0;
  }

  /**
   * 計算目標進度百分比
   */
  calculateProgress(goal: ISavingsGoal): {
    percentage: number;
    remaining: number;
    daysRemaining?: number;
  } {
    const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
    const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);

    let daysRemaining: number | undefined;
    if (goal.deadline && !goal.completed) {
      const now = new Date();
      const diff = goal.deadline.getTime() - now.getTime();
      daysRemaining = Math.ceil(diff / (1000 * 60 * 60 * 24));
    }

    return { percentage, remaining, daysRemaining };
  }
}

