const express = require("express");
const { Telegraf, Markup } = require("telegraf");
const admin = require("firebase-admin");
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const ALLOWED_GROUP_ID = String(process.env.ALLOWED_GROUP_ID || "").trim();

const BKASH = process.env.BKASH || "01571092111";
const NAGAD = process.env.NAGAD || "01571092111";
const ROCKET = process.env.ROCKET || "01571092111";
const BINANCE_PAY_ID = process.env.BINANCE_PAY_ID || "784264674";
const FIREBASE_SERVICE_ACCOUNT = process.env.FIREBASE_SERVICE_ACCOUNT;
const PORT = Number(process.env.PORT || 3000);

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN পাওয়া যায়নি।");
  process.exit(1);
}

if (!FIREBASE_SERVICE_ACCOUNT) {
  console.error("FIREBASE_SERVICE_ACCOUNT পাওয়া যায়নি।");
  process.exit(1);
}

let serviceAccount;
try {
  serviceAccount = JSON.parse(FIREBASE_SERVICE_ACCOUNT);
} catch {
  console.error("FIREBASE_SERVICE_ACCOUNT সঠিক JSON নয়।");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const bot = new Telegraf(BOT_TOKEN);
const app = express();

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatDealId(number) {
  return `#${String(number).padStart(4, "0")}`;
}

function allowedGroup(chatId) {
  return ALLOWED_GROUP_ID && String(chatId) === ALLOWED_GROUP_ID;
}

async function isAdmin(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return member.status === "creator" || member.status === "administrator";
  } catch {
    return false;
  }
}

async function deleteSilently(ctx) {
  try {
    await ctx.deleteMessage();
  } catch {}
}

function parseCreateCommand(text = "") {
  const match = text.match(
    /^\/m(?:@\w+)?\s+(\d+(?:\.\d{1,2})?)(d)?\s+(@[A-Za-z0-9_]{5,})\s+(@[A-Za-z0-9_]{5,})\s+([\s\S]+?)\s*\|\s*([\s\S]+)$/i
  );

  if (!match) return null;

  const isDollar = Boolean(match[2]);

  return {
    amount: match[1],
    currencySymbol: isDollar ? "$" : "৳",
    buyer: match[3],
    seller: match[4],
    sellerCondition: match[5].trim(),
    buyerCondition: match[6].trim()
  };
}

async function nextDealId() {
  const counterRef = db.collection("system").doc("counter");

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(counterRef);
    const lastDealId = snap.exists ? Number(snap.data().lastDealId || 0) : 0;
    const next = lastDealId + 1;

    transaction.set(counterRef, { lastDealId: next }, { merge: true });
    return formatDealId(next);
  });
}

function paymentText(deal) {
  return [
    "💳 <b>PAYMENT INSTRUCTIONS</b> 💳",
    "━━━━━━━━━━━━━━━━━━━━━━",
    `🆔 Deal ID: <code>${esc(deal.dealId)}</code>`,
    `💰 Amount: <b>${esc(deal.amount)} ${esc(deal.currencySymbol)}</b>`,
    "",
    `👤 Seller: ${esc(deal.seller)}`,
    "📝 Condition:",
    esc(deal.sellerCondition),
    "",
    `👤 Buyer: ${esc(deal.buyer)}`,
    "📝 Condition:",
    esc(deal.buyerCondition),
    "━━━━━━━━━━━━━━━━━━━━━━",
    `📢 ${esc(deal.buyer)} send <b>${esc(deal.amount)} ${esc(deal.currencySymbol)}</b> to the Admin's wallet:`,
    "",
    "╭─ 💳 <b>Payment Details</b>",
    "│",
    "├ 🟣 bKash",
    `├     <code>${esc(BKASH)}</code> ✅`,
    "├ 🟠 Nagad",
    `├     <code>${esc(NAGAD)}</code> ✅`,
    "├ 🚀 Rocket (Agent)",
    `├     <code>${esc(ROCKET)}</code> ✅`,
    "│",
    "├ 💰 Binance (Pay ID)",
    `├     <code>${esc(BINANCE_PAY_ID)}</code> ✅`,
    "│",
    "╰ ✅ SS / Last 4",
    "━━━━━━━━━━━━━━━━━━━━━━"
  ].join("\n");
}

function paidEditedText(deal) {
  return [
    paymentText(deal),
    "",
    "🔒 <b>Payment Successfully Received</b>",
    "",
    `🆔 Deal ID: <code>${esc(deal.dealId)}</code>`,
    "",
    "✅ Payment verified successfully."
  ].join("\n");
}

