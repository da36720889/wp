import { Client, middleware, MiddlewareConfig, WebhookEvent } from '@line/bot-sdk';
import { TransactionService } from './transaction.service';
import { LLMService } from './llm.service';
import { UserService } from './user.service';
import { GroupExpenseService } from './groupExpense.service';
import { PetService } from './pet.service';
import { BudgetNotificationService } from './budgetNotification.service';
import { createTransactionSchema } from '@/lib/schemas/transaction.schema';
import { logger } from '@/lib/utils/logger';
import { AppError } from '@/lib/utils/errors';
import connectDB from '@/lib/db/mongodb';
import { IParticipant } from '@/lib/models/GroupExpense';

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

  constructor() {
    this.transactionService = new TransactionService();
    this.llmService = new LLMService();
    this.userService = new UserService();
    this.groupExpenseService = new GroupExpenseService();
    this.petService = new PetService();
    this.budgetNotificationService = new BudgetNotificationService();
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
      // 處理特殊指令
      if (message.startsWith('/')) {
        const groupId = event.source.type === 'group' ? (event.source as { groupId?: string }).groupId : undefined;
        await this.handleCommand(userId, message, event.replyToken, groupId);
        return;
      }

      // 使用 LLM 解析記帳訊息
      const parsed = await this.llmService.parseTransactionMessage(message);
      if (!parsed) {
        await this.replyMessage(
          event.replyToken,
          '抱歉，我無法理解您的記帳訊息。請使用格式：金額 類別 描述（例如：午餐 150 元）'
        );
        return;
      }

      // 獲取或創建用戶（統一用戶 ID）
      const unifiedUserId = await this.getOrCreateUser(userId);

      // 驗證並創建交易記錄
      const validated = createTransactionSchema.parse(parsed);
      const transaction = await this.transactionService.createTransaction(unifiedUserId, validated);

      // 餵食電子雞
      let petMessage = '';
      try {
        const pet = await this.petService.feedPet(unifiedUserId, validated.amount);
        const petEmoji = pet.state === 'eating' ? '🍽️' : pet.state === 'happy' ? '😊' : '🐣';
        petMessage = `\n\n${petEmoji} ${pet.name} 吃飽了！${pet.state === 'eating' ? '正在享用美食中...' : ''}`;
        
        // 檢查進化（根據階段變化判斷）
        const currentPet = await this.petService.getOrCreatePet(unifiedUserId);
        if (currentPet.stage !== pet.stage && currentPet.stage !== 'sick' && currentPet.stage !== 'dying' && currentPet.stage !== 'dead') {
          petMessage += '\n✨ 恭喜！你的電子雞進化了！';
        }
      } catch (error) {
        logger.error('Error feeding pet', error as Error);
      }

      // 檢查預算（僅對支出進行檢查）
      let budgetMessage = '';
      if (validated.type === 'expense') {
        try {
          const { BudgetService } = await import('./budget.service');
          const budgetService = new BudgetService();
          const status = await budgetService.getBudgetStatus(unifiedUserId);
          
          if (status.budget.totalBudget && status.budget.totalBudget > 0) {
            const usagePercent = (status.totalSpent / status.budget.totalBudget) * 100;
            const remaining = status.totalRemaining || 0;
            
            if (usagePercent >= 100) {
              budgetMessage = `\n\n⚠️ 預算警告：已超支 ${Math.abs(remaining).toLocaleString()} 元！`;
            } else if (usagePercent >= 90) {
              budgetMessage = `\n\n🔴 預算警告：使用率 ${usagePercent.toFixed(1)}%，剩餘 ${remaining.toLocaleString()} 元`;
            } else if (usagePercent >= 80) {
              budgetMessage = `\n\n🟡 預算提醒：使用率 ${usagePercent.toFixed(1)}%，剩餘 ${remaining.toLocaleString()} 元`;
            }
          }
          
          // 檢查類別預算
          if (status.budget.categoryBudgets && status.budget.categoryBudgets.size > 0) {
            const categoryBudget = status.budget.categoryBudgets.get(validated.category);
            if (categoryBudget && categoryBudget > 0) {
              const categorySpent = status.categorySpent.get(validated.category) || 0;
              const categoryPercent = (categorySpent / categoryBudget) * 100;
              
              if (categoryPercent >= 100) {
                budgetMessage += `\n⚠️ ${validated.category} 類別已超支！`;
              } else if (categoryPercent >= 90) {
                budgetMessage += `\n🔴 ${validated.category} 類別使用率 ${categoryPercent.toFixed(1)}%`;
              }
            }
          }
        } catch (error) {
          logger.error('Error checking budget', error as Error);
          // 預算檢查失敗不影響記帳流程
        }
        
        // 觸發預算通知服務（非阻塞，使用 pushMessage）
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

      const typeText = validated.type === 'income' ? '收入' : '支出';
      const response = `✅ 已記錄 ${typeText}：\n金額：${validated.amount} 元\n類別：${validated.category}${
        validated.description ? `\n說明：${validated.description}` : ''
      }${petMessage}${budgetMessage}`;

      await this.replyMessage(event.replyToken, response);
      logger.info('Transaction created', { lineUserId: userId, unifiedUserId, transactionId: transaction._id });
    } catch (error) {
      logger.error('Error handling LINE message', error as Error, { userId, message });
      
      if (error instanceof AppError) {
        await this.replyMessage(event.replyToken, `❌ 錯誤：${error.message}`);
      } else {
        await this.replyMessage(event.replyToken, '❌ 處理您的訊息時發生錯誤，請稍後再試。');
      }
    }
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
        case 'ls': {
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
        case 'sum': {
          const summary = await this.transactionService.getSummary(unifiedUserId);
          const response = `📊 記帳摘要：\n\n總收入：${summary.totalIncome} 元\n總支出：${summary.totalExpense} 元\n餘額：${summary.balance} 元`;
          await this.replyMessage(replyToken, response);
          break;
        }

        case 'delete':
        case '刪除':
        case 'del': {
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
        case '電子雞': {
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
        case 'id': {
          await this.replyMessage(
            replyToken,
            `🆔 您的 LINE 用戶 ID：\n\`${lineUserId}\`\n\n💡 在 Web 界面中輸入此 ID 以連結您的 Google 帳號`
          );
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
        case 'h': {
          const helpText = `📖 使用說明：\n\n` +
            `💬 直接輸入記帳訊息（例如：午餐 150 元）\n\n` +
            `📋 指令：\n` +
            `/list [數量] - 查詢最近的記錄（預設 10 筆）\n` +
            `/summary - 查看記帳摘要\n` +
            `/delete [編號] - 刪除指定記錄（例如：/delete i1 或 /delete o1）\n` +
            `/pet - 查看電子雞狀態\n` +
            `/myid - 獲取您的 LINE 用戶 ID（用於連結 Google 帳號）\n` +
            `/group - 群組分帳功能（僅在群組中使用）\n` +
            `/help - 顯示此說明\n\n` +
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
}

