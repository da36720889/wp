import { TransactionRepository } from '@/lib/repositories/transaction.repository';
import {
  CreateTransactionInput,
  QueryTransactionInput,
  DeleteTransactionInput,
} from '@/lib/schemas/transaction.schema';
import { ITransaction } from '@/lib/models/Transaction';

export class TransactionService {
  private repository: TransactionRepository;

  constructor() {
    this.repository = new TransactionRepository();
  }

  async createTransaction(
    userId: string,
    data: CreateTransactionInput
  ): Promise<ITransaction> {
    return await this.repository.create({ ...data, userId });
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
    const transaction = await this.repository.findById(transactionId, userId);
    if (!transaction) {
      return null;
    }
    return await this.repository.update(transactionId, userId, data);
  }

  async deleteTransaction(transactionId: string, userId: string): Promise<boolean> {
    const transaction = await this.repository.findById(transactionId, userId);
    if (!transaction) {
      return false;
    }
    return await this.repository.delete(transactionId, userId);
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

