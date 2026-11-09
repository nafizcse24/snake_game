# 🐍 Snake – Responsive Web Edition

An exact 1:1 responsive web replica of the classic Pygame snake game, running smoothly in any browser on desktop and mobile.

## 🎮 Controls

| Device | Control |
|---|---|
| **Desktop** | Arrow Keys (Up, Down, Left, Right) |
| **Mobile Touch** | Swipe in any direction OR tap the on-screen D-Pad |

## 📁 Project Structure

```
Snake/
├── index.html          # Web page
├── style.css           # Responsive layout styling
├── game.js             # Exact reference game logic in JavaScript
├── Graphics/           # Exact original sprites
│   ├── apple.png
│   ├── head_up.png / head_down.png / head_left.png / head_right.png
│   ├── tail_up.png / tail_down.png / tail_left.png / tail_right.png
│   ├── body_vertical.png / body_horizontal.png
│   └── body_tl.png / body_tr.png / body_bl.png / body_br.png
├── Sound/
│   └── crunch.wav      # Original crunch audio
└── Font/
    └── PoetsenOne-Regular.ttf # Original font
```

## 🚀 Running Locally

```bash
python3 -m http.server 8080
```
Then visit `http://localhost:8080`.
