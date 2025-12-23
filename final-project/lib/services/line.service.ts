import { Client, middleware, MiddlewareConfig, WebhookEvent } from '@line/bot-sdk';
import { TransactionService } from './transaction.service';
import { LLMService } from './llm.service';
import { UserService } from './user.service';
import { GroupExpenseService } from './groupExpense.service';
import { PetService } from './pet.service';
import { BudgetNotificationService } from './budgetNotification.service';
import { BudgetService } from './budget.service';
import { SavingsGoalService } from './savingsGoal.service';
import { SavingsGoalNotificationService } from './savingsGoalNotification.service';
import { createTransactionSchema } from '@/lib/schemas/transaction.schema';
import { logger } from '@/lib/utils/logger';
import { AppError } from '@/lib/utils/errors';
import connectDB from '@/lib/db/mongodb';
import { IParticipant } from '@/lib/models/GroupExpense';
import { ITransaction } from '@/lib/models/Transaction';

function getLineConfig() {
  const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelSecret = process.env.LINE_CHANNEL_SECRET;

  if (!channelAccessToken || !channelSecret) {
    throw new Error('LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET must be set');
  }

  return {
    channelAccessToken,
    channelSecret,
  };
}

export function getLineClient(): Client {
  const config = getLineConfig();
  return new Client({
    channelAccessToken: config.channelAccessToken,
  });
}

export function getLineMiddlewareConfig(): MiddlewareConfig {
  const config = getLineConfig();
  return {
    channelAccessToken: config.channelAccessToken,
    channelSecret: config.channelSecret,
  };
}

export class LineService {
  private transactionService: TransactionService;
  private llmService: LLMService;
  private userService: UserService;
  private groupExpenseService: GroupExpenseService;
  private petService: PetService;
  private budgetNotificationService: BudgetNotificationService;
  private budgetService: BudgetService;
  private savingsGoalService: SavingsGoalService;
  private savingsGoalNotificationService: SavingsGoalNotificationService;

  constructor() {
    this.transactionService = new TransactionService();
    this.llmService = new LLMService();
    this.userService = new UserService();
    this.groupExpenseService = new GroupExpenseService();
    this.petService = new PetService();
    this.budgetNotificationService = new BudgetNotificationService();
    this.budgetService = new BudgetService();
    this.savingsGoalService = new SavingsGoalService();
    this.savingsGoalNotificationService = new SavingsGoalNotificationService();
  }

  private async getOrCreateUser(lineUserId: string): Promise<string> {
    await connectDB();
    let user = await this.userService.findByLineUserId(lineUserId);
    if (!user) {
      user = await this.userService.createUserWithLine(lineUserId);
    }
    return user._id.toString();
  }

