# 部署指南

本指南将帮助您将 LINE 記帳機器人部署到 GitHub 和 Vercel。

## 步骤 1: 推送到 GitHub

### 1.1 在 GitHub 创建新仓库

1. 前往 [GitHub](https://github.com) 并登录
2. 点击右上角的 "+" → "New repository"
3. 填写仓库信息：
   - Repository name: `line-accounting-bot` (或您喜欢的名称)
   - Description: `LINE 記帳機器人 with Gemini integration`
   - 选择 Public 或 Private
   - **不要**勾选 "Initialize this repository with a README"
4. 点击 "Create repository"

### 1.2 连接本地仓库并推送

在终端中执行以下命令（将 `YOUR_USERNAME` 和 `YOUR_REPO_NAME` 替换为您的实际值）：

```bash
# 添加远程仓库
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 推送代码
git branch -M main
git push -u origin main
```

或者如果您使用 SSH：

```bash
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

## 步骤 2: 部署到 Vercel

### 2.1 导入项目

1. 前往 [Vercel](https://vercel.com) 并登录（可以使用 GitHub 账号登录）
2. 点击 "Add New..." → "Project"
3. 在 "Import Git Repository" 中选择您刚创建的 GitHub 仓库
4. 点击 "Import"

### 2.2 配置项目设置

Vercel 会自动检测 Next.js 项目，保持默认设置即可：
- **Framework Preset**: Next.js
- **Root Directory**: `./`
- **Build Command**: `npm run build` (自动检测)
- **Output Directory**: `.next` (自动检测)

### 2.3 配置环境变量

在 "Environment Variables" 部分，添加以下环境变量：

```
# 数据库
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/line-accounting?retryWrites=true&w=majority

# LINE Bot
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key

# NextAuth (认证)
NEXTAUTH_SECRET=your_random_secret_key_here
NEXTAUTH_URL=https://your-project.vercel.app

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# 应用 URL (可选)
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
```

**重要**：
- 将 `NEXTAUTH_URL` 和 `NEXT_PUBLIC_APP_URL` 中的 `your-project` 替换为 Vercel 分配的实际域名
- 或者先部署，然后在部署完成后更新这些变量
- `NEXTAUTH_SECRET` 可以使用以下命令生成：`openssl rand -base64 32`

### 2.4 部署

1. 点击 "Deploy" 按钮
2. 等待部署完成（通常需要 1-3 分钟）
3. 部署完成后，您会看到一个类似 `https://your-project.vercel.app` 的 URL

## 步骤 3: 配置 LINE Bot Webhook

### 3.1 获取 Webhook URL

部署完成后，您的 Webhook URL 将是：
```
https://your-project.vercel.app/api/webhook
```

### 3.2 在 LINE Developers Console 配置

1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. 选择您的 Provider 和 Messaging Channel
3. 在 "Messaging API" 标签页中，找到 "Webhook settings"
4. 点击 "Edit"
5. 在 "Webhook URL" 中输入：`https://your-project.vercel.app/api/webhook`
6. 启用 "Use webhook"
7. 点击 "Update" 保存

### 3.3 验证 Webhook

1. 在 LINE Developers Console 中，点击 "Verify" 按钮测试 Webhook
2. 如果验证成功，您会看到 "Success" 消息
3. 如果失败，请检查：
   - Webhook URL 是否正确
   - Vercel 部署是否成功
   - 环境变量是否正确配置

### 3.4 发布 Bot

1. 在 LINE Developers Console 中，找到 "Messaging API" 标签页
2. 确保 "Webhook" 已启用
3. 您的 Bot 现在已经可以接收消息了！

## 步骤 4: 测试 Bot

1. 在 LINE 中搜索您的 Bot 名称或使用 QR Code
2. 将 Bot 加入好友
3. 发送测试消息，例如："午餐 150 元"
4. Bot 应该会回复确认消息

## 常见问题

### 404 错误

如果部署后访问网站出现 404 错误，请按以下步骤排查：

1. **检查构建日志**
   - 在 Vercel Dashboard 中查看 "Deployments" → 选择最新的部署 → 查看 "Build Logs"
   - 确认构建是否成功完成
   - 检查是否有 TypeScript 或编译错误

2. **验证环境变量**
   - 确保所有必需的环境变量都已设置：
     - `MONGODB_URI`
     - `NEXTAUTH_SECRET`
     - `NEXTAUTH_URL` (必须设置为完整的 Vercel URL，例如：`https://your-project.vercel.app`)
     - `GOOGLE_CLIENT_ID`
     - `GOOGLE_CLIENT_SECRET`
   - 在 Vercel Dashboard → Project Settings → Environment Variables 中检查

3. **测试健康检查端点**
   - 访问 `https://your-project.vercel.app/api/health`
   - 如果返回 `{"status":"ok",...}`，说明应用正在运行
   - 如果返回 404，可能是路由配置问题

4. **检查 Next.js 配置**
   - 确认 `next.config.ts` 中没有不兼容的配置
   - 已移除可能导致问题的 Turbopack 配置

5. **重新部署**
   - 在 Vercel Dashboard 中点击 "Redeploy"
   - 或推送新的 commit 触发自动部署

6. **查看运行时日志**
   - 在 Vercel Dashboard → Deployments → 选择部署 → "Functions" 标签
   - 查看是否有运行时错误

### Webhook 验证失败

- 确保 Vercel 部署成功
- 检查 Webhook URL 是否正确（必须以 `/api/webhook` 结尾）
- 确保环境变量 `LINE_CHANNEL_SECRET` 已正确配置

### Bot 无法回复消息

- 检查 Vercel 的部署日志
- 确认所有环境变量都已正确设置
- 检查 MongoDB 连接是否正常
- 确认 Gemini API Key 有效

### Google 登入出現 "Bad request" 錯誤

如果點擊 Google 登入按鈕後出現 "Bad request" 錯誤，請按以下步驟排查：

1. **檢查 NEXTAUTH_URL 環境變數**
   - 在 Vercel Dashboard → Project Settings → Environment Variables 中確認
   - `NEXTAUTH_URL` 必須設置為完整的 Vercel URL，例如：`https://final-lac-alpha.vercel.app`
   - **重要**：URL 必須包含 `https://` 前綴，且不能有尾隨斜線
   - 如果設置錯誤，更新後需要重新部署

2. **檢查 Google OAuth 重定向 URI 配置**
   - 前往 [Google Cloud Console](https://console.cloud.google.com/)
   - 進入「API 和服務」→「憑證」
   - 編輯您的 OAuth 2.0 用戶端 ID
   - 確認「已授權的重新導向 URI」中包含：
     - `https://final-lac-alpha.vercel.app/api/auth/callback/google`
   - 確認「已授權的 JavaScript 來源」中包含：
     - `https://final-lac-alpha.vercel.app`
   - 儲存變更（通常需要幾分鐘生效）

3. **檢查環境變數是否正確設置**
   - `GOOGLE_CLIENT_ID` - 必須與 Google Cloud Console 中的用戶端 ID 一致
   - `GOOGLE_CLIENT_SECRET` - 必須與 Google Cloud Console 中的用戶端密鑰一致
   - `NEXTAUTH_SECRET` - 必須設置（可以使用 `openssl rand -base64 32` 生成）
   - `NEXTAUTH_URL` - 必須設置為完整的 Vercel URL

4. **檢查 NextAuth 配置**
   - 確認 `lib/auth.ts` 中包含 `trustHost: true` 選項（已在最新版本中添加）
   - 此選項對於 Vercel 等平台是必需的

5. **重新部署**
   - 更新環境變數或 Google OAuth 設定後，在 Vercel Dashboard 中點擊 "Redeploy"
   - 等待部署完成後再次測試

6. **查看錯誤日誌**
   - 在 Vercel Dashboard → Deployments → 選擇部署 → "Functions" 標籤
   - 查看是否有相關錯誤訊息
   - 在瀏覽器開發者工具的 Console 和 Network 標籤中查看詳細錯誤

### 环境变量更新

如果更新了环境变量：
1. 在 Vercel Dashboard 中更新环境变量
2. 重新部署项目（Vercel 会自动触发，或手动点击 "Redeploy"）

## 后续更新

每次您推送代码到 GitHub 的 `main` 分支时，Vercel 会自动重新部署您的应用。

```bash
# 修改代码后
git add .
git commit -m "Your commit message"
git push origin main
```

Vercel 会自动检测并部署新版本。

