# LINE Flex Message 記帳成功回覆功能實作說明

## 📋 功能概述

本次更新新增了「記帳成功後使用 Flex Message 回覆」的功能，取代原本的純文字回覆。當使用者成功新增一筆記帳資料後，系統會回覆一個美觀的 Flex Message，包含：

1. **Hero 圖片**：顯示記帳相關的插圖
2. **最近三筆記帳記錄**：動態顯示使用者最近三筆記帳（金額、類別、時間）
3. **快速查詢按鈕**：提供「本周支出」和「本月支出」兩個 postback 按鈕，可快速查看摘要

## 🎯 主要變更

### 1. 新增 Flex Message 回覆功能

**檔案**: `lib/services/line.service.ts`

- 新增 `buildRecordSuccessBubble()` 方法：構建記帳成功後的 Flex Message bubble
- 新增 `replyFlexMessage()` 方法：發送 Flex Message 到 LINE
- 修改 `handleMessage()` 方法：記帳成功後改為發送 Flex Message 而非純文字

### 2. 新增 Postback 事件處理

**檔案**: 
- `lib/services/line.service.ts` - 新增 `handlePostback()` 方法
- `app/api/webhook/route.ts` - 新增 postback 事件處理邏輯

支援的 postback 動作：
- `expense_summary:week` - 查詢本週支出摘要
- `expense_summary:month` - 查詢本月支出摘要

### 3. 錯誤處理優化

- 修復 replyToken 重複使用問題（避免 LINE API 400 錯誤）
- 添加日期格式化類型安全檢查
- 添加數值類型轉換保護
- 添加 postback data 解析的穩健性檢查

## 📐 Flex Message JSON 結構

以下是完整的 Flex Message bubble JSON 結構，供參考和修改：

```json
{
  "type": "bubble",
  "size": "mega",
  "direction": "ltr",
  "hero": {
    "type": "image",
    "url": "https://png.pngtree.com/png-clipart/20230802/original/pngtree-the-rich-man-cartoon-bank-person-vector-picture-image_9328574.png",
    "size": "full",
    "aspectRatio": "20:13",
    "aspectMode": "fit",
    "offsetTop": "none"
  },
  "body": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "weight": "bold",
        "size": "xl",
        "text": "已成功紀錄!"
      },
      {
        "type": "text",
        "text": "最近三筆紀錄",
        "size": "sm",
        "color": "#999999",
        "margin": "md"
      },
      {
        "type": "text",
        "text": "💰 150 元 | 午餐 | 12/25 14:30",
        "wrap": true,
        "size": "sm",
        "color": "#666666"
      },
      {
        "type": "text",
        "text": "💸 300 元 | 交通 | 12/25 10:15",
        "wrap": true,
        "size": "sm",
        "color": "#666666"
      },
      {
        "type": "text",
        "text": "💰 5000 元 | 薪資 | 12/24 09:00",
        "wrap": true,
        "size": "sm",
        "color": "#666666"
      }
    ]
  },
  "footer": {
    "type": "box",
    "layout": "vertical",
    "spacing": "sm",
    "contents": [
      {
        "type": "button",
        "style": "link",
        "height": "sm",
        "action": {
          "type": "postback",
          "label": "本周支出",
          "data": "expense_summary:week"
        }
      },
      {
        "type": "button",
        "style": "link",
        "height": "sm",
        "action": {
          "type": "postback",
          "label": "本月支出",
          "data": "expense_summary:month"
        }
      }
    ],
    "flex": 0
  },
  "styles": {
    "header": {
      "separator": false
    }
  }
}
```

## 🔧 如何修改 Flex Message

### 修改 Hero 圖片

在 `lib/services/line.service.ts` 的 `buildRecordSuccessBubble()` 方法中，找到：

```typescript
hero: {
  type: 'image',
  url: 'https://png.pngtree.com/png-clipart/20230802/original/pngtree-the-rich-man-cartoon-bank-person-vector-picture-image_9328574.png',
  // ...
}
```

將 `url` 替換為您想要的圖片 URL（必須是 HTTPS，且圖片需可公開訪問）。

### 修改記錄顯示格式

在 `buildRecordSuccessBubble()` 方法中，記錄文字的格式為：

```typescript
const recordText = `${typeEmoji} ${t.amount} 元 | ${t.category} | ${formatDateTime(t.createdAt)}`;
```

