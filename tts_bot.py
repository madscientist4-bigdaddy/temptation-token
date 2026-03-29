import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup, WebAppInfo
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, MessageHandler, filters, ContextTypes
import json
import hashlib
from datetime import datetime

logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.environ.get('BOT_TOKEN', '')
APP_URL = 'https://app.temptationtoken.io'
CHANNEL_URL = 'https://t.me/TemptationToken'

# Simple in-memory storage (Railway persists via env vars or you add a DB later)
referrals = {}
users = {}

def get_referral_code(user_id):
    return hashlib.md5(str(user_id).encode()).hexdigest()[:8]

def get_welcome_keyboard(user_id):
    ref_code = get_referral_code(user_id)
    ref_link = f'https://t.me/TTSGameBot?start=ref_{ref_code}'
    return InlineKeyboardMarkup([
        [InlineKeyboardButton("🎮 Play TTS Now", web_app=WebAppInfo(url=APP_URL))],
        [InlineKeyboardButton("💰 How to Earn", callback_data='earn'),
         InlineKeyboardButton("📊 Live Stats", callback_data='stats')],
        [InlineKeyboardButton("⭐ VIP Access", callback_data='vip'),
         InlineKeyboardButton("🏆 Leaderboard", callback_data='leaderboard')],
        [InlineKeyboardButton("🔗 My Referral Link", callback_data=f'refer_{ref_code}')],
        [InlineKeyboardButton("📢 Follow Channel", url='https://t.me/TTSGameBot')],
    ])

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    user_id = user.id
    args = context.args

    # Track referral
    if args and args[0].startswith('ref_'):
        ref_code = args[0][4:]
        referrals[user_id] = ref_code

    # Track user
    users[user_id] = {
        'username': user.username,
        'first_name': user.first_name,
        'joined': datetime.now().isoformat(),
        'referral_code': get_referral_code(user_id)
    }

    welcome_text = f"""🔥 *Welcome to Temptation Token, {user.first_name}!*

The world's first crypto-powered Hot or Not voting game on Base blockchain.

*How it works:*
🗳 Vote $TTS on your favorite profiles
🏆 Top profile + top voter split 80% of the pot
🔥 Losing votes are BURNED — TTS is deflationary
💎 Stake TTS to multiply your vote power up to 3x

*New user bonus:* 100 $TTS just for signing up!

Tap *Play TTS Now* to start 👇"""

    await update.message.reply_text(
        welcome_text,
        parse_mode='Markdown',
        reply_markup=get_welcome_keyboard(user_id)
    )

async def earn_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    text = """💰 *Ways to Earn $TTS*

*1. Vote & Win*
Place the most $TTS on the winning profile → win 40% of the entire prize pool

*2. Submit Your Profile*
Get voted on and win 40% of the prize pool as the top-voted profile

*3. Stake Your TTS*
Lock TTS to earn APR rewards:
• Bronze $50+ → 8% APR, 1.1x votes
• Silver $100+ → 12% APR, 1.25x votes  
• Gold $250+ → 18% APR, 1.5x votes
• Platinum $500+ → 24% APR, 1.75x votes
• Diamond $1000+ → 32% APR, 2x votes
• VIP $5000+ → 45% APR, 3x votes 🔥

*4. Refer Friends*
Earn 10 TTS for every friend who joins

*Buy TTS on Uniswap (Base network):*
Contract: `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`"""

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("🎮 Start Playing", web_app=WebAppInfo(url=APP_URL))],
        [InlineKeyboardButton("⬅️ Back", callback_data='back')]
    ])
    await query.edit_message_text(text, parse_mode='Markdown', reply_markup=keyboard)

async def vip_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    text = """⭐ *TTS VIP Vault*

Exclusive access for serious players.

*VIP Tier Benefits:*
🥉 Bronze 500 TTS/mo → Early photo previews (24hr before voting)
🥈 Silver 2,000 TTS/mo → Full gallery + strategy hints
🥇 Gold 5,000 TTS/mo → Direct creator interaction + NFT drops
💎 Diamond 10,000 TTS/mo → Kingmaker badge + 3x vote weight + weekly AMA

*Coming soon* — VIP access will be purchasable directly in this bot using Telegram Stars or $TTS.

For now, stake your TTS in the app to unlock vote multipliers and APR rewards."""

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("🎮 Open App to Stake", web_app=WebAppInfo(url=APP_URL + '#stake'))],
        [InlineKeyboardButton("⬅️ Back", callback_data='back')]
    ])
    await query.edit_message_text(text, parse_mode='Markdown', reply_markup=keyboard)