  async handleMessage(event: WebhookEvent): Promise<void> {
    if (event.type !== 'message') {
      logger.info('Skipping non-message event', { eventType: event.type });
      return;
    }

    if (event.message.type !== 'text') {
      logger.info('Skipping non-text message', { 
        eventType: event.type, 
        messageType: event.message.type 
      });
      return;
    }

    const userId = event.source.userId;
    if (!userId) {
      logger.warn('Received message without userId', { 
        sourceType: event.source?.type,
        source: event.source 
      });
      return;
    }

    const message = event.message.text.trim();
    const replyToken = event.replyToken;
    
    logger.info('Received LINE message', { 
      userId, 
      message,
      replyToken: replyToken ? 'present' : 'missing',
      messageLength: message.length
    });

    if (!replyToken) {
      logger.error('Missing replyToken in LINE message event', undefined, { userId, message });
      return;
    }

    try {
      // 檢查是否為自然語言指令並轉換
      const normalizedMessage = this.normalizeNaturalLanguageCommand(message);
      
      // 處理特殊指令（包括轉換後的自然語言指令）
      if (normalizedMessage.startsWith('/')) {
        const groupId = event.source.type === 'group' ? (event.source as { groupId?: string }).groupId : undefined;
        await this.handleCommand(userId, normalizedMessage, event.replyToken, groupId);
        return;
      }

      // 檢查是否為預算設定訊息（優先於記帳訊息處理）
      const unifiedUserId = await this.getOrCreateUser(userId);
      
      // 檢查是否為儲蓄目標設定訊息
      const savingsGoalMatch = this.parseSavingsGoalMessage(message);
      if (savingsGoalMatch) {
        logger.info('Setting savings goal', {
          userId: unifiedUserId,
          title: savingsGoalMatch.title,
          targetAmount: savingsGoalMatch.targetAmount,
          deadline: savingsGoalMatch.deadline,
        });
        const goal = await this.savingsGoalService.createGoal(unifiedUserId, {
          title: savingsGoalMatch.title,
          targetAmount: savingsGoalMatch.targetAmount,
          deadline: savingsGoalMatch.deadline,
        });
        await this.savingsGoalService.updateGoalProgress(unifiedUserId, goal._id.toString());
        const updatedGoal = await this.savingsGoalService.getGoal(goal._id.toString(), unifiedUserId);
        if (updatedGoal) {
          const progress = this.savingsGoalService.calculateProgress(updatedGoal);
          const deadlineText = updatedGoal.deadline 
            ? `\n期限：${new Date(updatedGoal.deadline).toLocaleDateString('zh-TW')}（剩餘 ${progress.daysRemaining} 天）`
            : '';
          await this.replyMessageWithQuickReply(
            event.replyToken,
            `✅ 儲蓄目標設定成功！\n\n目標名稱：${updatedGoal.title}\n目標金額：${updatedGoal.targetAmount.toLocaleString()} 元\n當前進度：${updatedGoal.currentAmount.toLocaleString()} 元（${progress.percentage.toFixed(1)}%）\n還需：${progress.remaining.toLocaleString()} 元${deadlineText}`
          );
        }
        return;
      }
      
      const budgetMatch = this.parseBudgetMessage(message);
      if (budgetMatch) {
        const currentMonth = this.getCurrentMonth();
        logger.info('Setting budget', {
          userId: unifiedUserId,
          currentMonth,
          daily: budgetMatch.daily,
          weekly: budgetMatch.weekly,
          monthly: budgetMatch.monthly,
          message: message,
        });
        const updatedBudget = await this.budgetService.updateBudget(unifiedUserId, currentMonth, {
          dailyBudget: budgetMatch.daily,
          weeklyBudget: budgetMatch.weekly,
          monthlyBudget: budgetMatch.monthly,
        });
        
        // 重新載入以確認保存成功
        const Budget = (await import('@/lib/models/Budget')).default;
        const savedBudget = await Budget.findById(updatedBudget._id);
        
        logger.info('Budget updated successfully', {
          userId: unifiedUserId,
          budgetId: updatedBudget._id?.toString(),
          dailyBudget: savedBudget?.dailyBudget,
          weeklyBudget: savedBudget?.weeklyBudget,
          monthlyBudget: savedBudget?.monthlyBudget,
          savedDailyBudget: savedBudget?.dailyBudget,
          savedWeeklyBudget: savedBudget?.weeklyBudget,
          savedMonthlyBudget: savedBudget?.monthlyBudget,
        });
        await this.replyMessageWithQuickReply(
          event.replyToken,
          `✅ 預算設定成功！\n\n單日預算：${budgetMatch.daily.toLocaleString()} 元\n單週預算：${budgetMatch.weekly.toLocaleString()} 元\n單月預算：${budgetMatch.monthly.toLocaleString()} 元`
        );
        return;
      }

      // 使用 LLM 解析記帳訊息
      const parsed = await this.llmService.parseTransactionMessage(message);
      if (!parsed) {
        const helpMessage = `🤔 我無法理解您的訊息呢！\n\n` +
          `💡 記帳很簡單，直接告訴我：\n` +
          `• 「午餐 150 元」\n` +
          `• 「交通 50」\n` +
          `• 「收入 5000」\n\n` +
          `📋 或輸入 /help 查看完整指令說明\n\n` +
          `💬 只要包含「金額」和「項目名稱」就可以了！`;
        await this.replyMessage(event.replyToken, helpMessage);
        return;
      }

      // 驗證並創建交易記錄
      const validated = createTransactionSchema.parse(parsed);
      const transaction = await this.transactionService.createTransaction(unifiedUserId, validated);
      
      logger.info('Transaction created', {
        userId: unifiedUserId,
        transactionId: transaction._id,
        amount: transaction.amount,
        type: transaction.type,
        date: transaction.date,
      });

      // 餵食電子雞（背景執行，不顯示訊息）
      Promise.resolve().then(async () => {
        try {
          await this.petService.feedPet(unifiedUserId, validated.amount);
        } catch (error) {
          logger.error('Error feeding pet', error as Error);
        }
      }).catch(err => {
        logger.error('Error in pet feeding promise', err as Error);
      });

      // 檢查預算（背景執行，不顯示訊息，僅觸發通知服務）
      if (validated.type === 'expense') {
        Promise.resolve().then(async () => {
          try {
            await this.budgetNotificationService.checkAndNotifyBudget(unifiedUserId);
          } catch (err) {
            logger.error('Error in budget notification service', err as Error);
          }
        }).catch(err => {
          logger.error('Error in budget notification promise', err as Error);
        });
      }

      // 檢查儲蓄目標達成（背景執行，不顯示訊息，僅觸發通知服務）
      Promise.resolve().then(async () => {
        try {
          await this.savingsGoalNotificationService.checkAndNotifyGoalCompletion(unifiedUserId);
        } catch (err) {
          logger.error('Error in savings goal notification service', err as Error);
        }
      }).catch(err => {
        logger.error('Error in savings goal notification promise', err as Error);
      });

      // 構建回覆訊息（交易成功 + 預算警告，同一次 reply）
      const periodLabels = {
        daily: '單日',
        weekly: '單週',
        monthly: '單月',
      };
      
      let replyMessage = `✅ 已記錄：${validated.category} NT$${validated.amount.toLocaleString()}`;
      
      if (validated.type === 'expense') {
        try {
          // 等待一小段時間確保交易已完全保存到資料庫
          await new Promise(resolve => setTimeout(resolve, 100));
          
          // 檢查總預算（日/週/月）
          const budgetExceeded = await this.budgetService.checkBudgetExceeded(unifiedUserId);
          logger.info('Budget check result', { 
            userId: unifiedUserId, 
            exceeded: budgetExceeded,
            transactionAmount: validated.amount 
          });
          
          // 檢查類別預算
          const categoryBudgetExceeded = await this.budgetService.checkCategoryBudgetExceeded(unifiedUserId, validated.category);
          logger.info('Category budget check result', { 
            userId: unifiedUserId, 
            category: validated.category,
            exceeded: categoryBudgetExceeded,
            transactionAmount: validated.amount 
          });
          
          // 顯示總預算警告
          if (budgetExceeded) {
            const { period, limit, current } = budgetExceeded;
            const periodLabel = periodLabels[period] || period;
            replyMessage += `\n\n⚠️ 已超過${periodLabel}預算！目前 ${current.toLocaleString()} / ${limit.toLocaleString()}`;
            logger.info('Budget exceeded warning added', {
              userId: unifiedUserId,
              period,
              current,
              limit,
            });
          }
          
          // 顯示類別預算警告
          if (categoryBudgetExceeded) {
            const { category, limit, current } = categoryBudgetExceeded;
            replyMessage += `\n\n⚠️ 「${category}」類別已超支！目前 ${current.toLocaleString()} / ${limit.toLocaleString()}`;
            logger.info('Category budget exceeded warning added', {
              userId: unifiedUserId,
              category,
              current,
              limit,
            });
          }
          
          if (!budgetExceeded && !categoryBudgetExceeded) {
            logger.info('No budget exceeded', { userId: unifiedUserId });
          }
        } catch (err) {
          logger.error('Error checking budget exceeded', err as Error, { 
            userId: unifiedUserId,
            errorMessage: err instanceof Error ? err.message : String(err)
          });
        }
      }

      // 發送成功訊息（帶 quick reply 按鈕）
      await this.replyMessageWithQuickReply(event.replyToken, replyMessage);

      logger.info('Transaction created', { lineUserId: userId, unifiedUserId, transactionId: transaction._id });
    } catch (error) {
      logger.error('Error handling LINE message', error as Error, { userId, message });
      
      // 错误处理：如果 replyToken 可能已使用，使用 pushMessage 发送错误
      const client = getLineClient();
      const errorMessage = error instanceof AppError 
        ? `❌ 錯誤：${error.message}`
        : '❌ 處理您的訊息時發生錯誤，請稍後再試。';
      
      // 尝试使用 pushMessage（因为 replyToken 可能已使用）
      try {
        await client.pushMessage(userId, {
          type: 'text',
          text: errorMessage,
        });
      } catch (pushError) {
        logger.error('Error sending error message via pushMessage', pushError as Error);
        // 如果 pushMessage 也失败，尝试使用 replyMessage（可能 replyToken 还未使用）
        if (event.replyToken) {
          try {
            await this.replyMessage(event.replyToken, errorMessage);
          } catch (replyError) {
            logger.error('Error sending error message via replyMessage', replyError as Error);
          }
        }
      }
    }
  }

