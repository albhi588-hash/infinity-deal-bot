# Infinity Deal Bot V4

## Render-এ শুধু দরকার

```text
BOT_TOKEN
ALLOWED_GROUP_ID
```

`OWNER_USER_ID` ও `FIREBASE_SERVICE_ACCOUNT` লাগবে না।

## Currency Command

```text
/m 200 @buyer @seller First Condition | Second Condition
```

দিলে:

```text
Amount: 200 ৳
```

```text
/m 200d @buyer @seller First Condition | Second Condition
```

দিলে:

```text
Amount: 200 $
```

## Button নিয়ম

- শুধু Group Admin ব্যবহার করতে পারবেন
- কোনো Private DM যাবে না
- নতুন Group Message যাবে না
- একই Payment Instructions Message edit হবে
- Payment Received-এর পরে Release ও Cancel Button দেখা যাবে
- শেষ Status হওয়ার পরে Button চলে যাবে

## GitHub ও Render

1. ZIP Extract করুন
2. GitHub-এর পুরোনো সব project file replace করুন
3. Commit changes দিন
4. Render → Manual Deploy
5. Deploy latest commit
6. Logs-এ দেখুন:

```text
Infinity Deal Bot V4 started ✅
```

7. Deploy শেষ হওয়ার পরে নতুন `/m` Deal বানিয়ে পরীক্ষা করুন

## গুরুত্বপূর্ণ সীমাবদ্ধতা

এই Version Firebase ব্যবহার করে না। Render Free service restart/redeploy হলে
local `data.json` reset হতে পারে। ফলে Deal ID আবার `#0001` থেকে শুরু হতে পারে।
বর্তমান Bot flow পরীক্ষা ও চালানোর জন্য এটি সহজ Version।
