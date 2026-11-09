# 🐍 Snake – Web Edition

## Folder Structure

```
web/
├── index.html          ← main game page
├── style.css           ← responsive styles
├── game.js             ← full game logic
└── humans/
    ├── manifest.json   ← list of photo filenames
    ├── alice.jpg
    ├── bob.png
    └── ...
```

## Adding Human Photos

1. Drop your photos (`.jpg`, `.jpeg`, `.png`) into the `humans/` folder.
2. Open `humans/manifest.json` and list each filename:

```json
{
  "images": ["alice.jpg", "bob.png", "charlie.jpeg"]
}
```

3. That's it — the game auto-picks a random face each time the fruit spawns.

## Controls

| Device   | Control |
|----------|---------|
| Desktop  | Arrow keys |
| Mobile   | Swipe on the game area OR tap the D-pad buttons |
| Restart  | Any key / tap after Game Over |

## Hosting Options

### Option A — GitHub Pages (Free, easiest)
1. Push the `web/` folder contents to a GitHub repo.
2. Go to **Settings → Pages → Branch: main → Folder: / (root)**.
3. Your game is live at `https://<username>.github.io/<repo>/`

### Option B — Netlify (Free, drag & drop)
1. Go to [netlify.com](https://netlify.com) → "Add new site" → "Deploy manually".
2. Drag the entire `web/` folder onto the upload area.
3. Done — instant live URL.

### Option C — Vercel (Free)
```bash
npm i -g vercel
cd web/
vercel
```

### Option D — Local (testing)
```bash
cd web/
python3 -m http.server 8080
# open http://localhost:8080
```
> ⚠️ Must use a local server (not `file://`) because `fetch()` is used to load the manifest.
