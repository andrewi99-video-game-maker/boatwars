# Sky Skiff

A 3D hover-boat battle arena. Ten hulls, one shrinking sea, last one floating takes the purse.
Plain JavaScript and Three.js. No build step, no terminal, no server.

## How to play it

Unzip the folder and **double-click `index.html`**. That's the whole setup.

It needs an internet connection the first time so it can pull Three.js from a CDN.
Everything else is in the folder.

Your coins, hulls and fitted guns save automatically in the browser. Same browser, same
progress. "Erase save" in the garage wipes it.

## Putting it on GitHub Pages

I can't publish to your account, but the folder is already set up for it:

1. Make a new repository on github.com
2. Upload everything in this folder — `index.html` has to sit at the top level, not inside another folder
3. Repo **Settings** → **Pages** → Source: **Deploy from a branch** → Branch: **main**, folder: **/ (root)** → Save
4. Wait a minute or two. Your game is at `https://YOURNAME.github.io/REPONAME/`

That link works on your phone, your iPad, and anyone you send it to.

## Controls

| | |
|---|---|
| **W** / **S** | throttle forward and back |
| **A** / **D** | steer |
| **mouse** | look around and aim |
| **Shift** | boost |
| **Space** | fly, if the hull has a flight core |
| **Q** | toggle lock-on |
| **Left click** or **1** | fire hardpoint 1 |
| **Right click** or **2** | fire hardpoint 2 |
| **3** **4** **5** | fire hardpoints 3, 4 and 5 |

Click the canvas once to capture the mouse. Esc gives it back.

On touch: left stick steers, drag the right half of the screen to look, the round buttons
on the right are your triggers — one per fitted gun.

## Hardpoints

Every hull has between 2 and 5 hardpoints. You buy guns separately and fit them to whichever
hardpoint you like, and each hardpoint gets its own trigger. A Leviathan with five guns
fitted means five separate triggers you manage at once.

**Fitting a gun is permanent.** It can never be moved to another hull. You can scrap it for
a quarter of its price to free the hardpoint, but that destroys it. Buy the gun you actually
want for that boat.

## Heat

Hold a trigger and the gun fires until its heat bar fills, then it vents and locks you out
for a second or two. The other guns keep working the whole time. Roughly:

- **Hailstorm, Shrike Pods** — about two seconds of fire, long vent
- **Pulse Repeater, Tack Driver** — three to four seconds, quick vent
- **Rail Lance, Harpoon Rail** — four or five heavy shots, then a pause
- **Basilisk** — two shots, then a very long wait

Let go before the bar fills and it cools with no penalty. Staggering triggers instead of
mashing them all at once is most of the skill.

## Lock-on

Press **Q** and the nearest target to your crosshair gets a reticle. The ring fills as the
lock builds. Once it snaps red, every shot from every gun on board rolls a **90% chance to
hit** — the shot bends to find the target. The 10% that fail visibly miss wide.

Without a lock, bullets are ordinary projectiles with travel time. You have to lead the
target yourself, and arcing guns like the Mortar and Cinder Lobber drop as they fly.

## Coins

Damage dealt is the biggest slice of your payout, so fighting pays far better than hiding.
A quiet last-place run is worth around 150 coins; a winning run with five kills is worth
around 2,400. Cheapest hull is 450, the endgame Sovereign is 9,800.

## Files

```
index.html        the page — this is the one you open
css/style.css     HUD, menu and garage styling
js/catalog.js     all 14 hulls and 24 guns. Change numbers here.
js/physics.js     movement, steering, hover and flight
js/combat.js      hardpoints, heat, lock-on, projectiles
js/render.js      Three.js scene, boat models, water, effects
js/bots.js        enemy AI
js/garage.js      coins, buying, fitting, the save file
js/game.js        the match itself
js/main.js        menus, input, startup
```

Balance lives entirely in `catalog.js`. Change a number, reload the page, play it.
Gun heat is derived from `burstSec` — how many seconds of held trigger you want before it
vents — so you set the feel directly rather than guessing at a heat-per-shot value.

## Notes

- Tested at 10 boats with full loadouts; matches run about 30 to 50 seconds
- Turn rate and `assist` are the two steering knobs. `assist` is how much the boat's momentum
  swings with the bow — raise it for arcade, lower it for heavy and floaty
- There's no server in this version, so the other nine boats are bots
