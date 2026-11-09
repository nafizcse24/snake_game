'use strict';

// ══════════════════════════════════════════════════════════════
//  EXACT REPLICA OF REFERENCE SNAKE GAME
// ══════════════════════════════════════════════════════════════
const cell_size   = 40;
const cell_number = 20;
const screen_size = cell_size * cell_number; // 800 x 800

const canvas = document.getElementById('gameCanvas');
const screen = canvas.getContext('2d');
canvas.width  = screen_size;
canvas.height = screen_size;

// ── Images & Audio ───────────────────────────────────────────
const images = {};
const imageFiles = [
    'head_up', 'head_down', 'head_right', 'head_left',
    'tail_up', 'tail_down', 'tail_right', 'tail_left',
    'body_vertical', 'body_horizontal',
    'body_tr', 'body_tl', 'body_br', 'body_bl',
    'apple'
];

function loadImages() {
    return Promise.all(imageFiles.map(name => new Promise(resolve => {
        const img = new Image();
        img.onload = () => { images[name] = img; resolve(); };
        img.onerror = () => { resolve(); };
        img.src = `Graphics/${name}.png`;
    })));
}

const crunchSound = new Audio('Sound/crunch.wav');
crunchSound.preload = 'auto';

let audioUnlocked = false;
function playCrunchSound() {
    try {
        crunchSound.currentTime = 0;
        crunchSound.play().catch(() => {});
    } catch (_) {}
}

function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    crunchSound.play().then(() => {
        crunchSound.pause();
        crunchSound.currentTime = 0;
    }).catch(() => {});
}

// ── Pre-rendered Grass ───────────────────────────────────────
const grassCanvas = document.createElement('canvas');
grassCanvas.width = screen_size;
grassCanvas.height = screen_size;
function renderGrass() {
    const g = grassCanvas.getContext('2d');
    // Base fill: (175, 215, 70)
    g.fillStyle = 'rgb(175, 215, 70)';
    g.fillRect(0, 0, screen_size, screen_size);

    // Checker tiles: (167, 209, 61)
    g.fillStyle = 'rgb(167, 209, 61)';
    for (let row = 0; row < cell_number; row++) {
        if (row % 2 === 0) {
            for (let col = 0; col < cell_number; col += 2) {
                g.fillRect(col * cell_size, row * cell_size, cell_size, cell_size);
            }
        } else {
            for (let col = 1; col < cell_number; col += 2) {
                g.fillRect(col * cell_size, row * cell_size, cell_size, cell_size);
            }
        }
    }
}
renderGrass();

// ── SNAKE Class ──────────────────────────────────────────────
class SNAKE {
    constructor() {
        this.reset();
    }

    reset() {
        this.body = [
            { x: 5, y: 10 },
            { x: 4, y: 10 },
            { x: 3, y: 10 }
        ];
        this.direction = { x: 0, y: 0 };
        this.new_block = false;
        this.head = images.head_right;
        this.tail = images.tail_left;
    }

    draw_snake() {
        this.update_head_graphics();
        this.update_tail_graphics();

        for (let index = 0; index < this.body.length; index++) {
            const block = this.body[index];
            const x_pos = block.x * cell_size;
            const y_pos = block.y * cell_size;

            if (index === 0) {
                if (this.head) screen.drawImage(this.head, x_pos, y_pos, cell_size, cell_size);
            } else if (index === this.body.length - 1) {
                if (this.tail) screen.drawImage(this.tail, x_pos, y_pos, cell_size, cell_size);
            } else {
                const previous_block = {
                    x: this.body[index + 1].x - block.x,
                    y: this.body[index + 1].y - block.y
                };
                const next_block = {
                    x: this.body[index - 1].x - block.x,
                    y: this.body[index - 1].y - block.y
                };

                if (previous_block.x === next_block.x) {
                    if (images.body_vertical) screen.drawImage(images.body_vertical, x_pos, y_pos, cell_size, cell_size);
                } else if (previous_block.y === next_block.y) {
                    if (images.body_horizontal) screen.drawImage(images.body_horizontal, x_pos, y_pos, cell_size, cell_size);
                } else {
                    if ((previous_block.x === -1 && next_block.y === -1) || (previous_block.y === -1 && next_block.x === -1)) {
                        if (images.body_tl) screen.drawImage(images.body_tl, x_pos, y_pos, cell_size, cell_size);
                    } else if ((previous_block.x === -1 && next_block.y === 1) || (previous_block.y === 1 && next_block.x === -1)) {
                        if (images.body_bl) screen.drawImage(images.body_bl, x_pos, y_pos, cell_size, cell_size);
                    } else if ((previous_block.x === 1 && next_block.y === -1) || (previous_block.y === -1 && next_block.x === 1)) {
                        if (images.body_tr) screen.drawImage(images.body_tr, x_pos, y_pos, cell_size, cell_size);
                    } else if ((previous_block.x === 1 && next_block.y === 1) || (previous_block.y === 1 && next_block.x === 1)) {
                        if (images.body_br) screen.drawImage(images.body_br, x_pos, y_pos, cell_size, cell_size);
                    }
                }
            }
        }
    }

