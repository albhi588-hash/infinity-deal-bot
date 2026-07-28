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
const PAYMENT_TIMEOUT_MINUTES = Math.max(1, Number(process.env.PAYMENT_TIMEOUT_MINUTES || 30));
const SUPER_ADMIN_IDS = new Set(String(process.env.SUPER_ADMIN_IDS || "")
  .split(",").map(v => v.trim()).filter(Boolean));
const MODERATOR_IDS = new Set(String(process.env.MODERATOR_IDS || "")
  .split(",").map(v => v.trim()).filter(Boolean));

if (!BOT_TOKEN || !ALLOWED_GROUP_ID) {
  console.error("BOT_TOKEN অথবা ALLOWED_GROUP_ID পাওয়া যায়নি।");
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);
const app = express();
const DATA_FILE = path.join(__dirname, "data.json");

function defaultData() {
  return { lastDealId: 0, deals: {}, users: {}, usersById: {}, adminLogs: [] };
}

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return defaultData();
    const parsed = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    return {
      lastDealId: Number(parsed.lastDealId || 0),
      deals: parsed.deals || {},
      users: parsed.users || {},
      usersById: parsed.usersById || {},
      adminLogs: Array.isArray(parsed.adminLogs) ? parsed.adminLogs : []
    };
  } catch (error) {
    console.error("data.json read error:", error.message);
    return defaultData();
  }
}

function saveData(data) {
  const temp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(temp, DATA_FILE);
}

function esc(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function usernameKey(username = "") {
  return String(username).replace(/^@/, "").trim().toLowerCase();
}

function normalizeDigits(text = "") {
  return String(text).replace(/[^\d]/g, "");
}

function formatDealId(number) {
  return `#${String(number).padStart(4, "0")}`;
}

function isAllowedGroup(chatId) {
  return String(chatId) === ALLOWED_GROUP_ID;
}

async function adminRole(ctx) {
  const userId = String(ctx.from?.id || "");
  if (SUPER_ADMIN_IDS.has(userId)) return "super_admin";
  if (MODERATOR_IDS.has(userId)) return "moderator";
  try {
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    if (member.status === "creator") return "super_admin";
    if (member.status === "administrator") return "moderator";
  } catch {}
  return null;
}

async function isAdmin(ctx) {
  return Boolean(await adminRole(ctx));
}

async function isSuperAdmin(ctx) {
  return (await adminRole(ctx)) === "super_admin";
}

function dhakaTime(iso = new Date().toISOString()) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "Asia/Dhaka",
    year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: true
  });
}

function addTimeline(deal, type, text, actor = null) {
  if (!Array.isArray(deal.timeline)) deal.timeline = [];
  deal.timeline.push({ type, text, actor, at: new Date().toISOString() });
}

function addAdminLog(data, ctx, action, dealId = null, details = "") {
  if (!Array.isArray(data.adminLogs)) data.adminLogs = [];
  data.adminLogs.push({
    action, dealId, details,
    adminId: ctx.from?.id,
    adminUsername: ctx.from?.username || null,
    at: new Date().toISOString()
  });
  if (data.adminLogs.length > 2000) data.adminLogs = data.adminLogs.slice(-2000);
}

function timelineText(deal) {
  const items = Array.isArray(deal.timeline) ? deal.timeline.slice(-6) : [];
  if (!items.length) return "";
  return ["", "🕘 <b>Deal History</b>", ...items.map(i => `• ${esc(i.text)} — ${esc(dhakaTime(i.at))}`)].join("\n");
}

function progressText(deal) {
  const map = {
    waiting_payment: "▰▱▱▱ 25%",
    paid: "▰▰▱▱ 50%",
    release_pending: "▰▰▰▱ 75%",
    completed: "▰▰▰▰ 100%",
    refunded: "▰▰▰▰ 100%",
    cancelled: "▰▰▰▰ Closed"
  };
  return map[deal.status] || "▰▱▱▱ 25%";
}

async function deleteMessageSilently(ctx) {
  try { await ctx.deleteMessage(); } catch {}
}

