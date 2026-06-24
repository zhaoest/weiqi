import { GoGame } from './GoGame';
import { Position } from './types';

type StoneColor = 'black' | 'white';

/**
 * 陪孩子下棋的入门级 AI
 * 
 * 设计理念:
 * - 防守第一,先保住自己的棋
 * - 只吃明显的死子,不做复杂追击
 * - 给孩子学习机会,不下太凶的棋
 * - 按照入门教学的基本棋理
 * - 棋形稳健,避免下出"狗屎棋"
 */
export class GoAI {
  // 随机种子,控制"让棋"概率
  private randomThreshold = 0.12;

  getMove(game: GoGame): Position | null {
    const validMoves = game.getValidMoves();
    if (validMoves.length === 0) return null;

    const moveCount = game.state.history.length;
    
    // 开局阶段 - 优先占角
    if (moveCount < 6) {
      const opening = this.getOpeningMove(game, validMoves);
      if (opening) return opening;
    }

    // 第一优先级: 救自己的棋 (防守)
    const save = this.findSaveMove(game, validMoves);
    if (save) return save;

    // 第二优先级: 吃掉明显的死子 (稳健进攻)
    const capture = this.findSimpleCapture(game, validMoves);
    if (capture) return capture;

    // 第三优先级: 防守自己危险的棋 (预防性防守)
    const defend = this.findDefensiveMove(game, validMoves);
    if (defend) return defend;

    // 第四优先级: 下出稳健的好棋 (不给孩子太大压力)
    const safe = this.getSafeMove(game, validMoves);
    if (safe) return safe;

    // 最后: 随机选择 (给机会)
    return this.getRandomMove(game, validMoves);
  }

  /**
   * 开局占角
   * 入门教学: 先占角,再建边
   */
  private getOpeningMove(game: GoGame, validMoves: Position[]): Position | null {
    const size = game.size;
    const board = game.state.board;

    // 角部优先点
    const cornerPoints: Position[] = size === 9
      ? [
          // 星位 (角部中心)
          { row: 2, col: 2 }, { row: 2, col: 6 },
          { row: 6, col: 2 }, { row: 6, col: 6 },
          // 三三 (角部角落)
          { row: 1, col: 1 }, { row: 1, col: 7 },
          { row: 7, col: 1 }, { row: 7, col: 7 },
          // 小目的邻位
          { row: 2, col: 1 }, { row: 2, col: 7 },
          { row: 6, col: 1 }, { row: 6, col: 7 },
          { row: 1, col: 2 }, { row: 1, col: 6 },
          { row: 7, col: 2 }, { row: 7, col: 6 },
        ]
      : [
          // 13×13 和 19×19 的星位和三三
          { row: 3, col: 3 }, { row: 3, col: size - 4 },
          { row: size - 4, col: 3 }, { row: size - 4, col: size - 4 },
          { row: 2, col: 2 }, { row: 2, col: size - 3 },
          { row: size - 3, col: 2 }, { row: size - 3, col: size - 3 },
        ];

    // 按优先级选择
    for (const pt of cornerPoints) {
      if (pt.row < size && pt.col < size && board[pt.row][pt.col] === null) {
        const isValid = validMoves.some(m => m.row === pt.row && m.col === pt.col);
        if (isValid) return pt;
      }
    }

    return null;
  }

