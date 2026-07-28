const express = require("express");
const fs = require("fs");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");
require("dotenv").config();

const BOT_TOKEN = String(process.env.BOT_TOKEN || "").trim();
const ALLOWED_GROUP_ID = String(process.env.ALLOWED_GROUP_ID || "").trim();

const BKASH = process.env.BKASH || "01571092111";
const NAGAD = process.env.NAGAD || "01571092111";
const ROCKET = process.env.ROCKET || "01571092111";
const BINANCE_PAY_ID = process.env.BINANCE_PAY_ID || "784264674";
const PORT = Number(process.env.PORT || 3000);

if (!BOT_TOKEN) {
  console.error("BOT_TOKEN পাওয়া যায়নি।");
  process.exit(1);
}

if (!ALLOWED_GROUP_ID) {
  console.error("ALLOWED_GROUP_ID পাওয়া যায়নি।");
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

    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

    return {
      lastDealId: Number(parsed.lastDealId || 0),
      deals: parsed.deals || {}
    };
  } catch (error) {
    console.error("data.json পড়তে সমস্যা:", error.message);
    return { lastDealId: 0, deals: {} };
  }
}

function saveData(data) {
  const tempFile = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tempFile, DATA_FILE);
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function formatDealId(number) {
  return `#${String(number).padStart(4, "0")}`;
}

function isAllowedGroup(chatId) {
  return String(chatId) === ALLOWED_GROUP_ID;
}

async function isAdmin(ctx) {
  try {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    return member.status === "creator" || member.status === "administrator";
  } catch (error) {
    console.error("Admin check failed:", error.message);
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

    // আপনার চাওয়া বর্তমান format:
    // প্রথম condition Seller-এর নিচে
    // | এর পরের condition Buyer-এর নিচে
    sellerCondition: match[5].trim(),
    buyerCondition: match[6].trim()
  };
}

function nextDeal(data) {
  data.lastDealId += 1;
  return formatDealId(data.lastDealId);
}

function basePaymentText(deal) {
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

function statusBlock(deal) {
  if (deal.status === "paid") {
    return [
      "",
      "🔒 <b>Payment Successfully Received</b>",
      "",
      `🆔 Deal ID: <code>${esc(deal.dealId)}</code>`,
      "",
      "✅ Payment verified successfully."
    ].join("\n");
  }

  if (deal.status === "released") {
    return [
      "",
      "✅ <b>Deal Completed Successfully</b>",
      "",
      `🆔 Deal ID: <code>${esc(deal.dealId)}</code>`,
      "",
      "✅ Payment released successfully."
    ].join("\n");
  }

  if (deal.status === "cancelled") {
    return [
      "",
      "❌ <b>Deal Cancelled</b>",
      "",
      `🆔 Deal ID: <code>${esc(deal.dealId)}</code>`,
      "",
      "The deal has been cancelled by an admin."
    ].join("\n");
  }

  return "";
}

function fullDealText(deal) {
  return basePaymentText(deal) + statusBlock(deal);
}

function buttonsFor(deal) {
  if (deal.status === "waiting_payment") {
    return Markup.inlineKeyboard([
      [Markup.button.callback("🔒 Payment Received", `paid:${deal.dealId}`)],
      [Markup.button.callback("❌ Cancel Deal", `cancel:${deal.dealId}`)]
    ]);
  }

  if (deal.status === "paid") {
    return Markup.inlineKeyboard([
      [Markup.button.callback("✅ Release Payment", `release:${deal.dealId}`)],
      [Markup.button.callback("❌ Cancel Deal", `cancel:${deal.dealId}`)]
    ]);
  }

  return Markup.inlineKeyboard([]);
}

async function answerEmpty(ctx) {
  try {
    await ctx.answerCbQuery();
  } catch {}
}

bot.start(async (ctx) => {
  await ctx.reply("✅ Infinity Deal Bot চালু আছে।");
});

bot.command("m", async (ctx) => {
  if (ctx.chat.type === "private") {
    return ctx.reply("এই কমান্ডটি শুধু অনুমোদিত গ্রুপে ব্যবহার করা যাবে।");
  }

  if (!isAllowedGroup(ctx.chat.id)) {
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
        "<code>/m 200 @buyer @seller First Condition | Second Condition</code>",
        "<code>/m 200d @buyer @seller First Condition | Second Condition</code>"
      ].join("\n"),
      { parse_mode: "HTML" }
    );

    setTimeout(() => {
      ctx.telegram.deleteMessage(ctx.chat.id, warning.message_id).catch(() => {});
    }, 10000);

    return;
  }

  const data = loadData();
  const dealId = nextDeal(data);

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
    createdAt: new Date().toISOString(),
    groupId: String(ctx.chat.id)
  };

  data.deals[dealId] = deal;
  saveData(data);

  const sent = await ctx.telegram.sendMessage(
    ctx.chat.id,
    fullDealText(deal),
    {
      parse_mode: "HTML",
      disable_web_page_preview: true,
      ...buttonsFor(deal)
    }
  );

  data.deals[dealId].groupMessageId = sent.message_id;
  saveData(data);
});

