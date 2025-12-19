import mongoose, { Schema, Document } from 'mongoose';

export interface ITransactionTemplate extends Document {
  userId: string;
  name: string; // 模板名稱
  amount: number;
  category: string;
  description?: string;
  type: 'income' | 'expense';
  createdAt: Date;
  updatedAt: Date;
}

const TransactionTemplateSchema: Schema = new Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
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
  },
  {
    timestamps: true,
  }
);

// 創建索引
TransactionTemplateSchema.index({ userId: 1, type: 1 });

export default mongoose.models.TransactionTemplate ||
  mongoose.model<ITransactionTemplate>('TransactionTemplate', TransactionTemplateSchema);

