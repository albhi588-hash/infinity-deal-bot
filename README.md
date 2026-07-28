# Infinity Deal Bot V4.2

Payment Received চাপলে:

- গ্রুপের একই Message ছোট করে Edit হবে
- সব Button Hide হবে
- Buyer ও Seller-এর Private Chat-এ একই Message পাঠাবে

Group ও DM Message:

```text
✅ Payment verified successfully.

🆔 Deal ID: #0002
💰 Amount: 200 ৳

👤 Seller: @ALBHi0
📝 Condition:
buyer Condition

👤 Buyer: @ALBHi9
📝 Condition:
seller condition
```

## Telegram-এর বাধ্যতামূলক নিয়ম

Bot শুধু username দেখে কাউকে Private Message পাঠাতে পারে না।

Buyer ও Seller-কে জীবনে একবার Bot-এর Profile খুলে `Start` চাপতে হবে।
তারপর Bot তাদের username ও Telegram User ID সংরক্ষণ করবে।

Start না করলে Group Message ঠিকভাবে Edit হবে, কিন্তু সেই ব্যক্তির DM যাবে না।
Admin-কে একটি Alert দিয়ে জানানো হবে কার DM যায়নি।

## Render

শুধু দরকার:

```text
BOT_TOKEN
ALLOWED_GROUP_ID
```

GitHub-এ ফাইল Replace করে Commit দিন।
তারপর Render → Manual Deploy → Deploy latest commit।

Logs-এ দেখুন:

```text
Infinity Deal Bot V4.2 started ✅
```
