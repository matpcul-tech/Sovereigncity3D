# Sovereign City 3D
### Build What You Own

A third-person founder simulation game built for the next generation of builders. Walk the city, find a real problem, name your business, pitch your neighbors face to face, hire a team, raise funding, and build a tower with your name on it.

**Play the demo:** [matpcul-tech.github.io/Sovereigncity3D](https://matpcul-tech.github.io/Sovereigncity3D/)

---

## What It Is

Sovereign City is a 3D open-world business simulation designed for kids, teens, and young adults who need to see themselves as founders before anyone tells them they can be. Built on Three.js, runs entirely in the browser with no downloads.

**12 industries to found:** Music, Food, Tech, AI, Fashion, Acting, Agency, Infrastructure, Education, Sports, Arts, Local Services.

**5 stages of growth:** Ideator → Hustler → Builder → Scaler → Sovereign.

**Real economics:** Revenue, expenses, churn, equity, burn rate, automation, community investment. Every term arrives through consequence, never a lecture.

**Founders Commons:** A shared co-op town in Zone 6 where every player's building appears in everyone else's world.

---

## How to Play

**Mobile:** Use the on-screen joystick to move. Drag the right side of the screen to look around. Tap the interact button when it appears.

**Desktop:** WASD or arrow keys to move. Mouse drag to look. E or Enter to interact.

**Cheat sheet:**
- Find Marcus Webb in The Grind first
- Read the Community Board to pick your industry
- Pitch neighbors face to face to get customers
- Buy the Empty Lot at 5 customers
- Scale to 15 customers to unlock Innovation Row
- Invest in the Sovereign District for a permanent revenue boost
- Automate at the Tech Hub, hire a GM, run 7 profitable days hands-off
- Your tower rises in the Skyline as you approach Sovereignty

**Easter egg:** Push the joystick all the way at Stage 2 to skate. Watch for the goose.

---

## Class codes and town codes

One code is one shared town. A **class code** is that code at school. A **town code** is the same kind of code at home with friends, including friends who go to a different school. The same letters join the same town. A different code is a different town.

Founder names only. No accounts, no emails, no passwords. Leave the code blank to play alone on this device.

### School: class code

1. **Pick a class code.** Any 6 letters or numbers, for example `ROOM12`.
2. **Share the game link** with the class:
   `https://matpcul-tech.github.io/Sovereigncity3D/?session=true&code=ROOM12&duration=40`
   This fills in the class code, locks it to School, and runs a countdown (`duration` is minutes). Or share the plain game link and have students tap **School** and type the code.
3. **Open the Facilitator Dashboard** on your laptop before anyone joins:
   `https://matpcul-tech.github.io/Sovereigncity3D/facilitator.html?code=ROOM12`
   The page explains the class code, stores founder names only, and has a student link to copy. An empty class says no students yet. Set **Today's Hustle** even before the first founder joins. That one line stays on screen in the game. The roster then shows business, stage, customers, daily profit/loss, vocabulary, insights, and last activity.
   Each student on the session link gets a countdown (`duration` is minutes) that starts when they enter the city. The dashboard has a separate period clock. Press Start when class begins. That clock stays on the laptop.

### Home: town code

Pick a town code and share it with friends. On the title screen, tap **Home** and type that code. Friends do not need to be in the same school.

Use a different code from the class code if home play should stay separate. Anyone who types the class code joins the class town, at school or at home.

Optional home link (fills the code and locks Home):
`https://matpcul-tech.github.io/Sovereigncity3D/?code=HOME12&use=town`

`facilitator.html?code=HOME12` opens that same town. Class codes and town codes share one `town_code`. `?code=` is the key.

### Founder Mode tabletop

Founder Mode is the paper companion to the 3D browser game and the youth pilot. The print kit page hosts the board, rulebook, player mat, print cards, tokens, cheat sheet, facilitator card, and junior rules, plus one zip of those PDFs.

**Print kit:** [print-kit.html](https://matpcul-tech.github.io/Sovereigncity3D/print-kit.html)

The game title screen and the facilitator dashboard both link there. Founder names and codes only. The browser game does not require the paper kit.

### What players see

- Other founders with the same code walking the city live, with name tags (and as dots on the minimap)
- Founders Commons plots claimed by anyone on that code appear in everyone's world instantly
- The Hall of Fame ranks the fastest founders to reach Sovereignty
- Progress saves to the cloud under the code plus founder name, so any device can resume

### One-time backend setup (repo owner)

Group play runs on a free [Supabase](https://supabase.com) project:

1. Create a Supabase project, open **SQL Editor**, and run `supabase-migration.sql`, then `supabase-patch-classroom.sql` (both in this repo).
2. In **Database → Replication**, enable Realtime on the `plots` and `saves` tables.
3. In this repo's **Settings → Secrets and variables → Actions**, add:
   - `VITE_SUPABASE_URL`: the project URL (Supabase Dashboard → Settings → API)
   - `VITE_SUPABASE_ANON_KEY`: the anon public key
4. Re-run the deploy (push to `main` or Actions → Deploy to GitHub Pages → Run workflow).

Without the secrets the game still works in solo mode. A class code or town code simply plays locally.

---

## Trailer Mode

A five-act, 30-second cinematic commercial the game films by itself: letterbox bars, on-screen captions, music shifts, fireworks, and a title card. Load a game with a named business first (the business name appears on the tower in the final act).

**Desktop:** open the browser console (F12) and run:
```javascript
Trailer.start()
```
Capture with OBS Studio (1080p, 60 fps).

**Mobile (no console needed):** open the game with `?trailer=true`:
`https://matpcul-tech.github.io/Sovereigncity3D/?trailer=true`
Continue your save, then start your phone's screen recorder during the 5-second on-screen countdown. When the trailer ends, your game resumes untouched.

---

## Tech Stack

- **Three.js r128**: 3D rendering, procedural textures, shadows
- **Web Audio API**: Generative per-zone soundtrack, zero audio files
- **HTML5 Canvas**: Minimap, facade textures, floating reward text, tutorial arrows
- **Vanilla JS**: No framework, no build step, one file

---

## The Company

Sovereign City is a product of **Sovereign Shield Technologies LLC**, Ada, Oklahoma.  
Founded by an enrolled Chickasaw citizen building sovereign infrastructure for nations and communities.

*"Pick up enough crumbs, you get a loaf of bread."*

**Halito. Chokma. Yakoke.**

---

## License

Demo build. All rights reserved. Sovereign Shield Technologies LLC © 2026.
