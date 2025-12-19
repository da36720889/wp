import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  lineUserId?: string;
  googleId: string;
  email: string;
  name?: string;
  picture?: string;
  gmailAccessToken?: string; // Gmail API access token
  gmailRefreshToken?: string; // Gmail API refresh token
  gmailEnabled?: boolean; // 是否啟用 Gmail 自動匯入
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema: Schema = new Schema(
  {
    lineUserId: {
      type: String,
      index: true,
      sparse: true,
    },
    googleId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
    },
    picture: {
      type: String,
    },
    gmailAccessToken: {
      type: String,
      select: false, // 預設不返回，保護敏感資訊
    },
    gmailRefreshToken: {
      type: String,
      select: false,
    },
    gmailEnabled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// 创建复合索引
UserSchema.index({ lineUserId: 1, googleId: 1 });

export default mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
