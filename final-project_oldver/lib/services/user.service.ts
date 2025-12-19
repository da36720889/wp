import User, { IUser } from '@/lib/models/User';

export class UserService {
  async findOrCreateByGoogle(googleId: string, email: string, name?: string, picture?: string): Promise<IUser> {
    let user = await User.findOne({ googleId });
    if (!user) {
      user = await User.create({
        googleId,
        email,
        name,
        picture,
      });
    } else {
      // 更新用户信息
      user.email = email;
      if (name) user.name = name;
      if (picture) user.picture = picture;
      await user.save();
    }
    return user;
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return await User.findOne({ email });
  }

  async findByLineUserId(lineUserId: string): Promise<IUser | null> {
    return await User.findOne({ lineUserId });
  }

  async linkLineUser(email: string, lineUserId: string): Promise<IUser | null> {
    const user = await User.findOne({ email });
    if (user) {
      user.lineUserId = lineUserId;
      await user.save();
      return user;
    }
    return null;
  }

  async createUserWithLine(lineUserId: string, email?: string): Promise<IUser> {
    // 如果提供了邮箱，检查是否已存在
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        existingUser.lineUserId = lineUserId;
        await existingUser.save();
        return existingUser;
      }
    }

    // 创建新用户（仅 LINE）
    return await User.create({
      lineUserId,
      googleId: `line_${lineUserId}`, // 临时 ID，等待关联 Google
      email: email || `line_${lineUserId}@line.local`,
    });
  }

  async getUserById(userId: string): Promise<IUser | null> {
    return await User.findById(userId);
  }

  /**
   * 查找需要關聯的 LINE 用戶（即只有臨時 googleId 的用戶）
   * 這用於在 Google 登入時自動關聯 LINE 用戶
   */
  async findLineUsersToLink(): Promise<IUser[]> {
    return await User.find({
      lineUserId: { $exists: true, $ne: null },
      googleId: { $regex: /^line_/ }, // googleId 以 line_ 開頭表示是臨時 ID
    });
  }

  /**
   * 合併 LINE 用戶到 Google 用戶
   * 將 LINE 用戶的 lineUserId 轉移到 Google 用戶，並返回需要更新 userId 的 Transaction 記錄
   */
  async mergeLineUserToGoogle(lineUserId: string, googleUserId: string): Promise<{
    oldUserId: string;
    newUserId: string;
  } | null> {
    const lineUser = await User.findOne({ lineUserId });
    const googleUser = await User.findById(googleUserId);

    if (!lineUser || !googleUser) {
      return null;
    }

    // 如果 LINE 用戶和 Google 用戶是同一個，不需要合併
    if (lineUser._id.toString() === googleUser._id.toString()) {
      return null;
    }

    // 將 LINE 用戶的 lineUserId 轉移到 Google 用戶
    googleUser.lineUserId = lineUserId;
    await googleUser.save();

    // 返回需要更新的用戶 ID
    return {
      oldUserId: lineUser._id.toString(),
      newUserId: googleUser._id.toString(),
    };
  }

  /**
   * 解除 Google 用戶與 LINE 用戶的連結
   */
  async unlinkLineUser(googleUserId: string): Promise<boolean> {
    const user = await User.findById(googleUserId);
    if (!user || !user.lineUserId) {
      return false;
    }

    user.lineUserId = undefined;
    await user.save();
    return true;
  }

  /**
   * 查找所有重複連結的 LINE 用戶（同一個 lineUserId 被多個 Google 帳號使用）
   * 這用於診斷和修復之前的 bug
   */
  async findDuplicateLineLinks(): Promise<Array<{
    lineUserId: string;
    users: Array<{
      userId: string;
      email: string;
      googleId: string;
    }>;
  }>> {
    // 查找所有有 lineUserId 的用戶
    const usersWithLine = await User.find({
      lineUserId: { $exists: true, $ne: null },
      googleId: { $not: { $regex: /^line_/ } }, // 只查找真實的 Google 帳號
    });

    // 按 lineUserId 分組
    const lineUserMap = new Map<string, Array<{
      userId: string;
      email: string;
      googleId: string;
    }>>();

    for (const user of usersWithLine) {
      if (user.lineUserId) {
        if (!lineUserMap.has(user.lineUserId)) {
          lineUserMap.set(user.lineUserId, []);
        }
        lineUserMap.get(user.lineUserId)!.push({
          userId: user._id.toString(),
          email: user.email,
          googleId: user.googleId,
        });
      }
    }

    // 只返回重複的（多於 1 個用戶）
    const duplicates: Array<{
      lineUserId: string;
      users: Array<{
        userId: string;
        email: string;
        googleId: string;
      }>;
    }> = [];

    for (const [lineUserId, users] of lineUserMap.entries()) {
      if (users.length > 1) {
        duplicates.push({ lineUserId, users });
      }
    }

    return duplicates;
  }
}

