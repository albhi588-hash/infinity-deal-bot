# Infinity Deal Bot v2

## নতুন সুবিধা

- `/myid` দিলে নিজের Telegram User ID পাওয়া যাবে
- গ্রুপে `/groupid` দিলে Group ID পাওয়া যাবে
- `/m` কমান্ড শুধু Admin ব্যবহার করতে পারবেন
- Admin-এর command সঙ্গে সঙ্গে delete হবে
- Deal ID `#0001`, `#0002` করে বাড়বে
- Deal ID ও wallet number tap করে copy করা যাবে
- `🔒 Payment Received` button
- Button চাপলে Owner-এর private chat-এ নির্ধারিত message যাবে
- `ALLOWED_GROUP_ID` বসালে অন্য গ্রুপ থেকে Bot নিজে বের হয়ে যাবে

## Command

```text
/m 200 @buyer @seller Seller Condition | Buyer Condition
```

## Render Environment Variables

প্রথমে:

```text
BOT_TOKEN = নতুন Bot Token
```

Deploy হওয়ার পরে Bot-এর private chat-এ:

```text
/myid
```

গ্রুপে:

```text
/groupid
```

দুটি ID পাওয়ার পরে Render-এ যোগ করুন:

```text
OWNER_USER_ID = আপনার User ID
ALLOWED_GROUP_ID = আপনার Group ID
BKASH = 01571092111
NAGAD = 01571092111
ROCKET = 01571092111
BINANCE_PAY_ID = 784264674
```

তারপর Manual Deploy বা Restart দিন।

## Telegram Group Permission

Bot-কে Admin করে অন্তত:

- Delete Messages
- Send Messages

অনুমতি দিন।

## গুরুত্বপূর্ণ

Private notification পেতে Owner-কে আগে Bot-এর private chat-এ `/start` পাঠাতে হবে।

Render Free service restart/redeploy হলে local `data.json` reset হতে পারে। স্থায়ী Deal History ও স্থায়ী Deal ID-এর জন্য পরের সংস্করণে Firebase ব্যবহার করা হবে।
