import mongoose, { Schema, Document } from 'mongoose';

export interface IBudget extends Document {
  userId: string;
  month: string; // YYYY-MM 格式
  totalBudget?: number; // 總預算
  categoryBudgets?: Map<string, number>; // 類別預算 { "餐飲": 5000, "交通": 2000 }
  createdAt: Date;
  updatedAt: Date;
}

const BudgetSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    month: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}$/, // YYYY-MM 格式
    },
    totalBudget: {
      type: Number,
      min: 0,
    },
    categoryBudgets: {
      type: Map,
      of: Number,
      default: new Map(),
    },
  },
  {
    timestamps: true,
  }
);

// 複合索引：每個用戶每個月只能有一個預算記錄
BudgetSchema.index({ userId: 1, month: 1 }, { unique: true });

export default mongoose.models.Budget || mongoose.model<IBudget>('Budget', BudgetSchema);

