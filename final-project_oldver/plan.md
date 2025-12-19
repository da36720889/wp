# Final Project – Midterm Plan

## Deploy Link

**Web Application:** https://final-lac-alpha.vercel.app

**LINE Bot:** @757cbqbh

![LINE Bot QR Code](pic/lineQRcode.png)

## 1. 本次 Prototype 已完成

### 基本架構與功能
- ✅ Next.js App Router 架構
- ✅ TypeScript 類型安全
- ✅ MongoDB 資料庫串接（Mongoose ODM）
- ✅ NextAuth.js Google OAuth 登入系統
- ✅ Vercel 部署配置

### 前端頁面
- ✅ 首頁（Landing Page）
- ✅ 登入頁面（Google OAuth）
- ✅ Dashboard 主頁面
  - 記帳摘要卡片（總收入、總支出、餘額）
  - 消費趨勢圖表（日/週/月/年視圖）
  - 記帳記錄列表
  - LINE Bot 連結卡片
  - 新增記帳表單

### 後端 API
- ✅ `/api/auth/[...nextauth]` - 認證路由
- ✅ `/api/transactions` - 記帳記錄 CRUD
- ✅ `/api/transactions/[id]` - 單筆記錄更新/刪除
- ✅ `/api/summary` - 記帳摘要
- ✅ `/api/trends` - 消費趨勢數據
- ✅ `/api/link-line` - LINE 帳號連結
- ✅ `/api/webhook` - LINE Bot Webhook

### LINE Bot 功能
- ✅ 自然語言記帳解析（使用 Google Gemini API）
- ✅ 正則表達式備用解析機制
- ✅ 指令系統：
  - `/list [數量]` - 查詢記帳記錄（收入/支出分開顯示）
  - `/summary` - 查看記帳摘要
  - `/delete [編號]` - 刪除記錄（支援 i1, o1 格式）
  - `/myid` - 獲取 LINE 用戶 ID
  - `/help` - 使用說明
- ✅ 自動回覆記帳確認訊息

### 核心功能
- ✅ 記帳記錄建立（收入/支出）
- ✅ 記帳記錄查詢與篩選
- ✅ 記帳記錄編輯與刪除
- ✅ 消費趨勢視覺化（折線圖）
- ✅ LINE Bot 與 Google 帳號連結
- ✅ 記帳記錄同步（LINE Bot ↔ Web）

### 資料模型
- ✅ User 模型（支援 LINE 與 Google 雙重登入）
- ✅ Transaction 模型（金額、類別、描述、類型、日期）

## 2. 最終版本預計完成項目

### 功能增強
- 🔄 記帳類別管理（自訂類別）
- 🔄 記帳記錄匯出功能（CSV/Excel）
- 🔄 多幣別支援
- 🔄 記帳提醒功能
- 🔄 預算設定與追蹤

### 介面優化
- 🔄 響應式設計優化（行動裝置適配）
- 🔄 深色模式支援
- 🔄 圖表互動功能（hover 顯示詳細資訊）
- 🔄 記帳記錄篩選與搜尋功能

### 效能與穩定性
- 🔄 錯誤處理機制完善
- 🔄 載入狀態優化
- 🔄 快取策略優化
- 🔄 API 速率限制

### 安全性
- 🔄 資料驗證強化
- 🔄 API 權限檢查
- 🔄 敏感資料加密

## 3. 預期開發進度

### Week 1: 功能增強與優化
- 完成記帳類別管理功能
- 實作記帳記錄匯出功能（CSV）
- 優化消費趨勢圖表互動性
- 完善錯誤處理與使用者回饋

### Week 2: 介面優化與新功能
- 完成響應式設計優化
- 實作記帳記錄進階篩選功能
- 新增預算設定功能
- 優化 LINE Bot 指令與回應

### Week 3: 最終整合與測試
- 全面功能測試
- 效能優化與載入速度改善
- 文件撰寫與部署準備
- 使用者體驗最終調整

## 4. 技術棧

### 前端
- Next.js 14 (App Router)
- React 18
- TypeScript
- Tailwind CSS

### 後端
- Next.js API Routes
- NextAuth.js
- MongoDB (Mongoose)
- LINE Messaging API SDK

### 第三方服務
- Google OAuth 2.0
- Google Gemini API
- LINE Messaging API
- Vercel (部署平台)

### 開發工具
- ESLint
- TypeScript
- Git/GitHub

## 5. 已知問題與待解決項目

### 已解決
- ✅ LINE Bot Webhook 連線問題
- ✅ Google OAuth 在 Vercel 上的配置
- ✅ Gemini API 模型可用性問題（已實作備用解析機制）
- ✅ 記帳記錄更新功能
- ✅ 趨勢圖表寬度與顯示問題

### 待優化
- 🔄 圖表載入效能
- 🔄 LINE Bot 回應速度
- 🔄 大量記帳記錄的查詢效能

