# Infinity Deal Bot V4.4

Release/Refund Flow:

1. Admin: `/release #0001`
2. Buyer ও Seller একবার করে Accept/Decline
3. দুজন Accept করলে Seller Method দেবে
4. সিদ্ধান্ত আলাদা হলে Admin:
   - Approve Deal → Seller Method
   - Refund Buyer → Buyer Method
5. Method নির্বাচন হবে Group-এ
6. Number দিতে:
   - `/details #0001 016784640484`
7. Bot Group-এ Withdrawal/Refund Details দেখাবে
8. `✅ Complete Payment` শুধু Admin চাপতে পারবে
9. Admin চাপলে একই Message Edit হয়ে:
   - Release হলে `Deal Completed`
   - Refund হলে `Refund Completed`

সব তথ্য Group-এ সবার সামনে থাকবে।

Render Environment:
- `BOT_TOKEN`
- `ALLOWED_GROUP_ID`

Deploy শেষে Logs-এ দেখুন:
`Infinity Deal Bot V4.4 started ✅`
