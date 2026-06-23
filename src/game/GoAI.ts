import { GoGame } from './GoGame';
import { Position } from './types';

type StoneColor = 'black' | 'white';

export class GoAI {
  getMove(game: GoGame): Position | null {
    const validMoves = game.getValidMoves();
    if (validMoves.length === 0) return null;

    const moveCount = game.state.history.length;

    if (moveCount < 4) {
      const opening = this.getOpeningMove(game, validMoves);
      if (opening) return opening;
    }

    const save = this.findSaveMove(game, validMoves);
    if (save) return save;

    const capture = this.findCaptureMove(game, validMoves);
    if (capture) return capture;

    const prevent = this.findPreventiveDefense(game, validMoves);
    if (prevent) return prevent;

    const attack = this.findAttackMove(game, validMoves);
    if (attack) return attack;

    return this.getStrategicMove(game, validMoves);
  }

  private getOpeningMove(game: GoGame, validMoves: Position[]): Position | null {
    const size = game.size;
    const board = game.state.board;

    const cornerPoints: Position[] = size === 9
      ? [
          { row: 2, col: 2 }, { row: 2, col: 6 },
          { row: 6, col: 2 }, { row: 6, col: 6 },
          { row: 3, col: 2 }, { row: 2, col: 3 },
          { row: 3, col: 6 }, { row: 2, col: 5 },
          { row: 6, col: 3 }, { row: 5, col: 2 },
          { row: 6, col: 5 }, { row: 5, col: 6 },
          { row: 3, col: 3 }, { row: 3, col: 5 },
          { row: 5, col: 3 }, { row: 5, col: 5 },
        ]
      : [
          { row: 3, col: 3 }, { row: 3, col: size - 4 },
          { row: size - 4, col: 3 }, { row: size - 4, col: size - 4 },
        ];

    for (const pt of cornerPoints) {
      if (pt.row < size && pt.col < size && board[pt.row][pt.col] === null) {
        const isValid = validMoves.some(m => m.row === pt.row && m.col === pt.col);
        if (isValid) return pt;
      }
    }

    return null;
  }

