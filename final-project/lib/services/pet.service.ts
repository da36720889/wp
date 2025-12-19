import Pet, { IPet, PetState, PetStage } from '@/lib/models/Pet';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

export class PetService {
  /**
   * 獲取或創建寵物
   */
  async getOrCreatePet(userId: string): Promise<IPet> {
    await connectDB();

    let pet = await Pet.findOne({ userId });
    if (!pet) {
      pet = await Pet.create({
        userId,
        name: '記帳小雞',
        stage: 'egg',
        state: 'idle',
        hunger: 50,
        happiness: 50,
        health: 100,
        experience: 0,
        level: 1,
        lastFedAt: new Date(),
        consecutiveDays: 0,
        totalTransactions: 0,
      });
    } else {
      // 修復舊的階段值（如果存在）
      const needsFix = false;
      let needsSave = false;
      
      // 修復舊的階段值：'teen' -> 'child', 'evolved' -> 'adult'
      if (pet.stage === 'teen') {
        pet.stage = 'child';
        needsSave = true;
        logger.info('Fixed pet stage from teen to child', { userId });
      } else if (pet.stage === 'evolved') {
        pet.stage = 'adult';
        needsSave = true;
        logger.info('Fixed pet stage from evolved to adult', { userId });
      }
      
      // 修復舊的狀態值（如果存在）
      if (pet.state === 'sick' || pet.state === 'evolving') {
        // 如果狀態是 'sick'，根據健康度設置階段
        if (pet.state === 'sick') {
          if (pet.health <= 0) {
            pet.stage = 'dead';
            pet.state = 'idle';
          } else if (pet.health <= 10) {
            pet.stage = 'dying';
            pet.state = 'idle';
          } else if (pet.health <= 30) {
            pet.stage = 'sick';
            pet.state = 'idle';
          } else {
            pet.state = 'idle';
          }
        } else {
          // 'evolving' 狀態改為 'idle'
          pet.state = 'idle';
        }
        needsSave = true;
      }
      
      // 確保階段和狀態都是有效的
      const validStages: PetStage[] = ['egg', 'baby', 'child', 'adult', 'sick', 'dying', 'dead'];
      const validStates: PetState[] = ['idle', 'happy', 'hungry', 'eating'];
      
      if (!validStages.includes(pet.stage as PetStage)) {
        logger.warn('Invalid pet stage, resetting to egg', new Error(`Invalid stage: ${pet.stage}`));
        pet.stage = 'egg';
        needsSave = true;
      }
      
      if (!validStates.includes(pet.state as PetState)) {
        logger.warn('Invalid pet state, resetting to idle', new Error(`Invalid state: ${pet.state}`));
        pet.state = 'idle';
        needsSave = true;
      }
      
      // 如果有修復，先保存（在 updatePetStatus 之前）
      if (needsSave) {
        try {
          // 使用 updateOne 直接更新，避免驗證錯誤
          await Pet.updateOne(
            { _id: pet._id },
            { 
              $set: { 
                stage: pet.stage,
                state: pet.state
              }
            }
          );
          // 重新載入以確保數據同步
          pet = await Pet.findById(pet._id);
          if (!pet) {
            throw new Error('Pet not found after update');
          }
        } catch (saveError) {
          logger.error('Error saving pet after fix', saveError as Error);
          // 如果保存失敗，嘗試創建新的寵物
          throw saveError;
        }
      }
    }

    // 更新狀態（檢查是否飢餓、生病等）
    await this.updatePetStatus(pet);
    return pet;
  }

