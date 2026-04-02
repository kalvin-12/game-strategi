/**
 * Hex Conquer - Strategi Offline
 * Main Game Logic
 */

const CONFIG = {
    GRID_ROWS: 12,
    GRID_COLS: 8,
    HEX_SIZE: 25, // Will be calculated based on screen size
    COLORS: {
        NEUTRAL: '#bdc3c7',
        PLAYER: '#e74c3c',
        ENEMY: '#2ecc71',
        SELECTED: '#f1c40f',
        ADJACENT: 'rgba(241, 196, 15, 0.3)',
        GRID: '#ddd'
    },
    COSTS: {
        CAPTURE: 8, // Reduced from 10 to make it faster
        UPGRADE: 4  // Reduced from 5
    },
    GOLD_PER_TILE: 1, // Base income per tile
    BASE_INCOME: 5,   // Guaranteed base income
    STARTING_GOLD: 15,
    DIFFICULTIES: {
        easy: { maxActions: 2, incomeMult: 0.8, startStrength: 3 },
        medium: { maxActions: 3, incomeMult: 1.0, startStrength: 5 },
        hard: { maxActions: 5, incomeMult: 1.5, startStrength: 8 }
    }
};

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.header = document.getElementById('game-header');
        this.controls = document.getElementById('game-controls');
        
        this.playerGoldSpan = document.getElementById('player-gold');
        this.playerTerritorySpan = document.getElementById('player-territory');
        this.enemyGoldSpan = document.getElementById('enemy-gold');
        this.enemyTerritorySpan = document.getElementById('enemy-territory');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.tileInfo = document.getElementById('tile-info');
        this.endTurnBtn = document.getElementById('end-turn-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.modal = document.getElementById('game-over-modal');
        this.tutorialModal = document.getElementById('tutorial-modal');
        this.startGameBtn = document.getElementById('start-game-btn');
        this.aiThinkingUI = document.getElementById('ai-thinking');

        this.grid = [];
        this.currentPlayer = 0; // 0: Player, 1: AI
        this.gold = [CONFIG.STARTING_GOLD, CONFIG.STARTING_GOLD];
        this.selectedTile = null;
        this.gameOver = false;
        this.gameStarted = false;
        this.floatingTexts = [];
        this.difficulty = 'medium';

        this.audioCtx = null;
        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupGrid();
        this.setupEventListeners();
        
        // Only give starting resources if it's a new game (not loaded)
        if (!localStorage.getItem('hex_conquer_save')) {
            this.processResources(0);
        }
        
        this.updateUI();
        this.startLoop();
    }

    initAudio() {
        if (!this.audioCtx) {
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    }

    playSFX(type) {
        if (!this.audioCtx) return;
        
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        
        const now = this.audioCtx.currentTime;
        
        switch(type) {
            case 'capture':
                osc.type = 'triangle';
                osc.frequency.setValueAtTime(440, now);
                osc.frequency.exponentialRampToValueAtTime(880, now + 0.1);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.1);
                osc.start(now);
                osc.stop(now + 0.1);
                break;
            case 'upgrade':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(660, now);
                osc.frequency.exponentialRampToValueAtTime(1320, now + 0.2);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
            case 'income':
                osc.type = 'sine';
                osc.frequency.setValueAtTime(880, now);
                osc.frequency.exponentialRampToValueAtTime(1760, now + 0.05);
                gain.gain.setValueAtTime(0.05, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
                osc.start(now);
                osc.stop(now + 0.05);
                break;
            case 'fail':
                osc.type = 'sawtooth';
                osc.frequency.setValueAtTime(220, now);
                osc.frequency.exponentialRampToValueAtTime(110, now + 0.2);
                gain.gain.setValueAtTime(0.1, now);
                gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
                osc.start(now);
                osc.stop(now + 0.2);
                break;
        }
    }

    startLoop() {
        const loop = () => {
            this.update();
            this.draw();
            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }

    update() {
        // Update floating texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            const ft = this.floatingTexts[i];
            ft.y -= 1;
            ft.life -= 0.02;
            if (ft.life <= 0) this.floatingTexts.splice(i, 1);
        }
    }

    addFloatingText(text, x, y, color = 'white') {
        this.floatingTexts.push({ text, x, y, color, life: 1 });
    }

    resize() {
        const container = document.getElementById('game-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight - this.header.offsetHeight - this.controls.offsetHeight;
        
        // Calculate hex size to fit the screen (width or height, whichever is smaller)
        const hexWidthNeeded = this.canvas.width / (CONFIG.GRID_COLS + 0.5);
        const hexHeightNeeded = this.canvas.height / (CONFIG.GRID_ROWS * 0.75 + 0.25);
        
        // Size based on width
        const sizeByWidth = hexWidthNeeded / Math.sqrt(3);
        // Size based on height
        const sizeByHeight = hexHeightNeeded / 2;
        
        // Use the smaller of the two to ensure it fits both ways
        this.hexSize = Math.min(sizeByWidth, sizeByHeight) * 0.95;
        this.hexHeight = 2 * this.hexSize;
        this.rowHeight = this.hexHeight * 0.75;
        
        if (this.grid.length > 0) this.draw();
    }

    setupGrid() {
        this.grid = [];
        for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
            this.grid[r] = [];
            for (let c = 0; c < CONFIG.GRID_COLS; c++) {
                this.grid[r][c] = {
                    r, c,
                    owner: null, // null, 0, 1
                    strength: 1,
                    type: Math.random() < 0.1 ? 'mine' : 'land'
                };
            }
        }

        // Start positions at opposite corners
        this.grid[0][0].owner = 1; 
        this.grid[0][0].strength = 5;
        this.grid[CONFIG.GRID_ROWS - 1][CONFIG.GRID_COLS - 1].owner = 0;
        this.grid[CONFIG.GRID_ROWS - 1][CONFIG.GRID_COLS - 1].strength = 5;
        
        this.loadGame(); // Try to load saved game
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => {
            this.initAudio();
            this.handleCanvasClick(e);
        });
        
        // Add touch support for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            this.initAudio();
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent("click", {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        }, { passive: false });

        this.endTurnBtn.addEventListener('click', () => {
            this.initAudio();
            this.endTurn();
        });
        this.restartBtn.addEventListener('click', () => {
            this.initAudio();
            this.restart();
        });
        this.startGameBtn.addEventListener('click', () => {
            this.initAudio();
            const selectedDiff = document.querySelector('input[name="difficulty"]:checked');
            if (selectedDiff) {
                this.difficulty = selectedDiff.value;
                this.applyDifficulty();
            }
            this.tutorialModal.classList.add('hidden');
            this.gameStarted = true;
        });
    }

    applyDifficulty() {
        const diffSettings = CONFIG.DIFFICULTIES[this.difficulty];
        // Apply start strength to base tiles
        this.grid[0][0].strength = diffSettings.startStrength;
        this.grid[CONFIG.GRID_ROWS - 1][CONFIG.GRID_COLS - 1].strength = 5; // Player stays same
    }

    handleCanvasClick(e) {
        if (!this.gameStarted || this.currentPlayer !== 0 || this.gameOver) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Find which hex was clicked
        let closestHex = null;
        let minDist = Infinity;

        for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
            for (let c = 0; c < CONFIG.GRID_COLS; c++) {
                const { px, py } = this.getHexCenter(r, c);
                const dist = Math.hypot(x - px, y - py);
                if (dist < minDist && dist < this.hexSize * 0.9) {
                    minDist = dist;
                    closestHex = this.grid[r][c];
                }
            }
        }

        if (closestHex) {
            this.onTileSelect(closestHex.r, closestHex.c);
        }
    }

    getHexCenter(r, c) {
        const xOffset = (r % 2 === 0) ? 0 : (Math.sqrt(3) * this.hexSize) / 2;
        const px = c * (Math.sqrt(3) * this.hexSize) + xOffset + (Math.sqrt(3) * this.hexSize) / 2;
        const py = r * this.rowHeight + this.hexSize;
        return { px, py };
    }

    onTileSelect(r, c) {
        const tile = this.grid[r][c];
        
        // If we select a tile we already selected, try to action it
        if (this.selectedTile && this.selectedTile.r === r && this.selectedTile.c === c) {
            this.tryAction(tile);
        } else {
            this.selectedTile = tile;
            this.updateTileInfo(tile);
        }
        
        this.draw();
    }

    tryAction(tile) {
        // If it's player's tile, upgrade it
        if (tile.owner === 0) {
            if (this.gold[0] >= CONFIG.COSTS.UPGRADE && tile.strength < 10) {
                this.gold[0] -= CONFIG.COSTS.UPGRADE;
                tile.strength++;
                this.tileInfo.textContent = `Petak diperkuat! (Kekuatan: ${tile.strength})`;
                this.playSFX('upgrade');
            } else if (tile.strength >= 10) {
                this.tileInfo.textContent = "Pertahanan sudah maksimal!";
                this.playSFX('fail');
            } else {
                this.tileInfo.textContent = "Emas tidak cukup untuk memperkuat!";
                this.playSFX('fail');
            }
        } 
        // If it's adjacent and neutral/enemy, capture it
        else {
            if (this.isAdjacentToPlayer(tile.r, tile.c)) {
                if (this.gold[0] >= CONFIG.COSTS.CAPTURE) {
                    this.gold[0] -= CONFIG.COSTS.CAPTURE;
                    
                    const playerStrength = this.getAdjacentPlayerStrength(tile.r, tile.c);
                    const diff = playerStrength - tile.strength;
                    const { px, py } = this.getHexCenter(tile.r, tile.c);
                    
                    if (tile.owner === null || diff >= 0) {
                        // Success - capture it
                        tile.owner = 0;
                        tile.strength = Math.max(1, Math.floor(diff / 2) + 1);
                        this.tileInfo.textContent = "Wilayah dikuasai!";
                        this.addFloatingText("⚔️ MENANG!", px, py, 'gold');
                        this.playSFX('capture');
                    } else {
                        // Failure - defender loses some strength based on the attack
                        const damage = Math.max(1, Math.floor(playerStrength / 2));
                        tile.strength -= damage;
                        this.tileInfo.textContent = `Serangan gagal! Pertahanan musuh berkurang ${damage}.`;
                        this.addFloatingText(`⚔️ -${damage}`, px, py, 'red');
                        this.playSFX('fail');
                    }
                } else {
                    this.tileInfo.textContent = "Emas tidak cukup untuk menyerang!";
                    this.playSFX('fail');
                }
            } else {
                this.tileInfo.textContent = "Hanya bisa menyerang petak yang bersebelahan!";
                this.playSFX('fail');
            }
        }
        
        this.updateUI();
        this.checkWinCondition();
    }

    getNeighbors(r, c) {
        const neighbors = [];
        const possible = [
            [r, c-1], [r, c+1] // horizontal
        ];
        
        if (r % 2 === 0) {
            // even row
            possible.push([r-1, c], [r-1, c-1], [r+1, c], [r+1, c-1]);
        } else {
            // odd row
            possible.push([r-1, c], [r-1, c+1], [r+1, c], [r+1, c+1]);
        }

        possible.forEach(([nr, nc]) => {
            if (nr >= 0 && nr < CONFIG.GRID_ROWS && nc >= 0 && nc < CONFIG.GRID_COLS) {
                neighbors.push(this.grid[nr][nc]);
            }
        });
        return neighbors;
    }

    isAdjacent(r1, c1, r2, c2) {
        const neighbors = this.getNeighbors(r1, c1);
        return neighbors.some(n => n.r === r2 && n.c === c2);
    }

    isAdjacentToPlayer(r, c) {
        return this.getNeighbors(r, c).some(n => n.owner === 0);
    }

    getAdjacentPlayerStrength(r, c) {
        let maxStr = 0;
        this.getNeighbors(r, c).forEach(n => {
            if (n.owner === 0) {
                maxStr = Math.max(maxStr, n.strength);
            }
        });
        return maxStr;
    }

    getAdjacentAIStrength(r, c) {
        let maxStr = 0;
        this.getNeighbors(r, c).forEach(n => {
            if (n.owner === 1) {
                maxStr = Math.max(maxStr, n.strength);
            }
        });
        return maxStr;
    }

    updateTileInfo(tile) {
        let ownerText = tile.owner === null ? "Netral" : (tile.owner === 0 ? "Anda" : "Lawan");
        let typeText = tile.type === 'mine' ? "Tambang Emas (+5 emas/giliran)" : "Tanah Biasa";
        this.tileInfo.textContent = `[${ownerText}] ${typeText} | Kekuatan: ${tile.strength}`;
    }

    updateUI() {
        this.playerGoldSpan.textContent = Math.floor(this.gold[0]);
        this.enemyGoldSpan.textContent = Math.floor(this.gold[1]);
        
        const playerTerritory = this.grid.flat().filter(t => t.owner === 0).length;
        const enemyTerritory = this.grid.flat().filter(t => t.owner === 1).length;
        
        this.playerTerritorySpan.textContent = playerTerritory;
        this.enemyTerritorySpan.textContent = enemyTerritory;

        if (this.currentPlayer === 0) {
            this.turnIndicator.textContent = "Giliran Anda";
            this.turnIndicator.classList.remove('enemy-turn');
            this.endTurnBtn.disabled = false;
        } else {
            this.turnIndicator.textContent = "Giliran Lawan...";
            this.turnIndicator.classList.add('enemy-turn');
            this.endTurnBtn.disabled = true;
        }
    }

    endTurn() {
        if (this.currentPlayer !== 0 || this.gameOver) return;
        
        this.currentPlayer = 1;
        this.selectedTile = null;
        this.updateUI();
        
        // Delay AI move for better feel
        setTimeout(() => this.aiMove(), 800);
    }

    processResources(playerIdx) {
        let income = CONFIG.BASE_INCOME;
        this.grid.flat().forEach(tile => {
            if (tile.owner === playerIdx) {
                income += CONFIG.GOLD_PER_TILE;
                if (tile.type === 'mine') income += 5;
            }
        });
        
        // Difficulty multiplier for AI
        if (playerIdx === 1) {
            const mult = CONFIG.DIFFICULTIES[this.difficulty].incomeMult;
            income = Math.floor(income * mult);
        }

        this.gold[playerIdx] += income;
        this.playSFX('income');
        
        // Show income as floating text
        const targetTile = this.grid.flat().find(t => t.owner === playerIdx);
        if (targetTile) {
            const { px, py } = this.getHexCenter(targetTile.r, targetTile.c);
            this.addFloatingText(`+${income} 💰`, px, py, playerIdx === 0 ? 'gold' : 'green');
        }
    }

    aiMove() {
        if (this.gameOver) return;
        
        this.aiThinkingUI.classList.remove('hidden');
        
        // AI gets income at start of its turn
        this.processResources(1);

        const diffSettings = CONFIG.DIFFICULTIES[this.difficulty];
        const maxActions = diffSettings.maxActions;
        let actions = 0;

        const owned = [];
        const expandable = [];

        for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
            for (let c = 0; c < CONFIG.GRID_COLS; c++) {
                const tile = this.grid[r][c];
                if (tile.owner === 1) {
                    owned.push(tile);
                } else if (this.isAdjacentToAI(r, c)) {
                    expandable.push(tile);
                }
            }
        }

        // Expansion phase
        while (this.gold[1] >= CONFIG.COSTS.CAPTURE && expandable.length > 0 && actions < maxActions) {
            expandable.sort((a, b) => {
                const aVal = (a.type === 'mine' ? 8 : 0) + (a.owner === 0 ? 5 : 0) + (a.owner === null ? 2 : 0);
                const bVal = (b.type === 'mine' ? 8 : 0) + (b.owner === 0 ? 5 : 0) + (b.owner === null ? 2 : 0);
                return bVal - aVal;
            });

            const target = expandable.shift();
            const aiStrength = this.getAdjacentAIStrength(target.r, target.c);
            
            this.gold[1] -= CONFIG.COSTS.CAPTURE;
            actions++;
            
            if (target.owner === null || aiStrength >= target.strength) {
                const diff = aiStrength - (target.strength || 0);
                target.owner = 1;
                target.strength = Math.max(1, Math.floor(diff / 2) + 1);
                owned.push(target);
                
                const neighbors = this.getNeighbors(target.r, target.c);
                neighbors.forEach(n => {
                    if (n.owner !== 1 && !expandable.includes(n)) {
                        expandable.push(n);
                    }
                });
            } else {
                target.strength -= Math.max(1, Math.floor(aiStrength / 2));
            }
        }

        // Upgrade phase
        while (this.gold[1] >= CONFIG.COSTS.UPGRADE && actions < maxActions + 2) {
            const weakest = owned.filter(t => t.strength < (this.difficulty === 'hard' ? 10 : 6))
                                .sort((a, b) => a.strength - b.strength)[0];
            if (!weakest) break;
            this.gold[1] -= CONFIG.COSTS.UPGRADE;
            weakest.strength++;
            actions++;
        }

        setTimeout(() => {
            this.aiThinkingUI.classList.add('hidden');
            this.checkWinCondition();
            
            if (!this.gameOver) {
                this.currentPlayer = 0;
                this.processResources(0); // Player gets gold at start of their turn
                this.updateUI();
            }
        }, 1000);
    }

    isAdjacentToAI(r, c) {
        return this.getNeighbors(r, c).some(n => n.owner === 1);
    }

    checkWinCondition() {
        const tiles = this.grid.flat();
        const playerTiles = tiles.filter(t => t.owner === 0).length;
        const aiTiles = tiles.filter(t => t.owner === 1).length;
        const totalTiles = tiles.length;

        if (playerTiles === 0) {
            this.showGameOver("Anda Kalah!", "AI telah menguasai seluruh wilayah.");
        } else if (aiTiles === 0) {
            this.showGameOver("Anda Menang!", "Anda telah menguasai seluruh wilayah!");
        } else if (playerTiles + aiTiles === totalTiles) {
            if (playerTiles > aiTiles) {
                this.showGameOver("Anda Menang!", `Anda menguasai ${playerTiles} petak vs AI ${aiTiles} petak.`);
            } else {
                this.showGameOver("Anda Kalah!", `AI menguasai ${aiTiles} petak vs Anda ${playerTiles} petak.`);
            }
        }
    }

    showGameOver(title, message) {
        this.gameOver = true;
        document.getElementById('game-over-title').textContent = title;
        document.getElementById('game-over-message').textContent = message;
        this.modal.classList.remove('hidden');
    }

    restart() {
        localStorage.removeItem('hex_conquer_save');
        this.gold = [CONFIG.STARTING_GOLD, CONFIG.STARTING_GOLD];
        this.currentPlayer = 0;
        this.gameOver = false;
        this.selectedTile = null;
        this.modal.classList.add('hidden');
        this.setupGrid();
        this.processResources(0); // Give resources for new game
        this.updateUI();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
            for (let c = 0; c < CONFIG.GRID_COLS; c++) {
                const tile = this.grid[r][c];
                const { px, py } = this.getHexCenter(r, c);

                // Fill color based on owner
                let color = CONFIG.COLORS.NEUTRAL;
                if (tile.owner === 0) color = CONFIG.COLORS.PLAYER;
                else if (tile.owner === 1) color = CONFIG.COLORS.ENEMY;

                // Selection highlight
                if (this.selectedTile && this.selectedTile.r === r && this.selectedTile.c === c) {
                    color = CONFIG.COLORS.SELECTED;
                } else if (this.selectedTile && this.isAdjacent(this.selectedTile.r, this.selectedTile.c, r, c)) {
                    if (this.selectedTile.owner === 0 && tile.owner !== 0) {
                        color = CONFIG.COLORS.ADJACENT;
                    }
                }

                this.drawHex(px, py, this.hexSize * 0.95, color);

                // Draw Mine icon
                if (tile.type === 'mine') {
                    this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    this.ctx.font = `${this.hexSize * 0.6}px Arial`;
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText('💰', px, py + 5);
                }

                // Draw Strength
                this.ctx.fillStyle = 'white';
                this.ctx.font = `bold ${this.hexSize * 0.5}px Arial`;
                this.ctx.textAlign = 'center';
                this.ctx.fillText(tile.strength, px, py + this.hexSize * 0.6);
            }
        }
        
        // Draw floating texts
        this.floatingTexts.forEach(ft => {
            this.ctx.fillStyle = `rgba(${ft.color === 'gold' ? '255, 215, 0' : (ft.color === 'red' ? '255, 0, 0' : '255, 255, 255')}, ${ft.life})`;
            this.ctx.font = `bold ${this.hexSize * 0.5}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.fillText(ft.text, ft.x, ft.y);
        });
        
        this.saveGame(); // Auto-save after each draw/action
    }

    drawHex(x, y, size, color) {
        this.ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (Math.PI / 180) * (60 * i - 30);
            const px = x + size * Math.cos(angle);
            const py = y + size * Math.sin(angle);
            if (i === 0) this.ctx.moveTo(px, py);
            else this.ctx.lineTo(px, py);
        }
        this.ctx.closePath();
        this.ctx.fillStyle = color;
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(0,0,0,0.1)';
        this.ctx.stroke();
    }

    saveGame() {
        const gameState = {
            grid: this.grid,
            gold: this.gold,
            currentPlayer: this.currentPlayer,
            gameOver: this.gameOver,
            difficulty: this.difficulty
        };
        localStorage.setItem('hex_conquer_save', JSON.stringify(gameState));
    }

    loadGame() {
        const saved = localStorage.getItem('hex_conquer_save');
        if (saved) {
            try {
                const state = JSON.parse(saved);
                this.grid = state.grid;
                this.gold = state.gold;
                this.currentPlayer = state.currentPlayer;
                this.gameOver = state.gameOver;
                this.difficulty = state.difficulty || 'medium';
                this.gameStarted = true;
                this.tutorialModal.classList.add('hidden');
                this.updateUI();
            } catch (e) {
                console.error("Failed to load game", e);
            }
        }
    }
}

// Start game
window.addEventListener('load', () => {
    new Game();
});
