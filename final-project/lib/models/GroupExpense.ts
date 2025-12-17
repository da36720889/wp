import mongoose, { Schema, Document } from 'mongoose';

export interface IParticipant {
  lineUserId: string;
  name?: string;
  paid: number; // 實際支付的金額
  share: number; // 應分攤的金額
}

export interface IGroupExpense extends Document {
  groupId: string; // LINE 群組 ID
  groupName?: string; // 群組名稱（可選）
  creatorLineUserId: string; // 建立者的 LINE 用戶 ID
  totalAmount: number; // 總金額
  description?: string; // 描述
  participants: IParticipant[]; // 參與者列表
  settled: boolean; // 是否已結算
  settledAt?: Date; // 結算時間
  transactions: string[]; // 關聯的交易記錄 ID（匯入個人記帳後）
  createdAt: Date;
  updatedAt: Date;
}

const ParticipantSchema: Schema = new Schema(
  {
    lineUserId: {
      type: String,
      required: true,
    },
    name: {
      type: String,
    },
    paid: {
      type: Number,
      required: true,
      min: 0,
    },
    share: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
);

const GroupExpenseSchema: Schema = new Schema(
  {
    groupId: {
      type: String,
      required: true,
      index: true,
    },
    groupName: {
      type: String,
    },
    creatorLineUserId: {
      type: String,
      required: true,
      index: true,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
    },
    participants: {
      type: [ParticipantSchema],
      required: true,
      validate: {
        validator: function (participants: IParticipant[]) {
          return participants.length > 0;
        },
        message: '至少需要一個參與者',
      },
    },
    settled: {
      type: Boolean,
      default: false,
      index: true,
    },
    settledAt: {
      type: Date,
    },
    transactions: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

// 創建索引
GroupExpenseSchema.index({ groupId: 1, createdAt: -1 });
GroupExpenseSchema.index({ creatorLineUserId: 1, settled: 1 });

export default mongoose.models.GroupExpense ||
  mongoose.model<IGroupExpense>('GroupExpense', GroupExpenseSchema);

