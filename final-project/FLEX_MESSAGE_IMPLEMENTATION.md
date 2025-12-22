# LINE Flex Message 記帳成功回覆功能實作說明

## 📋 功能概述

本次更新新增了「記帳成功後使用 Flex Message 回覆」的功能，取代原本的純文字回覆。當使用者成功新增一筆記帳資料後，系統會回覆一個簡潔的 Flex Message，只顯示「已成功紀錄!」訊息。

**設計理念**：簡化回覆內容，避免資訊過載，讓使用者專注於記帳本身。

## 🎯 主要變更

### 1. 新增簡化 Flex Message 回覆功能

**檔案**: `lib/services/line.service.ts`

- 新增 `buildRecordSuccessBubble()` 方法：構建簡化的 Flex Message bubble（只顯示「已成功紀錄!」）
- 新增 `replyFlexMessage()` 方法：發送 Flex Message 到 LINE
- 修改 `handleMessage()` 方法：記帳成功後改為發送簡化的 Flex Message 而非純文字

### 2. 移除不必要的訊息回覆

- **移除電子雞狀態回覆**：電子雞餵食功能仍會在背景執行，但不會顯示訊息給使用者
- **移除預算提醒回覆**：預算檢查仍會在背景執行並觸發通知服務，但不會在記帳成功時立即提醒

### 3. 新增 Postback 事件處理

**檔案**: 
- `lib/services/line.service.ts` - 新增 `handlePostback()` 方法
- `app/api/webhook/route.ts` - 新增 postback 事件處理邏輯

支援的 postback 動作：
- `expense_summary:week` - 查詢本週支出摘要
- `expense_summary:month` - 查詢本月支出摘要

### 4. 錯誤處理優化

- 修復 replyToken 重複使用問題（避免 LINE API 400 錯誤）
- 添加 postback data 解析的穩健性檢查

## 📐 Flex Message JSON 結構

以下是簡化的 Flex Message bubble JSON 結構，供參考和修改：

```json
{
  "type": "bubble",
  "size": "mega",
  "direction": "ltr",
  "body": {
    "type": "box",
    "layout": "vertical",
    "contents": [
      {
        "type": "text",
        "weight": "bold",
        "size": "xl",
        "text": "已成功紀錄!"
      }
    ]
  },
  "styles": {
    "header": {
      "separator": false
    }
  }
}
```

## 🔧 如何修改 Flex Message

### 修改成功訊息文字

在 `lib/services/line.service.ts` 的 `buildRecordSuccessBubble()` 方法中，找到：

```typescript
{
  type: 'text',
  weight: 'bold',
  size: 'xl',
  text: '已成功紀錄!',  // 修改這裡改變顯示文字
}
```

### 添加更多內容

如果您想在 Flex Message 中添加更多內容（例如金額、類別等），可以在 `body.contents` 陣列中添加：

```typescript
body: {
  type: 'box',
  layout: 'vertical',
  contents: [
    {
      type: 'text',
      weight: 'bold',
      size: 'xl',
      text: '已成功紀錄!',
    },
    {
      type: 'text',
      text: `${validated.amount} 元 - ${validated.category}`,  // 添加金額和類別
      size: 'sm',
      color: '#666666',
      margin: 'md',
    },
  ],
}
```

### 添加 Hero 圖片

如果需要添加圖片，可以在 bubble 物件中添加 `hero` 欄位：

```typescript
return {
  type: 'bubble',
  size: 'mega',
  direction: 'ltr',
  hero: {
    type: 'image',
    url: 'https://your-image-url.com/image.png',  // 必須是 HTTPS
    size: 'full',
    aspectRatio: '20:13',
    aspectMode: 'fit',
  },
  body: {
    // ...
  },
};
```

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

### 背景處理

電子雞餵食和預算檢查會在背景執行，不會阻塞記帳流程或顯示訊息：

```typescript
// 電子雞餵食（背景執行）
Promise.resolve().then(async () => {
  try {
    await this.petService.feedPet(unifiedUserId, validated.amount);
  } catch (error) {
    logger.error('Error feeding pet', error as Error);
  }
});

// 預算檢查（背景執行）
if (validated.type === 'expense') {
  Promise.resolve().then(async () => {
    try {
      await this.budgetNotificationService.checkAndNotifyBudget(unifiedUserId);
    } catch (err) {
      logger.error('Error in budget notification service', err as Error);
    }
  });
}
```

### Postback 處理流程

1. 使用者點擊按鈕
2. LINE 發送 postback 事件到 webhook
3. `app/api/webhook/route.ts` 接收事件並呼叫 `handlePostback()`
4. `handlePostback()` 解析 `data` 欄位（格式：`expense_summary:week` 或 `expense_summary:month`）
5. 根據 period 查詢對應時間範圍的摘要
6. 回覆文字訊息給使用者

### 錯誤處理

- **replyToken 重複使用**：使用 `pushMessage` 作為 fallback
- **Postback 解析**：驗證 data 格式，未知格式時回覆錯誤訊息
- **Flex Message 發送失敗**：自動降級為純文字回覆

## 🚀 未來擴展建議

1. **自訂 Hero 圖片**：根據記帳類型（收入/支出）顯示不同圖片
2. **顯示記帳詳情**：在 Flex Message 中顯示金額、類別等資訊
3. **添加快速操作按鈕**：例如「查看詳情」「刪除這筆」等
4. **根據使用者偏好自訂**：讓使用者選擇要顯示的資訊詳細程度

## 📚 相關文件

- [LINE Flex Message 官方文件](https://developers.line.biz/en/docs/messaging-api/flex-message-elements/)
- [LINE Flex Message Simulator](https://developers.line.biz/flex-simulator/)
- [Postback 事件說明](https://developers.line.biz/en/docs/messaging-api/using-postbacks/)