  /**
   * 將自然語言轉換為對應的指令
   */
  private normalizeNaturalLanguageCommand(message: string): string {
    const trimmed = message.trim().toLowerCase();
    
    // 指令映射表：自然語言關鍵字 -> 指令
    const commandMap: Record<string, string> = {
      // list 相關
      '最近紀錄': '/list',
      '最近記錄': '/list',
      '最近記帳': '/list',
      '查詢記錄': '/list',
      '查詢紀錄': '/list',
      '查看記錄': '/list',
      '查看紀錄': '/list',
      '記錄列表': '/list',
      '紀錄列表': '/list',
      'recent': '/list',
      'records': '/list',
      'list': '/list',
      'history': '/list',
      '查詢': '/list',
      '列表': '/list',
      
      // summary 相關
      '摘要': '/summary',
      '總結': '/summary',
      '總覽': '/summary',
      '統計': '/summary',
      'summary': '/summary',
      'overview': '/summary',
      'statistics': '/summary',
      'stats': '/summary',
      '總計': '/summary',
      
      // delete 相關（需要額外參數，這裡只做初步識別）
      '刪除': '/delete',
      '刪掉': '/delete',
      '移除': '/delete',
      'delete': '/delete',
      'remove': '/delete',
      'del': '/delete',
      
      // pet 相關
      '電子雞': '/pet',
      '寵物': '/pet',
      '我的寵物': '/pet',
      '寵物狀態': '/pet',
      'pet': '/pet',
      'tamagotchi': '/pet',
      '我的雞': '/pet',
      '小雞': '/pet',
      
      // myid 相關
      '我的id': '/myid',
      '用戶id': '/myid',
      'line id': '/myid',
      'id': '/myid',
      'myid': '/myid',
      'userid': '/myid',
      '我的用戶id': '/myid',
      
      // help 相關
      '幫助': '/help',
      '說明': '/help',
      '使用說明': '/help',
      '如何使用': '/help',
      '功能': '/help',
      'help': '/help',
      '說明書': '/help',
      '教學': '/help',

      // savings/goal 相關
      '儲蓄': '/savings',
      '儲蓄目標': '/savings',
      '目標': '/savings',
      '我的目標': '/savings',
      '查看目標': '/savings',
      '查看儲蓄': '/savings',
      'savings': '/savings',
      'goal': '/savings',
      'goals': '/savings',
    };
    
    // 檢查完全匹配
    if (commandMap[trimmed]) {
      return commandMap[trimmed];
    }
    
    // 檢查部分匹配（處理帶參數的情況，如 "刪除 i1"）
    for (const [keyword, command] of Object.entries(commandMap)) {
      if (trimmed.startsWith(keyword + ' ') || trimmed === keyword) {
        // 如果有後續參數，保留它們
        const rest = message.slice(keyword.length).trim();
        return rest ? `${command} ${rest}` : command;
      }
    }
    
    // 如果已經是以 / 開頭的指令，直接返回
    if (message.startsWith('/')) {
      return message;
    }
    
    // 不匹配，返回原訊息
    return message;
  }

