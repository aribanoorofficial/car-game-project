// DOM Elements
const appContainer = document.getElementById('appContainer');
const gameWindow = document.getElementById('gameWindow');
const mainRoad = document.getElementById('mainRoad');
const playerCar = document.getElementById('playerCar');
const environmentLines = document.querySelectorAll('.lane-line, .grass');
const scoreVal = document.getElementById('scoreValue');
const gameOverUI = document.getElementById('gameOverUI');

// Buttons
const btnLeft = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnRace = document.getElementById('btnRace');
const btnRestart = document.getElementById('restartBtn');

const enemyColors = [
    'linear-gradient(180deg, #ff0055, #cc0033)',
    'linear-gradient(180deg, #ffcc00, #dd9900)',
    'linear-gradient(180deg, #cc33ff, #8800ff)',
    'linear-gradient(180deg, #33ff66, #00aa33)'
];

// Game State
let gameState = { isActive: false, score: 0, speed: 6, roadY: 0 };

// Player State (height and width match CSS exactly)
let player = {
    x: 0, width: 44, height: 80, speedLateral: 6, rotation: 0
};

let keys = { left: false, right: false, race: false };
let enemies = [];
let nextEnemySpawn = 0;
let lastFrame = 0;

function initSizes() {
    const roadRect = mainRoad.getBoundingClientRect();

    // Initial horizontal centering
    if (!gameState.isActive) {
        player.x = (roadRect.width / 2) - (player.width / 2);
    }

    updatePlayerTransform();
}

// Input Map
window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') { keys.left = true; btnLeft.classList.add('active'); }
    if (e.key === 'ArrowRight' || e.key === 'd') { keys.right = true; btnRight.classList.add('active'); }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') { keys.race = true; btnRace.classList.add('active'); }
});

window.addEventListener('keyup', (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a') { keys.left = false; btnLeft.classList.remove('active'); }
    if (e.key === 'ArrowRight' || e.key === 'd') { keys.right = false; btnRight.classList.remove('active'); }
    if (e.key === 'ArrowUp' || e.key === 'w' || e.key === ' ') { keys.race = false; btnRace.classList.remove('active'); }
});

// Touch setup
function bindTouch(btn, dirKey) {
    const start = e => { e.preventDefault(); keys[dirKey] = true; btn.classList.add('active'); };
    const end = e => { e.preventDefault(); keys[dirKey] = false; btn.classList.remove('active'); };

    btn.addEventListener('touchstart', start, { passive: false });
    btn.addEventListener('mousedown', start);
    btn.addEventListener('touchend', end);
    btn.addEventListener('mouseup', end);
    btn.addEventListener('mouseleave', end);
}
bindTouch(btnLeft, 'left');
bindTouch(btnRight, 'right');
bindTouch(btnRace, 'race');

function updatePlayerTransform() {
    playerCar.style.left = player.x + 'px';
    // Note: 'bottom' is strictly managed by CSS, no 'top' manipulation is needed!
    playerCar.style.transform = `rotate(${player.rotation}deg)`;
}

function movePlayer() {
    const roadWidth = mainRoad.offsetWidth;
    const maxX = roadWidth - player.width;
    let targetRot = 0;

    if (keys.left && player.x > 0) {
        player.x -= player.speedLateral; targetRot = -10;
    }
    if (keys.right && player.x < maxX) {
        player.x += player.speedLateral; targetRot = 10;
    }

    // Bound Constraints
    if (player.x < 0) player.x = 0;
    if (player.x > maxX) player.x = maxX;

    player.rotation += (targetRot - player.rotation) * 0.2;
    updatePlayerTransform();
}

function animateEnvironment() {
    // Boost speed if holding Race button
    const activeSpeed = keys.race ? gameState.speed * 2 : gameState.speed;

    gameState.roadY += activeSpeed;
    if (gameState.roadY >= 1000) gameState.roadY -= 1000;

    environmentLines.forEach(el => { el.style.backgroundPositionY = gameState.roadY + 'px'; });
    return activeSpeed;
}

