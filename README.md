# Infinity Deal Bot v1

এই ZIP সরাসরি GitHub-এ আপলোড করার জন্য তৈরি।

## বর্তমান ফিচার

- `/m` কমান্ড শুধু গ্রুপ Admin ব্যবহার করতে পারবেন
- Command পাঠানোর পর `/m ...` মেসেজ Auto Delete
- Auto Deal ID: `#0001`, `#0002`...
- Deal ID ও Wallet Number tap করে copy করা যায়
- Payment Instructions সুন্দরভাবে দেখায়
- `🔒 Payment Received` Button
- Button চাপলে Owner-এর Private Chat-এ এই মেসেজ যায়:

```text
🔒 Payment Successfully Received

🆔 Deal ID: #0001

✅ Payment verified successfully.
```

- অন্য গ্রুপে যোগ করলে Bot নিজে Leave করবে
- Bot শুধু `ALLOWED_GROUP_ID` গ্রুপে কাজ করবে

## Command Format

```text
/m 200 @buyer @seller Seller Condition | Buyer Condition
```

উদাহরণ:

```text
/m 200 @nhkhan12 @m_r_sahin কন্ডিশন আইডি buyer রিসিভ করলে seller-কে payment দিবেন | same condition
```

## জরুরি নিরাপত্তা

আগের Bot Token প্রকাশ হয়েছিল। BotFather থেকে পুরনো Token Revoke করে নতুন Token ব্যবহার করুন।
নতুন Token কখনো GitHub file বা Telegram message-এ লিখবেন না।

## Environment Variables

Hosting-এ নিচের Variables বসাতে হবে:

- `BOT_TOKEN` = BotFather-এর নতুন Token
- `ALLOWED_GROUP_ID` = আপনার Telegram Group ID
- `OWNER_USER_ID` = আপনার নিজের Telegram Numeric User ID
- `BKASH` = bKash নম্বর
- `NAGAD` = Nagad নম্বর
- `ROCKET` = Rocket নম্বর
- `BINANCE_PAY_ID` = Binance Pay ID

## Telegram Permission

Bot-কে আপনার গ্রুপে Admin করে অন্তত এই Permission দিন:

- Delete Messages
- Send Messages

## গুরুত্বপূর্ণ

Owner-এর Private Chat-এ notification পাওয়ার জন্য Owner-কে আগে Bot-এর Profile খুলে `Start` চাপতে হবে।

## চালানোর Command

```bash
npm install
npm start
```
