# Google OAuth 設定指南

本指南將幫助您設定 Google OAuth，以便用戶可以使用 Google 帳號登入 Web 界面。

## 步驟 1: 在 Google Cloud Console 創建專案

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 點擊頂部的專案選擇器，然後點擊「新增專案」
3. 輸入專案名稱（例如：LINE Accounting Bot）
4. 點擊「建立」

## 步驟 2: 啟用 Google+ API

1. 在 Google Cloud Console 中，前往「API 和服務」→「程式庫」
2. 搜尋「Google+ API」或「Google Identity」
3. 點擊「啟用」

## 步驟 3: 建立 OAuth 2.0 憑證

1. 前往「API 和服務」→「憑證」
2. 點擊「建立憑證」→「OAuth 用戶端 ID」
3. 如果這是第一次，系統會要求您設定 OAuth 同意畫面：
   - 選擇「外部」
   - 填寫應用程式名稱（例如：LINE 記帳機器人）
   - 填寫使用者支援電子郵件
   - 填寫開發人員連絡資訊
   - 點擊「儲存並繼續」
   - 在「範圍」頁面，點擊「儲存並繼續」
   - 在「測試使用者」頁面，可以稍後添加，點擊「儲存並繼續」
   - 點擊「返回資訊主頁」

4. 建立 OAuth 用戶端 ID：
   - 應用程式類型：選擇「網頁應用程式」
   - 名稱：輸入應用程式名稱
   - 已授權的 JavaScript 來源：
     - 開發環境：`http://localhost:3000`
     - 生產環境：`https://your-domain.vercel.app`
   - 已授權的重新導向 URI：
     - 開發環境：`http://localhost:3000/api/auth/callback/google`
     - 生產環境：`https://your-domain.vercel.app/api/auth/callback/google`
   - 點擊「建立」

5. 複製「用戶端 ID」和「用戶端密鑰」

## 步驟 4: 設定環境變數

在 `.env.local` 文件中添加：

```env
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
NEXTAUTH_SECRET=your_random_secret_key_here
NEXTAUTH_URL=http://localhost:3000
```

### 生成 NEXTAUTH_SECRET

您可以使用以下命令生成一個安全的密鑰：

```bash
openssl rand -base64 32
```

或在 Node.js 中：

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

## 步驟 5: 在 Vercel 中設定環境變數

部署到 Vercel 時，請確保設定以下環境變數：

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`（應設為您的 Vercel 域名，例如：`https://your-project.vercel.app`）

**重要**：在 Vercel 中設定 `NEXTAUTH_URL` 時，請使用您的實際 Vercel 域名。

## 步驟 6: 更新 Google OAuth 設定

在 Vercel 部署後，請回到 Google Cloud Console，更新 OAuth 憑證：

1. 前往「API 和服務」→「憑證」
2. 編輯您的 OAuth 用戶端 ID
3. 在「已授權的 JavaScript 來源」中添加：`https://your-domain.vercel.app`
4. 在「已授權的重新導向 URI」中添加：`https://your-domain.vercel.app/api/auth/callback/google`
5. 儲存變更

## 測試

1. 啟動開發伺服器：`npm run dev`
2. 前往 `http://localhost:3000/auth/signin`
3. 點擊「使用 Google 登入」
4. 完成 Google 登入流程
5. 應該會重定向到 `/dashboard` 頁面

## 用戶關聯說明

系統會自動處理 LINE Bot 用戶和 Google 帳號的關聯：

- 如果用戶先使用 LINE Bot，然後用 Google 登入 Web 界面，系統會根據電子郵件自動關聯（如果 LINE 用戶提供了電子郵件）
- 如果用戶先用 Google 登入，然後使用 LINE Bot，系統會在用戶首次使用 LINE Bot 時創建關聯
- 所有記帳記錄都會同步，無論是通過 LINE Bot 還是 Web 界面創建