  private findSaveMove(game: GoGame, validMoves: Position[]): Position | null {
    const color = game.state.currentPlayer;
    const board = game.state.board;

    let bestSave: { move: Position; priority: number } | null = null;
    for (const move of validMoves) {
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === color) {
          const group = game.getGroup(neighbor);
          if (group.liberties.size === 1) {
            const tempGame = game.clone();
            tempGame.state.board[move.row][move.col] = color;
            const newGroup = tempGame.getGroup(move);
            if (newGroup.liberties.size >= 2) {
              const priority = 300 + group.stones.length * 15 + newGroup.liberties.size * 3;
              if (!bestSave || priority > bestSave.priority) {
                bestSave = { move, priority };
              }
            }
          }
        }
      }
    }
    if (bestSave) return bestSave.move;

    let bestEscape: { move: Position; priority: number } | null = null;
    for (const move of validMoves) {
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === color) {
          const group = game.getGroup(neighbor);
          if (group.liberties.size === 2) {
            const tempGame = game.clone();
            tempGame.state.board[move.row][move.col] = color;
            const newGroup = tempGame.getGroup(move);
            if (newGroup.liberties.size >= 4) {
              const priority = 200 + group.stones.length * 10;
              if (!bestEscape || priority > bestEscape.priority) {
                bestEscape = { move, priority };
              }
            }
          }
        }
      }
    }
    if (bestEscape) return bestEscape.move;

    let bestExpand: { move: Position; priority: number } | null = null;
    for (const move of validMoves) {
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === color) {
          const group = game.getGroup(neighbor);
          if (group.liberties.size === 2) {
            const tempGame = game.clone();
            tempGame.state.board[move.row][move.col] = color;
            const newGroup = tempGame.getGroup(move);
            if (newGroup.liberties.size >= 3) {
              const priority = 150 + group.stones.length * 8 + newGroup.liberties.size * 2;
              if (!bestExpand || priority > bestExpand.priority) {
                bestExpand = { move, priority };
              }
            }
          }
        }
      }
    }
    if (bestExpand) return bestExpand.move;

    return null;
  }

  private findPreventiveDefense(game: GoGame, validMoves: Position[]): Position | null {
    const color = game.state.currentPlayer;
    const opponent = color === 'black' ? 'white' : 'black';
    const board = game.state.board;

    const myGroups: { stones: Position[]; liberties: Set<string> }[] = [];
    const visited = new Set<string>();

    for (let r = 0; r < game.size; r++) {
      for (let c = 0; c < game.size; c++) {
        if (board[r][c] === color) {
          const key = `${r},${c}`;
          if (!visited.has(key)) {
            const group = game.getGroup({ row: r, col: c });
            for (const s of group.stones) {
              visited.add(`${s.row},${s.col}`);
            }
            if (group.liberties.size <= 3) {
              myGroups.push(group);
            }
          }
        }
      }
    }

    if (myGroups.length === 0) return null;

    let bestDefense: { move: Position; priority: number } | null = null;

    for (const group of myGroups) {
      for (const libKey of group.liberties) {
        const [lr, lc] = libKey.split(',').map(Number);
        const libPos = { row: lr, col: lc };
        const isValid = validMoves.some(m => m.row === lr && m.col === lc);
        if (!isValid) continue;

        const simGame = game.clone();
        simGame.state.board[lr][lc] = opponent;
        let wouldReduceTo = Infinity;
        for (const stone of group.stones) {
          const sGroup = simGame.getGroup(stone);
          wouldReduceTo = Math.min(wouldReduceTo, sGroup.liberties.size);
        }

        if (wouldReduceTo <= 1) {
          const blockTemp = game.clone();
          blockTemp.state.board[lr][lc] = color;
          const newGroup = blockTemp.getGroup(libPos);
          if (newGroup.liberties.size >= 2) {
            const priority = 250 + group.stones.length * 12 + newGroup.liberties.size * 3;
            if (!bestDefense || priority > bestDefense.priority) {
              bestDefense = { move: libPos, priority };
            }
          }
        }
      }
    }

    if (bestDefense) return bestDefense.move;

    let bestApproach: { move: Position; priority: number } | null = null;
    for (const group of myGroups) {
      if (group.liberties.size === 3) {
        for (const libKey of group.liberties) {
          const [lr, lc] = libKey.split(',').map(Number);
          const libPos = { row: lr, col: lc };
          const isValid = validMoves.some(m => m.row === lr && m.col === lc);
          if (!isValid) continue;

          const simGame = game.clone();
          simGame.state.board[lr][lc] = opponent;
          let wouldReduceTo = Infinity;
          for (const stone of group.stones) {
            const sGroup = simGame.getGroup(stone);
            wouldReduceTo = Math.min(wouldReduceTo, sGroup.liberties.size);
          }

          if (wouldReduceTo <= 1) {
            const blockTemp = game.clone();
            blockTemp.state.board[lr][lc] = color;
            const newGroup = blockTemp.getGroup(libPos);
            if (newGroup.liberties.size >= 2) {
              const priority = 220 + group.stones.length * 10;
              if (!bestApproach || priority > bestApproach.priority) {
                bestApproach = { move: libPos, priority };
              }
            }
          }
        }
      }
    }

    if (bestApproach) return bestApproach.move;

    return null;
  }

  private findCaptureMove(game: GoGame, validMoves: Position[]): Position | null {
    const color = game.state.currentPlayer;
    const opponent = color === 'black' ? 'white' : 'black';
    const board = game.state.board;

    let bestCapture: { move: Position; priority: number } | null = null;
    for (const move of validMoves) {
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === opponent) {
          const group = game.getGroup(neighbor);
          if (group.liberties.size === 1) {
            const priority = 260 + group.stones.length * 15;
            if (!bestCapture || priority > bestCapture.priority) {
              bestCapture = { move, priority };
            }
          }
        }
      }
    }
    if (bestCapture) return bestCapture.move;

    return null;
  }

  private findAttackMove(game: GoGame, validMoves: Position[]): Position | null {
    const color = game.state.currentPlayer;
    const opponent = color === 'black' ? 'white' : 'black';
    const board = game.state.board;

    let bestChase: { move: Position; priority: number } | null = null;
    for (const move of validMoves) {
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === opponent) {
          const group = game.getGroup(neighbor);
          if (group.liberties.size === 2) {
            const tempGame = game.clone();
            tempGame.state.board[move.row][move.col] = color;
            const newGroup = tempGame.getGroup(neighbor);
            if (newGroup.liberties.size === 1) {
              const priority = 180 + group.stones.length * 10;
              if (!bestChase || priority > bestChase.priority) {
                bestChase = { move, priority };
              }
            }
          }
        }
      }
    }
    if (bestChase) return bestChase.move;

    let bestHane: { move: Position; priority: number } | null = null;
    for (const move of validMoves) {
      let weakOpponentNearby = 0;
      for (const neighbor of game.getNeighbors(move)) {
        if (board[neighbor.row][neighbor.col] === opponent) {
          const group = game.getGroup(neighbor);
          if (group.liberties.size <= 2) {
            weakOpponentNearby++;
          }
        }
      }
      if (weakOpponentNearby >= 2) {
        const tempGame = game.clone();
        tempGame.state.board[move.row][move.col] = color;
        const myGroup = tempGame.getGroup(move);
        if (myGroup.liberties.size >= 2) {
          const priority = 100 + weakOpponentNearby * 20;
          if (!bestHane || priority > bestHane.priority) {
            bestHane = { move, priority };
          }
        }
      }
    }
    if (bestHane) return bestHane.move;

    return null;
  }

  private getStrategicMove(game: GoGame, validMoves: Position[]): Position {
    const color = game.state.currentPlayer;
    const opponent = color === 'black' ? 'white' : 'black';
    const board = game.state.board;
    const size = game.size;
    const moveCount = game.state.history.length;

    const scored = validMoves.map(move => {
      let score = 0;

      const tempGame = game.clone();
      tempGame.state.board[move.row][move.col] = color;
      const myGroup = tempGame.getGroup(move);
      const myLiberties = myGroup.liberties.size;

      if (myLiberties <= 1) return { move, score: -300 };

      score += myLiberties * 5;

      score += this.getPositionalScore(game, move, moveCount);

      score += this.getConnectionScore(game, move, color);

      score += this.getAttackScore(game, move, color, opponent);

      score += (Math.random() - 0.5) * 2;

      return { move, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].move;
  }

  private getPositionalScore(game: GoGame, move: Position, moveCount: number): number {
    const size = game.size;
    let score = 0;

    const isLine1 = move.row === 0 || move.row === size - 1 || move.col === 0 || move.col === size - 1;
    const isLine2 = move.row === 1 || move.row === size - 2 || move.col === 1 || move.col === size - 2;
    const isCorner = (move.row <= 2 && move.col <= 2) ||
                     (move.row <= 2 && move.col >= size - 3) ||
                     (move.row >= size - 3 && move.col <= 2) ||
                     (move.row >= size - 3 && move.col >= size - 3);

    if (isLine1) {
      score -= 20;
    } else if (isLine2) {
      score -= 5;
    }

    if (moveCount < 15) {
      if (isCorner && !isLine1) score += 8;
      const center = (size - 1) / 2;
      const dist = Math.abs(move.row - center) + Math.abs(move.col - center);
      score += Math.max(0, (size - dist)) * 1;
    } else {
      if (isCorner && !isLine1) score += 5;
    }

    return score;
  }

  private getConnectionScore(game: GoGame, move: Position, color: StoneColor): number {
    let score = 0;
    let friendlyNeighbors = 0;

    for (const neighbor of game.getNeighbors(move)) {
      if (game.state.board[neighbor.row][neighbor.col] === color) {
        friendlyNeighbors++;
        const group = game.getGroup(neighbor);
        if (group.liberties.size <= 2) {
          score += 10;
        }
      }
    }

    if (friendlyNeighbors === 1) {
      score += 3;
    } else if (friendlyNeighbors >= 2) {
      score += 6;
    }

    if (friendlyNeighbors >= 3) {
      score -= 3;
    }

    return score;
  }

  private getAttackScore(game: GoGame, move: Position, color: StoneColor, opponent: StoneColor): number {
    let score = 0;
    const board = game.state.board;

    let emptyNeighbors = 0;
    let opponentNeighbors = 0;
    let opponentWeakCount = 0;

    for (const neighbor of game.getNeighbors(move)) {
      const nColor = board[neighbor.row][neighbor.col];
      if (nColor === null) {
        emptyNeighbors++;
      } else if (nColor === opponent) {
        opponentNeighbors++;
        const group = game.getGroup(neighbor);
        if (group.liberties.size <= 2) {
          opponentWeakCount++;
          score += 8;
        }
      }
    }

    score += emptyNeighbors * 2;

    if (opponentNeighbors >= 3) {
      score -= 10;
    }

    if (opponentWeakCount >= 2) {
      score += 6;
    }

    return score;
  }
}
