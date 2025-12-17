# LINE Bot Webhook 故障排除指南

如果您在 LINE Bot 中輸入指令（如 `/myid`）時收到預設的自動回覆訊息，而不是 Bot 的正常回應，請按照以下步驟排查：

## 問題症狀

- 輸入 `/myid` 或其他指令時，收到 LINE 的預設自動回覆：
  > "感謝您的訊息！很抱歉，本帳號無法個別回覆用戶的訊息。"
- Bot 沒有正常回應指令
- 記帳功能無法使用

## 排查步驟

### 1. 檢查 LINE Developers Console 設置

#### 1.1 確認 Webhook URL 正確設置

1. 前往 [LINE Developers Console](https://developers.line.biz/console/)
2. 選擇您的 Provider 和 Messaging Channel
3. 進入「Messaging API」標籤頁
4. 找到「Webhook settings」區塊
5. 確認 Webhook URL 設置為：
   ```
   https://final-lac-alpha.vercel.app/api/webhook
   ```
6. 確認「Use webhook」已啟用（開關應該是開啟狀態）

#### 1.2 驗證 Webhook

1. 在「Webhook settings」區塊中，點擊「Verify」按鈕
2. 如果驗證成功，會顯示「Success」
3. 如果驗證失敗，檢查：
   - Webhook URL 是否正確
   - Vercel 部署是否成功
   - 環境變數是否正確設置

#### 1.3 關閉自動回覆

**重要**：必須關閉 LINE Bot 的自動回覆功能，否則 Webhook 不會被調用。

1. 在「Messaging API」標籤頁中，找到「Response settings」區塊
2. 找到「Auto-reply messages」設定
3. **關閉**自動回覆功能（確保開關是關閉狀態）
4. 如果啟用了「Greeting messages」，也可以關閉（可選）

#### 1.4 檢查 Webhook 事件

1. 在「Messaging API」標籤頁中，找到「Webhook settings」區塊
2. 點擊「Edit」按鈕
3. 確認以下事件已啟用：
   - ✅ Message
   - ✅ Follow（可選）
   - ✅ Unfollow（可選）

### 2. 檢查 Vercel 部署

#### 2.1 確認部署成功

1. 前往 [Vercel Dashboard](https://vercel.com/dashboard)
2. 選擇您的專案
3. 檢查最新的部署狀態
4. 確認部署成功（沒有錯誤）

#### 2.2 檢查環境變數

在 Vercel Dashboard → Project Settings → Environment Variables 中確認：

- `LINE_CHANNEL_ACCESS_TOKEN` - 已設置且正確
- `LINE_CHANNEL_SECRET` - 已設置且正確
- `MONGODB_URI` - 已設置且正確
- 其他必要的環境變數

#### 2.3 測試 Webhook 端點

在終端中執行：

```bash
curl https://final-lac-alpha.vercel.app/api/webhook
```

應該返回：
```json
{"message":"LINE Bot Webhook is running"}
```

### 3. 檢查 Vercel 運行時日誌

1. 在 Vercel Dashboard 中，選擇您的專案
2. 進入「Deployments」標籤
3. 選擇最新的部署
4. 進入「Functions」標籤
5. 查看 `/api/webhook` 的運行時日誌
6. 檢查是否有錯誤訊息

### 4. 測試 Webhook

#### 4.1 使用 LINE Developers Console 測試

1. 在 LINE Developers Console 中，找到「Messaging API」標籤頁
2. 在「Webhook settings」區塊中，點擊「Verify」按鈕
3. 如果驗證成功，表示 Webhook 可以正常接收請求

#### 4.2 在 LINE Bot 中測試

1. 打開 LINE Bot
2. 輸入測試訊息：`/help`
3. 應該收到 Bot 的回應，而不是預設的自動回覆

### 5. 常見問題

#### Q: Webhook 驗證失敗

**原因**：
- Webhook URL 不正確
- Vercel 部署失敗
- 環境變數 `LINE_CHANNEL_SECRET` 設置錯誤

**解決方法**：
1. 確認 Webhook URL 正確
2. 檢查 Vercel 部署狀態
3. 確認環境變數正確設置
4. 重新部署

#### Q: 收到預設自動回覆

**原因**：
- LINE Bot 的「Auto-reply messages」功能已啟用
- Webhook 沒有被調用

**解決方法**：
1. 在 LINE Developers Console 中關閉「Auto-reply messages」
2. 確認「Use webhook」已啟用
3. 重新測試

#### Q: Bot 沒有回應

**原因**：
- Webhook 處理有錯誤
- 環境變數缺失
- 資料庫連接失敗

**解決方法**：
1. 檢查 Vercel 運行時日誌
2. 確認所有環境變數已設置
3. 檢查資料庫連接

## 快速檢查清單

- [ ] Webhook URL 設置為：`https://final-lac-alpha.vercel.app/api/webhook`
- [ ] 「Use webhook」已啟用
- [ ] 「Auto-reply messages」已關閉
- [ ] Webhook 驗證成功
- [ ] Vercel 部署成功
- [ ] 環境變數已正確設置
- [ ] 測試 `/help` 指令有正常回應

## 重新設置步驟

如果以上步驟都無法解決問題，請按照以下步驟重新設置：

1. **在 LINE Developers Console 中**：
   - 關閉「Auto-reply messages」
   - 關閉「Greeting messages」（可選）
   - 啟用「Use webhook」
   - 設置 Webhook URL
   - 點擊「Verify」驗證

2. **在 Vercel 中**：
   - 確認所有環境變數已設置
   - 重新部署專案

3. **測試**：
   - 在 LINE Bot 中輸入 `/help`
   - 應該收到 Bot 的正常回應

## 聯繫支援

如果問題仍然存在，請：
1. 檢查 Vercel 運行時日誌
2. 檢查 LINE Developers Console 的 Webhook 日誌
3. 提供錯誤訊息和日誌截圖

