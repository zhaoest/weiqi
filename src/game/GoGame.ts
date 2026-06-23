import { Position, StoneColor, Intersection, GameState, BoardSize } from './types';

export class GoGame {
  size: BoardSize;
  state: GameState;

  constructor(size: BoardSize = 9) {
    this.size = size;
    this.state = this.createInitialState();
  }

  createInitialState(): GameState {
    const board: Intersection[][] = [];
    for (let i = 0; i < this.size; i++) {
      board.push(new Array(this.size).fill(null));
    }
    return {
      board,
      currentPlayer: 'black',
      captures: { black: 0, white: 0 },
      koPoint: null,
      passCount: 0,
      lastMove: null,
      gameOver: false,
      history: [],
    };
  }

  reset(): void {
    this.state = this.createInitialState();
  }

  getPositionKey(pos: Position): string {
    return `${pos.row},${pos.col}`;
  }

  isInBounds(pos: Position): boolean {
    return pos.row >= 0 && pos.row < this.size && pos.col >= 0 && pos.col < this.size;
  }

  getNeighbors(pos: Position): Position[] {
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
    return dirs
      .map(([dr, dc]) => ({ row: pos.row + dr, col: pos.col + dc }))
      .filter(p => this.isInBounds(p));
  }

  getGroup(pos: Position): { stones: Position[]; liberties: Set<string> } {
    const color = this.state.board[pos.row][pos.col];
    if (!color) return { stones: [], liberties: new Set() };

    const visited = new Set<string>();
    const stones: Position[] = [];
    const liberties = new Set<string>();
    const stack = [pos];

    while (stack.length > 0) {
      const current = stack.pop()!;
      const key = this.getPositionKey(current);
      if (visited.has(key)) continue;
      visited.add(key);

      stones.push(current);
      for (const neighbor of this.getNeighbors(current)) {
        const nKey = this.getPositionKey(neighbor);
        const nColor = this.state.board[neighbor.row][neighbor.col];
        if (nColor === null) {
          liberties.add(nKey);
        } else if (nColor === color && !visited.has(nKey)) {
          stack.push(neighbor);
        }
      }
    }

    return { stones, liberties };
  }

  removeGroup(stones: Position[]): number {
    for (const stone of stones) {
      this.state.board[stone.row][stone.col] = null;
    }
    return stones.length;
  }

  wouldBeSuicide(pos: Position, color: StoneColor): boolean {
    const tempBoard = this.state.board.map(r => [...r]);
    this.state.board[pos.row][pos.col] = color;

    let isSuicide = false;
    const { liberties } = this.getGroup(pos);
    if (liberties.size === 0) {
      const opponent = color === 'black' ? 'white' : 'black';
      let capturesOpponent = false;
      for (const neighbor of this.getNeighbors(pos)) {
        if (this.state.board[neighbor.row][neighbor.col] === opponent) {
          const nGroup = this.getGroup(neighbor);
          if (nGroup.liberties.size === 0) {
            capturesOpponent = true;
            break;
          }
        }
      }
      isSuicide = !capturesOpponent;
    }

    this.state.board = tempBoard;
    return isSuicide;
  }

  playMove(pos: Position): boolean {
    if (this.state.gameOver) return false;
    if (!this.isInBounds(pos)) return false;
    if (this.state.board[pos.row][pos.col] !== null) return false;

    const color = this.state.currentPlayer;
    const opponent = color === 'black' ? 'white' : 'black';

    if (this.state.koPoint &&
        pos.row === this.state.koPoint.row &&
        pos.col === this.state.koPoint.col) {
      return false;
    }

    this.state.board[pos.row][pos.col] = color;

    let capturedStones: Position[] = [];
    for (const neighbor of this.getNeighbors(pos)) {
      if (this.state.board[neighbor.row][neighbor.col] === opponent) {
        const group = this.getGroup(neighbor);
        if (group.liberties.size === 0) {
          capturedStones.push(...group.stones);
        }
      }
    }

    const myGroup = this.getGroup(pos);
    if (myGroup.liberties.size === 0 && capturedStones.length === 0) {
      this.state.board[pos.row][pos.col] = null;
      return false;
    }

    const capturedCount = this.removeGroup(capturedStones);
    this.state.captures[color] += capturedCount;

    if (capturedCount === 1 && myGroup.stones.length === 1 && myGroup.liberties.size === 1) {
      this.state.koPoint = capturedStones[0];
    } else {
      this.state.koPoint = null;
    }

    this.state.passCount = 0;
    this.state.lastMove = pos;
    this.state.currentPlayer = opponent;
    this.state.history.push(`${color} ${pos.row},${pos.col}`);
    return true;
  }

  pass(): void {
    if (this.state.gameOver) return;

    this.state.passCount++;
    this.state.koPoint = null;
    this.state.lastMove = null;
    this.state.currentPlayer = this.state.currentPlayer === 'black' ? 'white' : 'black';
    this.state.history.push(`${this.state.currentPlayer === 'black' ? 'white' : 'black'} pass`);

    if (this.state.passCount >= 2) {
      this.state.gameOver = true;
    }
  }

  getScore(): { black: number; white: number } {
    let blackTerritory = 0;
    let whiteTerritory = 0;
    let blackStones = 0;
    let whiteStones = 0;

    const visited = Array.from({ length: this.size }, () => new Array(this.size).fill(false));

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const color = this.state.board[r][c];
        if (color === 'black') blackStones++;
        else if (color === 'white') whiteStones++;
      }
    }

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (visited[r][c] || this.state.board[r][c] !== null) continue;

        const territory: Position[] = [];
        const borders = new Set<string>();
        const stack: Position[] = [{ row: r, col: c }];

        while (stack.length > 0) {
          const pos = stack.pop()!;
          const key = this.getPositionKey(pos);
          if (visited[pos.row][pos.col]) continue;
          visited[pos.row][pos.col] = true;
          territory.push(pos);

          for (const n of this.getNeighbors(pos)) {
            const nColor = this.state.board[n.row][n.col];
            if (nColor === null && !visited[n.row][n.col]) {
              stack.push(n);
            } else if (nColor !== null) {
              borders.add(nColor);
            }
          }
        }

        if (borders.size === 1) {
          if (borders.has('black')) blackTerritory += territory.length;
          else whiteTerritory += territory.length;
        }
      }
    }

    return {
      black: blackStones + blackTerritory + this.state.captures.black,
      white: whiteStones + whiteTerritory + this.state.captures.white + 6.5,
    };
  }

  getValidMoves(): Position[] {
    const moves: Position[] = [];
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (this.state.board[r][c] === null) {
          const pos = { row: r, col: c };
          if (!this.wouldBeSuicide(pos, this.state.currentPlayer)) {
            if (!(this.state.koPoint &&
                  pos.row === this.state.koPoint.row &&
                  pos.col === this.state.koPoint.col)) {
              moves.push(pos);
            }
          }
        }
      }
    }
    return moves;
  }

  clone(): GoGame {
    const game = new GoGame(this.size);
    game.state = {
      board: this.state.board.map(r => [...r]),
      currentPlayer: this.state.currentPlayer,
      captures: { ...this.state.captures },
      koPoint: this.state.koPoint ? { ...this.state.koPoint } : null,
      passCount: this.state.passCount,
      lastMove: this.state.lastMove ? { ...this.state.lastMove } : null,
      gameOver: this.state.gameOver,
      history: [...this.state.history],
    };
    return game;
  }
}
