import { SavingsGoalService } from './savingsGoal.service';
import { UserService } from './user.service';
import { getLineClient } from './line.service';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

export class SavingsGoalNotificationService {
  private savingsGoalService: SavingsGoalService;
  private userService: UserService;

  constructor() {
    this.savingsGoalService = new SavingsGoalService();
    this.userService = new UserService();
  }

  /**
   * 檢查並發送儲蓄目標達成通知
   * 當儲蓄目標達成時發送通知
   */
  async checkAndNotifyGoalCompletion(userId: string): Promise<void> {
    try {
      await connectDB();

      // 獲取所有未完成的目標
      const goals = await this.savingsGoalService.getGoals(userId, false);

      if (goals.length === 0) {
        return; // 沒有目標，不發送通知
      }

      // 獲取用戶的 LINE ID
      const user = await this.userService.getUserById(userId);
      if (!user || !user.lineUserId) {
        return; // 沒有連結 LINE，不發送通知
      }

      // 檢查每個目標
      for (const goal of goals) {
        // 更新進度（會自動檢查是否完成）
        const previousCompleted = goal.completed;
        await this.savingsGoalService.updateGoalProgress(userId, goal._id.toString());
        
        // 重新獲取目標以檢查是否剛完成
        const updatedGoal = await this.savingsGoalService.getGoal(goal._id.toString(), userId);
        if (!updatedGoal) continue;

        // 如果目標剛完成（之前未完成，現在完成了）
        if (!previousCompleted && updatedGoal.completed) {
          const message = `🎉 恭喜！儲蓄目標達成！\n\n` +
            `目標名稱：${updatedGoal.title}\n` +
            `目標金額：${updatedGoal.targetAmount.toLocaleString()} 元\n` +
            `當前金額：${updatedGoal.currentAmount.toLocaleString()} 元\n` +
            `達成時間：${updatedGoal.completedAt ? new Date(updatedGoal.completedAt).toLocaleString('zh-TW') : '剛剛'}\n\n` +
            `繼續加油，完成更多目標！💪`;

          await this.sendLineNotification(user.lineUserId, message);
          logger.info('Savings goal completion notification sent', { 
            userId, 
            goalId: updatedGoal._id.toString(),
            goalTitle: updatedGoal.title 
          });
        }
      }
    } catch (error) {
      logger.error('Error checking savings goal completion', error as Error);
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
}