bot.action(/^(paid|release|cancel):(#\d{4,})$/, async (ctx) => {
  const action = ctx.match[1];
  const dealId = ctx.match[2];

  if (!isAllowedGroup(ctx.chat.id)) {
    return ctx.answerCbQuery("এই গ্রুপ অনুমোদিত নয়।", {
      show_alert: true
    });
  }

  if (!(await isAdmin(ctx))) {
    return ctx.answerCbQuery(
      "শুধু গ্রুপ Admin এই Button ব্যবহার করতে পারবেন।",
      { show_alert: true }
    );
  }

  const data = loadData();
  const deal = data.deals[dealId];

  if (!deal) {
    return ctx.answerCbQuery("Deal পাওয়া যায়নি।", {
      show_alert: true
    });
  }

  if (action === "paid") {
    if (deal.status !== "waiting_payment") {
      return ctx.answerCbQuery("এই Deal ইতোমধ্যে Update হয়েছে।", {
        show_alert: true
      });
    }

    deal.status = "paid";
    deal.paidBy = ctx.from.id;
    deal.paidAt = new Date().toISOString();
  }

  if (action === "release") {
    if (deal.status !== "paid") {
      return ctx.answerCbQuery("আগে Payment Received করতে হবে।", {
        show_alert: true
      });
    }

    deal.status = "released";
    deal.releasedBy = ctx.from.id;
    deal.releasedAt = new Date().toISOString();
  }

  if (action === "cancel") {
    if (deal.status === "released" || deal.status === "cancelled") {
      return ctx.answerCbQuery("এই Deal ইতোমধ্যে শেষ হয়েছে।", {
        show_alert: true
      });
    }

    deal.status = "cancelled";
    deal.cancelledBy = ctx.from.id;
    deal.cancelledAt = new Date().toISOString();
  }

  data.deals[dealId] = deal;
  saveData(data);

  await ctx.editMessageText(fullDealText(deal), {
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...buttonsFor(deal)
  });

  await answerEmpty(ctx);
});

bot.on("my_chat_member", async (ctx) => {
  const status = ctx.update.my_chat_member.new_chat_member.status;
  const active = ["member", "administrator"].includes(status);

  if (active && !isAllowedGroup(ctx.chat.id)) {
    try {
      await ctx.telegram.leaveChat(ctx.chat.id);
    } catch {}
  }
});

bot.catch((error) => {
  console.error("Bot error:", error);
});

app.get("/", (_req, res) => {
  res.send("Infinity Deal Bot V4 is running ✅");
});

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    version: "4.0.0",
    firebase: false,
    privateMessages: false
  });
});

app.listen(PORT, async () => {
  console.log(`Web server running on port ${PORT}`);

  try {
    await bot.launch({ dropPendingUpdates: true });
    console.log("Infinity Deal Bot V4 started ✅");
  } catch (error) {
    console.error("Bot launch failed:", error);
  }
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