async function registerUser(ctx) {
  if (!ctx.from?.id || !ctx.from?.username) return;
  const data = loadData();
  const userId = String(ctx.from.id);
  const previous = data.usersById?.[userId];
  const current = ctx.from.username;

  if (!data.usersById) data.usersById = {};
  data.users[usernameKey(current)] = {
    userId: ctx.from.id,
    username: current,
    updatedAt: new Date().toISOString()
  };
  data.usersById[userId] = { username: current, updatedAt: new Date().toISOString() };

  if (previous?.username && usernameKey(previous.username) !== usernameKey(current)) {
    const affected = Object.values(data.deals).filter(d =>
      !["completed", "refunded", "cancelled"].includes(d.status) &&
      [usernameKey(d.buyer), usernameKey(d.seller)].includes(usernameKey(previous.username))
    );
    for (const deal of affected) {
      addTimeline(deal, "username_changed", `Username changed: @${previous.username} → @${current}`, userId);
    }
    saveData(data);
    if (ctx.chat?.type !== "private" && affected.length) {
      await ctx.reply(
        `⚠️ Username পরিবর্তনের সতর্কতা\n@${previous.username} এখন @${current} ব্যবহার করছেন।\nActive Deal: ${affected.map(d => d.dealId).join(", ")}`
      ).catch(() => {});
    }
    return;
  }
  saveData(data);
}

function parseCreateCommand(text = "") {
  const match = text.match(
    /^\/m(?:@\w+)?\s+(\d+(?:\.\d{1,2})?)(d)?\s+(@[A-Za-z0-9_]{5,})\s+(@[A-Za-z0-9_]{5,})\s+([\s\S]+?)\s*\|\s*([\s\S]+)$/i
  );
  if (!match) return null;

  return {
    amount: match[1],
    currencySymbol: match[2] ? "$" : "৳",
    buyer: match[3],
    seller: match[4],
    sellerCondition: match[5].trim(),
    buyerCondition: match[6].trim()
  };
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
    "╭─ 💳 <b>PAYMENT DESTINATION</b>",
    "│",
    "├ 🟣 bKash",
    `│   • <code>${esc(BKASH)}</code> ✅`,
    "│",
    "├ 🟠 Nagad",
    `│   • <code>${esc(NAGAD)}</code> ✅`,
    "│",
    "├ 🚀 Rocket (Agent)",
    `│   • <code>${esc(ROCKET)}</code> ✅`,
    "│",
    "├ 💰 Binance Pay ID",
    `│   • <code>${esc(BINANCE_PAY_ID)}</code> ✅`,
    "│",
    "╰ 📎 Payment Confirmation:",
    "   Send Screenshot or Last 4 Digits",
    "━━━━━━━━━━━━━━━━━━━━━━",
    `📈 Progress: <b>${progressText(deal)}</b>`,
    `🕒 Created: ${esc(dhakaTime(deal.createdAt))}`,
    `⏳ Payment confirmation deadline: ${esc(dhakaTime(deal.paymentExpiresAt))}`,
    timelineText(deal)
  ].filter(Boolean).join("\n");
}

function cancelledText(deal) {
  return [
    "❌ <b>Deal Cancelled</b>",
    "━━━━━━━━━━━━━━━━━━━━━━",
    `🆔 Deal ID: <code>${esc(deal.dealId)}</code>`,
    `💰 Amount: <b>${esc(deal.amount)} ${esc(deal.currencySymbol)}</b>`,
    `👤 Seller: ${esc(deal.seller)}`,
    `👤 Buyer: ${esc(deal.buyer)}`,
    "",
    "📊 Status: <b>🔴 Cancelled</b>",
    `📈 Progress: <b>${progressText(deal)}</b>`,
    `🕒 Updated: ${esc(dhakaTime(deal.cancelledAt))}`,
    "━━━━━━━━━━━━━━━━━━━━━━",
    timelineText(deal)
  ].filter(Boolean).join("\n");
}

function verifiedText(deal) {
  return [
    "✅ <b>Payment verified successfully.</b>",
    "",
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
    "",
    `📊 Status: <b>🟡 Payment Verified</b>`,
    `📈 Progress: <b>${progressText(deal)}</b>`,
    `🕒 Verified: ${esc(dhakaTime(deal.paidAt))}`,
    timelineText(deal)
  ].filter(Boolean).join("\n");
}

function decisionLabel(value) {
  if (value === "accepted") return "✅ Accepted";
  if (value === "declined") return "❌ Declined";
  return "⏳ Pending";
}

