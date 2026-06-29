import { GoGame } from './GoGame';
import { Position, AILevel } from './types';

type StoneColor = 'black' | 'white';

/**
 * 少儿围棋陪练 AI — 扭十字教法专用
 * 
 * 设计理念:
 * - 棋盘已预置扭十字（两黑两白交叉）
 * - 防守第一：积极救棋、连接、预判威胁
 * - 进攻适中：吃死子、收气压迫，但不深入追杀
 * - 配合教学：紧跟孩子走法，在不远离十字的区域缠斗
 */
export class GoAI {
  private level: AILevel;

  constructor(level: AILevel = 'medium') {
    this.level = level;
  }

  getMove(game: GoGame): Position | null {
    const validMoves = game.getValidMoves();
    if (validMoves.length === 0) return null;

    // === 第一优先级：紧急救棋 (1口气) ===
    const save = this.findEmergencySave(game, validMoves);
    if (save) return save;

    // === 第二优先级：救2口气的弱棋 ===
    const save2 = this.findSave2Liberty(game, validMoves);
    if (save2) return save2;

    // === 第三优先级：吃掉对方死子 ===
    const capture = this.findCapture(game, validMoves);
    if (capture) return capture;

    // === 第四优先级：压迫对方弱棋（进攻性防守） ===
    const pressure = this.findPressureMove(game, validMoves);
    if (pressure) return pressure;

    // === 第五优先级：防守保护 + 连接 + 好形 ===
    const defend = this.findDefenseMove(game, validMoves);
    if (defend) return defend;

    // === 第六优先级：战略走棋 ===
    const strategy = this.findStrategyMove(game, validMoves);
    if (strategy) return strategy;

    // === 兜底 ===
    return this.getSafeFallback(game, validMoves);
  }

  // ============================================================
  //  紧急救棋 (1口气)
  // ============================================================