bot.start(async (ctx) => {
  await ctx.reply("✅ Infinity Deal Bot চালু আছে।");
});

bot.command("m", async (ctx) => {
  if (ctx.chat.type === "private") {
    return ctx.reply("এই কমান্ডটি শুধু অনুমোদিত গ্রুপে ব্যবহার করা যাবে।");
  }

  if (!allowedGroup(ctx.chat.id)) {
    await deleteSilently(ctx);
    return;
  }

  if (!(await isAdmin(ctx))) {
    await deleteSilently(ctx);
    return;
  }

  const parsed = parseCreateCommand(ctx.message.text || "");
  await deleteSilently(ctx);

  if (!parsed) {
    const warning = await ctx.telegram.sendMessage(
      ctx.chat.id,
      [
        "❌ সঠিক ফরম্যাট:",
        "",
        "<code>/m 200 @buyer @seller Seller Condition | Buyer Condition</code>",
        "<code>/m 200d @buyer @seller Seller Condition | Buyer Condition</code>"
      ].join("\n"),
      { parse_mode: "HTML" }
    );

    setTimeout(() => {
      ctx.telegram.deleteMessage(ctx.chat.id, warning.message_id).catch(() => {});
    }, 10000);

    return;
  }

  const dealId = await nextDealId();

  const deal = {
    dealId,
    amount: parsed.amount,
    currencySymbol: parsed.currencySymbol,
    buyer: parsed.buyer,
    seller: parsed.seller,
    sellerCondition: parsed.sellerCondition,
    buyerCondition: parsed.buyerCondition,
    status: "waiting_payment",
    createdBy: ctx.from.id,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    groupId: String(ctx.chat.id)
  };

  await db.collection("deals").doc(dealId.replace("#", "")).set(deal);

  const sent = await ctx.telegram.sendMessage(ctx.chat.id, paymentText(deal), {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...Markup.inlineKeyboard([
      [Markup.button.callback("🔒 Payment Received", `paid:${dealId}`)]
    ])
  });

  await db.collection("deals").doc(dealId.replace("#", "")).set({
    groupMessageId: sent.message_id
  }, { merge: true });
});

bot.action(/^paid:(#\d{4,})$/, async (ctx) => {
  const dealId = ctx.match[1];

  if (!allowedGroup(ctx.chat.id)) {
    return ctx.answerCbQuery("এই গ্রুপ অনুমোদিত নয়।", { show_alert: true });
  }

  if (!(await isAdmin(ctx))) {
    return ctx.answerCbQuery("শুধু গ্রুপ Admin এই Button ব্যবহার করতে পারবেন।", {
      show_alert: true
    });
  }

  const ref = db.collection("deals").doc(dealId.replace("#", ""));
  const snap = await ref.get();

  if (!snap.exists) {
    return ctx.answerCbQuery("Deal পাওয়া যায়নি।", { show_alert: true });
  }

  const deal = snap.data();

  if (deal.status === "paid") {
    return ctx.answerCbQuery("Payment আগেই verified হয়েছে।", {
      show_alert: true
    });
  }

  await ref.set({
    status: "paid",
    paidBy: ctx.from.id,
    paidAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  await ctx.editMessageText(paidEditedText(deal), {
    parse_mode: "HTML",
    disable_web_page_preview: true
  });

  // Telegram-এর loading animation বন্ধ করতে empty callback answer।
  // কোনো popup text দেখাবে না।
  try {
    await ctx.answerCbQuery();
  } catch {}
});

bot.on("my_chat_member", async (ctx) => {
  if (!ALLOWED_GROUP_ID) return;

  const status = ctx.update.my_chat_member.new_chat_member.status;
  const active = ["member", "administrator"].includes(status);

  if (active && String(ctx.chat.id) !== ALLOWED_GROUP_ID) {
    try {
      await ctx.telegram.leaveChat(ctx.chat.id);
    } catch {}
  }
});

bot.catch((error) => {
  console.error("Bot error:", error);
});

app.get("/", (_req, res) => {
  res.send("Infinity Deal Bot v3.5 is running ✅");
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, version: "3.5.0" });
});

app.listen(PORT, async () => {
  console.log(`Web server running on port ${PORT}`);

  try {
    await bot.launch({ dropPendingUpdates: true });
    console.log("Infinity Deal Bot v3.5 started ✅");
  } catch (error) {
    console.error("Launch error:", error);
  }
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