function releaseDecisionText(deal) {
  const r = deal.release;
  const bothDone =
    r.buyerDecision !== "pending" &&
    r.sellerDecision !== "pending";

  let status = "🟡 Waiting for Decisions";
  if (bothDone && r.buyerDecision !== r.sellerDecision) {
    status = "⏳ Awaiting Admin Decision";
  } else if (r.buyerDecision === "accepted" && r.sellerDecision === "accepted") {
    status = "🟢 Both Parties Accepted";
  } else if (r.buyerDecision === "declined" && r.sellerDecision === "declined") {
    status = "🔴 Both Parties Declined";
  }

  return [
    "🤝 <b>DEAL DETAILS</b> 🤝",
    "━━━━━━━━━━━━━━━━━━━━━━",
    `🆔 Deal ID: <code>${esc(deal.dealId)}</code>`,
    `💰 Amount: <b>${esc(deal.amount)} ${esc(deal.currencySymbol)}</b>`,
    `👤 Seller: ${esc(deal.seller)} (${decisionLabel(r.sellerDecision)})`,
    `👤 Buyer: ${esc(deal.buyer)} (${decisionLabel(r.buyerDecision)})`,
    "",
    "📝 <b>Seller's Condition:</b>",
    esc(deal.sellerCondition),
    "",
    "📝 <b>Buyer's Condition:</b>",
    esc(deal.buyerCondition),
    "",
    `📊 Status: <b>${status}</b>`,
    `📅 Release Request Time: ${esc(r.requestedAtText)}`,
    `📈 Progress: <b>${progressText(deal)}</b>`,
    "━━━━━━━━━━━━━━━━━━━━━━",
    timelineText(deal)
  ].filter(Boolean).join("\n");
}

function decisionButtons(dealId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ Accept Deal", `party_accept:${dealId}`),
      Markup.button.callback("❌ Decline Deal", `party_decline:${dealId}`)
    ]
  ]);
}

function adminDecisionButtons(dealId) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("✅ Approve Deal", `admin_release:${dealId}`),
      Markup.button.callback("❌ Refund Buyer", `admin_refund:${dealId}`)
    ]
  ]);
}

function methodButtons(dealId, flow) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("📱 bKash", `method:${flow}:bkash:${dealId}`),
      Markup.button.callback("📱 Nagad", `method:${flow}:nagad:${dealId}`)
    ],
    [
      Markup.button.callback("🚀 Rocket", `method:${flow}:rocket:${dealId}`),
      Markup.button.callback("🔶 Binance", `method:${flow}:binance:${dealId}`)
    ]
  ]);
}

function methodPromptText(deal, flow, methodLabel) {
  const target = flow === "release" ? deal.seller : deal.buyer;
  const title = flow === "release"
    ? "💳 <b>Withdrawal Details Required</b>"
    : "💳 <b>Refund Details Required</b>";

  return [
    title,
    "━━━━━━━━━━━━━━━━━━━━━━",
    `🆔 Deal ID: <code>${esc(deal.dealId)}</code>`,
    `💰 Amount: <b>${esc(deal.amount)} ${esc(deal.currencySymbol)}</b>`,
    "",
    `${esc(target)}, please enter your ${esc(methodLabel)} number.`
  ].join("\n");
}

function detailsText(deal) {
  const p = deal.payout;
  const title = p.flow === "release"
    ? "💳 <b>DEAL WITHDRAWAL DETAILS</b>"
    : "💳 <b>DEAL REFUND DETAILS</b>";

  return [
    title,
    "━━━━━━━━━━━━━━━━━━━━━━",
    `🆔 Deal ID: <code>${esc(deal.dealId)}</code>`,
    `👤 Seller: ${esc(deal.seller)}`,
    `👤 Buyer: ${esc(deal.buyer)}`,
    "",
    `💰 Amount: <b>${esc(deal.amount)} ${esc(deal.currencySymbol)}</b>`,
    "📊 Status: <b>🟢 Active</b>",
    `💳 Method: <b>${esc(p.methodLabel)}</b>`,
    `💸 Send Payment To:\n👤 ${esc(deal.payout.flow === "release" ? deal.seller + " (Seller)" : deal.buyer + " (Buyer)")}\n\n📱 Number: <code>${esc(p.number)}</code>`,
    "━━━━━━━━━━━━━━━━━━━━━━",
    "Payment সম্পন্ন হলে নিচের Button চাপুন।"
  ].join("\n");
}

