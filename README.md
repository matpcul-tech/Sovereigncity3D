# Sovereign City 3D
### Build What You Own

A third-person founder simulation game built for the next generation of builders. Walk the city, find a real problem, name your business, pitch your neighbors face to face, hire a team, raise funding, and build a tower with your name on it.

**Play the demo:** [sovereigncity.netlify.app](https://sovereigncity.netlify.app) *(update this link after deploy)*

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

## Classroom / Group Play

Sovereign City is built for classrooms: a whole class plays in one shared town, sees each other live in the city, builds Founders Commons together, and the teacher watches progress in real time.

### For teachers

1. **Pick a Class Code** — any 6 letters/numbers (e.g. `ROOM12`). That code IS the class town; no accounts, no emails, no passwords.
2. **Share the game link** with the class:
   `https://matpcul-tech.github.io/Sovereigncity3D/?session=true&code=ROOM12&duration=40`
   — this pre-fills the class code, locks it, and runs a countdown session timer (`duration` is minutes). Or just share the plain game link and have students type the code on the title screen.
3. **Open the Facilitator Dashboard** while they play:
   `https://matpcul-tech.github.io/Sovereigncity3D/facilitator.html?code=ROOM12`
   Live for every student: business, stage, customers, daily profit/loss, vocabulary terms earned, insights, last-active. Set a custom **"Today's Hustle"** challenge that pops up in every student's game, and export a session report as CSV for grading.

### What students see

- Classmates walking the same city live, with name tags (and as dots on the minimap)
- Founders Commons plots claimed by classmates appear in everyone's world instantly
- The Hall of Fame ranks the fastest founders to reach Sovereignty
- Progress saves to the cloud under Class Code + founder name, so any device can resume

### One-time backend setup (repo owner)

Group play runs on a free [Supabase](https://supabase.com) project:

1. Create a Supabase project, open **SQL Editor**, and run `supabase-migration.sql`, then `supabase-patch-classroom.sql` (both in this repo).
2. In **Database → Replication**, enable Realtime on the `plots` and `saves` tables.
3. In this repo's **Settings → Secrets and variables → Actions**, add:
   - `VITE_SUPABASE_URL` — the project URL (Supabase Dashboard → Settings → API)
   - `VITE_SUPABASE_ANON_KEY` — the anon public key
4. Re-run the deploy (push to `main` or Actions → Deploy to GitHub Pages → Run workflow).

Without the secrets the game still works perfectly in solo mode — the class-code field simply plays locally.

---

## Trailer Mode

Open the browser console and run:
```javascript
Trailer.start()
```
Records a 30-second automated cinematic sequence. Use OBS Studio to capture.

---

## Tech Stack

- **Three.js r128** — 3D rendering, procedural textures, shadows
- **Web Audio API** — Generative per-zone soundtrack, zero audio files
- **HTML5 Canvas** — Minimap, facade textures, floating reward text, tutorial arrows
- **Vanilla JS** — No framework, no build step, one file

---

## The Company

Sovereign City is a product of **Sovereign Shield Technologies LLC**, Ada, Oklahoma.  
Founded by an enrolled Chickasaw citizen building sovereign infrastructure for nations and communities.

*"Pick up enough crumbs, you get a loaf of bread."*

**Halito. Chokma. Yakoke.**

---

## License

Demo build. All rights reserved. Sovereign Shield Technologies LLC © 2026.
