import mongoose, { Schema, Document } from 'mongoose';

export interface ITransaction extends Document {
  userId: string;
  amount: number;
  category: string;
  description?: string;
  type: 'income' | 'expense';
  date: Date;
  groupExpenseId?: string; // 關聯的群組分帳 ID
  groupExpenseType?: 'contribution' | 'reimbursement'; // 群組出資或回收
  createdAt: Date;
  updatedAt: Date;
}

const TransactionSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    category: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: true,
    },
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    groupExpenseId: {
      type: String,
      index: true,
    },
    groupExpenseType: {
      type: String,
      enum: ['contribution', 'reimbursement'],
    },
  },
  {
    timestamps: true,
  }
);

// 创建复合索引以提高查询性能
TransactionSchema.index({ userId: 1, date: -1 });
TransactionSchema.index({ userId: 1, type: 1 });

export default mongoose.models.Transaction ||
  mongoose.model<ITransaction>('Transaction', TransactionSchema);