function completedText(deal) {
  const releaseFlow = deal.payout.flow === "release";

  return [
    releaseFlow
      ? "✅ <b>Deal Completed!</b> ✅"
      : "✅ <b>Refund Completed!</b> ✅",
    "━━━━━━━━━━━━━━━━━━━━━━",
    `🆔 Deal ID: <code>${esc(deal.dealId)}</code>`,
    `💰 Amount: <b>${esc(deal.amount)} ${esc(deal.currencySymbol)}</b>`,
    `👤 Seller: ${esc(deal.seller)} (${decisionLabel(deal.release.sellerDecision)})`,
    `👤 Buyer: ${esc(deal.buyer)} (${decisionLabel(deal.release.buyerDecision)})`,
    "",
    "📝 <b>Seller's Condition:</b>",
    esc(deal.sellerCondition),
    "",
    "📝 <b>Buyer's Condition:</b>",
    esc(deal.buyerCondition),
    "",
    `📊 Status: <b>${releaseFlow ? "✅ Completed" : "↩️ Refunded"}</b>`,
    `📈 Progress: <b>${progressText(deal)}</b>`,
    `🕒 Completed: ${esc(dhakaTime(deal.completedAt))}`,
    "━━━━━━━━━━━━━━━━━━━━━━",
    timelineText(deal)
  ].filter(Boolean).join("\n");
}

function findWaitingDealForUser(data, username, chatId) {
  const key = usernameKey(username);
  return Object.values(data.deals).find((deal) => {
    if (!deal.payout || deal.payout.stage !== "waiting_number") return false;
    if (String(deal.groupId) !== String(chatId)) return false;

    const target = deal.payout.flow === "release" ? deal.seller : deal.buyer;
    return usernameKey(target) === key;
  });
}

bot.use(async (ctx, next) => {
  await registerUser(ctx);
  return next();
});

bot.start(async (ctx) => {
  await ctx.reply("✅ Infinity Deal Bot চালু আছে।");
});

bot.command("m", async (ctx) => {
  if (ctx.chat.type === "private") {
    return ctx.reply("এই কমান্ডটি শুধু অনুমোদিত গ্রুপে ব্যবহার করা যাবে।");
  }
  if (!isAllowedGroup(ctx.chat.id) || !(await isAdmin(ctx))) {
    await deleteMessageSilently(ctx);
    return;
  }

  const parsed = parseCreateCommand(ctx.message.text || "");
  await deleteMessageSilently(ctx);

  if (!parsed) return;

  const data = loadData();
  data.lastDealId += 1;
  const dealId = formatDealId(data.lastDealId);

  data.deals[dealId] = {
    dealId,
    ...parsed,
    status: "waiting_payment",
    createdBy: ctx.from.id,
    createdAt: new Date().toISOString(),
    paymentExpiresAt: new Date(Date.now() + PAYMENT_TIMEOUT_MINUTES * 60 * 1000).toISOString(),
    groupId: String(ctx.chat.id),
    adminNotes: [],
    timeline: []
  };
  addTimeline(data.deals[dealId], "created", "Deal created", ctx.from.id);
  addAdminLog(data, ctx, "CREATE_DEAL", dealId, `${parsed.amount} ${parsed.currencySymbol}`);
  saveData(data);

  const sent = await ctx.telegram.sendMessage(
    ctx.chat.id,
    paymentText(data.deals[dealId]),
    {
      parse_mode: "HTML",
      ...Markup.inlineKeyboard([
        [Markup.button.callback("🔒 Payment Received", `paid:${dealId}`)]
      ])
    }
  );

  data.deals[dealId].groupMessageId = sent.message_id;
  saveData(data);
});

bot.action(/^paid:(#\d{4,})$/, async (ctx) => {
  if (!(await isAdmin(ctx))) {
    return ctx.answerCbQuery("শুধু Admin ব্যবহার করতে পারবেন।", { show_alert: true });
  }

  const data = loadData();
  const deal = data.deals[ctx.match[1]];
  if (!deal) return;

  if (deal.status === "cancelled") {
    return ctx.answerCbQuery("এই Deal ইতোমধ্যে Cancel হয়ে গেছে।", { show_alert: true });
  }

  const expiresAt = new Date(deal.paymentExpiresAt || 0).getTime();
  if (deal.status !== "waiting_payment" || (expiresAt && Date.now() >= expiresAt)) {
    return ctx.answerCbQuery("Payment confirmation সময় শেষ হয়ে গেছে।", { show_alert: true });
  }

  deal.status = "paid";
  deal.paidAt = new Date().toISOString();
  addTimeline(deal, "payment_verified", "Payment verified", ctx.from.id);
  addAdminLog(data, ctx, "PAYMENT_VERIFIED", deal.dealId);
  saveData(data);

  await ctx.editMessageText(verifiedText(deal), {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [] }
  });
  try { await ctx.answerCbQuery(); } catch {}
});

