import mongoose, { Schema, Document } from 'mongoose';

export interface IBudget extends Document {
  userId: string;
  month: string; // YYYY-MM 格式
  totalBudget?: number; // 總預算
  categoryBudgets?: Map<string, number>; // 類別預算 { "餐飲": 5000, "交通": 2000 }
  dailyBudget?: number; // 單日預算上限
  weeklyBudget?: number; // 單週預算上限
  monthlyBudget?: number; // 單月預算上限
  createdAt: Date;
  updatedAt: Date;
}

const BudgetSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
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
    dailyBudget: {
      type: Number,
      min: 0,
      default: null,
      required: false,
    },
    weeklyBudget: {
      type: Number,
      min: 0,
      default: null,
      required: false,
    },
    monthlyBudget: {
      type: Number,
      min: 0,
      default: null,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// 複合索引：每個用戶每個月只能有一個預算記錄
BudgetSchema.index({ userId: 1, month: 1 }, { unique: true });

// 強制重新編譯模型以確保使用最新的 schema（清除緩存）
if (mongoose.models.Budget) {
  delete mongoose.models.Budget;
}

export default mongoose.model<IBudget>('Budget', BudgetSchema);

