import os
import asyncio
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes
import hashlib

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.environ.get('BOT_TOKEN', '')
APP_URL = 'https://app.temptationtoken.io'

users = {}

def get_ref_code(uid):
    return hashlib.md5(str(uid).encode()).hexdigest()[:8]

def main_kb(uid):
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🎮 Play TTS Now", web_app=WebAppInfo(url=APP_URL))],
        [InlineKeyboardButton("💰 How to Earn", callback_data='earn'),
         InlineKeyboardButton("📊 Stats", callback_data='stats')],
        [InlineKeyboardButton("⭐ VIP Access", callback_data='vip'),
         InlineKeyboardButton("🏆 Leaderboard", callback_data='lb')],
        [InlineKeyboardButton("🔗 My Referral Link", callback_data='ref')],
    ])

async def start(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    u = update.effective_user
    users[u.id] = {'name': u.first_name, 'ref': get_ref_code(u.id)}
    if ctx.args and ctx.args[0].startswith('ref_'):
        users[u.id]['referred_by'] = ctx.args[0][4:]
    await update.message.reply_text(
        f"🔥 *Welcome to Temptation Token, {u.first_name}!*\n\n"
        "The world's first crypto Hot or Not voting game on Base blockchain.\n\n"
        "🗳 Vote $TTS on profiles\n"
        "🏆 Top voter wins 40% of the weekly pot\n"
        "🔥 Losing votes burned — deflationary\n"
        "💎 Stake to multiply vote power up to 3x\n\n"
        "*New user bonus:* 100 $TTS just for signing up!\n\n"
        "Tap *Play TTS Now* to start 👇",
        parse_mode='Markdown',
        reply_markup=main_kb(u.id)
    )

async def earn(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    await q.edit_message_text(
        "💰 *Ways to Earn $TTS*\n\n"
        "*Vote & Win:* Put the most TTS on the winning profile → win 40% of the pot\n\n"
        "*Submit Your Profile:* Get voted on and win 40% as top profile\n\n"
        "*Stake Your TTS:*\n"
        "• Bronze $50+ → 8% APR, 1.1x votes\n"
        "• Silver $100+ → 12% APR, 1.25x votes\n"
        "• Gold $250+ → 18% APR, 1.5x votes\n"
        "• Platinum $500+ → 24% APR, 1.75x votes\n"
        "• Diamond $1000+ → 32% APR, 2x votes\n"
        "• VIP $5000+ → 45% APR, 3x votes 🔥\n\n"
        "*Refer Friends:* Earn 10 TTS per referral",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🎮 Start Playing", web_app=WebAppInfo(url=APP_URL))],
            [InlineKeyboardButton("⬅️ Back", callback_data='back')]
        ])
    )

async def stats(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    await q.edit_message_text(
        "📊 *TTS Live Stats*\n\n"
        "🪙 Token: $TTS on Base Mainnet\n"
        "📍 Contract:\n`0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`\n"
        "🔥 Deflationary — losing votes burned\n"
        "💧 Uniswap v3 Base ETH/TTS pool\n\n"
        "Buy on Uniswap: app.uniswap.org\n"
        "View on Basescan: basescan.org",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🎮 Play Now", web_app=WebAppInfo(url=APP_URL))],
            [InlineKeyboardButton("⬅️ Back", callback_data='back')]
        ])
    )

async def vip(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    await q.edit_message_text(
        "⭐ *TTS VIP Vault*\n\n"
        "🥉 Bronze 500 TTS/mo → Early photo previews\n"
        "🥈 Silver 2,000 TTS/mo → Full gallery + hints\n"
        "🥇 Gold 5,000 TTS/mo → Creator access + NFTs\n"
        "💎 Diamond 10,000 TTS/mo → 3x votes + AMA\n\n"
        "Stake TTS in the app now to unlock vote multipliers and APR rewards.",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("🎮 Stake in App", web_app=WebAppInfo(url=APP_URL))],
            [InlineKeyboardButton("⬅️ Back", callback_data='back')]
        ])
    )

async def leaderboard(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    await q.edit_message_text(
        "🏆 *TTS Leaderboard*\n\n"
        "Weekly voting round is live!\n\n"
        "Top voter at round close wins 40% of the prize pool.\n"
        "Round closes: Sunday 23:59 UTC\n\n"
        "Tap below to see live standings 👇",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("📊 View Leaderboard", web_app=WebAppInfo(url=APP_URL))],
            [InlineKeyboardButton("⬅️ Back", callback_data='back')]
        ])
    )

async def refer(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    uid = q.from_user.id
    code = get_ref_code(uid)
    link = f'https://t.me/TTSGameBot?start=ref_{code}'
    await q.edit_message_text(
        f"🔗 *Your Referral Link*\n\n"
        f"Share and earn *10 TTS* per friend who joins!\n\n"
        f"`{link}`\n\n"
        "They get 100 TTS signup bonus + 10 TTS extra.\nYou get 10 TTS automatically. 🔥",
        parse_mode='Markdown',
        reply_markup=InlineKeyboardMarkup([
            [InlineKeyboardButton("📤 Share Link", url=f'https://t.me/share/url?url={link}&text=Join+Temptation+Token+%26+get+100+TTS+free+%F0%9F%94%A5')],
            [InlineKeyboardButton("⬅️ Back", callback_data='back')]
        ])
    )

async def back(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    q = update.callback_query
    await q.answer()
    await q.edit_message_text(
        "🔥 *Temptation Token — Main Menu*\n\nVote. Stake. Win real $TTS every week.",
        parse_mode='Markdown',
        reply_markup=main_kb(q.from_user.id)
    )

async def message(update: Update, ctx: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "Use the menu buttons below 👇",
        reply_markup=main_kb(update.effective_user.id)
    )

def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler('start', start))
    app.add_handler(CallbackQueryHandler(earn, pattern='^earn$'))
    app.add_handler(CallbackQueryHandler(stats, pattern='^stats$'))
    app.add_handler(CallbackQueryHandler(vip, pattern='^vip$'))
    app.add_handler(CallbackQueryHandler(leaderboard, pattern='^lb$'))
    app.add_handler(CallbackQueryHandler(refer, pattern='^ref$'))
    app.add_handler(CallbackQueryHandler(back, pattern='^back$'))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, message))
    logger.info("TTS Bot starting...")
    app.run_polling()

if __name__ == '__main__':
    main()
# TTS Bot v3
