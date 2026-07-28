const express = require("express");
const fs = require("fs");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const ALLOWED_GROUP_ID = String(process.env.ALLOWED_GROUP_ID || "");
const OWNER_USER_ID = String(process.env.OWNER_USER_ID || "");
const PORT = process.env.PORT || 3000;

const BKASH = process.env.BKASH || "01571092111";
const NAGAD = process.env.NAGAD || "01571092111";
const ROCKET = process.env.ROCKET || "01571092111";
const BINANCE_PAY_ID = process.env.BINANCE_PAY_ID || "784264674";

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN পাওয়া যায়নি। Environment Variable যোগ করুন।");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const DATA_FILE = path.join(__dirname, "data.json");

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      return { lastDealId: 0, deals: {} };
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.error("data.json পড়তে সমস্যা:", error);
    return { lastDealId: 0, deals: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function escapeHtml(text = "") {
  return String(text)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatDealId(number) {
  return `#${String(number).padStart(4, "0")}`;
}

async function isGroupAdmin(ctx) {
  const userId = ctx.from?.id;
  if (!userId) return false;

  try {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, userId);
    return member.status === "creator" || member.status === "administrator";
  } catch (error) {
    console.error("Admin check error:", error);
    return false;
  }
}

function parseDealCommand(text) {
  const match = text.match(
    /^\/m(?:@\w+)?\s+(\d+(?:\.\d{1,2})?)\s+(@[A-Za-z0-9_]{5,})\s+(@[A-Za-z0-9_]{5,})\s+([\s\S]+?)\s*\|\s*([\s\S]+)$/i
  );

  if (!match) return null;

  return {
    amount: match[1],
    buyer: match[2],
    seller: match[3],
    sellerCondition: match[4].trim(),
    buyerCondition: match[5].trim()
  };
}

function buildPaymentMessage(deal) {
  return [
    "💳 <b>PAYMENT INSTRUCTIONS</b> 💳",
    "━━━━━━━━━━━━━━━━━━━━━━",
    `🆔 Deal ID: <code>${escapeHtml(deal.dealId)}</code>`,
    `💰 Amount: <b>${escapeHtml(deal.amount)} ৳</b>`,
    "",
    `👤 Seller: ${escapeHtml(deal.seller)}`,
    "📝 Condition:",
    escapeHtml(deal.sellerCondition),
    "",
    `👤 Buyer: ${escapeHtml(deal.buyer)}`,
    "📝 Condition:",
    escapeHtml(deal.buyerCondition),
    "━━━━━━━━━━━━━━━━━━━━━━",
    `📢 ${escapeHtml(deal.buyer)} send <b>${escapeHtml(deal.amount)} ৳</b> to the Admin's wallet:`,
    "",
    "╭─ 💳 <b>Payment Details</b>",
    "│",
    "├ 🟣 bKash",
    `├     <code>${escapeHtml(BKASH)}</code> ✅`,
    "├ 🟠 Nagad",
    `├     <code>${escapeHtml(NAGAD)}</code> ✅`,
    "├ 🚀 Rocket (Agent)",
    `├     <code>${escapeHtml(ROCKET)}</code> ✅`,
    "│",
    "├ 💰 Binance (Pay ID)",
    `├     <code>${escapeHtml(BINANCE_PAY_ID)}</code> ✅`,
    "│",
    "╰ ✅ SS / Last 4",
    "━━━━━━━━━━━━━━━━━━━━━━"
  ].join("\n");
}

bot.start(async (ctx) => {
  await ctx.reply(
    "✅ Infinity Deal Bot চালু আছে।\n\nএই বট শুধু অনুমোদিত গ্রুপে কাজ করবে।"
  );
});

bot.command("m", async (ctx) => {
  if (ctx.chat.type === "private") {
    return ctx.reply("এই কমান্ডটি শুধু অনুমোদিত গ্রুপে ব্যবহার করা যাবে।");
  }

  if (ALLOWED_GROUP_ID && String(ctx.chat.id) !== ALLOWED_GROUP_ID) {
    try { await ctx.deleteMessage(); } catch (_) {}
    return;
  }

  const admin = await isGroupAdmin(ctx);
  if (!admin) {
    try { await ctx.deleteMessage(); } catch (_) {}
    return;
  }

  const parsed = parseDealCommand(ctx.message.text || "");

  if (!parsed) {
    try { await ctx.deleteMessage(); } catch (_) {}
    return ctx.reply(
      "❌ সঠিক ফরম্যাট:\n\n<code>/m 200 @buyer @seller Seller Condition | Buyer Condition</code>",
      { parse_mode: "HTML" }
    ).then((msg) => {
      setTimeout(() => {
        ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
      }, 10000);
    });
  }

  const data = loadData();
  data.lastDealId += 1;

  const dealId = formatDealId(data.lastDealId);
  const deal = {
    dealId,
    amount: parsed.amount,
    buyer: parsed.buyer,
    seller: parsed.seller,
    sellerCondition: parsed.sellerCondition,
    buyerCondition: parsed.buyerCondition,
    status: "waiting_payment",
    createdBy: ctx.from.id,
    createdAt: new Date().toISOString(),
    groupId: ctx.chat.id
  };

  data.deals[dealId] = deal;
  saveData(data);

  try {
    await ctx.deleteMessage();
  } catch (error) {
    console.error("Command delete error:", error);
  }

  await ctx.telegram.sendMessage(
    ctx.chat.id,
    buildPaymentMessage(deal),
    {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔒 Payment Received", `paid:${dealId}`)]
      ])
    }
  );
});