    update_head_graphics() {
        if (this.body.length < 2) return;
        const head_relation = {
            x: this.body[1].x - this.body[0].x,
            y: this.body[1].y - this.body[0].y
        };

        if      (head_relation.x ===  1 && head_relation.y ===  0) this.head = images.head_left;
        else if (head_relation.x === -1 && head_relation.y ===  0) this.head = images.head_right;
        else if (head_relation.x ===  0 && head_relation.y ===  1) this.head = images.head_up;
        else if (head_relation.x ===  0 && head_relation.y === -1) this.head = images.head_down;
    }

    update_tail_graphics() {
        if (this.body.length < 2) return;
        const tail_relation = {
            x: this.body[this.body.length - 2].x - this.body[this.body.length - 1].x,
            y: this.body[this.body.length - 2].y - this.body[this.body.length - 1].y
        };

        if      (tail_relation.x ===  1 && tail_relation.y ===  0) this.tail = images.tail_left;
        else if (tail_relation.x === -1 && tail_relation.y ===  0) this.tail = images.tail_right;
        else if (tail_relation.x ===  0 && tail_relation.y ===  1) this.tail = images.tail_up;
        else if (tail_relation.x ===  0 && tail_relation.y === -1) this.tail = images.tail_down;
    }

    move_snake() {
        if (this.direction.x === 0 && this.direction.y === 0) return;

        if (this.new_block) {
            const new_head = {
                x: this.body[0].x + this.direction.x,
                y: this.body[0].y + this.direction.y
            };
            this.body.unshift(new_head);
            this.new_block = false;
        } else {
            const new_head = {
                x: this.body[0].x + this.direction.x,
                y: this.body[0].y + this.direction.y
            };
            this.body.pop();
            this.body.unshift(new_head);
        }
    }

    add_block() {
        this.new_block = true;
    }

    play_crunch_sound() {
        playCrunchSound();
    }
}

// ── FRUIT Class ──────────────────────────────────────────────
class FRUIT {
    constructor() {
        this.pos = { x: 0, y: 0 };
        this.randomize();
    }

    draw_fruit() {
        if (images.apple) {
            screen.drawImage(images.apple, this.pos.x * cell_size, this.pos.y * cell_size, cell_size, cell_size);
        }
    }

    randomize() {
        this.x = Math.floor(Math.random() * cell_number);
        this.y = Math.floor(Math.random() * cell_number);
        this.pos = { x: this.x, y: this.y };
    }
}

// ── MAIN Class ───────────────────────────────────────────────
class MAIN {
    constructor() {
        this.snake = new SNAKE();
        this.fruit = new FRUIT();
    }

    update() {
        this.snake.move_snake();
        this.check_collision();
        this.check_fail();
    }

    draw_elements() {
        this.draw_grass();
        this.fruit.draw_fruit();
        this.snake.draw_snake();
        this.draw_score();
    }

    check_collision() {
        if (this.fruit.pos.x === this.snake.body[0].x && this.fruit.pos.y === this.snake.body[0].y) {
            this.fruit.randomize();
            this.snake.add_block();
            this.snake.play_crunch_sound();
        }

        for (let i = 1; i < this.snake.body.length; i++) {
            if (this.snake.body[i].x === this.fruit.pos.x && this.snake.body[i].y === this.fruit.pos.y) {
                this.fruit.randomize();
            }
        }
    }

    check_fail() {
        const head = this.snake.body[0];
        if (head.x < 0 || head.x >= cell_number || head.y < 0 || head.y >= cell_number) {
            this.game_over();
            return;
        }

        for (let i = 1; i < this.snake.body.length; i++) {
            if (this.snake.body[i].x === head.x && this.snake.body[i].y === head.y) {
                this.game_over();
                return;
            }
        }
    }

    game_over() {
        this.snake.reset();
    }

    draw_grass() {
        screen.drawImage(grassCanvas, 0, 0);
    }