  private async handleCommand(
    lineUserId: string,
    command: string,
    replyToken: string,
    groupId?: string
  ): Promise<void> {
    const [cmd, ...args] = command.slice(1).split(' ');

    try {
      // 獲取統一用戶 ID
      const unifiedUserId = await this.getOrCreateUser(lineUserId);

      switch (cmd.toLowerCase()) {
        case 'list':
        case '查詢':
        case 'ls':
        case 'recent':
        case 'records':
        case 'history':
        case '最近紀錄':
        case '最近記錄':
        case '最近記帳':
        case '查詢記錄':
        case '查詢紀錄':
        case '查看記錄':
        case '查看紀錄':
        case '記錄列表':
        case '紀錄列表':
        case '列表':
        case '列表': {
          const limit = args[0] ? parseInt(args[0], 10) : 10;
          const result = await this.transactionService.getTransactions({
            userId: unifiedUserId,
            limit: Math.min(limit, 50),
            offset: 0,
          });

          if (result.transactions.length === 0) {
            await this.replyMessage(replyToken, '📝 目前沒有任何記帳記錄。');
            return;
          }

          // 分離收入和支出
          const incomes = result.transactions.filter((t) => t.type === 'income');
          const expenses = result.transactions.filter((t) => t.type === 'expense');

          let response = `📝 最近的 ${result.transactions.length} 筆記錄：\n\n`;

          // 顯示收入
          if (incomes.length > 0) {
            response += `💰 收入：\n`;
            incomes.forEach((t, index) => {
              const date = new Date(t.date).toLocaleDateString('zh-TW');
              response += `i${index + 1}. ${t.amount} 元\n`;
              response += `   類別：${t.category}${t.description ? ` | ${t.description}` : ''}\n`;
              response += `   日期：${date}\n\n`;
            });
          }

          // 顯示支出
          if (expenses.length > 0) {
            response += `💸 支出：\n`;
            expenses.forEach((t, index) => {
              const date = new Date(t.date).toLocaleDateString('zh-TW');
              response += `o${index + 1}. ${t.amount} 元\n`;
              response += `   類別：${t.category}${t.description ? ` | ${t.description}` : ''}\n`;
              response += `   日期：${date}\n\n`;
            });
          }

          response += `💡 使用 /delete [編號] 來刪除記錄（例如：/delete i1 或 /delete o1）`;

          await this.replyMessage(replyToken, response);
          break;
        }

        case 'summary':
        case '摘要':
        case 'sum':
        case 'overview':
        case 'statistics':
        case 'stats':
        case '總結':
        case '總覽':
        case '統計':
        case '總計': {
          const summary = await this.transactionService.getSummary(unifiedUserId);
          const response = `📊 記帳摘要：\n\n總收入：${summary.totalIncome} 元\n總支出：${summary.totalExpense} 元\n餘額：${summary.balance} 元`;
          await this.replyMessage(replyToken, response);
          break;
        }

        case 'delete':
        case '刪除':
        case 'del':
        case 'remove':
        case '刪掉':
        case '移除': {
          if (!args[0]) {
            await this.replyMessage(replyToken, '❌ 請提供要刪除的記錄編號或 ID。\n使用 /list 查看記錄。');
            return;
          }

          const deleteArg = args.join(' ').trim().toLowerCase();
          let transactionId: string | null = null;

          // 檢查是否為新格式（i1, i2, o1, o2...）
          if (deleteArg.startsWith('i') || deleteArg.startsWith('o')) {
            const type = deleteArg.startsWith('i') ? 'income' : 'expense';
            const indexStr = deleteArg.substring(1);
            const index = parseInt(indexStr, 10);

            if (isNaN(index) || index < 1) {
              await this.replyMessage(replyToken, `❌ 無效的編號格式。請使用 i1, i2, o1, o2 等格式。`);
              return;
            }

            // 獲取所有記錄並過濾類型
            const result = await this.transactionService.getTransactions({
              userId: unifiedUserId,
              limit: 50,
              offset: 0,
            });

            const filtered = result.transactions.filter((t) => t.type === type);

            if (filtered.length >= index) {
              transactionId = filtered[index - 1]._id.toString();
            } else {
              await this.replyMessage(replyToken, `❌ 找不到編號 ${deleteArg} 的記錄。請使用 /list 查看可用記錄。`);
              return;
            }
          } else {
            // 嘗試解析為數字索引（1, 2, 3...）- 向後兼容
            const index = parseInt(deleteArg, 10);

            if (!isNaN(index) && index > 0) {
              // 如果是數字，根據索引獲取交易
              const result = await this.transactionService.getTransactions({
                userId: unifiedUserId,
                limit: index,
                offset: 0,
              });

              if (result.transactions.length >= index) {
                transactionId = result.transactions[index - 1]._id.toString();
              } else {
                await this.replyMessage(replyToken, `❌ 找不到編號 ${index} 的記錄。請使用 /list 查看可用記錄。`);
                return;
              }
            } else {
              // 如果不是數字，嘗試作為交易 ID 使用
              const result = await this.transactionService.getTransactions({
                userId: unifiedUserId,
                limit: 50,
                offset: 0,
              });

              const matchingTransaction = result.transactions.find(
                (t) => t._id.toString() === deleteArg || t._id.toString().startsWith(deleteArg)
              );

              if (matchingTransaction) {
                transactionId = matchingTransaction._id.toString();
              } else {
                await this.replyMessage(replyToken, `❌ 找不到 ID 為 "${deleteArg}" 的記錄。請使用 /list 查看記錄。`);
                return;
              }
            }
          }

          // 執行刪除
          if (transactionId) {
            const deleted = await this.transactionService.deleteTransaction(transactionId, unifiedUserId);
            if (deleted) {
              await this.replyMessage(replyToken, '✅ 已刪除該筆記錄。');
            } else {
              await this.replyMessage(replyToken, '❌ 找不到該筆記錄或無權限刪除。');
            }
          }
          break;
        }

        case 'pet':
        case '寵物':
        case '電子雞':
        case 'tamagotchi':
        case '我的寵物':
        case '寵物狀態':
        case '我的雞':
        case '小雞': {
          const unifiedUserId = await this.getOrCreateUser(lineUserId);
          try {
            const pet = await this.petService.getOrCreatePet(unifiedUserId);
            const petEmoji = pet.stage === 'dead' ? '💀' : pet.stage === 'dying' ? '😵' : pet.stage === 'sick' ? '🤒' : pet.state === 'eating' ? '🍽️' : pet.state === 'hungry' ? '😰' : pet.state === 'happy' ? '😊' : '🐣';
            const stageText = pet.stage === 'egg' ? '蛋' : pet.stage === 'baby' ? '嬰兒期' : pet.stage === 'child' ? '兒童期' : pet.stage === 'adult' ? '成年期' : pet.stage === 'sick' ? '生病' : pet.stage === 'dying' ? '垂死' : '死亡';
            const petInfo = `${petEmoji} **${pet.name}**\n\n` +
              `階段：${stageText}\n` +
              `等級：Lv.${pet.level}\n` +
              `飽食度：${pet.hunger}%\n` +
              `心情值：${pet.happiness}%\n` +
              `健康度：${pet.health}%\n` +
              `連續記帳：${pet.consecutiveDays} 天\n` +
              `總記帳筆數：${pet.totalTransactions} 筆\n\n` +
              `狀態：${this.petService.getPetStatusMessage(pet)}`;
            await this.replyMessage(replyToken, petInfo);
          } catch (error) {
            logger.error('Error fetching pet info', error as Error);
            await this.replyMessage(replyToken, '❌ 查詢電子雞狀態時發生錯誤');
          }
          break;
        }

        case 'myid':
        case 'id':
        case 'userid':
        case '我的id':
        case '用戶id':
        case '我的用戶id': {
          await this.replyMessage(
            replyToken,
            `🆔 您的 LINE 用戶 ID：\n\`${lineUserId}\`\n\n💡 在 Web 界面中輸入此 ID 以連結您的 Google 帳號`
          );
          break;
        }

        case 'savings':
        case 'goal':
        case 'goals':
        case '儲蓄':
        case '儲蓄目標':
        case '目標':
        case '我的目標':
        case '查看目標':
        case '查看儲蓄': {
          const unifiedUserId = await this.getOrCreateUser(lineUserId);
          try {
            const goals = await this.savingsGoalService.getGoals(unifiedUserId, true);
            
            if (goals.length === 0) {
              await this.replyMessage(
                replyToken,
                `💰 目前沒有設定儲蓄目標\n\n💡 設定方式：\n「儲蓄目標 [名稱] [金額]」\n例如：儲蓄目標 旅遊 50000\n\n或使用：\n「設定儲蓄目標 [名稱] [金額]」`
              );
              break;
            }

            let message = `💰 儲蓄目標總覽：\n\n`;
            
            for (const goal of goals) {
              await this.savingsGoalService.updateGoalProgress(unifiedUserId, goal._id.toString());
              const updatedGoal = await this.savingsGoalService.getGoal(goal._id.toString(), unifiedUserId);
              if (!updatedGoal) continue;
              
              const progress = this.savingsGoalService.calculateProgress(updatedGoal);
              const statusIcon = updatedGoal.completed ? '✅' : '🎯';
              const deadlineText = updatedGoal.deadline 
                ? `\n期限：${new Date(updatedGoal.deadline).toLocaleDateString('zh-TW')}（剩餘 ${progress.daysRemaining} 天）`
                : '';
              
              message += `${statusIcon} ${updatedGoal.title}\n`;
              message += `目標：${updatedGoal.targetAmount.toLocaleString()} 元\n`;
              message += `目前：${updatedGoal.currentAmount.toLocaleString()} 元（${progress.percentage.toFixed(1)}%）\n`;
              message += `還需：${progress.remaining.toLocaleString()} 元${deadlineText}\n\n`;
            }
            
            await this.replyMessage(replyToken, message.trim());
          } catch (error) {
            logger.error('Error fetching savings goals', error as Error);
            await this.replyMessage(replyToken, '❌ 查詢儲蓄目標時發生錯誤。');
          }
          break;
        }

        case 'group':
        case '群組':
        case 'g': {
          // 群組分帳功能
          if (!groupId) {
            await this.replyMessage(replyToken, '❌ 此功能僅在群組中使用。請在群組中輸入指令。');
            return;
          }

          const subCmd = args[0]?.toLowerCase();
          if (!subCmd) {
            await this.replyMessage(
              replyToken,
              `📋 群組分帳指令：\n\n` +
                `/group new [總金額] [描述] - 建立新分帳\n` +
                `例如：/group new 1000 晚餐\n\n` +
                `/group add [金額] - 添加您的出資金額\n` +
                `例如：/group add 300\n\n` +
                `/group split [金額] - 設定您的分攤金額\n` +
                `例如：/group split 250\n\n` +
                `/group list - 查看當前分帳狀態\n` +
                `/group settle - 結算並匯入個人記帳\n` +
                `/group help - 顯示詳細說明`
            );
            return;
          }

          switch (subCmd) {
            case 'new':
            case '新建':
            case 'n': {
              if (args.length < 2) {
                await this.replyMessage(replyToken, '❌ 格式：/group new [總金額] [描述]\n例如：/group new 1000 晚餐');
                return;
              }

              const totalAmount = parseFloat(args[1]);
              if (isNaN(totalAmount) || totalAmount <= 0) {
                await this.replyMessage(replyToken, '❌ 請輸入有效的金額');
                return;
              }

              const description = args.slice(2).join(' ') || undefined;

              try {
                const expense = await this.groupExpenseService.createGroupExpense(
                  groupId,
                  lineUserId,
                  totalAmount,
                  [], // 初始無參與者
                  description
                );

                await this.replyMessage(
                  replyToken,
                  `✅ 已建立群組分帳\n總金額：${totalAmount} 元${description ? `\n描述：${description}` : ''}\n\n` +
                    `💡 使用 /group add [金額] 添加您的出資\n` +
                    `使用 /group split [金額] 設定您的分攤`
                );
              } catch (error) {
                logger.error('Error creating group expense', error as Error);
                await this.replyMessage(replyToken, `❌ 建立失敗：${error instanceof Error ? error.message : '未知錯誤'}`);
              }
              break;
            }

            case 'add':
            case '出資':
            case 'a': {
              if (!args[1]) {
                await this.replyMessage(replyToken, '❌ 格式：/group add [金額]\n例如：/group add 300');
                return;
              }

              const amount = parseFloat(args[1]);
              if (isNaN(amount) || amount <= 0) {
                await this.replyMessage(replyToken, '❌ 請輸入有效的金額');
                return;
              }

              // 獲取最新的未結算分帳
              const expenses = await this.groupExpenseService.getGroupExpenses(groupId, false);
              if (expenses.length === 0) {
                await this.replyMessage(replyToken, '❌ 請先使用 /group new 建立分帳');
                return;
              }

              const expense = expenses[0];
              const participant = expense.participants.find((p) => p.lineUserId === lineUserId);

              if (participant) {
                participant.paid = amount;
              } else {
                expense.participants.push({
                  lineUserId,
                  paid: amount,
                  share: 0, // 預設分攤為 0，需要手動設定
                });
              }

              await expense.save();

              await this.replyMessage(replyToken, `✅ 已記錄您的出資：${amount} 元\n💡 使用 /group split [金額] 設定您的分攤金額`);
              break;
            }

            case 'split':
            case '分攤':
            case 's': {
              if (!args[1]) {
                await this.replyMessage(replyToken, '❌ 格式：/group split [金額]\n例如：/group split 250');
                return;
              }

              const amount = parseFloat(args[1]);
              if (isNaN(amount) || amount <= 0) {
                await this.replyMessage(replyToken, '❌ 請輸入有效的金額');
                return;
              }

              // 獲取最新的未結算分帳
              const expenses = await this.groupExpenseService.getGroupExpenses(groupId, false);
              if (expenses.length === 0) {
                await this.replyMessage(replyToken, '❌ 請先使用 /group new 建立分帳');
                return;
              }

              const expense = expenses[0];
              const participant = expense.participants.find((p) => p.lineUserId === lineUserId);

              if (!participant) {
                await this.replyMessage(replyToken, '❌ 請先使用 /group add [金額] 添加您的出資');
                return;
              }

              participant.share = amount;
              await expense.save();

              await this.replyMessage(replyToken, `✅ 已設定您的分攤：${amount} 元`);
              break;
            }

            case 'list':
            case '查看':
            case 'l': {
              const expenses = await this.groupExpenseService.getGroupExpenses(groupId, false);
              if (expenses.length === 0) {
                await this.replyMessage(replyToken, '📝 目前沒有未結算的分帳記錄');
                return;
              }

              const expense = expenses[0];
              let message = `📋 當前分帳狀態：\n\n總金額：${expense.totalAmount} 元${expense.description ? `\n描述：${expense.description}` : ''}\n\n參與者：\n`;

              expense.participants.forEach((p, index) => {
                const balance = p.paid - p.share;
                const balanceText = balance > 0.01 ? `（應收 ${balance} 元）` : balance < -0.01 ? `（應付 ${Math.abs(balance)} 元）` : '（已平衡）';
                message += `${index + 1}. 出資：${p.paid} 元，分攤：${p.share} 元${balanceText}\n`;
              });

              // 計算分帳結果
              const settlements = this.groupExpenseService.calculateSettlements(expense.participants);
              if (settlements.length > 0) {
                message += `\n${this.groupExpenseService.formatSettlements(settlements)}`;
              } else {
                message += `\n✅ 分帳已平衡，無需轉帳`;
              }

              message += `\n💡 使用 /group settle 結算並匯入個人記帳`;

              await this.replyMessage(replyToken, message);
              break;
            }

            case 'settle':
            case '結算':
            case 'st': {
              const expenses = await this.groupExpenseService.getGroupExpenses(groupId, false);
              if (expenses.length === 0) {
                await this.replyMessage(replyToken, '❌ 沒有未結算的分帳記錄');
                return;
              }

              const expense = expenses[0];

              // 檢查是否所有參與者都設定了分攤
              const allSet = expense.participants.every((p) => p.share > 0);
              if (!allSet) {
                await this.replyMessage(replyToken, '❌ 請確保所有參與者都設定了分攤金額（使用 /group split）');
                return;
              }

              try {
                const result = await this.groupExpenseService.settleGroupExpense(expense._id.toString(), lineUserId);

                let message = `✅ 分帳已結算並匯入個人記帳\n\n`;
                message += this.groupExpenseService.formatSettlements(result.settlements);
                message += `\n💡 已為所有參與者創建「群組出資」和「群組回收」記錄`;

                await this.replyMessage(replyToken, message);
              } catch (error) {
                logger.error('Error settling group expense', error as Error);
                await this.replyMessage(replyToken, `❌ 結算失敗：${error instanceof Error ? error.message : '未知錯誤'}`);
              }
              break;
            }

            case 'help':
            case '幫助':
            case 'h': {
              const helpText = `📖 群組分帳使用說明：\n\n` +
                `1️⃣ 建立分帳：\n` +
                `/group new [總金額] [描述]\n` +
                `例如：/group new 1000 晚餐\n\n` +
                `2️⃣ 記錄出資：\n` +
                `/group add [金額]\n` +
                `例如：/group add 300（表示您實際出了 300 元）\n\n` +
                `3️⃣ 設定分攤：\n` +
                `/group split [金額]\n` +
                `例如：/group split 250（表示您應分攤 250 元）\n\n` +
                `4️⃣ 查看狀態：\n` +
                `/group list（查看當前分帳和轉帳建議）\n\n` +
                `5️⃣ 結算匯入：\n` +
                `/group settle（結算並自動匯入個人記帳）\n\n` +
                `💡 結算後會自動創建「群組出資」和「群組回收」記錄`;
              await this.replyMessage(replyToken, helpText);
              break;
            }

            default:
              await this.replyMessage(replyToken, `❌ 未知的子指令：${subCmd}\n使用 /group help 查看說明`);
          }
          break;
        }

        case 'help':
        case '幫助':
        case 'h':
        case '說明':
        case '使用說明':
        case '如何使用':
        case '功能':
        case '說明書':
        case '教學': {
          const helpText = `📖 使用說明：\n\n` +
            `💬 直接輸入記帳訊息（例如：午餐 150 元）\n\n` +
            `📋 指令：\n` +
            `/list [數量] - 查詢最近的記錄（預設 10 筆）\n` +
            `/summary - 查看記帳摘要\n` +
            `/delete [編號] - 刪除指定記錄（例如：/delete i1 或 /delete o1）\n` +
            `/pet - 查看電子雞狀態\n` +
            `/savings 或 /goal - 查看儲蓄目標進度\n` +
            `/myid - 獲取您的 LINE 用戶 ID（用於連結 Google 帳號）\n` +
            `/group - 群組分帳功能（僅在群組中使用）\n` +
            `/help - 顯示此說明\n\n` +
            `💰 設定儲蓄目標：\n` +
            `「儲蓄目標 [名稱] [金額]」\n` +
            `例如：儲蓄目標 旅遊 50000\n\n` +
            `🌐 網頁連結：\n` +
            `https://final-lac-alpha.vercel.app\n` +
            `可用 Google 信箱登入，與 LINE Bot 記帳記錄同步`;
          await this.replyMessage(replyToken, helpText);
          break;
        }

        default:
          await this.replyMessage(replyToken, `❌ 未知指令：${cmd}\n輸入 /help 查看可用指令。`);
      }
    } catch (error) {
      logger.error('Error handling command', error as Error, { lineUserId, command });
      await this.replyMessage(replyToken, '❌ 處理指令時發生錯誤。');
    }
  }