  /**
   * 更新寵物狀態（根據時間和記帳行為）
   */
  async updatePetStatus(pet: IPet): Promise<void> {
    const now = new Date();
    const hoursSinceLastFed = (now.getTime() - pet.lastFedAt.getTime()) / (1000 * 60 * 60);

    // 如果已經死亡，不再更新
    if (pet.stage === 'dead') {
      return;
    }

    // 飢餓度計算：每小時減少 2 點
    let newHunger = pet.hunger - Math.floor(hoursSinceLastFed * 2);
    newHunger = Math.max(0, Math.min(100, newHunger));

    // 根據飢餓度和健康度更新狀態和階段
    let newState: PetState = pet.state;
    let newHealth = pet.health;
    let newStage: PetStage = pet.stage;

    // 根據健康度決定階段
    if (newHealth <= 0) {
      // 死亡
      newStage = 'dead';
      newState = 'idle';
    } else if (newHealth <= 10) {
      // 垂死
      newStage = 'dying';
      newState = 'idle';
    } else if (newHealth <= 30) {
      // 生病
      newStage = 'sick';
      newState = 'idle';
    } else {
      // 根據飢餓度更新狀態
      // 注意：happy 狀態只在記帳時由 feedPet 設置，這裡不自動設置
      if (newHunger <= 20) {
        newState = 'hungry';
        newHealth = Math.max(0, pet.health - 1); // 飢餓會降低健康
      } else if (pet.state === 'happy') {
        // 保持 happy 狀態（由 feedPet 設置，會在 10-20 秒後自動恢復）
        newState = 'happy';
      } else {
        newState = 'idle';
      }

      // 健康度恢復（如果飽食度足夠）
      if (newHunger > 50 && newHealth < 100) {
        newHealth = Math.min(100, newHealth + 0.5);
      }
    }

    pet.hunger = newHunger;
    pet.health = newHealth;
    pet.state = newState;
    pet.stage = newStage;

    await pet.save();
  }

  /**
   * 餵食寵物（記帳時調用）
   */
  async feedPet(userId: string, amount?: number): Promise<IPet> {
    await connectDB();

    const pet = await this.getOrCreatePet(userId);
    const now = new Date();

    // 檢查是否為新的一天（用於計算連續天數）
    const lastFedDate = new Date(pet.lastFedAt);
    const today = new Date(now);
    const isNewDay =
      today.getDate() !== lastFedDate.getDate() ||
      today.getMonth() !== lastFedDate.getMonth() ||
      today.getFullYear() !== lastFedDate.getFullYear();

    // 增加飽食度
    pet.hunger = Math.min(100, pet.hunger + 30);
    pet.happiness = Math.min(100, pet.happiness + 10);
    pet.state = 'eating';
    pet.lastFedAt = now;
    pet.totalTransactions += 1;

    // 更新連續天數
    if (isNewDay) {
      // 檢查是否連續（最後餵食是昨天）
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (
        lastFedDate.getDate() === yesterday.getDate() &&
        lastFedDate.getMonth() === yesterday.getMonth() &&
        lastFedDate.getFullYear() === yesterday.getFullYear()
      ) {
        pet.consecutiveDays += 1;
      } else if (pet.consecutiveDays === 0) {
        // 第一次記帳
        pet.consecutiveDays = 1;
      } else {
        // 中斷了，重置
        pet.consecutiveDays = 1;
      }
    }

    // 如果已經死亡，不能再餵食
    if (pet.stage === 'dead') {
      return pet;
    }

    // 如果處於垂死或生病階段，餵食可以恢復健康
    if (pet.stage === 'dying' || pet.stage === 'sick') {
      pet.health = Math.min(100, pet.health + 20);
      // 如果健康度恢復到30以上，退出負面階段
      if (pet.health > 30 && pet.stage === 'sick') {
        // 根據等級決定恢復到哪個階段
        if (pet.level >= 15) {
          pet.stage = 'adult';
        } else if (pet.level >= 8) {
          pet.stage = 'child';
        } else if (pet.level >= 3) {
          pet.stage = 'baby';
        } else {
          pet.stage = 'egg';
        }
      } else if (pet.health > 10 && pet.stage === 'dying') {
        pet.stage = 'sick';
      }
    }

    // 增加經驗值
    const expGain = amount ? Math.floor(amount / 10) : 10;
    pet.experience += expGain;

    // 檢查升級
    const expForNextLevel = pet.level * 100;
    if (pet.experience >= expForNextLevel) {
      pet.experience -= expForNextLevel;
      pet.level += 1;
      await this.checkEvolution(pet);
    }

    await pet.save();

    // 3 秒後從 eating 狀態恢復到 happy 狀態
    setTimeout(async () => {
      await connectDB();
      const updatedPet = await Pet.findById(pet._id);
      if (updatedPet && updatedPet.state === 'eating') {
        updatedPet.state = 'happy';
        await updatedPet.save();
        
        // 10-20 秒後從 happy 恢復到 idle
        const happyDuration = 10000 + Math.random() * 10000; // 10-20 秒
        setTimeout(async () => {
          await connectDB();
          const finalPet = await Pet.findById(pet._id);
          if (finalPet && finalPet.state === 'happy') {
            finalPet.state = 'idle';
            await finalPet.save();
          }
        }, happyDuration);
      }
    }, 3000);

    return pet;
  }

