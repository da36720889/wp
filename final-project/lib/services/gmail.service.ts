import { google } from 'googleapis';
import User from '@/lib/models/User';
import connectDB from '@/lib/db/mongodb';
import { logger } from '@/lib/utils/logger';

export interface EmailMessage {
  id: string;
  subject: string;
  from: string;
  date: Date;
  body: string;
  snippet: string;
}

export class GmailService {
  /**
   * 獲取 Gmail API 客戶端
   */
  private async getGmailClient(userId: string) {
    await connectDB();

    const user = await User.findById(userId).select('+gmailAccessToken +gmailRefreshToken');
    if (!user || !user.gmailAccessToken) {
      throw new Error('用戶未授權 Gmail 存取');
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    );

    oauth2Client.setCredentials({
      access_token: user.gmailAccessToken,
      refresh_token: user.gmailRefreshToken,
    });

    // 如果 token 過期，嘗試刷新
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      if (credentials.access_token && credentials.refresh_token) {
        user.gmailAccessToken = credentials.access_token;
        if (credentials.refresh_token) {
          user.gmailRefreshToken = credentials.refresh_token;
        }
        await user.save();
        oauth2Client.setCredentials(credentials);
      }
    } catch (error) {
      logger.warn('Failed to refresh Gmail token', error as Error);
      // Token 可能已失效，需要重新授權
    }

    return google.gmail({ version: 'v1', auth: oauth2Client });
  }

  /**
   * 獲取最近的郵件（用於檢查帳單）
   */
  async getRecentEmails(
    userId: string,
    maxResults: number = 10,
    query?: string
  ): Promise<EmailMessage[]> {
    try {
      const gmail = await this.getGmailClient(userId);

      // 預設查詢：尋找可能包含帳單的郵件
      const defaultQuery = query || 'subject:(發票 OR 帳單 OR 收據 OR receipt OR invoice) OR from:(noreply OR notification)';

      const response = await gmail.users.messages.list({
        userId: 'me',
        q: defaultQuery,
        maxResults,
      });

      if (!response.data.messages) {
        return [];
      }

      const messages: EmailMessage[] = [];

      for (const message of response.data.messages) {
        try {
          const fullMessage = await gmail.users.messages.get({
            userId: 'me',
            id: message.id!,
            format: 'full',
          });

          const headers = fullMessage.data.payload?.headers || [];
          const subject = headers.find((h) => h.name === 'Subject')?.value || '';
          const from = headers.find((h) => h.name === 'From')?.value || '';
          const dateHeader = headers.find((h) => h.name === 'Date')?.value;
          const date = dateHeader ? new Date(dateHeader) : new Date();

          // 提取郵件內容
          let body = '';
          let snippet = fullMessage.data.snippet || '';

          const extractBody = (part: any): string => {
            if (part.body?.data) {
              return Buffer.from(part.body.data, 'base64').toString('utf-8');
            }
            if (part.parts) {
              return part.parts.map(extractBody).join('\n');
            }
            return '';
          };

          if (fullMessage.data.payload) {
            body = extractBody(fullMessage.data.payload);
          }

          messages.push({
            id: message.id!,
            subject,
            from,
            date,
            body,
            snippet,
          });
        } catch (error) {
          logger.warn('Error fetching email details', { error: error instanceof Error ? error.message : String(error), messageId: message.id });
        }
      }

      return messages;
    } catch (error) {
      logger.error('Error fetching emails', error as Error);
      throw error;
    }
  }

  /**
   * 檢查用戶是否已授權 Gmail
   */
  async isGmailAuthorized(userId: string): Promise<boolean> {
    try {
      await connectDB();
      const user = await User.findById(userId).select('+gmailAccessToken');
      return !!(user && user.gmailAccessToken);
    } catch (error) {
      return false;
    }
  }

  /**
   * 啟用或停用 Gmail 自動匯入
   */
  async setGmailEnabled(userId: string, enabled: boolean): Promise<void> {
    await connectDB();
    const user = await User.findById(userId);
    if (!user) {
      throw new Error('用戶不存在');
    }
    user.gmailEnabled = enabled;
    await user.save();
  }
}

