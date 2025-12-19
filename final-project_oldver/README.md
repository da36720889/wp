# LINE 記帳機器人

一個基於 Next.js 和 LINE Messaging API 的智能記帳機器人，支援自然語言輸入和 LLM 解析。

## 功能特色

- 💬 **自然語言記帳**：使用 LLM 解析自然語言訊息，自動提取記帳資訊
- 📊 **記帳管理**：支援收入/支出記錄、查詢、刪除
- 📈 **記帳摘要**：查看總收入、總支出和餘額
- 🤖 **LINE Bot 整合**：完整的 LINE Messaging API 整合
- 🗄️ **MongoDB 儲存**：使用 MongoDB Atlas 儲存記帳資料
- ✅ **資料驗證**：使用 Zod 進行請求驗證
- 🏗️ **架構設計**：採用 Repository Pattern 和 Service Layer

## 技術棧

- **框架**：Next.js 16 (App Router) + TypeScript
- **資料庫**：MongoDB Atlas + Mongoose ODM
- **驗證**：Zod
- **樣式**：Tailwind CSS
- **LLM**：Google Gemini 1.5 Flash
- **部署**：Vercel
- **程式品質**：ESLint + Prettier

## 專案結構

```
final-project/
├── app/
│   ├── api/
│   │   └── webhook/
│   │       └── route.ts          # LINE Webhook 端點
│   └── ...
├── lib/
│   ├── db/
│   │   └── mongodb.ts            # MongoDB 連接
│   ├── models/
│   │   └── Transaction.ts        # 記帳資料模型
│   ├── repositories/
│   │   └── transaction.repository.ts  # Repository 層
│   ├── services/
│   │   ├── transaction.service.ts     # 記帳業務邏輯
│   │   ├── line.service.ts            # LINE Bot 服務
│   │   └── llm.service.ts              # LLM 服務
│   ├── schemas/
│   │   └── transaction.schema.ts      # Zod 驗證 Schema
│   └── utils/
│       ├── errors.ts                  # 錯誤處理
│       └── logger.ts                  # 日誌工具
└── ...
```

## 環境變數設定

複製 `.env.example` 並建立 `.env.local` 檔案：

```bash
cp .env.example .env.local
```

在 `.env.local` 中設定以下環境變數：

```env
# MongoDB Atlas
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/line-accounting?retryWrites=true&w=majority

# LINE Bot
LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
LINE_CHANNEL_SECRET=your_line_channel_secret

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key

# Server
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 取得環境變數

1. **MongoDB Atlas**：
   - 前往 [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
   - 建立免費帳號和 Cluster
   - 取得連接字串

2. **LINE Bot**：
   - 前往 [LINE Developers](https://developers.line.biz/)
   - 建立 Provider 和 Messaging Channel
   - 取得 Channel Access Token 和 Channel Secret

3. **Google Gemini**：
   - 前往 [Google AI Studio](https://makersuite.google.com/app/apikey)
   - 建立 API Key

## 安裝與執行

### 安裝依賴

```bash
npm install
```

### 開發模式

```bash
npm run dev
```

應用程式將在 `http://localhost:3000` 啟動。

### 建置

```bash
npm run build
```

### 生產模式

```bash
npm start
```

## LINE Bot 設定

1. 在 LINE Developers Console 中設定 Webhook URL：
   - 開發環境：使用 ngrok 等工具將本地服務暴露到公網
   - 生產環境：`https://your-domain.vercel.app/api/webhook`

2. 啟用 Webhook

3. 將 Bot 加入好友並開始使用

## 使用方式

### 自然語言記帳

直接輸入記帳訊息，機器人會自動解析：

- `午餐 150 元`
- `收入 5000 元薪資`
- `買書 300 元`
- `今天交通費 80 元`

### 指令

- `/list [數量]` - 查詢最近的記帳記錄（預設 10 筆）
- `/summary` - 查看記帳摘要（總收入、總支出、餘額）
- `/delete [ID]` - 刪除指定記錄
- `/help` - 顯示使用說明

## 部署到 Vercel

详细的部署步骤请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

快速步骤：
1. 將專案推送到 GitHub
2. 在 [Vercel](https://vercel.com/) 中匯入專案
3. 設定環境變數（與 `.env.local` 相同）
4. 部署完成後，更新 LINE Webhook URL 為 Vercel 提供的網址

## 開發規範

### 程式碼風格

- 使用 ESLint 和 Prettier 確保程式碼品質
- 執行 `npm run lint` 檢查程式碼

### 架構原則

- **Repository Pattern**：資料存取邏輯封裝在 Repository 層
- **Service Layer**：業務邏輯處理在 Service 層
- **Schema Validation**：使用 Zod 驗證所有輸入
- **Error Handling**：集中式錯誤處理

## 授權

MIT License