  /**
   * 檢查進化條件
   */
  async checkEvolution(pet: IPet): Promise<void> {
    // 如果已經死亡或處於負面階段，不能進化
    if (pet.stage === 'dead' || pet.stage === 'dying' || pet.stage === 'sick') {
      return;
    }

    // 根據等級進化階段
    if (pet.level >= 3 && pet.stage === 'egg') {
      pet.stage = 'baby';
    } else if (pet.level >= 8 && pet.stage === 'baby') {
      pet.stage = 'child';
    } else if (pet.level >= 15 && pet.stage === 'child') {
      pet.stage = 'adult';
    }
    // 成年期是最終階段，不會再進化
  }

  /**
   * 根據預算狀態更新健康度
   */
  async updateHealthFromBudget(userId: string, budgetUsagePercent: number): Promise<void> {
    await connectDB();

    const pet = await this.getOrCreatePet(userId);

    // 如果已經死亡，不再更新
    if (pet.stage === 'dead') {
      return;
    }

    // 預算使用率越高，健康度越低
    if (budgetUsagePercent >= 100) {
      pet.health = Math.max(0, pet.health - 5); // 超支會大幅降低健康
      // 健康度低於30時進入生病階段
      if (pet.health <= 30 && pet.health > 10) {
        pet.stage = 'sick';
      } else if (pet.health <= 10 && pet.health > 0) {
        pet.stage = 'dying';
      } else if (pet.health <= 0) {
        pet.stage = 'dead';
      }
    } else if (budgetUsagePercent >= 90) {
      pet.health = Math.max(0, pet.health - 2); // 接近預算會降低健康
      pet.happiness = Math.max(0, pet.happiness - 5);
      // 檢查是否需要進入負面階段
      if (pet.health <= 30 && pet.health > 10 && (pet.stage === 'egg' || pet.stage === 'baby' || pet.stage === 'child' || pet.stage === 'adult')) {
        pet.stage = 'sick';
      } else if (pet.health <= 10 && pet.health > 0 && (pet.stage === 'egg' || pet.stage === 'baby' || pet.stage === 'child' || pet.stage === 'adult' || pet.stage === 'sick')) {
        pet.stage = 'dying';
      } else if (pet.health <= 0) {
        pet.stage = 'dead';
      }
    } else if (budgetUsagePercent <= 50) {
      // 預算控制良好會恢復健康，但不會從死亡/垂死/生病階段恢復
      if (pet.stage === 'egg' || pet.stage === 'baby' || pet.stage === 'child' || pet.stage === 'adult') {
        pet.health = Math.min(100, pet.health + 1);
        pet.happiness = Math.min(100, pet.happiness + 2);
      }
    }

    await pet.save();
  }

  /**
   * 獲取寵物狀態描述
   */
  getPetStatusMessage(pet: IPet): string {
    if (pet.stage === 'dead') {
      return '已經死亡...';
    } else if (pet.stage === 'dying') {
      return '生命垂危，急需照顧！';
    } else if (pet.stage === 'sick') {
      return '我生病了，需要好好照顧...';
    } else if (pet.state === 'eating') {
      return '正在享用美食中...';
    } else if (pet.state === 'hungry') {
      return '肚子好餓，快來記帳餵我！';
    } else if (pet.state === 'happy') {
      return '吃飽了，心情很好！';
    } else {
      return '等待你的照顧...';
    }
  }
}