bot.command("cancel", async (ctx) => {
  if (ctx.chat.type === "private") return;
  if (!isAllowedGroup(ctx.chat.id) || !(await isAdmin(ctx))) {
    await deleteMessageSilently(ctx);
    return;
  }

  const match = (ctx.message.text || "").match(/^\/cancel(?:@\w+)?\s+#?(\d+)$/i);
  await deleteMessageSilently(ctx);
  if (!match) return;

  const dealId = `#${String(match[1]).padStart(4, "0")}`;
  const data = loadData();
  const deal = data.deals[dealId];
  if (!deal || ["completed", "refunded", "cancelled"].includes(deal.status)) return;

  deal.status = "cancelled";
  deal.cancelledAt = new Date().toISOString();
  deal.cancelledBy = ctx.from.id;
  addTimeline(deal, "cancelled", "Deal cancelled", ctx.from.id);
  addAdminLog(data, ctx, "CANCEL_DEAL", deal.dealId);
  saveData(data);

  const messageIds = [...new Set([
    deal.groupMessageId,
    deal.release?.messageId
  ].filter(Boolean))];

  let edited = false;
  for (const messageId of messageIds) {
    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        messageId,
        undefined,
        cancelledText(deal),
        {
          parse_mode: "HTML",
          reply_markup: { inline_keyboard: [] }
        }
      );
      edited = true;
    } catch {}
  }

  if (!edited) {
    await ctx.telegram.sendMessage(ctx.chat.id, cancelledText(deal), {
      parse_mode: "HTML"
    });
  }
});

