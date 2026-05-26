# 後日回聲 AI 部署

這個版本已經加入 `/api/chat`，可在 Vercel 上安全呼叫 OpenAI API。

## 部署到 Vercel

1. 打開 Vercel 匯入頁：
   https://vercel.com/new/clone?repository-url=https://github.com/pphc-harry/afterdays-echo&env=OPENAI_API_KEY&env=OPENAI_MODEL

2. Environment Variables:
   - `OPENAI_API_KEY`: 你的 OpenAI API key
   - `OPENAI_MODEL`: `gpt-5.4-mini`

3. Deploy 完成後，使用 Vercel 給你的 HTTPS app URL。

## 行為

- 前端會先呼叫 `./api/chat`。
- 如果 API key 未設定、Vercel 未部署、或 API 暫時失敗，app 會自動 fallback 到本地模擬回覆。
- API prompt 會限制 AI 只根據該 capsule 的原留言、心情、語氣線索和最近對話回覆。

## 之後可以加

- Supabase/Firebase 儲存 capsule
- 到期 push notification
- PIN / Face ID 風格隱私鎖