bot.action(/^paid:(#\d{4,})$/, async (ctx) => {
  const dealId = ctx.match[1];

  if (ALLOWED_GROUP_ID && String(ctx.chat.id) !== ALLOWED_GROUP_ID) {
    return ctx.answerCbQuery("এই গ্রুপ অনুমোদিত নয়।", { show_alert: true });
  }

  const admin = await isGroupAdmin(ctx);
  if (!admin) {
    return ctx.answerCbQuery("শুধু গ্রুপ অ্যাডমিন ব্যবহার করতে পারবেন।", {
      show_alert: true
    });
  }

  const data = loadData();
  const deal = data.deals[dealId];

  if (!deal) {
    return ctx.answerCbQuery("Deal পাওয়া যায়নি।", { show_alert: true });
  }

  if (deal.status === "paid") {
    return ctx.answerCbQuery("Payment আগেই verified হয়েছে।", {
      show_alert: true
    });
  }

  deal.status = "paid";
  deal.paidBy = ctx.from.id;
  deal.paidAt = new Date().toISOString();
  saveData(data);

  const privateMessage = [
    "🔒 <b>Payment Successfully Received</b>",
    "",
    `🆔 Deal ID: <code>${escapeHtml(dealId)}</code>`,
    "",
    "✅ Payment verified successfully."
  ].join("\n");

  if (OWNER_USER_ID) {
    try {
      await ctx.telegram.sendMessage(OWNER_USER_ID, privateMessage, {
        parse_mode: "HTML"
      });
    } catch (error) {
      console.error("Owner DM error:", error.message);
      await ctx.answerCbQuery(
        "Payment verified, কিন্তু Owner-কে DM যায়নি। Owner আগে bot-এ Start চাপুন।",
        { show_alert: true }
      );
      return;
    }
  }

  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  } catch (_) {}

  await ctx.answerCbQuery("✅ Payment verified successfully.", {
    show_alert: true
  });
});

bot.on("my_chat_member", async (ctx) => {
  const chatId = String(ctx.chat.id);
  const newStatus = ctx.update.my_chat_member.new_chat_member.status;

  if (
    ALLOWED_GROUP_ID &&
    chatId !== ALLOWED_GROUP_ID &&
    ["member", "administrator"].includes(newStatus)
  ) {
    try {
      await ctx.telegram.leaveChat(ctx.chat.id);
    } catch (error) {
      console.error("Leave unauthorized chat error:", error);
    }
  }
});

bot.catch((error) => {
  console.error("Bot error:", error);
});

app.get("/", (_req, res) => {
  res.send("Infinity Deal Bot is running ✅");
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, bot: "@Infinitydeal1bot" });
});

app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);

  try {
    await bot.launch({
      dropPendingUpdates: true
    });
    console.log("Infinity Deal Bot started ✅");
  } catch (error) {
    console.error("Bot launch error:", error);
  }
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
