# Monster Battle Live — TikTok AFK game

**Download the latest Windows app:** [MonsterBattleLive-portable.exe](https://github.com/HyperNoobzz/monster-battle-live/releases/latest/download/MonsterBattleLive-portable.exe) · [all releases](https://github.com/HyperNoobzz/monster-battle-live/releases)

**Mac:** [Apple Silicon (M1–M4)](https://github.com/HyperNoobzz/monster-battle-live/releases/latest/download/MonsterBattleLive-mac-arm64.zip) · [Intel](https://github.com/HyperNoobzz/monster-battle-live/releases/latest/download/MonsterBattleLive-mac-x64.zip)

Every push to `main` builds new Windows and Mac apps automatically (GitHub Actions → *Build apps*).

### Opening the Mac app the first time
The app is not signed with a paid Apple developer certificate, so macOS blocks it the first time.
1. Double-click the `.zip`, then drag **Monster Battle Live** into **Applications**.
2. Open it once. macOS says it can't be opened. Click **Done**.
3. Open **System Settings → Privacy & Security**, scroll down, and click **Open Anyway** next to "Monster Battle Live", then confirm.

If macOS still says the app "is damaged" (for example a copy downloaded before v1.1.4), run this once in Terminal, then open the app again:
```
xattr -cr "/Applications/Monster Battle Live.app"
```

Viewers pick a team in the comments and send gifts to make their team's monster attack.

## Characters
RED is a cartoon **#7** striker (red shirt, green shorts) named RONALDO, and BLUE is a cartoon **#10** striker (sky-blue and white stripes) named MESSI.
Both are original chibi drawings made in code: no photos, club crests or brand logos. Attacks are kicked footballs.
Both names can be changed in the ⚙ panel (*RED player name* / *BLUE player name*). Viewers can also join by commenting `ronaldo`/`cr7` or `messi`/`lm10`.

## How viewers play
Nothing on screen mentions gifts. Everything shown to viewers is comment-, like- and share-based.

| Comment | Effect |
|---|---|
| `1` / `red` / `merah` | Join RED |
| `2` / `blue` / `biru` | Join BLUE |
| `A` / `attack` / `serang` | Attack: each comment hits for about 1.2% of the enemy's max HP |
| `D` / `defend` / `tahan` | Defend: adds a shield (1.5% max HP each, up to 30%) that absorbs damage |
| `H` / `heal` / `sembuh` | Heal: restores 0.8% of max HP |

- Each viewer can use a command once every 3 seconds (adjustable), so spamming doesn't help.
- Commands from the whole team are combined every ~1 second into one team attack, so a busy chat stays readable.
- Every 30 commands from a team (adjustable) charge a **⚡ POWER move** that hits for 8% of the enemy's max HP.
- Every 100 likes per team = a free attack. A follow = a free attack. A share heals 4% (once per viewer per 30s).
- Type advantage = ×1.5 damage, critical hit = ×2. A knockout wins the round and crowns the top damage dealer as MVP.

### Gifts
Gifts work alongside comments. A gift makes the sender's team monster attack right away, and bigger gifts trigger bigger moves:

| Gift value | Move |
|---|---|
| 1–4 coins | Quick hit |
| 5–29 coins | Special move |
| 30–99 coins | Power move (screen shake) |
| 100+ coins | ULTIMATE (flash + shake) |

The sender's name appears in gold with a ⭐, the gift's picture pops up above their player, and their damage counts toward MVP.

**Gift guide:** the bottom cards switch every 8 seconds between the comment commands and a gift guide. Each gift card shows the gift's picture, name, coin value, effect and approximate damage (coins × *Support damage per coin*, default 8).
The pictures are TikTok's own gift images, loaded live from TikTok when the game is connected (the built-in connection also loads the room's full gift list with prices; with TikFinity, pictures are learned as gifts arrive). They are remembered on that computer. Until a picture is known, an emoji stands in (🌹 💗 🍩 🎉).
Turn the guide off with **Show gift guide on screen** in the ⚙ panel.

## Desktop app (Windows)
Run `MonsterBattleLive-portable.exe`. Nothing needs installing, and Node.js is not required.
1. Start your LIVE in TikTok LIVE Studio.
2. In the game window, the settings panel opens on first launch (press `S` to toggle it later). Type your TikTok username and press **Go live**.
3. The header changes to `LIVE @username`. In LIVE Studio, add a **Window Capture** source and pick "Monster Battle Live".

Window menu: Always on top, Full screen (F11), and size presets up to 1080×1920.
Windows SmartScreen may warn because the app is not code-signed: click "More info", then "Run anyway".

### Using TikFinity instead
If you already run **TikFinity Desktop**, the game can read your LIVE from it, so you don't need the built-in connection.
1. Open TikFinity Desktop on the same PC and connect it to your LIVE.
2. In the game, open ⚙ and press **Use TikFinity**. The header shows `LIVE · TIKFINITY` once the first comment, like or gift arrives.

The game reads TikFinity's local event feed at `ws://localhost:21213/`. The choice is remembered; press **Stop using TikFinity** to switch back.
The web version also accepts `index.html?tikfinity`.

### Building the desktop app yourself
```
npm install
npm start            # run the app
npm run dist:win     # Windows .exe + .zip in dist/
npm run dist:mac     # macOS .app in dist/ (must run on a Mac)
```

## Web version
1. **Simulator only:** open `index.html` in a browser, click ⚙ (or press `S`) and use the buttons.
2. **With TikTok Live** (requires Node.js 18+):
   ```
   cd bridge
   npm install
   node bridge.js YOUR_TIKTOK_USERNAME
   ```
   Then open `index.html`. It auto-connects to `ws://localhost:8080`. The header shows `LIVE @username` once connected.
3. **In OBS / TikTok LIVE Studio:** add a Browser Source pointing to `index.html?clean`, set to 1080×1920.
   `?clean` hides the ⚙ button. Use `?ws=ws://host:port` for a different bridge address.

Settings (base HP, damage per coin, likes per free attack, sound) are in the ⚙ panel and are saved in the browser.