  private async replyMessage(replyToken: string, text: string): Promise<void> {
    try {
      const client = getLineClient();
      logger.info('Sending LINE reply', { replyToken, textLength: text.length });
      await client.replyMessage(replyToken, {
        type: 'text',
        text,
      });
      logger.info('LINE reply sent successfully', { replyToken });
    } catch (error) {
      logger.error('Error replying LINE message', error as Error, { 
        replyToken,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      // 重新拋出錯誤以便上層處理
      throw error;
    }
  }

  /**
   * 取得 Quick Reply 設定（本週支出 / 本月支出 / 最近記錄 / 設定預算）
   */
  private getQuickReplyConfig() {
    return {
      items: [
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '本周支出',
            data: 'expense_summary:week',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '本月支出',
            data: 'expense_summary:month',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '最近記錄',
            data: 'recent_records',
          },
        },
        {
          type: 'action',
          action: {
            type: 'postback',
            label: '設定預算',
            data: 'set_budget',
          },
        },
      ],
    } as const;
  }

  /**
   * 發送帶 Quick Reply 按鈕的訊息（僅文字）
   */
  private async replyMessageWithQuickReply(replyToken: string, text: string): Promise<void> {
    try {
      const client = getLineClient();
      logger.info('Sending LINE reply with quick reply', { replyToken, textLength: text.length });
      const quickReplyConfig = this.getQuickReplyConfig();
      await client.replyMessage(replyToken, {
        type: 'text',
        text,
        quickReply: {
          items: quickReplyConfig.items.map(item => ({ ...item })),
        },
      });
      logger.info('LINE reply with quick reply sent successfully', { replyToken });
    } catch (error) {
      logger.error('Error replying LINE message with quick reply', error as Error, { 
        replyToken,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * 處理 postback 事件
   */
  async handlePostback(event: WebhookEvent): Promise<void> {
    if (event.type !== 'postback') {
      return;
    }

    const userId = event.source.userId;
    if (!userId) {
      logger.warn('Received postback without userId');
      return;
    }

    const replyToken = event.replyToken;
    if (!replyToken) {
      logger.error('Missing replyToken in postback event');
      return;
    }

    const data = event.postback.data;
    logger.info('Processing postback', { userId, data });

    try {
      const unifiedUserId = await this.getOrCreateUser(userId);

      // 解析 postback data
      if (data && data.startsWith('expense_summary:')) {
        const parts = data.split(':');
        const period = parts[1]; // 'week', 'month', 'last_week', 'last_month'
        
        if (!period) {
          logger.warn('Invalid postback period', { data, period });
          await this.replyMessage(replyToken, '❌ 無效的請求參數');
          return;
        }
        
        let startDate: Date;
        let endDate: Date;
        let periodLabel: string;
        
        const now = new Date();
        
        if (period === 'week') {
          // 查詢本週支出
          const weekStart = new Date(now);
          const dayOfWeek = weekStart.getDay();
          const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 調整到週一
          weekStart.setDate(weekStart.getDate() + diff);
          weekStart.setHours(0, 0, 0, 0);
          startDate = weekStart;
          endDate = now;
          periodLabel = '本週';
        } else if (period === 'last_week') {
          // 查詢上週支出
          const lastWeekEnd = new Date(now);
          const dayOfWeek = lastWeekEnd.getDay();
          const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 調整到本週一
          lastWeekEnd.setDate(lastWeekEnd.getDate() + diff - 1); // 上週日
          lastWeekEnd.setHours(23, 59, 59, 999);
          
          const lastWeekStart = new Date(lastWeekEnd);
          lastWeekStart.setDate(lastWeekStart.getDate() - 6); // 上週一
          lastWeekStart.setHours(0, 0, 0, 0);
          startDate = lastWeekStart;
          endDate = lastWeekEnd;
          periodLabel = '上週';
        } else if (period === 'month') {
          // 查詢本月支出
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
          monthStart.setHours(0, 0, 0, 0);
          startDate = monthStart;
          endDate = now;
          periodLabel = '本月';
        } else if (period === 'last_month') {
          // 查詢上月支出
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0); // 上月最後一天
          lastMonthEnd.setHours(23, 59, 59, 999);
          
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1); // 上月第一天
          lastMonthStart.setHours(0, 0, 0, 0);
          startDate = lastMonthStart;
          endDate = lastMonthEnd;
          periodLabel = '上月';
        } else {
          logger.warn('Invalid postback period', { data, period });
          await this.replyMessage(replyToken, '❌ 無效的請求參數');
          return;
        }
        
        // 查詢該時間範圍內的所有交易記錄
        const result = await this.transactionService.getTransactions({
          userId: unifiedUserId,
          startDate,
          endDate,
          limit: 1000, // 設定較大的 limit 以確保取得所有記錄
          offset: 0,
        });
        
        // 按日期分組計算每天的收入和支出
        const dailyData = new Map<string, { income: number; expense: number }>();
        
        result.transactions.forEach((transaction) => {
          const dateKey = new Date(transaction.date).toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          
          if (!dailyData.has(dateKey)) {
            dailyData.set(dateKey, { income: 0, expense: 0 });
          }
          
          const dayData = dailyData.get(dateKey)!;
          if (transaction.type === 'income') {
            dayData.income += transaction.amount;
          } else {
            dayData.expense += transaction.amount;
          }
        });
        
        // 生成日期列表（從開始日期到結束日期）
        const dateList: string[] = [];
        const currentDate = new Date(startDate);
        const endDateForLoop = new Date(endDate);
        
        while (currentDate <= endDateForLoop) {
          const dateKey = currentDate.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
          });
          dateList.push(dateKey);
          currentDate.setDate(currentDate.getDate() + 1);
        }
        
        // 構建回覆訊息
        let response = `📊 ${periodLabel}每日明細：\n\n`;
        
        // 計算總計
        let totalIncome = 0;
        let totalExpense = 0;
        
        if (dateList.length === 0 || dailyData.size === 0) {
          response += '尚無記錄';
        } else {
          // 只顯示有記錄的日期
          dateList.forEach((dateKey) => {
            const dayData = dailyData.get(dateKey);
            if (!dayData) {
              return; // 跳過沒有記錄的日期
            }
            
            const income = Number(dayData.income) || 0;
            const expense = Number(dayData.expense) || 0;
            
            // 如果收入和支出都是0，跳過
            if (income === 0 && expense === 0) {
              return;
            }
            
            // 累加總計
            totalIncome += income;
            totalExpense += expense;
            
            // 顯示日期和明細（無icon，無餘額）
            response += `${dateKey}\n`;
            if (income > 0) {
              response += `  收入：${income.toLocaleString()} 元\n`;
            }
            if (expense > 0) {
              response += `  支出：${expense.toLocaleString()} 元\n`;
            }
          });
          
          // 計算總餘額
          const totalBalance = totalIncome - totalExpense;
          
          // 顯示總計（有icon，有餘額）
          response += `━━━━━━━━━━━━━━\n`;
          response += `總計：\n`;
          response += `💰 總收入：${totalIncome.toLocaleString()} 元\n`;
          response += `💸 總支出：${totalExpense.toLocaleString()} 元\n`;
          response += `📊 總餘額：${totalBalance.toLocaleString()} 元`;
        }
        
        // 使用帶 quick reply 的回覆，讓按鈕持續顯示
        await this.replyMessageWithQuickReply(replyToken, response);
      } else if (data === 'recent_records') {
        // 查詢最近十筆記錄
        const result = await this.transactionService.getTransactions({
          userId: unifiedUserId,
          limit: 10,
          offset: 0,
        });

        if (result.transactions.length === 0) {
          await this.replyMessageWithQuickReply(replyToken, '📝 目前沒有任何記帳記錄。');
          return;
        }

        let response = `📝 最近 ${result.transactions.length} 筆記錄：\n\n`;

        // 按時間順序顯示，格式：類別 | 支出(收入) | 金額 | 時間
        result.transactions.forEach((t, index) => {
          const typeText = t.type === 'income' ? '收入' : '支出';
          const date = new Date(t.date).toLocaleDateString('zh-TW');
          
          response += `${index + 1}. ${t.category} | ${typeText} | ${t.amount.toLocaleString()}元 | ${date}\n`;
        });

        await this.replyMessageWithQuickReply(replyToken, response);
      } else if (data === 'set_budget') {
        // 設定預算
        const template = `請按照以下格式輸入您的預算：\n\n單日預算：1000\n單週預算：5000\n單月預算：20000\n\n請複製貼上並修改金額：`;
        await this.replyMessageWithQuickReply(replyToken, template);
      } else {
        // 未知的 postback data 格式
        logger.warn('Unknown postback data format', { data });
        await this.replyMessage(replyToken, '❌ 無法識別的請求');
      }
    } catch (error) {
      logger.error('Error handling postback', error as Error, { userId, data });
      await this.replyMessage(replyToken, '❌ 處理請求時發生錯誤，請稍後再試。');
    }
  }

