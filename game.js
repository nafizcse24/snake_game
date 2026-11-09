'use strict';

// ══════════════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════════════
const CELL  = 20;        // grid cells
const CS    = 40;        // px per cell (logical resolution)
const SIZE  = CELL * CS; // 800 px
const TICK  = 150;       // ms per game step

// ══════════════════════════════════════════════════════════════
//  CANVAS SETUP
// ══════════════════════════════════════════════════════════════
const canvas = document.getElementById('gameCanvas');
const ctx    = canvas.getContext('2d');
canvas.width  = SIZE;
canvas.height = SIZE;

// ── roundRect polyfill (older Safari / Android WebView) ───────
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
        r = Math.min(r, w / 2, h / 2);
        this.beginPath();
        this.moveTo(x + r, y);
        this.lineTo(x + w - r, y);
        this.arcTo(x + w, y,     x + w, y + r,     r);
        this.lineTo(x + w, y + h - r);
        this.arcTo(x + w, y + h, x + w - r, y + h, r);
        this.lineTo(x + r, y + h);
        this.arcTo(x,     y + h, x,     y + h - r, r);
        this.lineTo(x, y + r);
        this.arcTo(x,     y,     x + r, y,          r);
        this.closePath();
        return this;
    };
}

// ══════════════════════════════════════════════════════════════
//  PRE-RENDERED BACKGROUND
// ══════════════════════════════════════════════════════════════
const bgCanvas = document.createElement('canvas');
bgCanvas.width = bgCanvas.height = SIZE;
(function buildBg() {
    const bx = bgCanvas.getContext('2d');
    for (let r = 0; r < CELL; r++) {
        for (let c = 0; c < CELL; c++) {
            bx.fillStyle = (r + c) % 2 === 0 ? '#2d5a1e' : '#265218';
            bx.fillRect(c * CS, r * CS, CS, CS);
        }
    }
    // subtle grid lines
    bx.strokeStyle = 'rgba(0,0,0,0.12)';
    bx.lineWidth   = 0.5;
    for (let i = 0; i <= CELL; i++) {
        bx.beginPath(); bx.moveTo(i * CS, 0);    bx.lineTo(i * CS, SIZE); bx.stroke();
        bx.beginPath(); bx.moveTo(0, i * CS);    bx.lineTo(SIZE, i * CS); bx.stroke();
    }
})();

// ══════════════════════════════════════════════════════════════
//  HUMAN IMAGE LOADER
// ══════════════════════════════════════════════════════════════
let humanImages = [];

const DEFAULT_IMAGE_LIST = [
    "20261109_193125.jpg",
    "20261109_213141.jpg",
    "20261109_213222.jpg",
    "20261109_213309.jpg",
    "20261109_213348.jpg"
];

/** Clip an <img> into a square canvas with center-crop and circular mask */
function makeCircular(img, size) {
    const c  = document.createElement('canvas');
    c.width  = c.height = size;
    const cx = c.getContext('2d');
    cx.beginPath();
    cx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
    cx.closePath();
    cx.clip();

    // Center crop (cover) to preserve aspect ratio
    const nw = img.naturalWidth  || img.width;
    const nh = img.naturalHeight || img.height;
    const minDim = Math.min(nw, nh);
    const sx = (nw - minDim) / 2;
    const sy = (nh - minDim) / 2;
    cx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
    return c;
}

async function loadHumanImages() {
    let files = DEFAULT_IMAGE_LIST;
    try {
        const res  = await fetch('humans/manifest.json');
        if (res.ok) {
            const data = await res.json();
            const list = Array.isArray(data) ? data : (data.images || []);
            if (list.length) files = list;
        }
    } catch (_) {}

    try {
        const loaded = await Promise.all(
            files.map(f => new Promise(resolve => {
                const img = new Image();
                img.onload  = () => resolve(img);
                img.onerror = () => resolve(null);
                img.src = `humans/${f}`;
            }))
        );
        humanImages = loaded
            .filter(Boolean)
            .map(img => makeCircular(img, CS * 2)); // pre-process once
    } catch (_) { /* silently fall back to drawn apple */ }
}

