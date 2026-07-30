# 🗺️ NP Live Campus Map & Telegram Bot

An interactive **Live Campus Map & Navigation System** built specifically for **Ngee Ann Polytechnic (NP) students**, integrated directly into Telegram as a Telegram Mini App (Web App) and Telegram Bot.

---

## ✨ Features Built
1. **Interactive Campus Map**:
   - Built with high-resolution NP campus landmarks (Blk 1 through Blk 83, Convention Centre, Makan Place, Munch, Food Club, SIT, Aerospace Hub, Sports Complex, etc.).
   - Interactive zoom & pan controls + filter pills (Academic, Food, Events, Transport).
2. **Campus Trail Navigation (Dijkstra Pathfinding)**:
   - Select starting location & destination to automatically draw a glowing neon trail guiding students step-by-step.
   - Walking time estimation.
3. **Level & Room Details**:
   - Bottom sheet drawer showing level tabs (Lvl 1, Lvl 2, Lvl 3, Lvl 4) and room facilities for each block.
4. **Telegram Bot Integration**:
   - `/start` - Launches welcome card with direct button to open the Mini App.
   - `/map` - Quick launch button for the interactive map.
   - `/legend` - Full list of NP Blocks & Schools.
   - `/search <query>` - Instant search for any building or room.

---

## 🛠️ Step-by-Step Setup Guide (What You Need to Do)

Follow these simple steps to run the Telegram Bot:

### Step 1: Install Node.js Dependencies
In your terminal inside this folder, run:
```bash
npm install
```

---

### Step 2: Get a Telegram Bot Token from `@BotFather`
1. Open Telegram and search for **`@BotFather`**.
2. Start a chat and send the command:
   ```text
   /newbot
   ```
3. Enter a name for your bot (e.g. `NP Live Map Bot`).
4. Enter a username for your bot ending in `bot` (e.g. `nplivemap_bot`).
5. **Copy the HTTP API Token** provided by BotFather.

---

### Step 3: Configure `.env` File
Create a `.env` file in the project folder (or edit `.env.example`) and paste your Bot Token:
```env
TELEGRAM_BOT_TOKEN=123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ
PORT=3000
WEBAPP_URL=https://your-ngrok-url.ngrok-free.app
```

---

### Step 4: Expose Localhost to HTTPS (Required for Telegram Web App)
Telegram requires your Web App URL to be `https://`. You can use **ngrok** (free) to test locally:
1. Download ngrok or install via terminal: `npx ngrok http 3000`
2. Copy the `https://xxxx.ngrok-free.app` URL provided by ngrok.
3. Update the `WEBAPP_URL` in your `.env` file with this HTTPS URL.

---

### Step 5: Set Up Menu Button in `@BotFather` (Optional but recommended)
To make your map launch seamlessly whenever students open your bot:
1. In Telegram, send `/setmenubutton` to `@BotFather`.
2. Select your bot.
3. Send the URL: `https://your-ngrok-url.ngrok-free.app`
4. Enter the button text: `🗺️ Live Map`

---

### Step 6: Start the Server & Bot
Run the start command:
```bash
npm start
```
Open your Telegram app, search for your bot username, and tap `/start` to use the Live Map!

---

## 📁 File Structure
- `server.js` - Express server & Telegraf Telegram Bot logic.
- `public/index.html` - Telegram Web App HTML5 interface.
- `public/style.css` - Glassmorphic dark design system & animation styles.
- `public/app.js` - Interactive map canvas, Dijkstra pathfinding trail drawer, level tab manager.
- `public/campus_data.js` - NP location coordinates, floor levels, keywords, and routing graph.