  /**
   * 解析預算設定訊息
   * 格式：單日預算：1000\n單週預算：5000\n單月預算：20000
   * 也支持：單日預算：1000 單週預算：5000 單月預算：20000（同一行）
   */
  private parseBudgetMessage(message: string): { daily: number; weekly: number; monthly: number } | null {
    try {
      logger.info('Parsing budget message', { message, messageLength: message.length });
      
      // 匹配格式：單日預算：數字（支持中文冒號和英文冒號）
      const dailyMatch = message.match(/單日預算[：:]\s*(\d+)/);
      const weeklyMatch = message.match(/單週預算[：:]\s*(\d+)/);
      const monthlyMatch = message.match(/單月預算[：:]\s*(\d+)/);

      logger.info('Budget message regex matches', {
        dailyMatch: dailyMatch ? dailyMatch[1] : null,
        weeklyMatch: weeklyMatch ? weeklyMatch[1] : null,
        monthlyMatch: monthlyMatch ? monthlyMatch[1] : null,
      });

      if (!dailyMatch || !weeklyMatch || !monthlyMatch) {
        logger.info('Budget message format not matched', { message });
        return null;
      }

      const daily = parseInt(dailyMatch[1], 10);
      const weekly = parseInt(weeklyMatch[1], 10);
      const monthly = parseInt(monthlyMatch[1], 10);

      if (isNaN(daily) || isNaN(weekly) || isNaN(monthly) || daily < 0 || weekly < 0 || monthly < 0) {
        logger.warn('Invalid budget values', { daily, weekly, monthly });
        return null;
      }

      logger.info('Budget message parsed successfully', { daily, weekly, monthly });
      return { daily, weekly, monthly };
    } catch (error) {
      logger.error('Error parsing budget message', error as Error, { message });
      return null;
    }
  }