// ══════════════════════════════════════════════════════════════
//  PARTICLE
// ══════════════════════════════════════════════════════════════
class Particle {
    constructor(x, y) {
        const a = Math.random() * Math.PI * 2;
        const s = 2 + Math.random() * 5;
        this.x  = x; this.y = y;
        this.vx = Math.cos(a) * s;
        this.vy = Math.sin(a) * s;
        this.life    = (18 + Math.random() * 12) | 0;
        this.maxLife = this.life;
        this.r       = (3 + Math.random() * 4)  | 0;
        this.hue     = 20 + (Math.random() * 40) | 0;
    }
    update() {
        this.x  += this.vx; this.y  += this.vy;
        this.vx *= 0.90;    this.vy *= 0.90;
        this.life--;
    }
    draw() {
        const alpha = this.life / this.maxLife;
        const r = Math.max(1, this.r * alpha);
        ctx.save();
        ctx.globalAlpha  = alpha;
        ctx.shadowColor  = `hsl(${this.hue},100%,60%)`;
        ctx.shadowBlur   = r * 3;
        ctx.fillStyle    = `hsl(${this.hue},100%,65%)`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    get alive() { return this.life > 0; }
}

// ══════════════════════════════════════════════════════════════
//  SNAKE
// ══════════════════════════════════════════════════════════════
class Snake {
    constructor() { this.reset(); }

    reset() {
        this.body      = [{x:5,y:10},{x:4,y:10},{x:3,y:10}];
        this.direction = {x:0, y:0};
        this.newBlock  = false;
    }

    move() {
        if (!this.direction.x && !this.direction.y) return;
        const h = this.body[0];
        const newHead = {
            x: (h.x + this.direction.x + CELL) % CELL,
            y: (h.y + this.direction.y + CELL) % CELL,
        };
        if (this.newBlock) {
            this.body = [newHead, ...this.body];
            this.newBlock = false;
        } else {
            this.body = [newHead, ...this.body.slice(0, -1)];
        }
    }

    addBlock() { this.newBlock = true; }

    hitsSelf() {
        const h = this.body[0];
        return this.body.slice(1).some(b => b.x === h.x && b.y === h.y);
    }