  /**
   * 救只剩1口气的己方棋（最高优先级）
   * 优先救大棋，优先救后气多
   */
  private findEmergencySave(game: GoGame, validMoves: Position[]): Position | null {
    const color = game.state.currentPlayer;
    const board = game.state.board;

    let bestSave: { move: Position; stoneCount: number; newLiberties: number } | null = null;

    for (const move of validMoves) {
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === color) {
          const group = game.getGroup(neighbor);
          if (group.liberties.size === 1) {
            const tempGame = game.clone();
            tempGame.state.board[move.row][move.col] = color;
            const newGroup = tempGame.getGroup(move);
            if (newGroup.liberties.size >= 2) {
              if (!bestSave || 
                  group.stones.length > bestSave.stoneCount || 
                  (group.stones.length === bestSave.stoneCount && newGroup.liberties.size > bestSave.newLiberties)) {
                bestSave = { move, stoneCount: group.stones.length, newLiberties: newGroup.liberties.size };
              }
            }
          }
        }
      }
    }

    return bestSave?.move ?? null;
  }

  /**
   * 救只剩2口气的己方弱棋
   * 更激进：只要救完后气>=3就救，不管子数
   */
  private findSave2Liberty(game: GoGame, validMoves: Position[]): Position | null {
    const color = game.state.currentPlayer;
    const board = game.state.board;

    const candidates: { move: Position; stoneCount: number; newLiberties: number; isAtari: boolean }[] = [];

    for (const move of validMoves) {
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === color) {
          const group = game.getGroup(neighbor);
          if (group.liberties.size === 2) {
            // 检查如果对手下一步走另一口气会不会打吃我们
            const otherLibs = Array.from(group.liberties);
            const wouldBeAtari = otherLibs.some(lib => {
              const [lr, lc] = lib.split(',').map(Number);
              if (lr === move.row && lc === move.col) return false;
              const tempGame = game.clone();
              const opponent = color === 'black' ? 'white' : 'black';
              tempGame.state.board[lr][lc] = opponent;
              const gAfter = tempGame.getGroup(group.stones[0]);
              return gAfter.liberties.size <= 1;
            });

            const tempGame = game.clone();
            tempGame.state.board[move.row][move.col] = color;
            const newGroup = tempGame.getGroup(move);
            if (newGroup.liberties.size >= 3) {
              candidates.push({
                move,
                stoneCount: group.stones.length,
                newLiberties: newGroup.liberties.size,
                isAtari: wouldBeAtari,
              });
            }
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // 排序：优先救对手可以直接打吃的 > 子多的 > 气多的
    candidates.sort((a, b) => {
      if (a.isAtari !== b.isAtari) return a.isAtari ? -1 : 1;
      if (b.stoneCount !== a.stoneCount) return b.stoneCount - a.stoneCount;
      return b.newLiberties - a.newLiberties;
    });

    return candidates[0].move;
  }

  // ============================================================
  //  吃棋（适度进攻）
  // ============================================================

  /**
   * 吃掉对方死子
   * 优先吃大棋、吃后自己安全
   */
  private findCapture(game: GoGame, validMoves: Position[]): Position | null {
    const color = game.state.currentPlayer;
    const opponent: StoneColor = color === 'black' ? 'white' : 'black';
    const board = game.state.board;

    const captures: { move: Position; captureCount: number; myLiberties: number }[] = [];

    for (const move of validMoves) {
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === opponent) {
          const group = game.getGroup(neighbor);
          if (group.liberties.size === 1) {
            const tempGame = game.clone();
            tempGame.state.board[move.row][move.col] = color;
            const myGroup = tempGame.getGroup(move);
            if (myGroup.liberties.size >= 2) {
              captures.push({
                move,
                captureCount: group.stones.length,
                myLiberties: myGroup.liberties.size,
              });
              break;
            }
          }
        }
      }
    }

    if (captures.length === 0) return null;

    captures.sort((a, b) => {
      if (b.captureCount !== a.captureCount) return b.captureCount - a.captureCount;
      return b.myLiberties - a.myLiberties;
    });

    return captures[0].move;
  }

  /**
   * 压迫对方弱棋：收对方2气子的气，迫使对方防守
   * 这是进攻性防守，不直接吃子但施加压力
   */
  private findPressureMove(game: GoGame, validMoves: Position[]): Position | null {
    const color = game.state.currentPlayer;
    const opponent: StoneColor = color === 'black' ? 'white' : 'black';
    const board = game.state.board;

    const pressures: { move: Position; targetSize: number; myLiberties: number }[] = [];

    for (const move of validMoves) {
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === opponent) {
          const group = game.getGroup(neighbor);
          // 对方2-3口气的棋子，我们收它一口气
          if (group.liberties.size >= 2 && group.liberties.size <= 3) {
            const tempGame = game.clone();
            tempGame.state.board[move.row][move.col] = color;
            const myGroup = tempGame.getGroup(move);
            // 自己必须安全
            if (myGroup.liberties.size >= 3) {
              pressures.push({
                move,
                targetSize: group.stones.length,
                myLiberties: myGroup.liberties.size,
              });
              break;
            }
          }
        }
      }
    }

    if (pressures.length === 0) return null;

    pressures.sort((a, b) => {
      if (b.targetSize !== a.targetSize) return b.targetSize - a.targetSize;
      return b.myLiberties - a.myLiberties;
    });

    return pressures[0].move;
  }

  // ============================================================
  //  防守保护
  // ============================================================

  /**
   * 综合防守评估：预防威胁 + 连接弱棋 + 好形 + 做眼
   */
  private findDefenseMove(game: GoGame, validMoves: Position[]): Position | null {
    const color = game.state.currentPlayer;

    const scored: { move: Position; score: number }[] = [];

    for (const move of validMoves) {
      const tempGame = game.clone();
      tempGame.state.board[move.row][move.col] = color;
      const myGroup = tempGame.getGroup(move);

      if (myGroup.liberties.size <= 1) continue;

      let score = 0;

      // 1. 救2-3口气的弱棋
      score += this.scoreSaveWeakGroups(game, move, color);

      // 2. 预防对手紧气威胁（增强权重）
      score += this.scoreThreatPrevention(game, move, color);

      // 3. 连接己方棋
      score += this.scoreConnection(game, move, color);

      // 4. 好形
      score += this.scoreShape(game, move, color);

      // 5. 做眼空间
      score += this.scoreEyeSpace(game, move, color);

      // 6. 扩展气（防守时气越多越好）
      if (myGroup.liberties.size >= 4) score += 2;
      if (myGroup.liberties.size >= 5) score += 2;

      scored.push({ move, score });
    }

    if (scored.length === 0) return null;

    scored.sort((a, b) => b.score - a.score);
    if (scored[0].score >= 5) {
      return scored[0].move;
    }

    return null;
  }

  /**
   * 连接弱棋加分
   */
  private scoreSaveWeakGroups(game: GoGame, move: Position, color: StoneColor): number {
    const board = game.state.board;
    let score = 0;

    for (const neighbor of game.getNeighbors(move)) {
      if (board[neighbor.row][neighbor.col] === color) {
        const ng = game.getGroup(neighbor);
        if (ng.liberties.size === 2) {
          score += 40 + ng.stones.length * 5;
        } else if (ng.liberties.size === 3) {
          score += 15 + ng.stones.length * 3;
        } else if (ng.liberties.size <= 4) {
          score += 5 + ng.stones.length;
        }
      }
    }

    return score;
  }

  /**
   * 预防对手紧气威胁（增强版）
   */
  private scoreThreatPrevention(game: GoGame, move: Position, color: StoneColor): number {
    const opponent: StoneColor = color === 'black' ? 'white' : 'black';
    const board = game.state.board;
    let score = 0;
    const checkedGroups = new Set<string>();

    for (const neighbor of game.getNeighbors(move)) {
      const nColor = board[neighbor.row][neighbor.col];
      if (nColor === color) {
        const group = game.getGroup(neighbor);
        const groupKey = group.stones.map(s => `${s.row},${s.col}`).sort().join('|');
        if (checkedGroups.has(groupKey)) continue;
        checkedGroups.add(groupKey);

        if (group.liberties.size <= 3) {
          for (const libKey of group.liberties) {
            const [lr, lc] = libKey.split(',').map(Number);
            if (lr === move.row && lc === move.col) continue;

            const tempGame = game.clone();
            tempGame.state.board[lr][lc] = opponent;
            const groupAfter = tempGame.getGroup(group.stones[0]);

            if (groupAfter.liberties.size === 0) {
              // 如果不补，对手下一步可以直接提掉！
              score += 35 + group.stones.length * 6;
            } else if (groupAfter.liberties.size === 1) {
              // 如果不补，会被打吃
              score += 20 + group.stones.length * 3;
            } else if (groupAfter.liberties.size === 2 && opponent === 'black') {
              // 注意：这里本来是检查对手颜色，应该始终检查
              score += 8 + group.stones.length;
            }
          }
        }
      }
    }

    return score;
  }

  /**
   * 连接价值
   */
  private scoreConnection(game: GoGame, move: Position, color: StoneColor): number {
    const board = game.state.board;
    let score = 0;
    const seenGroups = new Set<string>();
    let weakConnections = 0;
    let totalConnections = 0;

    for (const neighbor of game.getNeighbors(move)) {
      if (board[neighbor.row][neighbor.col] === color) {
        const group = game.getGroup(neighbor);
        const key = group.stones.map(s => `${s.row},${s.col}`).sort().join('|');
        if (seenGroups.has(key)) continue;
        seenGroups.add(key);

        totalConnections++;
        if (group.liberties.size <= 3) {
          weakConnections++;
          score += 10 + group.stones.length * 2;
        } else {
          score += 4;
        }
      }
    }

    // 连接两个不同棋组
    if (totalConnections >= 2) score += 8;

    // 对角有己方棋，尖的连接
    const diagonals = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    let diagFriendly = 0;
    for (const [dr, dc] of diagonals) {
      const r = move.row + dr;
      const c = move.col + dc;
      if (r >= 0 && r < game.size && c >= 0 && c < game.size && board[r][c] === color) {
        diagFriendly++;
      }
    }
    if (diagFriendly >= 2) score += 6;
    if (diagFriendly >= 1 && weakConnections >= 1) score += 4;

    return score;
  }

  /**
   * 形状评估
   */
  private scoreShape(game: GoGame, move: Position, color: StoneColor): number {
    const board = game.state.board;
    let score = 0;
    let adjacentFriendly = 0;
    let adjacentEmpty = 0;

    for (const neighbor of game.getNeighbors(move)) {
      const c = board[neighbor.row][neighbor.col];
      if (c === color) adjacentFriendly++;
      else if (c === null) adjacentEmpty++;
    }

    // 虎口检测
    const diagonals = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of diagonals) {
      const r1 = move.row + dr;
      const c1 = move.col + dc;
      const r2 = move.row + dr;
      const c2 = move.col;
      const r3 = move.row;
      const c3 = move.col + dc;

      if (r1 >= 0 && r1 < game.size && c1 >= 0 && c1 < game.size &&
          r2 >= 0 && r2 < game.size && c2 >= 0 && c2 < game.size &&
          r3 >= 0 && r3 < game.size && c3 >= 0 && c3 < game.size) {
        if (board[r1][c1] === color && board[r2][c2] === color) score += 5;
        if (board[r1][c1] === color && board[r3][c3] === color) score += 5;
      }
    }

    // 愚形惩罚
    if (adjacentFriendly >= 3) {
      score -= 10;
    } else if (adjacentFriendly === 2) {
      const tempGame = game.clone();
      tempGame.state.board[move.row][move.col] = color;
      const myGroup = tempGame.getGroup(move);
      if (myGroup.liberties.size <= 2) score -= 5;
    }

    // 舒展形（跳/飞）
    if (adjacentFriendly <= 1 && adjacentEmpty >= 3) {
      const tempGame = game.clone();
      tempGame.state.board[move.row][move.col] = color;
      const myGroup = tempGame.getGroup(move);
      if (myGroup.liberties.size >= 4) score += 4;
    }

    // 拆二、跳的好形
    if (adjacentFriendly === 0 && adjacentEmpty >= 3) {
      // 检查跳（隔一格有己方棋）
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          if (Math.abs(dr) + Math.abs(dc) === 2) continue;
          const r = move.row + dr * 2;
          const c = move.col + dc * 2;
          if (r >= 0 && r < game.size && c >= 0 && c < game.size && board[r][c] === color) {
            score += 3;
          }
        }
      }
    }

    return score;
  }

  /**
   * 做眼空间
   */
  private scoreEyeSpace(game: GoGame, move: Position, color: StoneColor): number {
    const board = game.state.board;
    let score = 0;
    let friendlyInRange = 0;
    let opponentInRange = 0;
    let emptyInRange = 0;

    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = move.row + dr;
        const c = move.col + dc;
        if (r >= 0 && r < game.size && c >= 0 && c < game.size) {
          if (board[r][c] === color) friendlyInRange++;
          else if (board[r][c] !== null) opponentInRange++;
          else emptyInRange++;
        }
      }
    }

    if (friendlyInRange > opponentInRange * 2 && friendlyInRange >= 3) {
      score += 5;
    }

    // 周围空旷，适合扎根
    if (emptyInRange >= 15 && opponentInRange <= 2) {
      score += 3;
    }

    return score;
  }

  // ============================================================
  //  战略走棋
  // ============================================================

  /**
   * 战略走棋：综合评估，选最优发展点
   */
  private findStrategyMove(game: GoGame, validMoves: Position[]): Position | null {
    const color = game.state.currentPlayer;
    const board = game.state.board;
    const size = game.size;
    const center = { row: Math.floor(size / 2), col: Math.floor(size / 2) };

    const scored = validMoves.map(move => {
      let score = 0;

      const tempGame = game.clone();
      tempGame.state.board[move.row][move.col] = color;
      const myGroup = tempGame.getGroup(move);

      // 安全检查
      if (myGroup.liberties.size <= 1) return { move, score: -1000 };

      // === 气数基础分 ===
      score += myGroup.liberties.size * 6;

      // === 靠近十字中心（配合教学，核心加分） ===
      const dist = Math.abs(move.row - center.row) + Math.abs(move.col - center.col);
      if (dist <= 1) score += 10;
      else if (dist <= 2) score += 6;
      else if (dist <= 3) score += 3;

      // === 边线惩罚（大幅增强） ===
      if (move.row === 0 || move.row === size - 1 || move.col === 0 || move.col === size - 1) {
        score -= 40;
      } else if (move.row === 1 || move.row === size - 2 || move.col === 1 || move.col === size - 2) {
        score -= 12;
      }

      // === 连接己方棋 ===
      let friendlyAdjacent = 0;
      let opponentAdjacent = 0;
      let emptyAdjacent = 0;
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === color) {
          friendlyAdjacent++;
        } else if (board[neighbor.row][neighbor.col] === null) {
          emptyAdjacent++;
        } else {
          opponentAdjacent++;
        }
      }

      if (friendlyAdjacent === 1) score += 5;
      else if (friendlyAdjacent === 2) score += 3;

      // === 远离强敌，靠近弱敌 ===
      for (const neighbor of game.getNeighbors(move)) {
        const nColor = board[neighbor.row][neighbor.col];
        if (nColor && nColor !== color) {
          const ng = game.getGroup(neighbor);
          if (ng.liberties.size <= 1 && ng.stones.length >= 2) {
            // 对方快死了，靠近可以收气
            score += 8;
          } else if (ng.liberties.size <= 2 && ng.stones.length >= 3) {
            score -= 10;
          } else if (ng.liberties.size <= 2) {
            score -= 4;
          }
        }
      }

      // === 对角线有己方棋加分（形成好形） ===
      const diagonals = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      let diagCount = 0;
      for (const [dr, dc] of diagonals) {
        const r = move.row + dr;
        const c = move.col + dc;
        if (r >= 0 && r < game.size && c >= 0 && c < game.size && board[r][c] === color) {
          diagCount++;
        }
      }
      if (diagCount >= 2) score += 5;
      else if (diagCount >= 1 && friendlyAdjacent >= 1) score += 3;

      // === 周围己方势力 ===
      let friendlyNearby = 0;
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (dr === 0 && dc === 0) continue;
          const r = move.row + dr;
          const c = move.col + dc;
          if (r >= 0 && r < game.size && c >= 0 && c < game.size && board[r][c] === color) {
            friendlyNearby++;
          }
        }
      }
      score += Math.min(friendlyNearby, 8) * 1;

      // === 轻量随机（保持一定变化性） ===
      if (this.level === 'easy') {
        score += (Math.random() - 0.35) * 8;
      } else {
        score += (Math.random() - 0.5) * 5;
      }

      return { move, score };
    });

    scored.sort((a, b) => b.score - a.score);
    const goodMoves = scored.filter(s => s.score > -100);

    if (goodMoves.length > 0) {
      const topMoves = goodMoves.slice(0, Math.min(3, goodMoves.length));
      return topMoves[Math.floor(Math.random() * topMoves.length)].move;
    }

    return scored.length > 0 ? scored[0].move : null;
  }

  // ============================================================
  //  安全兜底
  // ============================================================

  private getSafeFallback(game: GoGame, validMoves: Position[]): Position | null {
    if (validMoves.length === 0) return null;

    const color = game.state.currentPlayer;
    const size = game.size;
    const center = Math.floor(size / 2);

    const withLiberties = validMoves.filter(move => {
      const tempGame = game.clone();
      tempGame.state.board[move.row][move.col] = color;
      const group = tempGame.getGroup(move);
      return group.liberties.size >= 2;
    });

    const choices = withLiberties.length > 0 ? withLiberties : validMoves;

    // 优先内圈 > 二线 > 边
    const interior = choices.filter(
      m => m.row > 1 && m.row < size - 2 && m.col > 1 && m.col < size - 2
    );
    const secondLine = choices.filter(
      m => m.row === 1 || m.row === size - 2 || m.col === 1 || m.col === size - 2
    );

    let finalChoices: Position[];
    if (interior.length > 0) {
      finalChoices = interior;
    } else if (secondLine.length > 0) {
      finalChoices = secondLine;
    } else {
      finalChoices = choices;
    }

    // 偏向靠近中心
    finalChoices.sort((a, b) => {
      const distA = Math.abs(a.row - center) + Math.abs(a.col - center);
      const distB = Math.abs(b.row - center) + Math.abs(b.col - center);
      return distA - distB;
    });

    const topN = Math.min(5, finalChoices.length);
    return finalChoices[Math.floor(Math.random() * topN)];
  }

}