bot.command("release", async (ctx) => {
  if (ctx.chat.type === "private") return;
  if (!isAllowedGroup(ctx.chat.id) || !(await isAdmin(ctx))) {
    await deleteMessageSilently(ctx);
    return;
  }

  const m = (ctx.message.text || "").match(/^\/release(?:@\w+)?\s+#?(\d+)$/i);
  await deleteMessageSilently(ctx);
  if (!m) return;

  const dealId = `#${String(m[1]).padStart(4, "0")}`;
  const data = loadData();
  const deal = data.deals[dealId];
  if (!deal || deal.status !== "paid") return;

  deal.status = "release_pending";
  deal.release = {
    buyerDecision: "pending",
    sellerDecision: "pending",
    requestedAtText: new Date().toLocaleString("en-US", { timeZone: "Asia/Dhaka" })
  };

  addTimeline(deal, "release_requested", "Release decision requested", ctx.from.id);
  addAdminLog(data, ctx, "REQUEST_RELEASE", deal.dealId);

  const sent = await ctx.telegram.sendMessage(
    ctx.chat.id,
    releaseDecisionText(deal),
    {
      parse_mode: "HTML",
      ...decisionButtons(dealId)
    }
  );

  deal.release.messageId = sent.message_id;
  saveData(data);
});

bot.action(/^party_(accept|decline):(#\d{4,})$/, async (ctx) => {
  if (await isAdmin(ctx)) {
    return ctx.answerCbQuery("Admin সিদ্ধান্ত দিতে পারবেন না।", { show_alert: true });
  }

  const data = loadData();
  const deal = data.deals[ctx.match[2]];
  if (!deal?.release) return;

  const key = usernameKey(ctx.from?.username || "");
  const buyerKey = usernameKey(deal.buyer);
  const sellerKey = usernameKey(deal.seller);

  let role = null;
  if (key === buyerKey) role = "buyer";
  if (key === sellerKey) role = "seller";

  if (!role) {
    return ctx.answerCbQuery("শুধু Buyer ও Seller সিদ্ধান্ত দিতে পারবেন।", { show_alert: true });
  }

  const field = `${role}Decision`;
  if (deal.release[field] !== "pending") {
    return ctx.answerCbQuery("আপনি ইতোমধ্যে সিদ্ধান্ত দিয়েছেন।", { show_alert: true });
  }

  deal.release[field] = ctx.match[1] === "accept" ? "accepted" : "declined";
  addTimeline(deal, "party_decision", `${role === "buyer" ? "Buyer" : "Seller"} ${deal.release[field]}`, ctx.from.id);
  saveData(data);

  const bothDone =
    deal.release.buyerDecision !== "pending" &&
    deal.release.sellerDecision !== "pending";

  const mismatch =
    bothDone &&
    deal.release.buyerDecision !== deal.release.sellerDecision;

  const bothAccepted =
    bothDone &&
    deal.release.buyerDecision === "accepted" &&
    deal.release.sellerDecision === "accepted";

  if (bothAccepted) {
    deal.payout = { flow: "release", stage: "choose_method" };
    saveData(data);

    await ctx.editMessageText(
      [
        "💳 <b>Withdrawal Details Required</b>",
        "━━━━━━━━━━━━━━━━━━━━━━",
        `${esc(deal.seller)}, আপনার পেমেন্ট মাধ্যম নির্বাচন করুন:`
      ].join("\n"),
      {
        parse_mode: "HTML",
        reply_markup: methodButtons(deal.dealId, "release").reply_markup
      }
    );
    try { await ctx.answerCbQuery(); } catch {}
    return;
  }

  await ctx.editMessageText(releaseDecisionText(deal), {
    parse_mode: "HTML",
    reply_markup: mismatch
      ? adminDecisionButtons(deal.dealId).reply_markup
      : decisionButtons(deal.dealId).reply_markup
  });

  try { await ctx.answerCbQuery(); } catch {}
});

bot.action(/^admin_(release|refund):(#\d{4,})$/, async (ctx) => {
  if (!(await isAdmin(ctx))) {
    return ctx.answerCbQuery("শুধু Admin ব্যবহার করতে পারবেন।", { show_alert: true });
  }

  const data = loadData();
  const deal = data.deals[ctx.match[2]];
  if (!deal) return;

  const flow = ctx.match[1];
  deal.payout = { flow, stage: "choose_method" };
  saveData(data);

  const target = flow === "release" ? deal.seller : deal.buyer;
  const title = flow === "release"
    ? "💳 <b>Withdrawal Details Required</b>"
    : "💳 <b>Refund Details Required</b>";

  await ctx.editMessageText(
    [
      title,
      "━━━━━━━━━━━━━━━━━━━━━━",
      `${esc(target)}, আপনার পেমেন্ট মাধ্যম নির্বাচন করুন:`
    ].join("\n"),
    {
      parse_mode: "HTML",
      reply_markup: methodButtons(deal.dealId, flow).reply_markup
    }
  );

  try { await ctx.answerCbQuery(); } catch {}
});

bot.action(/^method:(release|refund):(bkash|nagad|rocket|binance):(#\d{4,})$/, async (ctx) => {
  const [, flow, method, dealId] = ctx.match;
  const data = loadData();
  const deal = data.deals[dealId];
  if (!deal?.payout || deal.payout.flow !== flow) return;

  const target = flow === "release" ? deal.seller : deal.buyer;
  if (usernameKey(ctx.from?.username || "") !== usernameKey(target)) {
    return ctx.answerCbQuery(
      flow === "release"
        ? "শুধু Seller Method নির্বাচন করতে পারবেন।"
        : "শুধু Buyer Method নির্বাচন করতে পারবেন।",
      { show_alert: true }
    );
  }

  const labels = {
    bkash: "bKash",
    nagad: "Nagad",
    rocket: "Rocket",
    binance: "Binance"
  };

  deal.payout.method = method;
  deal.payout.methodLabel = labels[method];
  deal.payout.stage = "waiting_number";
  deal.payout.waitingForUsername = usernameKey(target);
  saveData(data);

  await ctx.editMessageText(
    methodPromptText(deal, flow, labels[method]),
    {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: [] }
    }
  );

  try { await ctx.answerCbQuery(); } catch {}
});

bot.on("text", async (ctx) => {
  if (ctx.chat.type === "private") return;
  if (!isAllowedGroup(ctx.chat.id)) return;
  if (!ctx.from?.username) return;

  const text = String(ctx.message.text || "").trim();
  if (!text || text.startsWith("/")) return;

  const data = loadData();
  const deal = findWaitingDealForUser(data, ctx.from.username, ctx.chat.id);
  if (!deal) return;

  const digits = normalizeDigits(text);
  const method = deal.payout.method;

  const validMobile = /^01\d{9}$/.test(digits);
  const validBinance = /^[A-Za-z0-9]{4,30}$/.test(text.replace(/\s+/g, ""));

  if (method === "binance") {
    if (!validBinance) {
      const warn = await ctx.reply("❌ Please enter a valid Binance Pay ID.");
      setTimeout(() => {
        ctx.telegram.deleteMessage(ctx.chat.id, warn.message_id).catch(() => {});
      }, 5000);
      return;
    }
    deal.payout.number = text.replace(/\s+/g, "");
  } else {
    if (!validMobile) {
      const warn = await ctx.reply("❌ Please enter a valid 11-digit mobile number.");
      setTimeout(() => {
        ctx.telegram.deleteMessage(ctx.chat.id, warn.message_id).catch(() => {});
      }, 5000);
      return;
    }
    deal.payout.number = digits;
  }

  await deleteMessageSilently(ctx);

  deal.payout.stage = "ready_for_admin";
  deal.payout.receivedFrom = ctx.from.id;
  deal.payout.receivedAt = new Date().toISOString();
  saveData(data);

  await ctx.telegram.editMessageText(
    ctx.chat.id,
    deal.release.messageId,
    undefined,
    detailsText(deal),
    {
      parse_mode: "HTML",
      reply_markup: Markup.inlineKeyboard([
        [Markup.button.callback("✅ Complete Payment", `complete:${deal.dealId}`)]
      ]).reply_markup
    }
  );
});