async def stats_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    text = """📊 *Temptation Token Live Stats*

🪙 *Token:* $TTS on Base Mainnet
📍 *Contract:* `0x5570eA97d53A53170e973894A9Fa7feb5785d3b9`
🔥 *Mechanism:* Deflationary — losing votes burned
💧 *Liquidity:* Uniswap v3 Base ETH/TTS pool
🏆 *Weekly pot:* Active — vote to see current value

*View on:*
• Uniswap: app.uniswap.org
• Basescan: basescan.org

*App:* app.temptationtoken.io"""

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("🎮 Play Now", web_app=WebAppInfo(url=APP_URL))],
        [InlineKeyboardButton("⬅️ Back", callback_data='back')]
    ])
    await query.edit_message_text(text, parse_mode='Markdown', reply_markup=keyboard)

async def leaderboard_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    text = """🏆 *TTS Leaderboard*

Weekly voting round is live!

The leaderboard updates in real-time inside the app. Top voter at round close wins 40% of the prize pool.

*This week's round closes:* Sunday 23:59 UTC

Tap below to see current standings and cast your votes 👇"""

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("📊 View Live Leaderboard", web_app=WebAppInfo(url=APP_URL + '#leaderboard'))],
        [InlineKeyboardButton("⬅️ Back", callback_data='back')]
    ])
    await query.edit_message_text(text, parse_mode='Markdown', reply_markup=keyboard)

async def refer_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    ref_code = get_referral_code(user_id)
    ref_link = f'https://t.me/TTSGameBot?start=ref_{ref_code}'

    text = f"""🔗 *Your Referral Link*

Share this link and earn *10 TTS* for every friend who joins!

Your link:
`{ref_link}`

*How it works:*
1. Friend clicks your link
2. They join and claim 100 TTS signup bonus
3. You automatically receive 10 TTS
4. They get an extra 10 TTS bonus on top!

The more you share, the more you earn. 🔥"""

    keyboard = InlineKeyboardMarkup([
        [InlineKeyboardButton("📤 Share My Link", url=f'https://t.me/share/url?url={ref_link}&text=Join%20Temptation%20Token%20and%20get%20100%20TTS%20free!%20🔥')],
        [InlineKeyboardButton("⬅️ Back", callback_data='back')]
    ])
    await query.edit_message_text(text, parse_mode='Markdown', reply_markup=keyboard)

async def back_callback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user = query.from_user
    welcome_text = f"""🔥 *Temptation Token — Main Menu*

Vote. Stake. Win real $TTS every week.

What would you like to do?"""
    await query.edit_message_text(
        welcome_text,
        parse_mode='Markdown',
        reply_markup=get_welcome_keyboard(user.id)
    )

async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    text = update.message.text.lower()
    user_id = update.effective_user.id

    if any(w in text for w in ['help', 'how', 'what', 'support']):
        await update.message.reply_text(
            "Need help? Tap a menu button below or visit app.temptationtoken.io\n\nFor support email: support@temptationtoken.io",
            reply_markup=get_welcome_keyboard(user_id)
        )
    else:
        await update.message.reply_text(
            "Use the menu buttons to navigate 👇",
            reply_markup=get_welcome_keyboard(user_id)
        )

def main():
    app = Application.builder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler('start', start))
    app.add_handler(CallbackQueryHandler(earn_callback, pattern='^earn$'))
    app.add_handler(CallbackQueryHandler(vip_callback, pattern='^vip$'))
    app.add_handler(CallbackQueryHandler(stats_callback, pattern='^stats$'))
    app.add_handler(CallbackQueryHandler(leaderboard_callback, pattern='^leaderboard$'))
    app.add_handler(CallbackQueryHandler(refer_callback, pattern='^refer_'))
    app.add_handler(CallbackQueryHandler(back_callback, pattern='^back$'))
    app.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, handle_message))
    print("TTS Bot starting...")
    app.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    main()
