import { TransactionRepository } from '@/lib/repositories/transaction.repository';
import {
  CreateTransactionInput,
  QueryTransactionInput,
  DeleteTransactionInput,
} from '@/lib/schemas/transaction.schema';
import { ITransaction } from '@/lib/models/Transaction';
import { SavingsGoalService } from './savingsGoal.service';

export class TransactionService {
  private repository: TransactionRepository;
  private savingsGoalService: SavingsGoalService;

  constructor() {
    this.repository = new TransactionRepository();
    this.savingsGoalService = new SavingsGoalService();
  }

  async createTransaction(
    userId: string,
    data: CreateTransactionInput
  ): Promise<ITransaction> {
    const transaction = await this.repository.create({ ...data, userId });
    
    // 無論是收入還是支出，都更新所有儲蓄目標的進度（非同步，不阻塞）
    // 因為儲蓄 = 收入 - 支出，所以任何交易都會影響儲蓄金額
    Promise.resolve().then(async () => {
      try {
        const goals = await this.savingsGoalService.getGoals(userId, false);
        await Promise.all(
          goals.map(goal => 
            this.savingsGoalService.updateGoalProgress(userId, goal._id.toString())
          )
        );
      } catch (err) {
        console.error('Error updating savings goal progress:', err);
      }
    }).catch(err => {
      console.error('Error in savings goal update promise:', err);
    });
    
    return transaction;
  }

  async getTransactions(query: QueryTransactionInput): Promise<{
    transactions: ITransaction[];
    total: number;
  }> {
    return await this.repository.findByUserId(query);
  }

  async getTransaction(transactionId: string, userId: string): Promise<ITransaction | null> {
    return await this.repository.findById(transactionId, userId);
  }

  async updateTransaction(
    transactionId: string,
    userId: string,
    data: Partial<CreateTransactionInput>
  ): Promise<ITransaction | null> {
    const oldTransaction = await this.repository.findById(transactionId, userId);
    if (!oldTransaction) {
      return null;
    }
    
    const updatedTransaction = await this.repository.update(transactionId, userId, data);
    
    // 無論是收入還是支出，只要交易被更新（金額或類型改變），都應該更新儲蓄目標
    // 因為儲蓄 = 收入 - 支出
    if (updatedTransaction) {
      this.savingsGoalService.getGoals(userId, false).then(goals => {
        goals.forEach(goal => {
          this.savingsGoalService.updateGoalProgress(userId, goal._id.toString()).catch(err => {
            console.error('Error updating savings goal progress:', err);
          });
        });
      }).catch(err => {
        console.error('Error fetching savings goals:', err);
      });
    }
    
    return updatedTransaction;
  }

  async deleteTransaction(transactionId: string, userId: string): Promise<boolean> {
    const transaction = await this.repository.findById(transactionId, userId);
    if (!transaction) {
      return false;
    }
    
    const deleted = await this.repository.delete(transactionId, userId);
    
    // 刪除交易後，無論是收入還是支出，都應該更新儲蓄目標
    // 因為儲蓄 = 收入 - 支出
    if (deleted) {
      this.savingsGoalService.getGoals(userId, false).then(goals => {
        goals.forEach(goal => {
          this.savingsGoalService.updateGoalProgress(userId, goal._id.toString()).catch(err => {
            console.error('Error updating savings goal progress:', err);
          });
        });
      }).catch(err => {
        console.error('Error fetching savings goals:', err);
      });
    }
    
    return deleted;
  }

  async getSummary(userId: string, startDate?: Date, endDate?: Date): Promise<{
    totalIncome: number;
    totalExpense: number;
    balance: number;
  }> {
    return await this.repository.getSummary(userId, startDate, endDate);
  }

  async getTrends(userId: string, period: 'day' | 'week' | 'month' | 'year'): Promise<{
    labels: string[];
    income: number[];
    expense: number[];
  }> {
    return await this.repository.getTrends(userId, period);
  }
}

