import { BudgetService } from './budget.service';
import { UserService } from './user.service';
import { getLineClient } from './line.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

export class BudgetNotificationService {
  private budgetService: BudgetService;
  private userService: UserService;

  constructor() {
    this.budgetService = new BudgetService();
    this.userService = new UserService();
  }

  /**
   * 檢查並發送預算提醒
   * 當預算使用率達到 80%、90%、100% 時發送通知
   */
  async checkAndNotifyBudget(userId: string, month?: string): Promise<void> {
    try {
      await connectDB();

      const status = await this.budgetService.getBudgetStatus(userId, month);

      // 如果沒有設定預算，不發送通知
      if (!status.budget.totalBudget || status.budget.totalBudget === 0) {
        return;
      }

      const usagePercent = (status.totalSpent / status.budget.totalBudget) * 100;
      const remaining = status.totalRemaining || 0;

      // 獲取用戶的 LINE ID
      const user = await this.userService.getUserById(userId);
      if (!user || !user.lineUserId) {
        return; // 沒有連結 LINE，不發送通知
      }

      let message: string | null = null;

      // 根據使用率發送不同級別的提醒
      if (usagePercent >= 100) {
        message = `⚠️ 預算超支提醒\n\n` +
          `您本月的預算已超支！\n` +
          `總預算：${this.formatCurrency(status.budget.totalBudget)}\n` +
          `已使用：${this.formatCurrency(status.totalSpent)}\n` +
          `超支：${this.formatCurrency(Math.abs(remaining))}\n\n` +
          `請注意控制支出！`;
      } else if (usagePercent >= 90) {
        message = `🔴 預算警告\n\n` +
          `您的預算使用率已達 ${usagePercent.toFixed(1)}%！\n` +
          `總預算：${this.formatCurrency(status.budget.totalBudget)}\n` +
          `已使用：${this.formatCurrency(status.totalSpent)}\n` +
          `剩餘：${this.formatCurrency(remaining)}\n\n` +
          `請注意控制支出！`;
      } else if (usagePercent >= 80) {
        message = `🟡 預算提醒\n\n` +
          `您的預算使用率已達 ${usagePercent.toFixed(1)}%\n` +
          `總預算：${this.formatCurrency(status.budget.totalBudget)}\n` +
          `已使用：${this.formatCurrency(status.totalSpent)}\n` +
          `剩餘：${this.formatCurrency(remaining)}`;
      }

      // 檢查類別預算
      if (status.budget.categoryBudgets && status.budget.categoryBudgets.size > 0) {
        const categoryWarnings: string[] = [];
        
        status.budget.categoryBudgets.forEach((budgetAmount, category) => {
          const spent = status.categorySpent.get(category) || 0;
          const categoryPercent = (spent / budgetAmount) * 100;
          
          if (categoryPercent >= 100) {
            categoryWarnings.push(`⚠️ ${category} 類別已超支（${this.formatCurrency(spent)} / ${this.formatCurrency(budgetAmount)}）`);
          } else if (categoryPercent >= 90) {
            categoryWarnings.push(`🔴 ${category} 類別使用率 ${categoryPercent.toFixed(1)}%`);
          }
        });

        if (categoryWarnings.length > 0) {
          if (message) {
            message += `\n\n類別預算提醒：\n${categoryWarnings.join('\n')}`;
          } else {
            message = `📊 類別預算提醒\n\n${categoryWarnings.join('\n')}`;
          }
        }
      }

      // 發送 LINE 通知
      if (message) {
        await this.sendLineNotification(user.lineUserId, message);
        logger.info('Budget notification sent', { userId, month, usagePercent });
      }
    } catch (error) {
      logger.error('Error checking budget notification', error as Error);
    }
  }

  /**
   * 發送 LINE 通知
   */
  private async sendLineNotification(lineUserId: string, message: string): Promise<void> {
    try {
      const client = getLineClient();
      await client.pushMessage(lineUserId, {
        type: 'text',
        text: message,
      });
    } catch (error) {
      logger.error('Error sending LINE notification', error as Error, { lineUserId });
    }
  }

  /**
   * 格式化貨幣
   */
  private formatCurrency(amount: number): string {
    return new Intl.NumberFormat('zh-TW', {
      style: 'currency',
      currency: 'TWD',
      minimumFractionDigits: 0,
    }).format(amount);
  }
}

