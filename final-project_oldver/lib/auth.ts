import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import connectDB from './db/mongodb';
import User from './models/User';
import { UserService } from './services/user.service';
import { TransactionRepository } from './repositories/transaction.repository';

const userService = new UserService();
const transactionRepository = new TransactionRepository();

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  trustHost: true, // 在 Vercel 等平台上需要此選項
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider === 'google') {
        try {
          await connectDB();
          const googleId = account.providerAccountId;
          const email = user.email!;

          // 查找或创建用户
          let dbUser = await User.findOne({ googleId });

          if (!dbUser) {
            // 检查是否已有相同邮箱的用户（可能通过 LINE 关联）
            dbUser = await User.findOne({ email });
            if (dbUser) {
              // 更新现有用户，添加 Google ID
              dbUser.googleId = googleId;
              dbUser.name = user.name || undefined;
              dbUser.picture = user.image || undefined;
              await dbUser.save();
            } else {
              // 查找是否有 LINE 用戶需要關聯（查找所有只有臨時 googleId 的用戶）
              // 這裡我們採用簡單策略：如果用戶想要關聯，可以通過其他方式手動關聯
              // 或者我們可以查找第一個 LINE 用戶並關聯（但這可能不準確）
              
              // 创建新用户
              dbUser = await User.create({
                googleId,
                email,
                name: user.name || undefined,
                picture: user.image || undefined,
              });
            }
          } else {
            // 更新用户信息
            dbUser.email = email;
            dbUser.name = user.name || undefined;
            dbUser.picture = user.image || undefined;
            await dbUser.save();
          }

          // 不再自動關聯 LINE 用戶
          // 用戶必須通過 /api/link-line 手動連結 LINE 帳號
          // 這確保每個 Google 帳號只能連結到正確的 LINE 用戶

          return true;
        } catch (error) {
          console.error('Sign in error:', error);
          return false;
        }
      }
      return true;
    },
    async session({ session, user: sessionUser }) {
      if (session.user && session.user.email) {
        await connectDB();
        const user = await User.findOne({ email: session.user.email });
        if (user) {
          (session.user as { id?: string; lineUserId?: string }).id = user._id.toString();
          (session.user as { id?: string; lineUserId?: string }).lineUserId = user.lineUserId || undefined;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET,
});