    draw() {
        const len = this.body.length;
        // Draw tail → head so head renders on top
        for (let i = len - 1; i >= 0; i--) {
            const seg = this.body[i];
            const px  = seg.x * CS;
            const py  = seg.y * CS;

            // brightness: 1.0 at head, 0.65 at tail
            const t   = 1 - (i / Math.max(len - 1, 1)) * 0.35;
            const green = Math.round(140 + 90 * t);
            const red   = Math.round(30  + 30 * t);

            const PAD = 2, R = 7;

            // ── shadow ──────────────────────────────────────
            ctx.save();
            ctx.shadowColor    = 'rgba(0,0,0,0.45)';
            ctx.shadowBlur     = 8;
            ctx.shadowOffsetX  = 3;
            ctx.shadowOffsetY  = 4;
            ctx.fillStyle      = `rgb(${red},${green},30)`;
            ctx.roundRect(px + PAD, py + PAD, CS - PAD * 2, CS - PAD * 2, R);
            ctx.fill();
            ctx.restore();

            // ── shine highlight ──────────────────────────────
            ctx.save();
            ctx.globalAlpha = 0.22 * t;
            ctx.fillStyle   = 'white';
            ctx.beginPath();
            ctx.ellipse(px + CS * 0.3, py + CS * 0.27, CS * 0.18, CS * 0.10, -0.3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // ── head extras ──────────────────────────────────
            if (i === 0) {
                // green glow halo
                ctx.save();
                ctx.shadowColor = 'rgba(80,230,50,0.7)';
                ctx.shadowBlur  = 24;
                ctx.globalAlpha = 0.0; // just the shadow matters
                ctx.beginPath();
                ctx.arc(px + CS / 2, py + CS / 2, CS / 2 - 2, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();

                this._drawEyes(px, py);
            }
        }
    }

    _drawEyes(px, py) {
        const d = this.direction;
        let e1, e2;
        if      (d.x ===  1) { e1={x:px+CS*0.75,y:py+CS*0.3}; e2={x:px+CS*0.75,y:py+CS*0.7}; }
        else if (d.x === -1) { e1={x:px+CS*0.25,y:py+CS*0.3}; e2={x:px+CS*0.25,y:py+CS*0.7}; }
        else if (d.y === -1) { e1={x:px+CS*0.3, y:py+CS*0.25};e2={x:px+CS*0.7, y:py+CS*0.25};}
        else                 { e1={x:px+CS*0.3, y:py+CS*0.75};e2={x:px+CS*0.7, y:py+CS*0.75};}

        for (const e of [e1, e2]) {
            ctx.fillStyle = 'white';
            ctx.beginPath(); ctx.arc(e.x, e.y, 5, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#111';
            ctx.beginPath(); ctx.arc(e.x + 1, e.y + 1, 2.5, 0, Math.PI * 2); ctx.fill();
        }
    }
}

// ══════════════════════════════════════════════════════════════
//  FRUIT
// ══════════════════════════════════════════════════════════════
class Fruit {
    constructor() {
        this.pulse    = 0;
        this.circImg  = null;
        this.randomize();
    }

    pickImage() {
        this.circImg = humanImages.length
            ? humanImages[Math.floor(Math.random() * humanImages.length)]
            : null;
    }

    randomize() {
        this.x = Math.floor(Math.random() * CELL);
        this.y = Math.floor(Math.random() * CELL);
        this.pickImage();
    }

    draw() {
        this.pulse    = (this.pulse + 0.07) % (Math.PI * 2);
        const scale   = 1 + 0.08 * Math.sin(this.pulse);
        const glowAlp = 0.35 + 0.25 * Math.sin(this.pulse);
        const cx      = this.x * CS + CS / 2;
        const cy      = this.y * CS + CS / 2;
        const r       = CS * 0.48 * scale;

        if (this.circImg) {
            this._drawHuman(cx, cy, r, glowAlp);
        } else {
            this._drawApple(cx, cy, r, glowAlp);
        }
    }

    _drawHuman(cx, cy, r, glowAlp) {
        // golden glow ring
        ctx.save();
        ctx.globalAlpha  = glowAlp;
        ctx.shadowColor  = '#ffd700';
        ctx.shadowBlur   = 22;
        ctx.strokeStyle  = '#ffd700';
        ctx.lineWidth    = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // circular photo
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(this.circImg, cx - r, cy - r, r * 2, r * 2);
        ctx.restore();

        // white border ring
        ctx.save();
        ctx.strokeStyle = 'rgba(255,255,255,0.85)';
        ctx.lineWidth   = 2.5;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    _drawApple(cx, cy, r, glowAlp) {
        // red glow
        ctx.save();
        ctx.globalAlpha = glowAlp;
        ctx.shadowColor = '#ff4444';
        ctx.shadowBlur  = 20;
        ctx.strokeStyle = '#ff4444';
        ctx.lineWidth   = 3;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 5, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        // apple body with radial gradient
        const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        grad.addColorStop(0, '#ff6b6b');
        grad.addColorStop(1, '#c0392b');
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur  = 10;
        ctx.fillStyle   = grad;
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // shine
        ctx.save();
        ctx.globalAlpha = 0.38;
        ctx.fillStyle   = 'white';
        ctx.beginPath();
        ctx.ellipse(cx - r * 0.25, cy - r * 0.28, r * 0.26, r * 0.14, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // stem
        ctx.save();
        ctx.strokeStyle = '#5d4037';
        ctx.lineWidth   = 2.5;
        ctx.lineCap     = 'round';
        ctx.beginPath();
        ctx.moveTo(cx, cy - r);
        ctx.bezierCurveTo(cx, cy - r - 8, cx + 7, cy - r - 11, cx + 9, cy - r - 6);
        ctx.stroke();
        // leaf
        ctx.fillStyle = '#27ae60';
        ctx.beginPath();
        ctx.ellipse(cx + 5, cy - r - 9, 7, 3.5, -0.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

// ══════════════════════════════════════════════════════════════
//  GAME STATE
// ══════════════════════════════════════════════════════════════
let snake     = new Snake();
let fruit     = new Fruit();
let particles = [];
let gameOver  = false;
let goAlpha   = 0;
let scoreAnim = 0;
let started   = false;
let lastTick  = 0;

const getScore = () => snake.body.length - 3;

// ══════════════════════════════════════════════════════════════
//  GAME LOOP
// ══════════════════════════════════════════════════════════════
function gameLoop(ts) {
    if (!gameOver && ts - lastTick >= TICK) {
        lastTick = ts;
        snake.move();
        checkCollision();
        if (snake.hitsSelf()) triggerGameOver();
        particles = particles.filter(p => p.alive);
        particles.forEach(p => p.update());
        if (scoreAnim > 0) scoreAnim = Math.max(0, scoreAnim - 0.08);
    }
    render();
    requestAnimationFrame(gameLoop);
}

function render() {
    ctx.drawImage(bgCanvas, 0, 0);
    drawVignette();
    fruit.draw();
    snake.draw();
    particles.forEach(p => p.draw());
    drawHUD();
    if (gameOver)  drawGameOver();
    if (!started && !gameOver) drawStartPrompt();
}

// ── Vignette ──────────────────────────────────────────────────
function drawVignette() {
    const g = ctx.createRadialGradient(SIZE/2,SIZE/2, SIZE*0.28, SIZE/2,SIZE/2, SIZE*0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.32)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SIZE, SIZE);
}

// ── Score HUD ─────────────────────────────────────────────────
function drawHUD() {
    const score   = getScore();
    const bounce  = Math.abs(Math.sin(scoreAnim * Math.PI)) * 8;
    const fSize   = Math.round(22 + bounce);

    ctx.font = `bold ${fSize}px 'Segoe UI', system-ui, sans-serif`;
    const tw = ctx.measureText(String(score)).width;

    const pad = 10, iR = 13;
    const panW = iR * 2 + 10 + tw + pad * 2;
    const panH = 42;
    const px   = SIZE - panW - 10;
    const py   = SIZE - panH - 10;

    // panel
    ctx.save();
    ctx.globalAlpha = 0.88;
    ctx.fillStyle   = '#0a140a';
    ctx.strokeStyle = '#50b428';
    ctx.lineWidth   = 2;
    ctx.roundRect(px, py, panW, panH, 10);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // apple icon
    const ig = ctx.createRadialGradient(px+pad+iR-3, py+panH/2-3, 2, px+pad+iR, py+panH/2, iR);
    ig.addColorStop(0, '#ff6b6b');
    ig.addColorStop(1, '#c0392b');
    ctx.fillStyle = ig;
    ctx.beginPath(); ctx.arc(px+pad+iR, py+panH/2, iR, 0, Math.PI*2); ctx.fill();

    // score number
    ctx.fillStyle = '#c8ffa0';
    ctx.font      = `bold ${fSize}px 'Segoe UI', system-ui, sans-serif`;
    ctx.fillText(String(score), px + pad + iR*2 + 10, py + panH/2 + fSize/3);
}

// ── Game Over ─────────────────────────────────────────────────
function drawGameOver() {
    goAlpha = Math.min(220, goAlpha + 8);
    ctx.fillStyle = `rgba(0,0,0,${(goAlpha/255).toFixed(2)})`;
    ctx.fillRect(0, 0, SIZE, SIZE);

    if (goAlpha >= 160) {
        ctx.textAlign = 'center';

        ctx.save();
        ctx.font        = 'bold 60px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle   = '#e63c3c';
        ctx.shadowColor = '#ff0000';
        ctx.shadowBlur  = 24;
        ctx.fillText('GAME OVER', SIZE/2, SIZE/2 - 36);
        ctx.restore();

        ctx.font      = '26px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#cccccc';
        ctx.fillText(`Score: ${getScore()}`, SIZE/2, SIZE/2 + 18);

        ctx.font      = '19px "Segoe UI", system-ui, sans-serif';
        ctx.fillStyle = '#999999';
        ctx.fillText('Tap or press any key to restart', SIZE/2, SIZE/2 + 58);

        ctx.textAlign = 'left';
    }
}

// ── Start prompt ──────────────────────────────────────────────
function drawStartPrompt() {
    ctx.save();
    ctx.textAlign   = 'center';
    ctx.font        = 'bold 26px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle   = 'rgba(255,255,255,0.88)';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur  = 12;
    ctx.fillText('Press arrow key or tap to start', SIZE/2, SIZE/2);
    ctx.restore();
}

// ══════════════════════════════════════════════════════════════
//  COLLISION
// ══════════════════════════════════════════════════════════════
function checkCollision() {
    const h = snake.body[0];
    if (h.x === fruit.x && h.y === fruit.y) {
        const cx = fruit.x * CS + CS/2;
        const cy = fruit.y * CS + CS/2;
        for (let i = 0; i < 22; i++) particles.push(new Particle(cx, cy));
        snake.addBlock();
        playEat();
        scoreAnim = 1.0;
        // keep respawning until fruit isn't on snake
        do { fruit.randomize(); }
        while (snake.body.some(b => b.x === fruit.x && b.y === fruit.y));
    }
}

function triggerGameOver() { gameOver = true; goAlpha = 0; }

function restart() {
    snake.reset();
    fruit.randomize();
    particles  = [];
    gameOver   = false;
    goAlpha    = 0;
    scoreAnim  = 0;
    started    = false;
}

// ══════════════════════════════════════════════════════════════
//  SOUND  (Web Audio API — no external file needed)
// ══════════════════════════════════════════════════════════════
let audioCtx;
function playEat() {
    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc  = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.connect(gain); gain.connect(audioCtx.destination);
        osc.frequency.setValueAtTime(600, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(950, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
        osc.start(); osc.stop(audioCtx.currentTime + 0.14);
    } catch (_) {}
}

// ══════════════════════════════════════════════════════════════
//  INPUT — Keyboard
// ══════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' '].includes(e.key))
        e.preventDefault();

    if (gameOver) { restart(); return; }

    const d = snake.direction;
    if (e.key === 'ArrowUp'    && d.y !==  1) { snake.direction = {x:0,  y:-1}; started = true; }
    if (e.key === 'ArrowDown'  && d.y !== -1) { snake.direction = {x:0,  y: 1}; started = true; }
    if (e.key === 'ArrowLeft'  && d.x !==  1) { snake.direction = {x:-1, y: 0}; started = true; }
    if (e.key === 'ArrowRight' && d.x !== -1) { snake.direction = {x: 1, y: 0}; started = true; }
});

// ══════════════════════════════════════════════════════════════
//  INPUT — Touch swipe on canvas
// ══════════════════════════════════════════════════════════════
let touchStart = null;

canvas.addEventListener('touchstart', e => {
    touchStart = {x: e.touches[0].clientX, y: e.touches[0].clientY};
    e.preventDefault();
}, {passive: false});

canvas.addEventListener('touchend', e => {
    if (!touchStart) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    touchStart = null;

    if (gameOver) { restart(); return; }

    const d = snake.direction;
    if (Math.abs(dx) > Math.abs(dy)) {
        if (dx >  20 && d.x !== -1) { snake.direction = {x: 1, y:0}; started = true; }
        if (dx < -20 && d.x !==  1) { snake.direction = {x:-1, y:0}; started = true; }
    } else {
        if (dy >  20 && d.y !== -1) { snake.direction = {x:0, y: 1}; started = true; }
        if (dy < -20 && d.y !==  1) { snake.direction = {x:0, y:-1}; started = true; }
    }
    e.preventDefault();
}, {passive: false});

// ══════════════════════════════════════════════════════════════
//  INPUT — On-screen D-pad
// ══════════════════════════════════════════════════════════════
function dpad(dir) {
    if (gameOver) { restart(); return; }
    const d = snake.direction;
    if (dir === 'up'    && d.y !==  1) { snake.direction = {x:0,  y:-1}; started = true; }
    if (dir === 'down'  && d.y !== -1) { snake.direction = {x:0,  y: 1}; started = true; }
    if (dir === 'left'  && d.x !==  1) { snake.direction = {x:-1, y: 0}; started = true; }
    if (dir === 'right' && d.x !== -1) { snake.direction = {x: 1, y: 0}; started = true; }
}

// attach with touchstart (faster than click on mobile)
['up','down','left','right'].forEach(dir => {
    const btn = document.getElementById(`btn-${dir}`);
    if (!btn) return;
    btn.addEventListener('touchstart', e => { e.preventDefault(); dpad(dir); }, {passive:false});
    btn.addEventListener('click',      ()  => dpad(dir));
});

// ══════════════════════════════════════════════════════════════
//  BOOT
// ══════════════════════════════════════════════════════════════
loadHumanImages().then(() => {
    fruit.pickImage();          // re-pick now that images may be loaded
    requestAnimationFrame(gameLoop);
});