  /**
   * 解析儲蓄目標設定訊息
   * 支援格式：
   * - "儲蓄目標 旅遊 50000"
   * - "設定儲蓄目標 買車 300000"
   * - "儲蓄目標 買房 5000000 2025-12-31"
   */
  private parseSavingsGoalMessage(message: string): { title: string; targetAmount: number; deadline?: Date } | null {
    try {
      logger.info('Parsing savings goal message', { message, messageLength: message.length });
      
      // 匹配格式：儲蓄目標 [名稱] [金額] [期限（可選）]
      // 或：設定儲蓄目標 [名稱] [金額] [期限（可選）]
      const match = message.match(/(?:儲蓄目標|設定儲蓄目標)[：:\s]+([^\d]+?)\s+(\d+)(?:\s+(.+))?/);
      
      if (!match) {
        logger.info('Savings goal message format not matched', { message });
        return null;
      }

      const title = match[1].trim();
      const targetAmount = parseInt(match[2], 10);
      const deadlineStr = match[3]?.trim();

      if (!title || isNaN(targetAmount) || targetAmount <= 0) {
        logger.warn('Invalid savings goal values', { title, targetAmount });
        return null;
      }

      let deadline: Date | undefined;
      if (deadlineStr) {
        // 嘗試解析日期格式：YYYY-MM-DD 或 YYYY/MM/DD
        const dateMatch = deadlineStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
        if (dateMatch) {
          const year = parseInt(dateMatch[1], 10);
          const month = parseInt(dateMatch[2], 10) - 1;
          const day = parseInt(dateMatch[3], 10);
          deadline = new Date(year, month, day);
          if (isNaN(deadline.getTime())) {
            deadline = undefined;
          }
        }
      }

      logger.info('Savings goal message parsed successfully', { title, targetAmount, deadline });
      return { title, targetAmount, deadline };
    } catch (error) {
      logger.error('Error parsing savings goal message', error as Error);
      return null;
    }
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

