/**
 * Hex Conquer - Strategi Offline
 * Main Game Logic
 */

const CONFIG = {
    GRID_ROWS: 12,
    GRID_COLS: 8,
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
    STARTING_GOLD: 15
};

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.header = document.getElementById('game-header');
        this.controls = document.getElementById('game-controls');
        
        this.playerGoldSpan = document.getElementById('player-gold');
        this.playerTerritorySpan = document.getElementById('player-territory');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.tileInfo = document.getElementById('tile-info');
        this.endTurnBtn = document.getElementById('end-turn-btn');
        this.restartBtn = document.getElementById('restart-btn');
        this.modal = document.getElementById('game-over-modal');
        this.tutorialModal = document.getElementById('tutorial-modal');
        this.startGameBtn = document.getElementById('start-game-btn');

        this.grid = [];
        this.currentPlayer = 0; // 0: Player, 1: AI
        this.gold = [CONFIG.STARTING_GOLD, CONFIG.STARTING_GOLD];
        this.selectedTile = null;
        this.gameOver = false;
        this.gameStarted = false;

        this.init();
    }

    init() {
        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupGrid();
        this.setupEventListeners();
        
        // Starting resources for the first turn
        this.processResources(0);
        
        this.updateUI();
        this.draw();
    }

    resize() {
        const container = document.getElementById('game-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight - this.header.offsetHeight - this.controls.offsetHeight;
        
        this.tileWidth = this.canvas.width / CONFIG.GRID_COLS;
        this.tileHeight = this.canvas.height / CONFIG.GRID_ROWS;
        
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

        // Start positions
        this.grid[0][0].owner = 1; // AI start top-left
        this.grid[0][0].strength = 5;
        this.grid[CONFIG.GRID_ROWS - 1][CONFIG.GRID_COLS - 1].owner = 0; // Player start bottom-right
        this.grid[CONFIG.GRID_ROWS - 1][CONFIG.GRID_COLS - 1].strength = 5;
    }

    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        // Add touch support for mobile
        this.canvas.addEventListener('touchstart', (e) => {
            e.preventDefault();
            const touch = e.touches[0];
            const mouseEvent = new MouseEvent("click", {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            this.canvas.dispatchEvent(mouseEvent);
        }, { passive: false });

        this.endTurnBtn.addEventListener('click', () => this.endTurn());
        this.restartBtn.addEventListener('click', () => this.restart());
        this.startGameBtn.addEventListener('click', () => {
            this.tutorialModal.classList.add('hidden');
            this.gameStarted = true;
        });
    }

    handleCanvasClick(e) {
        if (!this.gameStarted || this.currentPlayer !== 0 || this.gameOver) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const c = Math.floor(x / this.tileWidth);
        const r = Math.floor(y / this.tileHeight);

        if (r >= 0 && r < CONFIG.GRID_ROWS && c >= 0 && c < CONFIG.GRID_COLS) {
            this.onTileSelect(r, c);
        }
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
            } else if (tile.strength >= 10) {
                this.tileInfo.textContent = "Pertahanan sudah maksimal!";
            } else {
                this.tileInfo.textContent = "Emas tidak cukup untuk memperkuat!";
            }
        } 
        // If it's adjacent and neutral/enemy, capture it
        else {
            if (this.isAdjacentToPlayer(tile.r, tile.c)) {
                if (this.gold[0] >= CONFIG.COSTS.CAPTURE) {
                    this.gold[0] -= CONFIG.COSTS.CAPTURE;
                    
                    const playerStrength = this.getAdjacentPlayerStrength(tile.r, tile.c);
                    const diff = playerStrength - tile.strength;
                    
                    if (tile.owner === null || diff >= 0) {
                        // Success - capture it
                        tile.owner = 0;
                        // Winner keeps half their excess strength, minimum 1
                        tile.strength = Math.max(1, Math.floor(diff / 2) + 1);
                        this.tileInfo.textContent = "Wilayah dikuasai!";
                    } else {
                        // Failure - defender loses some strength based on the attack
                        const damage = Math.max(1, Math.floor(playerStrength / 2));
                        tile.strength -= damage;
                        this.tileInfo.textContent = `Serangan gagal! Pertahanan musuh berkurang ${damage}.`;
                    }
                } else {
                    this.tileInfo.textContent = "Emas tidak cukup untuk menyerang!";
                }
            } else {
                this.tileInfo.textContent = "Hanya bisa menyerang petak yang bersebelahan!";
            }
        }
        
        this.updateUI();
        this.checkWinCondition();
    }

    getAdjacentPlayerStrength(r, c) {
        const neighbors = [[r-1, c], [r+1, c], [r, c-1], [r, c+1]];
        let maxStr = 0;
        neighbors.forEach(([nr, nc]) => {
            if (nr >= 0 && nr < CONFIG.GRID_ROWS && nc >= 0 && nc < CONFIG.GRID_COLS) {
                if (this.grid[nr][nc].owner === 0) {
                    maxStr = Math.max(maxStr, this.grid[nr][nc].strength);
                }
            }
        });
        return maxStr;
    }

    getAdjacentAIStrength(r, c) {
        const neighbors = [[r-1, c], [r+1, c], [r, c-1], [r, c+1]];
        let maxStr = 0;
        neighbors.forEach(([nr, nc]) => {
            if (nr >= 0 && nr < CONFIG.GRID_ROWS && nc >= 0 && nc < CONFIG.GRID_COLS) {
                if (this.grid[nr][nc].owner === 1) {
                    maxStr = Math.max(maxStr, this.grid[nr][nc].strength);
                }
            }
        });
        return maxStr;
    }

    isAdjacent(r1, c1, r2, c2) {
        return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1;
    }

    isAdjacentToPlayer(r, c) {
        const neighbors = [
            [r-1, c], [r+1, c], [r, c-1], [r, c+1]
        ];
        return neighbors.some(([nr, nc]) => {
            return nr >= 0 && nr < CONFIG.GRID_ROWS && nc >= 0 && nc < CONFIG.GRID_COLS &&
                   this.grid[nr][nc].owner === 0;
        });
    }

    updateTileInfo(tile) {
        let ownerText = tile.owner === null ? "Netral" : (tile.owner === 0 ? "Anda" : "Lawan");
        let typeText = tile.type === 'mine' ? "Tambang Emas (+5 emas/giliran)" : "Tanah Biasa";
        this.tileInfo.textContent = `[${ownerText}] ${typeText} | Kekuatan: ${tile.strength}`;
    }

    updateUI() {
        this.playerGoldSpan.textContent = Math.floor(this.gold[0]);
        
        const playerTerritory = this.grid.flat().filter(t => t.owner === 0).length;
        this.playerTerritorySpan.textContent = playerTerritory;

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
        this.gold[playerIdx] += income;
    }

    aiMove() {
        if (this.gameOver) return;
        
        // AI gets income at start of its turn
        this.processResources(1);

        // AI logic remains similar but with balanced pacing
        const expandable = [];
        const owned = [];

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

        // Expansion phase - Limited to 3 actions per turn to not be too aggressive
        let actions = 0;
        const maxActions = 3;
        
        while (this.gold[1] >= CONFIG.COSTS.CAPTURE && expandable.length > 0 && actions < maxActions) {
            // AI logic
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
                
                // Add new neighbors to expandable
                const neighbors = [[target.r-1, target.c], [target.r+1, target.c], [target.r, target.c-1], [target.r, target.c+1]];
                neighbors.forEach(([nr, nc]) => {
                    if (nr >= 0 && nr < CONFIG.GRID_ROWS && nc >= 0 && nc < CONFIG.GRID_COLS) {
                        const nTile = this.grid[nr][nc];
                        if (nTile.owner !== 1 && !expandable.includes(nTile)) {
                            expandable.push(nTile);
                        }
                    }
                });
            } else {
                target.strength -= Math.max(1, Math.floor(aiStrength / 2));
            }
        }

        // Upgrade phase - Only if gold left and not aggressive
        while (this.gold[1] >= CONFIG.COSTS.UPGRADE && actions < 5) {
            const weakest = owned.filter(t => t.strength < 6).sort((a, b) => a.strength - b.strength)[0];
            if (!weakest) break;
            this.gold[1] -= CONFIG.COSTS.UPGRADE;
            weakest.strength++;
            actions++;
        }

        this.draw();
        this.checkWinCondition();
        
        if (!this.gameOver) {
            this.currentPlayer = 0;
            this.processResources(0); // Player gets gold at start of their turn
            this.updateUI();
        }
    }

    isAdjacentToAI(r, c) {
        const neighbors = [[r-1, c], [r+1, c], [r, c-1], [r, c+1]];
        return neighbors.some(([nr, nc]) => {
            return nr >= 0 && nr < CONFIG.GRID_ROWS && nc >= 0 && nc < CONFIG.GRID_COLS &&
                   this.grid[nr][nc].owner === 1;
        });
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
        this.gold = [CONFIG.STARTING_GOLD, CONFIG.STARTING_GOLD];
        this.currentPlayer = 0;
        this.gameOver = false;
        this.selectedTile = null;
        this.modal.classList.add('hidden');
        this.setupGrid();
        this.updateUI();
        this.draw();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        for (let r = 0; r < CONFIG.GRID_ROWS; r++) {
            for (let c = 0; c < CONFIG.GRID_COLS; c++) {
                const tile = this.grid[r][c];
                const x = c * this.tileWidth;
                const y = r * this.tileHeight;

                // Fill color based on owner
                if (tile.owner === 0) this.ctx.fillStyle = CONFIG.COLORS.PLAYER;
                else if (tile.owner === 1) this.ctx.fillStyle = CONFIG.COLORS.ENEMY;
                else this.ctx.fillStyle = CONFIG.COLORS.NEUTRAL;

                // Selection highlight
                if (this.selectedTile && this.selectedTile.r === r && this.selectedTile.c === c) {
                    this.ctx.fillStyle = CONFIG.COLORS.SELECTED;
                } else if (this.selectedTile && this.isAdjacent(this.selectedTile.r, this.selectedTile.c, r, c)) {
                    // Highlight adjacent tiles to the selected one
                    if (this.selectedTile.owner === 0 && this.grid[r][c].owner !== 0) {
                        this.ctx.fillStyle = CONFIG.COLORS.ADJACENT;
                    }
                }

                this.ctx.fillRect(x + 1, y + 1, this.tileWidth - 2, this.tileHeight - 2);

                // Draw Mine icon
                if (tile.type === 'mine') {
                    this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
                    this.ctx.font = '14px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.fillText('💰', x + this.tileWidth/2, y + this.tileHeight/2 + 5);
                }

                // Draw Strength
                this.ctx.fillStyle = 'white';
                this.ctx.font = '10px Arial';
                this.ctx.textAlign = 'right';
                this.ctx.fillText(tile.strength, x + this.tileWidth - 5, y + this.tileHeight - 5);
            }
        }
    }
}

// Start game
window.addEventListener('load', () => {
    new Game();
});
