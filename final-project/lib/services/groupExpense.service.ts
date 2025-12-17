import GroupExpense, { IGroupExpense, IParticipant } from '@/lib/models/GroupExpense';
import Transaction from '@/lib/models/Transaction';
import { TransactionService } from './transaction.service';
import { UserService } from './user.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

export interface SettlementResult {
  from: string; // LINE 用戶 ID
  to: string; // LINE 用戶 ID
  amount: number; // 轉帳金額
  fromName?: string;
  toName?: string;
}

export class GroupExpenseService {
  private transactionService: TransactionService;
  private userService: UserService;

  constructor() {
    this.transactionService = new TransactionService();
    this.userService = new UserService();
  }

  /**
   * 創建群組分帳
   */
  async createGroupExpense(
    groupId: string,
    creatorLineUserId: string,
    totalAmount: number,
    participants: IParticipant[],
    description?: string,
    groupName?: string
  ): Promise<IGroupExpense> {
    await connectDB();

    // 驗證總金額與參與者金額
    const totalPaid = participants.reduce((sum, p) => sum + p.paid, 0);
    const totalShare = participants.reduce((sum, p) => sum + p.share, 0);

    if (Math.abs(totalPaid - totalAmount) > 0.01) {
      throw new Error(`實際支付總額 ${totalPaid} 與總金額 ${totalAmount} 不符`);
    }

    if (Math.abs(totalShare - totalAmount) > 0.01) {
      throw new Error(`分攤總額 ${totalShare} 與總金額 ${totalAmount} 不符`);
    }

    const groupExpense = new GroupExpense({
      groupId,
      groupName,
      creatorLineUserId,
      totalAmount,
      description,
      participants,
      settled: false,
    });

    return await groupExpense.save();
  }

  /**
   * 獲取群組的所有分帳記錄
   */
  async getGroupExpenses(
    groupId: string,
    includeSettled: boolean = true
  ): Promise<IGroupExpense[]> {
    await connectDB();

    const filter: { groupId: string; settled?: boolean } = { groupId };
    if (!includeSettled) {
      filter.settled = false;
    }

    return await GroupExpense.find(filter).sort({ createdAt: -1 });
  }

  /**
   * 獲取單一分帳記錄
   */
  async getGroupExpense(expenseId: string): Promise<IGroupExpense | null> {
    await connectDB();
    return await GroupExpense.findById(expenseId);
  }

  /**
   * 計算分帳結果（誰該給誰多少錢）
   * 使用最小轉帳次數算法
   */
  calculateSettlements(participants: IParticipant[]): SettlementResult[] {
    // 計算每個人應付/應收的金額
    const balances = new Map<string, number>();

    participants.forEach((p) => {
      const current = balances.get(p.lineUserId) || 0;
      const balance = p.paid - p.share; // 正數表示多付了（應收），負數表示少付了（應付）
      balances.set(p.lineUserId, current + balance);
    });

    // 分離應收和應付的人
    const creditors: Array<{ lineUserId: string; amount: number; name?: string }> = [];
    const debtors: Array<{ lineUserId: string; amount: number; name?: string }> = [];

    participants.forEach((p) => {
      const balance = balances.get(p.lineUserId) || 0;
      if (balance > 0.01) {
        // 應收（多付了）
        creditors.push({
          lineUserId: p.lineUserId,
          amount: balance,
          name: p.name,
        });
      } else if (balance < -0.01) {
        // 應付（少付了）
        debtors.push({
          lineUserId: p.lineUserId,
          amount: Math.abs(balance),
          name: p.name,
        });
      }
    });

    // 按金額排序（從大到小）
    creditors.sort((a, b) => b.amount - a.amount);
    debtors.sort((a, b) => b.amount - a.amount);

    // 最小轉帳次數算法
    const settlements: SettlementResult[] = [];
    let creditorIndex = 0;
    let debtorIndex = 0;

    while (creditorIndex < creditors.length && debtorIndex < debtors.length) {
      const creditor = creditors[creditorIndex];
      const debtor = debtors[debtorIndex];

      const amount = Math.min(creditor.amount, debtor.amount);

      settlements.push({
        from: debtor.lineUserId,
        to: creditor.lineUserId,
        amount: Math.round(amount * 100) / 100, // 保留兩位小數
        fromName: debtor.name,
        toName: creditor.name,
      });

      creditor.amount -= amount;
      debtor.amount -= amount;

      if (creditor.amount < 0.01) {
        creditorIndex++;
      }
      if (debtor.amount < 0.01) {
        debtorIndex++;
      }
    }

    return settlements;
  }