您可以修改這個格式，例如：
- 改變分隔符：`${typeEmoji} ${t.amount} 元 - ${t.category} - ${formatDateTime(t.createdAt)}`
- 添加描述：`${typeEmoji} ${t.amount} 元 | ${t.category}${t.description ? ` | ${t.description}` : ''} | ${formatDateTime(t.createdAt)}`

### 修改按鈕文字或動作

在 `footer.contents` 中修改按鈕：

```typescript
{
  type: 'button',
  style: 'link',
  height: 'sm',
  action: {
    type: 'postback',
    label: '本周支出',  // 修改這裡改變按鈕文字
    data: 'expense_summary:week',  // 修改這裡改變 postback data
  },
}
```

### 添加更多按鈕

在 `footer.contents` 陣列中添加新的按鈕物件：

```typescript
{
  type: 'button',
  style: 'link',
  height: 'sm',
  action: {
    type: 'postback',
    label: '本月收入',
    data: 'income_summary:month',
  },
}
```

然後在 `handlePostback()` 方法中添加對應的處理邏輯。

## 🐛 常見問題與除錯

### 1. Flex Message 沒有顯示

**可能原因**：
- JSON 格式錯誤
- 圖片 URL 無法訪問
- 文字內容過長（超過 LINE 限制）

**檢查方式**：
- 使用 [LINE Flex Message Simulator](https://developers.line.biz/flex-simulator/) 測試 JSON
- 檢查 Vercel 日誌中的錯誤訊息
- 確認圖片 URL 是 HTTPS 且可公開訪問

### 2. Postback 按鈕沒有反應

**可能原因**：
- postback data 格式錯誤
- `handlePostback()` 方法未正確處理該 data

**檢查方式**：
- 確認 `app/api/webhook/route.ts` 中有處理 postback 事件
- 檢查 `handlePostback()` 方法中的 data 解析邏輯
- 查看 Vercel 日誌中的錯誤訊息

### 3. 日期顯示異常

**可能原因**：
- MongoDB 返回的 `createdAt` 格式異常
- 日期格式化函數處理錯誤

**解決方式**：
- 檢查 `formatDateTime()` 函數的類型處理
- 確認資料庫中的日期欄位格式正確

### 4. 記錄數量不足三筆

**處理方式**：
- 系統會自動處理記錄數不足的情況
- 如果沒有記錄，會顯示「尚無其他記錄」
- 如果只有 1-2 筆，只會顯示現有的記錄

## 📝 技術細節

### 資料查詢

最近三筆記錄的查詢邏輯：

```typescript
const recentRecords = await this.transactionService.getTransactions({
  userId: unifiedUserId,
  limit: 3,
  offset: 0,
});
```

查詢會按照 `createdAt DESC` 排序（在 repository 層實現），確保顯示最新的三筆記錄。

### Postback 處理流程

1. 使用者點擊按鈕
2. LINE 發送 postback 事件到 webhook
3. `app/api/webhook/route.ts` 接收事件並呼叫 `handlePostback()`
4. `handlePostback()` 解析 `data` 欄位（格式：`expense_summary:week` 或 `expense_summary:month`）
5. 根據 period 查詢對應時間範圍的摘要
6. 回覆文字訊息給使用者

### 錯誤處理

- **replyToken 重複使用**：使用 `pushMessage` 作為 fallback
- **日期格式化**：檢查日期有效性，無效時顯示「日期無效」
- **數值轉換**：使用 `Number()` 確保類型安全
- **Postback 解析**：驗證 data 格式，未知格式時回覆錯誤訊息

## 🚀 未來擴展建議

1. **添加更多查詢按鈕**：例如「本日支出」「本年度摘要」等
2. **自訂 Hero 圖片**：根據記帳類型（收入/支出）顯示不同圖片
3. **添加圖表**：在 Flex Message 中顯示簡單的支出趨勢圖
4. **快速操作**：添加「刪除最後一筆」等快速操作按鈕

## 📚 相關文件

- [LINE Flex Message 官方文件](https://developers.line.biz/en/docs/messaging-api/flex-message-elements/)
- [LINE Flex Message Simulator](https://developers.line.biz/flex-simulator/)
- [Postback 事件說明](https://developers.line.biz/en/docs/messaging-api/using-postbacks/)

