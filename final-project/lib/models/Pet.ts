import mongoose, { Schema, Document } from 'mongoose';

export type PetState = 'idle' | 'happy' | 'hungry' | 'eating';
export type PetStage = 'egg' | 'baby' | 'child' | 'adult' | 'sick' | 'dying' | 'dead';

export interface IPet extends Document {
  userId: string;
  name: string; // 寵物名稱
  stage: PetStage; // 進化階段
  state: PetState; // 當前狀態
  hunger: number; // 飽食度 (0-100)
  happiness: number; // 心情值 (0-100)
  health: number; // 健康度 (0-100)
  experience: number; // 經驗值
  level: number; // 等級
  lastFedAt: Date; // 最後餵食時間
  consecutiveDays: number; // 連續記帳天數
  totalTransactions: number; // 總記帳筆數
  evolutionType?: 'wealth' | 'spender' | 'balanced'; // 進化類型
  createdAt: Date;
  updatedAt: Date;
}

const PetSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      default: '記帳小雞',
    },
    stage: {
      type: String,
      enum: ['egg', 'baby', 'child', 'adult', 'sick', 'dying', 'dead'],
      default: 'egg',
    },
    state: {
      type: String,
      enum: ['idle', 'happy', 'hungry', 'eating'],
      default: 'idle',
    },
    hunger: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    happiness: {
      type: Number,
      default: 50,
      min: 0,
      max: 100,
    },
    health: {
      type: Number,
      default: 100,
      min: 0,
      max: 100,
    },
    experience: {
      type: Number,
      default: 0,
      min: 0,
    },
    level: {
      type: Number,
      default: 1,
      min: 1,
    },
    lastFedAt: {
      type: Date,
      default: Date.now,
    },
    consecutiveDays: {
      type: Number,
      default: 0,
      min: 0,
    },
    totalTransactions: {
      type: Number,
      default: 0,
      min: 0,
    },
    evolutionType: {
      type: String,
      enum: ['wealth', 'spender', 'balanced'],
    },
  },
  {
    timestamps: true,
  }
);

// 創建索引
PetSchema.index({ userId: 1 });

export default mongoose.models.Pet || mongoose.model<IPet>('Pet', PetSchema);

