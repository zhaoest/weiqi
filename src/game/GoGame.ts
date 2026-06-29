import { Position, StoneColor, Intersection, GameState, BoardSize } from './types';

export type MoveRejectReason =
  | 'game_over'
  | 'out_of_bounds'
  | 'occupied'
  | 'ko'
  | 'suicide';

export type MoveResult =
  | { success: true }
  | { success: false; reason: MoveRejectReason };

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

  /**
   * 预置扭十字（PVE教学模式）
   * 2x2 交叉：两黑两白交替
   *   ● ○
   *   ○ ●
   * 孩子执黑，从扭十字局面开始攻防练习
   */
  setupCrossForTeaching(): void {
    const center = Math.floor(this.size / 2);
    const board = this.state.board;

    // 扭十字四子：两黑两白交叉
    board[center][center] = 'black';
    board[center][center + 1] = 'white';
    board[center + 1][center] = 'white';
    board[center + 1][center + 1] = 'black';

    this.state.history = [];
    this.state.currentPlayer = 'black';
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

  /**
   * 在指定棋盘上计算一个棋组的气和棋子
   */
  getGroupOnBoard(board: Intersection[][], pos: Position): { stones: Position[]; liberties: Set<string> } {
    const color = board[pos.row][pos.col];
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
        const nColor = board[neighbor.row][neighbor.col];
        if (nColor === null) {
          liberties.add(nKey);
        } else if (nColor === color && !visited.has(nKey)) {
          stack.push(neighbor);
        }
      }
    }

    return { stones, liberties };
  }

  /**
   * 在当前棋盘上计算棋组（兼容旧接口）
   */
  getGroup(pos: Position): { stones: Position[]; liberties: Set<string> } {
    return this.getGroupOnBoard(this.state.board, pos);
  }

  removeGroup(stones: Position[]): number {
    for (const stone of stones) {
      this.state.board[stone.row][stone.col] = null;
    }
    return stones.length;
  }

  wouldBeSuicide(pos: Position, color: StoneColor): boolean {
    // 模拟落子
    const tempBoard = this.state.board.map(r => [...r]);
    tempBoard[pos.row][pos.col] = color;

    const opponent = color === 'black' ? 'white' : 'black';

    // 先移除对方被提的棋子（关键！）
    for (const neighbor of this.getNeighbors(pos)) {
      if (tempBoard[neighbor.row][neighbor.col] === opponent) {
        const group = this.getGroupOnBoard(tempBoard, neighbor);
        if (group.liberties.size === 0) {
          for (const stone of group.stones) {
            tempBoard[stone.row][stone.col] = null;
          }
        }
      }
    }

    // 然后检查自己有没有气
    const myGroup = this.getGroupOnBoard(tempBoard, pos);
    return myGroup.liberties.size === 0;
  }

  playMove(pos: Position): MoveResult {
    if (this.state.gameOver) return { success: false, reason: 'game_over' };
    if (!this.isInBounds(pos)) return { success: false, reason: 'out_of_bounds' };
    if (this.state.board[pos.row][pos.col] !== null) return { success: false, reason: 'occupied' };

    const color = this.state.currentPlayer;
    const opponent = color === 'black' ? 'white' : 'black';

    if (this.state.koPoint &&
        pos.row === this.state.koPoint.row &&
        pos.col === this.state.koPoint.col) {
      return { success: false, reason: 'ko' };
    }

    // 落子
    this.state.board[pos.row][pos.col] = color;

    // 1. 先检查并移除对方被提的棋子
    let capturedStones: Position[] = [];
    for (const neighbor of this.getNeighbors(pos)) {
      if (this.state.board[neighbor.row][neighbor.col] === opponent) {
        const group = this.getGroup(neighbor);
        if (group.liberties.size === 0) {
          capturedStones.push(...group.stones);
        }
      }
    }

    // 去重（可能同一个棋组被多个邻居检测到）
    const capturedSet = new Set<string>();
    const uniqueCaptured: Position[] = [];
    for (const stone of capturedStones) {
      const key = this.getPositionKey(stone);
      if (!capturedSet.has(key)) {
        capturedSet.add(key);
        uniqueCaptured.push(stone);
      }
    }

    // 2. 移除对方死棋
    const capturedCount = this.removeGroup(uniqueCaptured);

    // 3. 提子后再检查自己的气（关键修复！之前是在提子前检查）
    const myGroup = this.getGroup(pos);
    if (myGroup.liberties.size === 0 && capturedCount === 0) {
      // 真正的自杀：落子后既没提对方，自己也没气
      this.state.board[pos.row][pos.col] = null;
      return { success: false, reason: 'suicide' };
    }

    // 4. 更新提子数
    this.state.captures[color] += capturedCount;

    // 5. 打劫判断：提了对方1子，自己落下的这颗子也只有1口气，且所在的棋组只有1颗子
    if (capturedCount === 1 && myGroup.stones.length === 1 && myGroup.liberties.size === 1) {
      this.state.koPoint = uniqueCaptured[0];
    } else {
      this.state.koPoint = null;
    }

    this.state.passCount = 0;
    this.state.lastMove = pos;
    this.state.currentPlayer = opponent;
    this.state.history.push(`${color} ${pos.row},${pos.col}`);

    // 自动判定: 对方如果没有合法落子点,自动结束
    this.checkAutoEnd();

    return { success: true };
  }

  pass(): void {
    if (this.state.gameOver) return;

    const currentColor = this.state.currentPlayer;

    this.state.passCount++;
    this.state.koPoint = null;
    this.state.lastMove = null;
    this.state.currentPlayer = currentColor === 'black' ? 'white' : 'black';
    this.state.history.push(`${currentColor} pass`);

    if (this.state.passCount >= 2) {
      this.state.gameOver = true;
      return;
    }

    // pass 后对方也可能没棋可下
    this.checkAutoEnd();
  }

  /**
   * 自动判定: 在当前棋盘状态下,如果一方没有合法落子点或分差过大,自动结束
   */
  checkAutoEnd(): void {
    if (this.state.gameOver) return;

    // 1. 检查当前玩家是否有合法落子点
    const currentMoves = this.getValidMoves();
    if (currentMoves.length === 0) {
      // 不能下棋,自动 pass
      this.state.passCount++;
      const whoPassed = this.state.currentPlayer;
      this.state.currentPlayer = whoPassed === 'black' ? 'white' : 'black';
      this.state.history.push(`${whoPassed} pass (auto: no valid moves)`);

      // 两人连续 pass 或对方也不行
      if (this.state.passCount >= 2) {
        this.state.gameOver = true;
        return;
      }

      // 递归检查对方是否也不能下
      this.checkAutoEnd();
      return;
    }

    // 2. 差距过大自动判负: 一方即使吃掉对方所有棋+占满所有空地也赢不了
    const score = this.getScore();
    const totalPoints = this.size * this.size; // 棋盘总点数
    const blackMax = totalPoints; // 黑棋理论最大分数
    const whiteMax = totalPoints + 6.5; // 白棋理论最大分数(含贴目)

    // 如果当前领先方的最小优势已经大于落后方的理论最大值差距
    if (score.black > score.white) {
      // 黑领先,白即使占满所有剩余点也追不上
      const remaining = this.getValidMoves().length;
      const whiteBest = score.white + remaining;
      if (whiteBest < score.black) {
        this.state.gameOver = true;
        this.state.history.push(`game over (auto: black wins decisively)`);
        return;
      }
    } else if (score.white > score.black) {
      // 白领先
      const remaining = this.getValidMoves().length;
      const blackBest = score.black + remaining;
      if (blackBest < score.white) {
        this.state.gameOver = true;
        this.state.history.push(`game over (auto: white wins decisively)`);
        return;
      }
    }
  }

  /**
   * 中国规则计分（数子法）
   * 分数 = 棋盘上的棋子数 + 围住的空地数
   * 白棋贴 6.5 目（贴目）
   */
  getScore(): { black: number; white: number } {
    let blackStones = 0;
    let whiteStones = 0;

    const visited = Array.from({ length: this.size }, () => new Array(this.size).fill(false));

    // 1. 数棋子
    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        const color = this.state.board[r][c];
        if (color === 'black') blackStones++;
        else if (color === 'white') whiteStones++;
      }
    }

    // 2. 数领地（被一方完全围住的空交叉点）
    let blackTerritory = 0;
    let whiteTerritory = 0;

    for (let r = 0; r < this.size; r++) {
      for (let c = 0; c < this.size; c++) {
        if (visited[r][c] || this.state.board[r][c] !== null) continue;

        const territory: Position[] = [];
        const borders = new Set<string>();
        const stack: Position[] = [{ row: r, col: c }];

        while (stack.length > 0) {
          const pos = stack.pop()!;
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

        // 只被一种颜色围住的空地才算领地
        if (borders.size === 1) {
          if (borders.has('black')) blackTerritory += territory.length;
          else whiteTerritory += territory.length;
        }
        // 被两种颜色都相邻的空地是中立区，谁都不算
      }
    }

    // 中国规则：棋子数 + 领地数（不另加提子数，因为提掉的子已经不算在棋盘上了）
    return {
      black: blackStones + blackTerritory,
      white: whiteStones + whiteTerritory + 6.5, // 贴目 6.5
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
