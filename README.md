# Infinity Deal Bot V3.5

এই সংস্করণে `Payment Received` চাপলে:

- শুধু Group Admin ব্যবহার করতে পারবেন
- কোনো Personal DM যাবে না
- নতুন Group Message যাবে না
- কোনো success popup text দেখাবে না
- একই Payment Instructions Message edit হবে
- Button remove হবে
- Message-এর নিচে যোগ হবে:

```text
🔒 Payment Successfully Received

🆔 Deal ID: #0001

✅ Payment verified successfully.
```

Currency:

```text
/m 200 ...
```

দিলে `200 ৳`

```text
/m 200d ...
```

দিলে `200 $`

## আপলোডের পরে জরুরি

GitHub-এ এই V3.5-এর সব ফাইল replace করে Commit দিন।

তারপর Render-এ:

1. Manual Deploy
2. Deploy latest commit
3. Logs-এ `Infinity Deal Bot v3.5 started ✅` দেখা পর্যন্ত অপেক্ষা করুন

পুরোনো Deal-এর Button নয়—Deploy শেষ হওয়ার পরে নতুন `/m` Deal বানিয়ে পরীক্ষা করুন।