  /**
   * 救自己的棋
   * 入门教学: 先保住自己的棋,别被吃掉
   */
  private findSaveMove(game: GoGame, validMoves: Position[]): Position | null {
    const color = game.state.currentPlayer;
    const board = game.state.board;

    // 1. 救只剩1口气的棋 (紧急!)
    for (const move of validMoves) {
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === color) {
          const group = game.getGroup(neighbor);
          if (group.liberties.size === 1) {
            // 模拟落子后,这颗棋至少有2口气
            const tempGame = game.clone();
            tempGame.state.board[move.row][move.col] = color;
            const newGroup = tempGame.getGroup(move);
            if (newGroup.liberties.size >= 2) {
              return move;
            }
          }
        }
      }
    }

    // 2. 救只剩2口气的大龙 (优先救子多的)
    let bestEscape: { move: Position; stoneCount: number; gain: number } | null = null;
    for (const move of validMoves) {
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === color) {
          const group = game.getGroup(neighbor);
          if (group.liberties.size === 2) {
            const tempGame = game.clone();
            tempGame.state.board[move.row][move.col] = color;
            const newGroup = tempGame.getGroup(move);
            // 落子后至少要有4口气才算好棋
            if (newGroup.liberties.size >= 4) {
              const gain = newGroup.liberties.size - group.liberties.size;
              const stoneCount = group.stones.length;
              if (!bestEscape || 
                  stoneCount > bestEscape.stoneCount || 
                  (stoneCount === bestEscape.stoneCount && gain > bestEscape.gain)) {
                bestEscape = { move, stoneCount, gain };
              }
            }
          }
        }
      }
    }
    if (bestEscape) return bestEscape.move;

    // 3. 救只剩2口气但扩气效果一般的棋 (降低优先级,可能让孩子吃掉)
    let weakEscape: { move: Position; stoneCount: number } | null = null;
    for (const move of validMoves) {
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === color) {
          const group = game.getGroup(neighbor);
          if (group.liberties.size === 2) {
            const tempGame = game.clone();
            tempGame.state.board[move.row][move.col] = color;
            const newGroup = tempGame.getGroup(move);
            // 扩到3口气也算可以
            if (newGroup.liberties.size >= 3) {
              if (!weakEscape || group.stones.length > weakEscape.stoneCount) {
                weakEscape = { move, stoneCount: group.stones.length };
              }
            }
          }
        }
      }
    }
    // 只有棋子数>=3时才救,否则让孩子有机会吃
    if (weakEscape && weakEscape.stoneCount >= 3) {
      return weakEscape.move;
    }

    return null;
  }

  /**
   * 吃掉明显的死子
   * 入门教学: 吃棋的时候要数清楚气
   */
  private findSimpleCapture(game: GoGame, validMoves: Position[]): Position | null {
    const color = game.state.currentPlayer;
    const opponent = color === 'black' ? 'white' : 'black';
    const board = game.state.board;

    // 只吃只剩1口气的棋 (最明显的死子)
    for (const move of validMoves) {
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === opponent) {
          const group = game.getGroup(neighbor);
          // 只打1口气的棋
          if (group.liberties.size === 1) {
            // 落子后自己能活
            const tempGame = game.clone();
            tempGame.state.board[move.row][move.col] = color;
            const myGroup = tempGame.getGroup(move);
            if (myGroup.liberties.size >= 2) {
              return move;
            }
          }
        }
      }
    }

    // 不做追击! 入门阶段不教孩子"追杀"的概念
    return null;
  }

  /**
   * 预防性防守
   * 入门教学: 要看到对手下一步能吃掉自己的棋
   */
  private findDefensiveMove(game: GoGame, validMoves: Position[]): Position | null {
    const color = game.state.currentPlayer;
    const opponent = color === 'black' ? 'white' : 'black';
    const board = game.state.board;

    // 找到自己所有有危险的棋
    const dangerGroups: { group: { stones: Position[]; liberties: Set<string> }; move: Position }[] = [];

    for (let r = 0; r < game.size; r++) {
      for (let c = 0; c < game.size; c++) {
        if (board[r][c] === color) {
          const group = game.getGroup({ row: r, col: c });
          // 3口气以下算危险
          if (group.liberties.size <= 3) {
            // 检查是否能被一步吃掉
            for (const libKey of group.liberties) {
              const [lr, lc] = libKey.split(',').map(Number);
              const libPos = { row: lr, col: lc };
              const isValid = validMoves.some(m => m.row === lr && m.col === lc);
              if (isValid) {
                // 模拟对手在这里落子
                const tempGame = game.clone();
                tempGame.state.board[lr][lc] = opponent;
                // 重新计算这个棋子的气
                let canCapture = true;
                for (const stone of group.stones) {
                  const sGroup = tempGame.getGroup(stone);
                  if (sGroup.liberties.size > 0) {
                    canCapture = false;
                    break;
                  }
                }
                if (canCapture) {
                  dangerGroups.push({ group, move: libPos });
                  break;
                }
              }
            }
          }
        }
      }
    }

    if (dangerGroups.length === 0) return null;

    // 选择最好的防守位置: 优先救大龙
    dangerGroups.sort((a, b) => b.group.stones.length - a.group.stones.length);
    const bestDefense = dangerGroups[0];

    // 模拟落子后自己是否能活
    const tempGame = game.clone();
    tempGame.state.board[bestDefense.move.row][bestDefense.move.col] = color;
    const newGroup = tempGame.getGroup(bestDefense.move);
    if (newGroup.liberties.size >= 2) {
      return bestDefense.move;
    }

    return null;
  }

  /**
   * 下出稳健的好棋
   * 入门教学: 连接自己的棋,拆边扩张地盘
   */
  private getSafeMove(game: GoGame, validMoves: Position[]): Position | null {
    const color = game.state.currentPlayer;
    const board = game.state.board;
    const size = game.size;
    const moveCount = game.state.history.length;

    // 评估每个落点
    const scored = validMoves.map(move => {
      let score = 0;

      // 1. 基础分: 增加自己的气
      const tempGame = game.clone();
      tempGame.state.board[move.row][move.col] = color;
      const myGroup = tempGame.getGroup(move);
      const myLiberties = myGroup.liberties.size;
      
      // 气太少不要下
      if (myLiberties <= 1) return { move, score: -1000 };
      score += myLiberties * 10;

      // 2. 连接己方棋 (入门基础: 不要被断开)
      let friendlyCount = 0;
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === color) {
          friendlyCount++;
          const ng = game.getGroup(neighbor);
          // 连接后让对方的棋气变少
          if (ng.liberties.size <= 2) {
            score += 8;
          }
        }
      }
      // 连接是好棋,但不要堆在一起
      if (friendlyCount === 1) score += 5;
      else if (friendlyCount === 2) score += 3;
      else if (friendlyCount > 2) score -= 5;

      // 3. 位置分数 (入门教学: 角 > 边 > 中腹)
      const posScore = this.getPositionScore(game, move, moveCount);
      score += posScore;

      // 4. 远离危险 (不要往对方棋多的地方凑)
      let danger = 0;
      for (const neighbor of game.getNeighbors(move)) {
        const nColor = board[neighbor.row][neighbor.col];
        if (nColor && nColor !== color) {
          const ng = game.getGroup(neighbor);
          if (ng.liberties.size <= 2) {
            danger += 5;
          }
        }
      }
      score -= danger;

      // 5. 随机加分 (让孩子有机会反击)
      score += (Math.random() - 0.3) * 15;

      return { move, score };
    });

    // 排序,取最高分
    scored.sort((a, b) => b.score - a.score);

    // 过滤掉分数太低的
    const goodMoves = scored.filter(s => s.score > -100);
    if (goodMoves.length > 0) {
      // 取前3个好棋,随机选一个 (增加变化,给孩子机会)
      const topMoves = goodMoves.slice(0, Math.min(3, goodMoves.length));
      return topMoves[Math.floor(Math.random() * topMoves.length)].move;
    }

    return scored[0].move;
  }

  /**
   * 位置分数
   * 入门教学: 角部价值高,边也不错,中腹要最后才下
   */
  private getPositionScore(game: GoGame, move: Position, moveCount: number): number {
    const size = game.size;

    // 远离一二线 (入门基础: 一线没前途)
    const isLine1 = move.row === 0 || move.row === size - 1 || 
                   move.col === 0 || move.col === size - 1;
    const isLine2 = move.row === 1 || move.row === size - 2 || 
                   move.col === 1 || move.col === size - 2;

    if (isLine1) return -30;
    if (isLine2) return -10;

    // 角部加分 (入门核心: 先占角)
    const isCorner = (move.row <= 2 && move.col <= 2) ||
                     (move.row <= 2 && move.col >= size - 3) ||
                     (move.row >= size - 3 && move.col <= 2) ||
                     (move.row >= size - 3 && move.col >= size - 3);
    
    if (isCorner) {
      // 开局占角加分高,中局后降低
      const cornerBonus = moveCount < 20 ? 15 : 8;
      return cornerBonus;
    }

    // 边上加分 (入门: 边比中腹好)
    const isEdge = move.row <= 3 || move.row >= size - 4 || 
                   move.col <= 3 || move.col >= size - 4;
    if (isEdge) {
      return 5;
    }

    return 0;
  }

  /**
   * 随机选择 (最后手段)
   * 增加随机性,给孩子更多机会
   */
  private getRandomMove(game: GoGame, validMoves: Position[]): Position | null {
    if (validMoves.length === 0) return null;
    // 优先选择有气的位置
    const color = game.state.currentPlayer;
    const withLiberties = validMoves.filter(move => {
      const tempGame = game.clone();
      tempGame.state.board[move.row][move.col] = color;
      const group = tempGame.getGroup(move);
      return group.liberties.size >= 2;
    });
    
    const choices = withLiberties.length > 0 ? withLiberties : validMoves;
    return choices[Math.floor(Math.random() * choices.length)];
  }
}
