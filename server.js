const express = require("express");
const fs = require("fs");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");
require("dotenv").config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const ALLOWED_GROUP_ID = String(process.env.ALLOWED_GROUP_ID || "").trim();
const OWNER_USER_ID = String(process.env.OWNER_USER_ID || "").trim();

const BKASH = process.env.BKASH || "01571092111";
const NAGAD = process.env.NAGAD || "01571092111";
const ROCKET = process.env.ROCKET || "01571092111";
const BINANCE_PAY_ID = process.env.BINANCE_PAY_ID || "784264674";
const PORT = Number(process.env.PORT || 3000);

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN পাওয়া যায়নি।");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const DATA_FILE = path.join(__dirname, "data.json");

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return { lastDealId: 0, deals: {} };
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      lastDealId: Number(parsed.lastDealId || 0),
      deals: parsed.deals || {}
    };
  } catch (error) {
    console.error("Data read error:", error);
    return { lastDealId: 0, deals: {} };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function dealIdOf(number) {
  return `#${String(number).padStart(4, "0")}`;
}

function groupAllowed(chatId) {
  if (!ALLOWED_GROUP_ID) return true;
  return String(chatId) === ALLOWED_GROUP_ID;
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
  try { await ctx.deleteMessage(); } catch {}
}

function parseCommand(text = "") {
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

function paymentText(deal) {
  return [
    "💳 <b>PAYMENT INSTRUCTIONS</b> 💳",
    "━━━━━━━━━━━━━━━━━━━━━━",
    `🆔 Deal ID: <code>${esc(deal.dealId)}</code>`,
    `💰 Amount: <b>${esc(deal.amount)} ৳</b>`,
    "",
    `👤 Seller: ${esc(deal.seller)}`,
    "📝 Condition:",
    esc(deal.sellerCondition),
    "",
    `👤 Buyer: ${esc(deal.buyer)}`,
    "📝 Condition:",
    esc(deal.buyerCondition),
    "━━━━━━━━━━━━━━━━━━━━━━",
    `📢 ${esc(deal.buyer)} send <b>${esc(deal.amount)} ৳</b> to the Admin's wallet:`,
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

function ownerPaidText(dealId) {
  return [
    "🔒 <b>Payment Successfully Received</b>",
    "",
    `🆔 Deal ID: <code>${esc(dealId)}</code>`,
    "",
    "✅ Payment verified successfully."
  ].join("\n");
}

bot.start(async (ctx) => {
  await ctx.reply(
    [
      "✅ Infinity Deal Bot চালু আছে।",
      "",
      "নিজের Telegram User ID দেখতে: /myid",
      "গ্রুপের Group ID দেখতে: গ্রুপে /groupid"
    ].join("\n")
  );
});

bot.command("myid", async (ctx) => {
  await ctx.reply(`আপনার User ID:\n<code>${ctx.from.id}</code>`, {
    parse_mode: "HTML"
  });
});

bot.command("groupid", async (ctx) => {
  if (ctx.chat.type === "private") {
    return ctx.reply("এই কমান্ডটি আপনার গ্রুপে পাঠান।");
  }

  const admin = await isAdmin(ctx);
  if (!admin) return deleteSilently(ctx);

  await deleteSilently(ctx);
  const msg = await ctx.telegram.sendMessage(
    ctx.chat.id,
    `এই গ্রুপের ID:\n<code>${ctx.chat.id}</code>`,
    { parse_mode: "HTML" }
  );

  setTimeout(() => {
    ctx.telegram.deleteMessage(ctx.chat.id, msg.message_id).catch(() => {});
  }, 30000);
});

bot.command("m", async (ctx) => {
  if (ctx.chat.type === "private") {
    return ctx.reply("এই কমান্ডটি শুধু গ্রুপে ব্যবহার করা যাবে।");
  }

  if (!groupAllowed(ctx.chat.id)) {
    await deleteSilently(ctx);
    return;
  }

  if (!(await isAdmin(ctx))) {
    await deleteSilently(ctx);
    return;
  }

  const parsed = parseCommand(ctx.message.text || "");
  await deleteSilently(ctx);

  if (!parsed) {
    const warning = await ctx.telegram.sendMessage(
      ctx.chat.id,
      [
        "❌ সঠিক ফরম্যাট:",
        "",
        "<code>/m 200 @buyer @seller Seller Condition | Buyer Condition</code>"
      ].join("\n"),
      { parse_mode: "HTML" }
    );

    setTimeout(() => {
      ctx.telegram.deleteMessage(ctx.chat.id, warning.message_id).catch(() => {});
    }, 10000);
    return;
  }

  const data = loadData();
  data.lastDealId += 1;

  const deal = {
    dealId: dealIdOf(data.lastDealId),
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

  data.deals[deal.dealId] = deal;
  saveData(data);

  await ctx.telegram.sendMessage(ctx.chat.id, paymentText(deal), {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...Markup.inlineKeyboard([
      [Markup.button.callback("🔒 Payment Received", `paid:${deal.dealId}`)]
    ])
  });
});

bot.action(/^paid:(#\d{4,})$/, async (ctx) => {
  const dealId = ctx.match[1];

  if (!groupAllowed(ctx.chat.id)) {
    return ctx.answerCbQuery("এই গ্রুপ অনুমোদিত নয়।", { show_alert: true });
  }

  if (!(await isAdmin(ctx))) {
    return ctx.answerCbQuery("শুধু Admin ব্যবহার করতে পারবেন।", {
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

  if (OWNER_USER_ID) {
    try {
      await ctx.telegram.sendMessage(OWNER_USER_ID, ownerPaidText(dealId), {
        parse_mode: "HTML"
      });
    } catch (error) {
      console.error("Owner DM failed:", error.message);
      return ctx.answerCbQuery(
        "Verified হয়েছে, কিন্তু Private message যায়নি। আগে Bot-এ Start চাপুন।",
        { show_alert: true }
      );
    }
  }

  try {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] });
  } catch {}

  await ctx.answerCbQuery("✅ Payment verified successfully.", {
    show_alert: true
  });
});

bot.on("my_chat_member", async (ctx) => {
  if (!ALLOWED_GROUP_ID) return;

  const status = ctx.update.my_chat_member.new_chat_member.status;
  const active = ["member", "administrator"].includes(status);

  if (active && String(ctx.chat.id) !== ALLOWED_GROUP_ID) {
    try { await ctx.telegram.leaveChat(ctx.chat.id); } catch {}
  }
});

bot.catch((error) => console.error("Bot error:", error));

app.get("/", (_req, res) => {
  res.send("Infinity Deal Bot v2 is running ✅");
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, version: "2.0.0" });
});

app.listen(PORT, async () => {
  console.log(`Web server running on port ${PORT}`);
  try {
    await bot.launch({ dropPendingUpdates: true });
    console.log("Infinity Deal Bot v2 started ✅");
  } catch (error) {
    console.error("Launch error:", error);
  }
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
