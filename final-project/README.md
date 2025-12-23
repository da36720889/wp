# [114-1] Web Programming Final

## (Group 59) LINE 記帳機器人

> **注意：請將 Group xx 替換為您的組別編號**

---

## 📹 Demo 影片連結

<!-- TODO: 請在此填入您的 Demo 影片連結 -->
[[Demo 影片連結](請填入您的影片連結)](https://drive.google.com/file/d/136xLr8zlhSKE6idA1UEtD914SDXjoDhM/view?usp=sharing)

---

## 📝 描述這個服務在做什麼

這是一個基於 Next.js 和 LINE Messaging API 的智能記帳機器人，支援自然語言輸入和 LLM 解析。使用者可以透過 LINE Bot 快速記錄日常收支，並在網頁版查看詳細的統計圖表和資料分析。

### 核心功能

- 💬 **自然語言記帳**：使用 Google Gemini LLM 解析自然語言訊息，自動提取記帳資訊（金額、類別、描述）
- 📊 **記帳管理**：支援收入/支出記錄、查詢、刪除、編輯
- 📈 **記帳摘要與統計**：查看總收入、總支出、餘額，以及消費趨勢圖表（日/週/月/年）
- 🤖 **LINE Bot 整合**：完整的 LINE Messaging API 整合，支援私聊和群組
- 🐣 **電子雞養成系統**：記帳時自動餵食電子雞，養成記帳習慣可以讓電子雞進化
- 💰 **預算管理與提醒**：設定單日/單週/單月預算上限，超支時自動提醒（支援總預算和類別預算）
- 👥 **群組分帳功能**：在 LINE 群組中記錄共同支出，自動計算分攤金額和轉帳建議
- 🎯 **儲蓄目標管理**：設定儲蓄目標，追蹤達成進度，達成時自動通知
- 📋 **記帳模板**：建立常用記帳模板，快速記錄重複性支出
- 🌐 **Web Dashboard**：提供網頁版介面，查看詳細統計和圖表
- 🔗 **帳號連結**：LINE Bot 與 Google 帳號連結，實現跨平台資料同步

---

## 🌐 Deployed 連結

<!-- TODO: 如有安全疑慮可省略此項 -->
**Web Application:** https://final-lac-alpha.vercel.app

**LINE Bot ID:** @757cbqbh

---

## 📱 使用/操作方式

### 伺服器端設定

1. **環境變數設定**（詳見下方「如何在 localhost 安裝與測試」章節）
2. **LINE Webhook 設定**：
   - 在 [LINE Developers Console](https://developers.line.biz/) 設定 Webhook URL
   - 開發環境：使用 ngrok 等工具將本地服務暴露到公網
   - 生產環境：`https://your-domain.vercel.app/api/webhook`
   - 啟用 Webhook

### 使用者端操作

#### LINE Bot 使用方式

1. **加入好友**：搜尋 LINE Bot ID `@757cbqbh` 或掃描 QR Code 加入好友

2. **自然語言記帳**：
   - 直接輸入記帳訊息，例如：
     - `午餐 150 元`
     - `早餐 100`
     - `收入 5000 元薪資`
     - `交通 50`
   - Bot 會自動解析金額、類別、描述，並判斷為收入或支出

3. **查詢記錄**：
   - 可使用斜線指令：`/list` 或 `/list 20` 查看最近的記帳記錄
   - 或直接輸入自然語言：
     - `最近紀錄`、`最近記錄`、`最近記帳`
     - `查詢記錄`、`查看記錄`、`列表`
     - `recent`、`records`、`history`、`list`

4. **查看摘要**：
   - 可使用斜線指令：`/summary` 查看總收入、總支出、餘額
   - 或直接輸入自然語言：
     - `摘要`、`總結`、`總覽`、`統計`、`總計`
     - `summary`、`overview`、`statistics`、`stats`

5. **設定預算**：
   - 點擊 Quick Reply 的「設定預算」按鈕
   - 按照模板輸入：
     ```
     單日預算：1000
     單週預算：5000
     單月預算：20000
     ```
   - 當累積花費超過預算時，記帳成功訊息會自動顯示警告

6. **儲蓄目標管理**：
   - **查看儲蓄目標**：
     - 可使用斜線指令：`/savings` 或 `/goal`
     - 或直接輸入自然語言：
       - `儲蓄`、`儲蓄目標`、`目標`、`我的目標`、`查看目標`、`查看儲蓄`
   - **設定儲蓄目標**：
     - 直接輸入自然語言：
       - `儲蓄目標 [名稱] [金額]`，例如：`儲蓄目標 旅遊 50000`
       - `設定儲蓄目標 [名稱] [金額]`，例如：`設定儲蓄目標 買車 300000`
       - 可選期限：`儲蓄目標 買房 5000000 2025-12-31`
   - **達成通知**：當記帳後儲蓄金額達到目標時，會自動收到 LINE 通知

7. **Quick Reply 功能**：
   - **本周支出**：查看本週每日收入和支出明細
   - **本月支出**：查看本月每日收入和支出明細
   - **最近記錄**：查看最近 10 筆記帳記錄
   - **設定預算**：設定日/週/月預算上限

8. **群組分帳**（僅在 LINE 群組中使用）：
   - `/group new [總金額] [描述]` - 建立新分帳
   - `/group add [金額]` - 記錄實際出資金額
   - `/group split [金額]` - 設定應分攤金額
   - `/group list` - 查看分帳狀態和轉帳建議
   - `/group settle` - 結算並自動匯入個人記帳

9. **其他指令**：
   - **查看電子雞**：
     - 斜線指令：`/pet`
     - 自然語言：`電子雞`、`寵物`、`我的寵物`、`寵物狀態`、`我的雞`、`小雞`、`pet`、`tamagotchi`
   
   - **獲取用戶ID**：
     - 斜線指令：`/myid`
     - 自然語言：`我的id`、`用戶id`、`我的用戶id`、`myid`、`id`、`userid`、`line id`
   
   - **查看說明**：
     - 斜線指令：`/help`
     - 自然語言：`幫助`、`說明`、`使用說明`、`如何使用`、`功能`、`說明書`、`教學`、`help`
   
   - **刪除記錄**：
     - 斜線指令：`/delete i1` 或 `/delete o1`
     - 自然語言：`刪除 i1`、`刪掉 o2`、`移除 i1`、`delete i1`、`remove o2`

#### Web Dashboard 使用方式

1. **登入**：
   - 訪問 https://final-lac-alpha.vercel.app
   - 使用 Google 帳號登入

2. **連結 LINE Bot**：
   - 在 LINE Bot 輸入 `/myid` 獲取 LINE 用戶 ID
   - 在網頁版 Dashboard 右側「連結 LINE Bot」卡片輸入 LINE 用戶 ID
   - 點擊「連結 LINE 用戶」完成連結

3. **查看統計**：
   - 記帳摘要卡片：總收入、總支出、餘額
   - 消費趨勢圖表：日/週/月/年視圖
   - 記帳記錄列表：所有記帳記錄，支援編輯和刪除

4. **管理功能**：
   - 新增記帳記錄
   - 設定預算
   - 管理儲蓄目標
   - 建立記帳模板
   - 匯出 CSV 檔案

---

## 🔗 Github Link

<!-- TODO: 如果有另外建立開源的 repo，請填入連結 -->
<!-- 請不要給成 private wp1141 repo，別人看不到 -->
[Github Repository](請填入您的公開 GitHub 連結，如果沒有則省略此項)

---

## 📌 其他說明

### 技術特色

- **AI 驅動**：使用 Google Gemini 1.5 Flash 進行自然語言理解，自動解析記帳訊息
- **雙平台整合**：LINE Bot 與 Web Dashboard 資料同步，提供一致的記帳體驗
- **遊戲化設計**：電子雞養成系統鼓勵使用者養成記帳習慣
- **智能提醒**：預算超支自動提醒，幫助使用者控制支出
- **群組協作**：群組分帳功能適合聚餐、旅遊等共同支出場景

### 資料安全

- 所有資料儲存在 MongoDB Atlas（加密傳輸）
- 使用 NextAuth.js 進行身份驗證
- LINE Webhook 使用簽名驗證確保安全性

---

## 🛠️ 使用與參考之框架/模組/原始碼

### 核心框架

- **Next.js 16** (App Router) - React 全端框架
- **TypeScript** - 類型安全的 JavaScript
- **React 19** - UI 函式庫

### 後端服務

- **MongoDB Atlas** - 雲端資料庫
- **Mongoose 9** - MongoDB ODM
- **NextAuth.js 5** - 身份驗證框架
- **LINE Messaging API** - LINE Bot SDK

### AI/LLM

- **Google Gemini 1.5 Flash** - 自然語言處理

### UI 框架

- **Material-UI (MUI) 7** - React UI 元件庫
- **Tailwind CSS 4** - 工具優先的 CSS 框架
- **Recharts** - React 圖表函式庫

### 驗證與工具

- **Zod** - TypeScript 優先的 Schema 驗證
- **ESLint** - 程式碼檢查工具
- **Prettier** - 程式碼格式化工具

### 部署

- **Vercel** - 雲端部署平台

---

## 📦 使用之第三方套件、框架、程式碼

### 主要依賴套件

```json
{
  "dependencies": {
    "@auth/core": "^0.34.3",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@google/generative-ai": "^0.24.1",
    "@line/bot-sdk": "^10.5.0",
    "@mui/icons-material": "^7.3.6",
    "@mui/material": "^7.3.6",
    "dotenv": "^17.2.3",
    "googleapis": "^169.0.0",
    "html2canvas": "^1.4.1",
    "jspdf": "^3.0.4",
    "mongoose": "^9.0.0",
    "next": "16.0.7",
    "next-auth": "^5.0.0-beta.30",
    "pdfkit": "^0.17.2",
    "react": "19.2.0",
    "react-dom": "19.2.0",
    "recharts": "^3.6.0",
    "zod": "^4.1.13"
  }
}
```

### 開發工具

- **ESLint** - 程式碼檢查
- **Prettier** - 程式碼格式化
- **TypeScript** - 類型檢查

### 參考資源

- [LINE Developers Documentation](https://developers.line.biz/)
- [Next.js Documentation](https://nextjs.org/docs)
- [Mongoose Documentation](https://mongoosejs.com/)
- [Google Gemini API Documentation](https://ai.google.dev/)

---

## 💭 專題製作心得

<!-- TODO: 請組員填寫專題製作心得 -->
[請在此填寫專題製作心得]

---

## 📋 如何在 localhost 安裝與測試之詳細步驟

### 前置需求

- **Node.js**：版本 18.0.0 或以上
- **npm** 或 **yarn**：套件管理工具
- **MongoDB Atlas 帳號**：免費帳號即可
- **LINE Developers 帳號**：建立 Messaging Channel
- **Google Cloud Console 帳號**：取得 Gemini API Key 和 OAuth 憑證

### 步驟 1：安裝 Node.js 和 npm

1. 前往 [Node.js 官網](https://nodejs.org/) 下載並安裝 Node.js（建議安裝 LTS 版本）
2. 確認安裝成功：
   ```bash
   node --version  # 應顯示 v18.x.x 或以上
   npm --version   # 應顯示 9.x.x 或以上
   ```

### 步驟 2：Clone 專案

```bash
# 如果從 GitHub clone
git clone <your-repo-url>
cd final-project

# 或直接進入專案目錄
cd final-project
```

### 步驟 3：安裝依賴套件

```bash
npm install
```

**預期輸出**：應該會看到所有套件安裝完成，沒有錯誤訊息。

### 步驟 4：設定環境變數

1. **建立 `.env.local` 檔案**（在 `final-project` 目錄下）：

```bash
# Windows (PowerShell)
New-Item -Path .env.local -ItemType File

# macOS/Linux
touch .env.local
```

2. **填入以下環境變數**：

```env
# MongoDB Atlas 連接字串
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/line-accounting?retryWrites=true&w=majority

# LINE Bot 設定
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# Google Gemini API
GEMINI_API_KEY=your_gemini_api_key

# NextAuth 設定
NEXTAUTH_SECRET=your_nextauth_secret_至少32字元隨機字串
NEXTAUTH_URL=http://localhost:3000

# Google OAuth 設定（用於網頁版登入）
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# 應用程式 URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 步驟 5：取得環境變數

#### 5.1 MongoDB Atlas

1. 前往 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. 註冊免費帳號並建立 Cluster（選擇免費 M0 方案）
3. 建立資料庫使用者：
   - Database Access → Add New Database User
   - 設定使用者名稱和密碼
4. 設定網路存取：
   - Network Access → Add IP Address
   - 選擇 "Allow Access from Anywhere" (0.0.0.0/0) 或加入您的 IP
5. 取得連接字串：
   - Database → Connect → Connect your application
   - 複製連接字串，替換 `<password>` 為您的密碼
   - 格式：`mongodb+srv://username:password@cluster.mongodb.net/line-accounting?retryWrites=true&w=majority`

#### 5.2 LINE Bot

1. 前往 [LINE Developers](https://developers.line.biz/)
2. 建立 Provider（如果還沒有）
3. 建立 Messaging Channel：
   - 選擇 "Messaging API"
   - 填寫 Channel 資訊
4. 取得 Channel Access Token：
   - Channel → Messaging API → Issue
   - 複製 Channel Access Token
5. 取得 Channel Secret：
   - Channel → Basic settings → Channel secret
   - 複製 Channel Secret
6. 設定 Webhook URL（開發環境）：
   - 使用 ngrok：`ngrok http 3000`
   - 複製 ngrok 提供的 HTTPS URL
   - 在 LINE Developers Console 設定 Webhook URL：`https://your-ngrok-url.ngrok.io/api/webhook`
   - 啟用 Webhook

#### 5.3 Google Gemini API

1. 前往 [Google AI Studio](https://makersuite.google.com/app/apikey)
2. 建立 API Key
3. 複製 API Key

#### 5.4 NextAuth Secret

產生隨機字串（至少 32 字元）：

```bash
# 使用 OpenSSL
openssl rand -base64 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 5.5 Google OAuth（網頁版登入）

1. 前往 [Google Cloud Console](https://console.cloud.google.com/)
2. 建立新專案或選擇現有專案
3. 啟用 Google+ API：
   - APIs & Services → Library → 搜尋 "Google+ API" → Enable
4. 建立 OAuth 2.0 憑證：
   - APIs & Services → Credentials → Create Credentials → OAuth client ID
   - Application type: Web application
   - Authorized redirect URIs: `http://localhost:3000/api/auth/callback/google`
5. 複製 Client ID 和 Client Secret

### 步驟 6：啟動開發伺服器

```bash
npm run dev
```

**預期輸出**：
```
  ▲ Next.js 16.0.7
  - Local:        http://localhost:3000
  - Ready in X.XXs
```

### 步驟 7：測試 Web 應用程式

1. **開啟瀏覽器**：訪問 `http://localhost:3000`
2. **測試登入**：
   - 點擊「登入」按鈕
   - 使用 Google 帳號登入
   - 應該能成功登入並看到 Dashboard
3. **測試記帳功能**：
   - 在 Dashboard 新增一筆記帳記錄
   - 確認記錄出現在列表中
   - 測試編輯和刪除功能

### 步驟 8：測試 LINE Bot

1. **確保 ngrok 正在運行**（如果使用本地開發）：
   ```bash
   ngrok http 3000
   ```
   複製 HTTPS URL 並更新 LINE Webhook URL

2. **加入 LINE Bot 好友**：
   - 搜尋 LINE Bot ID `@757cbqbh` 或掃描 QR Code

3. **測試記帳功能**：
   - 發送訊息：`午餐 150 元`
   - Bot 應該回覆：`✅ 已記錄：餐飲 NT$150`
   - 如果超過預算，會顯示警告訊息

4. **測試指令**：
   - 斜線指令：`/list`、`/summary`、`/help`
   - 自然語言：`最近記錄`、`摘要`、`說明`（無需輸入 `/`）

5. **測試 Quick Reply**：
   - 點擊「本周支出」查看本週明細
   - 點擊「本月支出」查看本月明細
   - 點擊「最近記錄」查看最近 10 筆記錄
   - 點擊「設定預算」設定預算上限

6. **測試預算警告**：
   - 設定日預算：點擊「設定預算」，輸入 `單日預算：500\n單週預算：3000\n單月預算：10000`
   - 記錄支出：`宵夜 600`（超過日預算 500）
   - 應該看到：`✅ 已記錄：宵夜 NT$600\n\n⚠️ 已超過單日預算！目前 600 / 500`

### 步驟 9：測試群組分帳功能（可選）

1. **建立 LINE 群組**並將 Bot 加入群組
2. **測試分帳指令**：
   - `/group new 1000 聚餐` - 建立新分帳
   - `/group add 300` - 記錄出資
   - `/group split 250` - 設定分攤
   - `/group list` - 查看狀態
   - `/group settle` - 結算

### 步驟 10：驗證資料庫連接

1. **檢查 MongoDB Atlas**：
   - 前往 MongoDB Atlas Dashboard
   - Collections → 應該能看到 `users`, `transactions`, `budgets`, `pets` 等集合
   - 確認資料已正確儲存

### 常見問題排除

#### 問題 1：`npm install` 失敗

**解決方案**：
- 確認 Node.js 版本：`node --version` 應為 18.x.x 或以上
- 清除快取：`npm cache clean --force`
- 刪除 `node_modules` 和 `package-lock.json`，重新執行 `npm install`

#### 問題 2：MongoDB 連接失敗

**解決方案**：
- 確認 MongoDB Atlas IP 白名單包含您的 IP 或 0.0.0.0/0
- 確認連接字串中的密碼正確（沒有特殊字元需要 URL encode）
- 確認資料庫使用者權限正確

#### 問題 3：LINE Webhook 無法接收訊息

**解決方案**：
- 確認 ngrok 正在運行且 URL 正確
- 確認 LINE Developers Console 中的 Webhook URL 設定正確
- 確認 Webhook 已啟用（Verify 按鈕顯示成功）
- 檢查伺服器日誌是否有錯誤

#### 問題 4：Google OAuth 登入失敗

**解決方案**：
- 確認 Google Cloud Console 中的 Redirect URI 設定正確：`http://localhost:3000/api/auth/callback/google`
- 確認 Client ID 和 Client Secret 正確
- 確認 Google+ API 已啟用

#### 問題 5：Gemini API 無法使用

**解決方案**：
- 確認 API Key 正確
- 確認 API Key 有啟用 Gemini API
- 檢查 API 配額是否用盡

---

## 👥 每位組員之負責項目

<!-- TODO: 請詳述每位組員的負責項目 -->
<!-- 如果有找外掛，請務必特別註明，並說明原因，且明確描述自己以及外掛的貢獻 -->

### 組員 1
- **負責項目**：[請填寫]
- **具體貢獻**：[請填寫]

### 組員 2
- **負責項目**：[請填寫]
- **具體貢獻**：[請填寫]

### 組員 3
- **負責項目**：[請填寫]
- **具體貢獻**：[請填寫]

<!-- 如果有外掛成員，請在此說明 -->
### 外掛成員（如有）
- **姓名**：[請填寫]
- **原因**：[請說明為什麼需要外掛]
- **外掛貢獻**：[請填寫外掛的具體貢獻]
- **自己貢獻**：[請填寫自己的具體貢獻]

---

## 🔄 專題延伸說明

<!-- TODO: 如果此專題是之前作品/專題的延伸，請在此說明清楚本學期的貢獻 -->
[如果此專題是之前作品/專題的延伸，請在此說明清楚本學期的貢獻。如果沒有，請填寫「無」]

---

## 💡 對於此課程的建議

<!-- TODO: 請填寫對於此課程的建議 -->
[請在此填寫對於此課程的建議]

---

## 技術棧

- **框架**：Next.js 16 (App Router) + TypeScript
- **資料庫**：MongoDB Atlas + Mongoose ODM
- **驗證**：Zod
- **樣式**：Tailwind CSS
- **UI 元件**：Material-UI (MUI)
- **LLM**：Google Gemini 1.5 Flash
- **部署**：Vercel
- **程式品質**：ESLint + Prettier

## 專案結構

```
final-project/
├── app/
│   ├── api/
│   │   ├── webhook/          # LINE Webhook 端點
│   │   ├── transactions/     # 記帳記錄 API
│   │   ├── auth/            # 認證 API
│   │   └── ...
│   ├── dashboard/           # Dashboard 頁面
│   └── ...
├── lib/
│   ├── db/
│   │   └── mongodb.ts       # MongoDB 連接
│   ├── models/              # 資料模型
│   ├── repositories/        # Repository 層
│   ├── services/            # Service 層
│   ├── schemas/             # Zod 驗證 Schema
│   └── utils/               # 工具函式
├── components/              # React 元件
└── ...
```

## 授權

MIT License
