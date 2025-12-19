# 安全性說明

## 環境變數安全性

### `NEXT_PUBLIC_` 前綴的含義

在 Next.js 中，以 `NEXT_PUBLIC_` 開頭的環境變數會被**暴露到客戶端（瀏覽器）**。這意味著：

- ✅ **可以安全暴露的內容**：
  - 公開的 URL（如應用程式域名）
  - 公開的 API 端點
  - 非敏感的配置值

- ❌ **絕對不能暴露的內容**：
  - API Keys（如 `GEMINI_API_KEY`）
  - Secrets（如 `NEXTAUTH_SECRET`、`LINE_CHANNEL_SECRET`）
  - 資料庫連接字串（如 `MONGODB_URI`）
  - OAuth Client Secrets

### 當前環境變數分類

#### 🔴 敏感變數（必須保密，不使用 `NEXT_PUBLIC_` 前綴）

```env
# 這些變數只在伺服器端使用，永遠不會暴露到客戶端
MONGODB_URI=...                    # 資料庫連接字串
LINE_CHANNEL_ACCESS_TOKEN=...      # LINE Bot Token
LINE_CHANNEL_SECRET=...            # LINE Bot Secret
GEMINI_API_KEY=...                 # Gemini API Key
NEXTAUTH_SECRET=...                # NextAuth 密鑰
GOOGLE_CLIENT_SECRET=...           # Google OAuth Secret
```

#### 🟢 公開變數（可以使用 `NEXT_PUBLIC_` 前綴）

```env
# 這些變數可以暴露到客戶端（但當前專案中未實際使用）
NEXT_PUBLIC_APP_URL=http://localhost:3000  # 應用程式 URL（公開資訊）
```

### `NEXT_PUBLIC_APP_URL` 的安全性分析

**結論：✅ 安全**

原因：
1. **URL 本身就是公開的**：用戶需要知道 URL 才能訪問應用
2. **不包含敏感資訊**：只是域名，不包含密鑰或憑證
3. **當前未實際使用**：檢查代碼後發現此變數目前未被使用

**建議**：
- 如果未來需要使用（例如：生成分享連結、重定向 URL 等），可以安全地使用
- 如果不需要，可以從環境變數中移除

### 安全最佳實踐

1. **永遠不要將敏感資訊放在 `NEXT_PUBLIC_` 變數中**
   ```env
   # ❌ 錯誤
   NEXT_PUBLIC_API_KEY=secret_key_here
   
   # ✅ 正確
   API_KEY=secret_key_here
   ```

2. **在客戶端使用環境變數時要謹慎**
   ```typescript
   // ❌ 錯誤：在客戶端代碼中使用敏感變數
   const apiKey = process.env.API_KEY; // 這不會工作，但即使能工作也不安全
   
   // ✅ 正確：敏感操作在 API 路由中處理
   // 客戶端只調用 API，不直接使用敏感變數
   ```

3. **使用環境變數驗證**
   - 在應用啟動時檢查必要的環境變數
   - 使用 Zod 或其他工具驗證環境變數格式

4. **不要在版本控制中提交敏感資訊**
   - `.env.local` 已在 `.gitignore` 中
   - 只提交 `.env.example`（不包含實際值）

### 當前專案的安全狀態

✅ **已實施的安全措施**：
- 所有敏感變數都使用正確的前綴（無 `NEXT_PUBLIC_`）
- `.env.local` 在 `.gitignore` 中
- API 路由都有身份驗證檢查
- 資料庫操作都在伺服器端進行

⚠️ **可以改進的地方**：
- `NEXT_PUBLIC_APP_URL` 目前未使用，可以考慮移除或保留以備將來使用
- 可以添加環境變數驗證腳本

### 部署時的安全檢查清單

- [ ] 確認所有敏感變數都已設置（不在 `NEXT_PUBLIC_` 中）
- [ ] 確認 Vercel 環境變數已正確配置
- [ ] 確認 `NEXTAUTH_URL` 設置為生產環境 URL
- [ ] 確認 Google OAuth 重定向 URI 已更新為生產環境 URL
- [ ] 確認 LINE Webhook URL 已更新為生產環境 URL