bot.action(/^complete:(#\d{4,})$/, async (ctx) => {
  if (!(await isAdmin(ctx))) {
    return ctx.answerCbQuery("শুধু Admin Complete করতে পারবেন।", { show_alert: true });
  }

  const data = loadData();
  const deal = data.deals[ctx.match[1]];
  if (!deal?.payout || deal.payout.stage !== "ready_for_admin") return;

  deal.payout.stage = "completed";
  deal.status = deal.payout.flow === "release" ? "completed" : "refunded";
  deal.completedAt = new Date().toISOString();
  addTimeline(deal, deal.status, deal.status === "completed" ? "Deal completed" : "Buyer refunded", ctx.from.id);
  addAdminLog(data, ctx, deal.status === "completed" ? "COMPLETE_DEAL" : "REFUND_DEAL", deal.dealId);
  saveData(data);

  await ctx.editMessageText(completedText(deal), {
    parse_mode: "HTML",
    reply_markup: { inline_keyboard: [] }
  });

  try { await ctx.answerCbQuery(); } catch {}
});


bot.command("note", async (ctx) => {
  if (ctx.chat.type === "private") return;
  if (!isAllowedGroup(ctx.chat.id) || !(await isAdmin(ctx))) {
    await deleteMessageSilently(ctx);
    return;
  }
  const m = (ctx.message.text || "").match(/^\/note(?:@\w+)?\s+#?(\d+)\s+([\s\S]+)$/i);
  await deleteMessageSilently(ctx);
  if (!m) return;
  const dealId = `#${String(m[1]).padStart(4, "0")}`;
  const data = loadData();
  const deal = data.deals[dealId];
  if (!deal) return;
  if (!Array.isArray(deal.adminNotes)) deal.adminNotes = [];
  deal.adminNotes.push({ text: m[2].trim(), by: ctx.from.id, username: ctx.from.username || null, at: new Date().toISOString() });
  addAdminLog(data, ctx, "ADD_NOTE", dealId);
  saveData(data);
  try {
    await ctx.telegram.sendMessage(ctx.from.id, `📝 Admin Note Saved\n${dealId}\n${m[2].trim()}`);
  } catch {}
});

bot.command("notes", async (ctx) => {
  if (ctx.chat.type === "private") return;
  if (!isAllowedGroup(ctx.chat.id) || !(await isAdmin(ctx))) {
    await deleteMessageSilently(ctx);
    return;
  }
  const m = (ctx.message.text || "").match(/^\/notes(?:@\w+)?\s+#?(\d+)$/i);
  await deleteMessageSilently(ctx);
  if (!m) return;
  const dealId = `#${String(m[1]).padStart(4, "0")}`;
  const data = loadData();
  const deal = data.deals[dealId];
  if (!deal) return;
  const notes = Array.isArray(deal.adminNotes) ? deal.adminNotes : [];
  const text = notes.length
    ? [`📝 Admin Notes — ${dealId}`, ...notes.map((n,i) => `${i+1}. ${n.text}\nBy: @${n.username || n.by} | ${dhakaTime(n.at)}`)].join("\n\n")
    : `📝 ${dealId}-এ কোনো Admin Note নেই।`;
  try { await ctx.telegram.sendMessage(ctx.from.id, text); } catch {}
});

bot.command("adminlog", async (ctx) => {
  if (ctx.chat.type === "private") return;
  if (!isAllowedGroup(ctx.chat.id) || !(await isSuperAdmin(ctx))) {
    await deleteMessageSilently(ctx);
    return;
  }
  await deleteMessageSilently(ctx);
  const data = loadData();
  const logs = (data.adminLogs || []).slice(-15).reverse();
  const text = logs.length
    ? ["👮 Recent Admin Log", ...logs.map(l => `• ${l.action}${l.dealId ? ` ${l.dealId}` : ""} — @${l.adminUsername || l.adminId} — ${dhakaTime(l.at)}`)].join("\n")
    : "কোনো Admin Log নেই।";
  try { await ctx.telegram.sendMessage(ctx.from.id, text); } catch {}
});

bot.command("admins", async (ctx) => {
  if (ctx.chat.type === "private") return;
  if (!isAllowedGroup(ctx.chat.id) || !(await isSuperAdmin(ctx))) {
    await deleteMessageSilently(ctx);
    return;
  }
  await deleteMessageSilently(ctx);
  const text = [
    "👮 Admin Permission",
    `Super Admin IDs: ${[...SUPER_ADMIN_IDS].join(", ") || "Group Creator"}`,
    `Moderator IDs: ${[...MODERATOR_IDS].join(", ") || "Group Administrators"}`,
    "",
    "Super Admin: সব কমান্ড + /adminlog",
    "Moderator: Deal create, verify, release, cancel, note"
  ].join("\n");
  try { await ctx.telegram.sendMessage(ctx.from.id, text); } catch {}
});

bot.on("my_chat_member", async (ctx) => {
  const status = ctx.update.my_chat_member.new_chat_member.status;
  if (["member", "administrator"].includes(status) && !isAllowedGroup(ctx.chat.id)) {
    try { await ctx.telegram.leaveChat(ctx.chat.id); } catch {}
  }
});


async function autoCancelExpiredDeals() {
  const data = loadData();
  const now = Date.now();
  const expired = [];

  for (const deal of Object.values(data.deals || {})) {
    if (deal.status !== "waiting_payment") continue;

    // পুরোনো Active Deal-এ deadline না থাকলে createdAt থেকে ৩০ মিনিট ধরা হবে।
    if (!deal.paymentExpiresAt) {
      const created = new Date(deal.createdAt || now).getTime();
      deal.paymentExpiresAt = new Date(created + PAYMENT_TIMEOUT_MINUTES * 60 * 1000).toISOString();
    }

    if (now < new Date(deal.paymentExpiresAt).getTime()) continue;

    deal.status = "cancelled";
    deal.cancelledAt = new Date().toISOString();
    deal.cancelledBy = "SYSTEM_TIMEOUT";
    deal.autoCancelled = true;
    addTimeline(deal, "auto_cancelled", `Payment confirmation not received within ${PAYMENT_TIMEOUT_MINUTES} minutes`, "SYSTEM");

    if (!Array.isArray(data.adminLogs)) data.adminLogs = [];
    data.adminLogs.push({
      action: "AUTO_CANCEL_TIMEOUT",
      dealId: deal.dealId,
      details: `${PAYMENT_TIMEOUT_MINUTES} minute payment timeout`,
      adminId: "SYSTEM",
      adminUsername: "System",
      at: deal.cancelledAt
    });
    expired.push(deal);
  }

  if (!expired.length) return;
  if (data.adminLogs.length > 2000) data.adminLogs = data.adminLogs.slice(-2000);
  saveData(data);

  for (const deal of expired) {
    try {
      await bot.telegram.editMessageText(
        deal.groupId || ALLOWED_GROUP_ID,
        deal.groupMessageId,
        undefined,
        cancelledText(deal),
        { parse_mode: "HTML", reply_markup: { inline_keyboard: [] } }
      );
    } catch (error) {
      try {
        await bot.telegram.sendMessage(
          deal.groupId || ALLOWED_GROUP_ID,
          cancelledText(deal),
          { parse_mode: "HTML" }
        );
      } catch {}
    }
  }
}

bot.catch((error) => console.error("Bot error:", error));

app.get("/", (_req, res) => res.send("Infinity Deal Bot V5.1 is running ✅"));
app.get("/health", (_req, res) => res.json({ ok: true, version: "5.1.0" }));

app.listen(PORT, async () => {
  console.log(`Web server running on port ${PORT}`);
  try {
    await bot.launch({ dropPendingUpdates: true });
    await autoCancelExpiredDeals();
    setInterval(() => {
      autoCancelExpiredDeals().catch(error => console.error("Auto cancel error:", error.message));
    }, 15000);
    console.log(`Infinity Deal Bot V5.1 started ✅ | Payment timeout: ${PAYMENT_TIMEOUT_MINUTES} minutes`);
  } catch (error) {
    console.error("Bot launch failed:", error);
  }
});

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