    draw_score() {
        const score_text = String(this.snake.body.length - 3);

        screen.font = "25px PoetsenOne, sans-serif";
        screen.textBaseline = 'middle';
        screen.textAlign = 'center';

        const text_metrics = screen.measureText(score_text);
        const text_width = text_metrics.width;

        const score_x = Math.floor(cell_size * cell_number - 60);
        const score_y = Math.floor(cell_size * cell_number - 40);

        const apple_width = 40;
        const apple_height = 40;

        // In reference:
        // score_rect = score_surface.get_rect(center = (score_x, score_y))
        // apple_rect = apple.get_rect(midright = (score_rect.left, score_rect.centery))
        // bg_rect = pygame.Rect(apple_rect.left, apple_rect.top, apple_rect.width + score_rect.width + 6, apple_rect.height)
        const score_left = score_x - text_width / 2;
        const apple_left = score_left - apple_width;
        const apple_top  = score_y - apple_height / 2;
        const bg_left    = apple_left;
        const bg_top     = apple_top;
        const bg_width   = apple_width + text_width + 6;
        const bg_height  = apple_height;

        // pygame.draw.rect(screen, (167, 209, 61), bg_rect)
        screen.fillStyle = 'rgb(167, 209, 61)';
        screen.fillRect(bg_left, bg_top, bg_width, bg_height);

        // screen.blit(apple, apple_rect)
        if (images.apple) {
            screen.drawImage(images.apple, apple_left, apple_top, apple_width, apple_height);
        }

        // screen.blit(score_surface, score_rect)
        screen.fillStyle = 'rgb(56, 74, 12)';
        screen.fillText(score_text, score_x, score_y);

        // pygame.draw.rect(screen, (56, 74, 12), bg_rect, 2)
        screen.strokeStyle = 'rgb(56, 74, 12)';
        screen.lineWidth = 2;
        screen.strokeRect(bg_left, bg_top, bg_width, bg_height);
    }
}

// ── Loop & Initialization ────────────────────────────────────
let main_game = null;
let lastUpdate = 0;
const SCREEN_UPDATE_INTERVAL = 150; // 150ms pygame timer

function animate(currentTime) {
    if (currentTime - lastUpdate >= SCREEN_UPDATE_INTERVAL) {
        lastUpdate = currentTime;
        main_game.update();
    }

    // screen.fill((175, 215, 70)) and main_game.draw_elements()
    main_game.draw_elements();

    requestAnimationFrame(animate);
}

// ── Controls: Keyboard + Mobile Swipe + D-Pad ────────────────
document.addEventListener('keydown', e => {
    unlockAudio();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
    }

    if (e.key === 'ArrowUp') {
        if (main_game.snake.direction.y !== 1) {
            main_game.snake.direction = { x: 0, y: -1 };
        }
    }
    if (e.key === 'ArrowRight') {
        if (main_game.snake.direction.x !== -1) {
            main_game.snake.direction = { x: 1, y: 0 };
        }
    }
    if (e.key === 'ArrowDown') {
        if (main_game.snake.direction.y !== -1) {
            main_game.snake.direction = { x: 0, y: 1 };
        }
    }
    if (e.key === 'ArrowLeft') {
        if (main_game.snake.direction.x !== 1) {
            main_game.snake.direction = { x: -1, y: 0 };
        }
    }
});

// Mobile Touch Swipe
let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', e => {
    unlockAudio();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    e.preventDefault();
}, { passive: false });

canvas.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    const dy = e.changedTouches[0].clientY - touchStartY;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);

    if (Math.max(absX, absY) > 20) {
        if (absX > absY) {
            if (dx > 0 && main_game.snake.direction.x !== -1) {
                main_game.snake.direction = { x: 1, y: 0 };
            } else if (dx < 0 && main_game.snake.direction.x !== 1) {
                main_game.snake.direction = { x: -1, y: 0 };
            }
        } else {
            if (dy > 0 && main_game.snake.direction.y !== -1) {
                main_game.snake.direction = { x: 0, y: 1 };
            } else if (dy < 0 && main_game.snake.direction.y !== 1) {
                main_game.snake.direction = { x: 0, y: -1 };
            }
        }
    }
    e.preventDefault();
}, { passive: false });

// Mobile D-Pad Buttons
function handleDpad(dir) {
    unlockAudio();
    if (dir === 'up' && main_game.snake.direction.y !== 1) {
        main_game.snake.direction = { x: 0, y: -1 };
    } else if (dir === 'right' && main_game.snake.direction.x !== -1) {
        main_game.snake.direction = { x: 1, y: 0 };
    } else if (dir === 'down' && main_game.snake.direction.y !== -1) {
        main_game.snake.direction = { x: 0, y: 1 };
    } else if (dir === 'left' && main_game.snake.direction.x !== 1) {
        main_game.snake.direction = { x: -1, y: 0 };
    }
}

['up', 'right', 'down', 'left'].forEach(dir => {
    const btn = document.getElementById(`btn-${dir}`);
    if (btn) {
        btn.addEventListener('touchstart', e => { e.preventDefault(); handleDpad(dir); }, { passive: false });
        btn.addEventListener('click', () => handleDpad(dir));
    }
});

// ── Bootstrap ────────────────────────────────────────────────
loadImages().then(() => {
    main_game = new MAIN();
    requestAnimationFrame(animate);
});