  /**
   * 結算分帳並匯入個人記帳
   */
  async settleGroupExpense(
    expenseId: string,
    creatorLineUserId: string
  ): Promise<{ settlements: SettlementResult[]; transactionIds: string[] }> {
    await connectDB();

    const expense = await GroupExpense.findById(expenseId);
    if (!expense) {
      throw new Error('找不到分帳記錄');
    }

    if (expense.creatorLineUserId !== creatorLineUserId) {
      throw new Error('只有建立者可以結算分帳');
    }

    if (expense.settled) {
      throw new Error('此分帳已經結算過了');
    }

    // 計算分帳結果
    const settlements = this.calculateSettlements(expense.participants);

    // 為每個參與者創建交易記錄
    const transactionIds: string[] = [];
    const groupName = expense.groupName || '群組';

    for (const participant of expense.participants) {
      // 獲取或創建用戶
      let user = await this.userService.findByLineUserId(participant.lineUserId);
      if (!user) {
        user = await this.userService.createUserWithLine(participant.lineUserId);
      }
      const unifiedUserId = user._id.toString();

      // 創建「群組出資」記錄（實際支付的金額）
      if (participant.paid > 0) {
        const contributionTransaction = await this.transactionService.createTransaction(
          unifiedUserId,
          {
            amount: participant.paid,
            category: '群組出資',
            description: `${groupName}出資${expense.description ? ` - ${expense.description}` : ''}`,
            type: 'expense',
            date: new Date(),
          }
        );

        // 直接更新 MongoDB 文檔以添加群組標記
        await Transaction.findByIdAndUpdate(contributionTransaction._id, {
          groupExpenseId: expenseId,
          groupExpenseType: 'contribution',
        });

        transactionIds.push(contributionTransaction._id.toString());
      }

      // 計算應收/應付金額
      const balance = participant.paid - participant.share;

      // 創建「群組回收」記錄（如果應收金額 > 0）
      if (balance > 0.01) {
        const reimbursementTransaction = await this.transactionService.createTransaction(
          unifiedUserId,
          {
            amount: balance,
            category: '群組回收',
            description: `${groupName}回收${expense.description ? ` - ${expense.description}` : ''}`,
            type: 'income',
            date: new Date(),
          }
        );

        // 直接更新 MongoDB 文檔以添加群組標記
        await Transaction.findByIdAndUpdate(reimbursementTransaction._id, {
          groupExpenseId: expenseId,
          groupExpenseType: 'reimbursement',
        });

        transactionIds.push(reimbursementTransaction._id.toString());
      }
    }

    // 標記為已結算
    expense.settled = true;
    expense.settledAt = new Date();
    expense.transactions = transactionIds;
    await expense.save();

    logger.info('Group expense settled', {
      expenseId,
      creatorLineUserId,
      settlementsCount: settlements.length,
      transactionsCount: transactionIds.length,
    });

    return { settlements, transactionIds };
  }

  /**
   * 格式化分帳結果為文字訊息
   */
  formatSettlements(settlements: SettlementResult[]): string {
    if (settlements.length === 0) {
      return '✅ 分帳已平衡，無需轉帳。';
    }

    let message = '💰 分帳結果：\n\n';
    settlements.forEach((s, index) => {
      const fromName = s.fromName || s.from.substring(0, 8);
      const toName = s.toName || s.to.substring(0, 8);
      message += `${index + 1}. ${fromName} → ${toName}：${s.amount} 元\n`;
    });

    return message;
  }
}

