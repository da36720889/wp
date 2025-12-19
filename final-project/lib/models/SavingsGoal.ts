import mongoose, { Schema, Document } from 'mongoose';

export interface ISavingsGoal extends Document {
  userId: string;
  title: string; // 目標名稱
  targetAmount: number; // 目標金額
  currentAmount: number; // 目前金額（從收入累積）
  deadline?: Date; // 截止日期（可選）
  completed: boolean; // 是否已完成
  completedAt?: Date; // 完成時間
  createdAt: Date;
  updatedAt: Date;
}

const SavingsGoalSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
    },
    targetAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    currentAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    deadline: {
      type: Date,
    },
    completed: {
      type: Boolean,
      default: false,
      index: true,
    },
    completedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// 創建索引
SavingsGoalSchema.index({ userId: 1, completed: 1 });

export default mongoose.models.SavingsGoal ||
  mongoose.model<ISavingsGoal>('SavingsGoal', SavingsGoalSchema);