function createEnemyDOM(colorBg) {
    const el = document.createElement('div');
    el.className = 'car enemy-car';
    el.style.background = colorBg;
    el.innerHTML = `<div class="car-body"><div class="headlights"></div><div class="windshield"></div><div class="roof"></div><div class="rear-window"></div><div class="taillights"></div></div>`;
    return el;
}

function spawnEnemy(timestamp) {
    const interval = Math.max(700, 1800 - gameState.score * 2);

    if (timestamp > nextEnemySpawn) {
        const el = createEnemyDOM(enemyColors[Math.floor(Math.random() * enemyColors.length)]);
        const maxX = mainRoad.offsetWidth - player.width;
        const rndX = Math.floor(Math.random() * maxX);

        el.style.left = rndX + 'px';
        el.style.top = -player.height + 'px';

        mainRoad.appendChild(el);
        enemies.push({
            el,
            y: -player.height,
            speed: gameState.speed * (0.6 + Math.random() * 0.4)
        });
        nextEnemySpawn = timestamp + interval;
    }
}

// Bounding Box Collision Engine - Extremely Accurate
function checkCollision(enemyEl) {
    const pRect = playerCar.getBoundingClientRect();
    const eRect = enemyEl.getBoundingClientRect();

    // Slight margin forgiveness around hitboxes (approx 15%)
    const mx = pRect.width * 0.15;
    const my = pRect.height * 0.15;

    return (
        pRect.left + mx < eRect.right - mx &&
        pRect.right - mx > eRect.left + mx &&
        pRect.top + my < eRect.bottom - my &&
        pRect.bottom - my > eRect.top + my
    );
}

function moveAndCheckEnemies(activeSpeed) {
    const gameH = gameWindow.offsetHeight;

    for (let i = enemies.length - 1; i >= 0; i--) {
        let e = enemies[i];

        // Enemy speed calculation
        e.y += activeSpeed * 0.3 + e.speed;
        e.el.style.top = e.y + 'px';

        // Check Native Collision
        if (checkCollision(e.el)) {
            crashGame();
            return;
        }

        // Clean up out of bounds
        if (e.y > gameH) {
            e.el.remove();
            enemies.splice(i, 1);

            gameState.score += 15;
            if (gameState.score % 150 === 0) {
                gameState.speed += 0.8;
                player.speedLateral += 0.3;
            }
        }
    }
}

function gameLoop(stamp) {
    if (!gameState.isActive) return;

    if (stamp - lastFrame >= 16) {
        movePlayer();
        const activeSpeed = animateEnvironment();
        spawnEnemy(stamp);
        moveAndCheckEnemies(activeSpeed);

        // Passive scoring
        if (Math.floor(stamp / 100) % 10 === 0 && stamp - lastFrame > 0) {
            gameState.score += keys.race ? 2 : 1;
            scoreVal.innerText = gameState.score;
        }
        lastFrame = stamp;
    }
    requestAnimationFrame(gameLoop);
}

function startGame() {
    gameState = { isActive: true, score: 0, speed: 6, roadY: 0 };
    player.speedLateral = 7;
    player.rotation = 0;

    // Always horizontally center the car dynamically relative to actual loaded road bounds
    player.x = (mainRoad.offsetWidth / 2) - (player.width / 2);
    updatePlayerTransform();

    keys = { left: false, right: false, race: false };

    enemies.forEach(e => e.el.remove());
    enemies = [];

    nextEnemySpawn = performance.now() + 500;
    lastFrame = performance.now();

    scoreVal.innerText = '0';
    gameOverUI.classList.remove('visible');

    initSizes();
    requestAnimationFrame(gameLoop);
}

function crashGame() {
    gameState.isActive = false;
    document.getElementById('finalScoreValue').innerText = gameState.score;
    gameOverUI.classList.add('visible');
    if ("vibrate" in navigator) navigator.vibrate(200);
}

btnRestart.addEventListener('click', startGame);
window.addEventListener('resize', initSizes);

// Initial boot
setTimeout(() => {
    initSizes();
    startGame();
}, 100);
