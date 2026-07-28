# Infinity Deal Bot V5.0

## নতুন আপডেট

- Premium Progress Bar
- Dhaka timezone অনুযায়ী সুন্দর Timestamp
- উন্নত Status Icon
- প্রতিটি Deal-এর History Timeline
- Buyer/Seller ছাড়া নির্দিষ্ট Button কাজ করবে না
- একই Telegram User ID-এর Username বদলালে Active Deal-এ সতর্কবার্তা
- Admin Log
- Private Admin Notes
- Multiple Admin Support
- Super Admin / Moderator Permission

## নতুন কমান্ড

- `/note #0001 আপনার নোট` — ডিলে ব্যক্তিগত Admin Note যোগ করবে
- `/notes #0001` — Note ব্যক্তিগতভাবে Admin-এর inbox-এ পাঠাবে
- `/adminlog` — শেষ ১৫টি Admin কাজ দেখাবে; শুধু Super Admin
- `/admins` — Permission তথ্য দেখাবে; শুধু Super Admin

## Permission

- Super Admin: Group Creator অথবা `SUPER_ADMIN_IDS`
- Moderator: Group Administrator অথবা `MODERATOR_IDS`

একাধিক ID কমা দিয়ে লিখুন:

`SUPER_ADMIN_IDS=123456789,987654321`

`MODERATOR_IDS=111111111,222222222`

## Render Environment Variables

- `BOT_TOKEN`
- `ALLOWED_GROUP_ID`
- `BKASH`
- `NAGAD`
- `ROCKET`
- `BINANCE_PAY_ID`
- `SUPER_ADMIN_IDS` (ঐচ্ছিক)
- `MODERATOR_IDS` (ঐচ্ছিক)

Deploy শেষে Logs:

`Infinity Deal Bot V5.0 started ✅`

## V5.1 — ৩০ মিনিট Auto Cancel

- Deal তৈরি হওয়ার পর `Payment Received` বাটন ৩০ মিনিটের মধ্যে চাপতে হবে।
- ৩০ মিনিট পার হলে Deal স্বয়ংক্রিয়ভাবে `Cancelled` হবে।
- বাটন সরিয়ে দেওয়া হবে এবং Timeline ও Admin Log-এ `AUTO_CANCEL_TIMEOUT` যোগ হবে।
- Bot restart হলেও saved deadline অনুযায়ী expired Deal cancel হবে।
- সময় পরিবর্তন করতে ঐচ্ছিক Environment Variable: `PAYMENT_TIMEOUT_MINUTES=30`

## User Deal Report (V5.2)
Admin command:

```text
/about @username
```

Shows the user's total deals, Buyer/Seller counts, Completed/Active/Cancelled/Refunded counts, and all related Deal IDs.
