# Infinity Deal Bot V4.5

নতুন Auto Number System:

1. Seller/Buyer bKash, Nagad, Rocket বা Binance Button চাপবে
2. Bot লিখবে:
   `Please enter your bKash/Nagad/Rocket/Binance number.`
3. User শুধু নম্বর বা Binance Pay ID লিখবে
4. কোনো `/details` command লাগবে না
5. Bot:
   - User-এর number message delete করবে
   - শুধু number/Pay ID গ্রহণ করবে
   - Deal message edit করবে
   - `✅ Complete Payment` Button দেখাবে
6. Complete Payment শুধু Admin চাপতে পারবে
7. Admin চাপলে Deal Completed বা Refund Completed দেখাবে

Validation:
- bKash/Nagad/Rocket: 11 digit, `01XXXXXXXXX`
- Binance: 4–30 letter/number

Render:
- `BOT_TOKEN`
- `ALLOWED_GROUP_ID`

Deploy শেষে Logs:
`Infinity Deal Bot V4.5 started ✅`
