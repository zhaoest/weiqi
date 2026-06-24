import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Modal, Dimensions } from 'react-native';
import { GoGame } from '../game/GoGame';
import { GoAI } from '../game/GoAI';
import { GoBoard } from '../components/GoBoard';
import { GameMode, BoardSize, AILevel, Position } from '../game/types';

interface GameScreenProps {
  mode: GameMode;
  boardSize: BoardSize;
  aiLevel?: AILevel;
  onBack: () => void;
}

export function GameScreen({ mode, boardSize, aiLevel = 'easy', onBack }: GameScreenProps) {
  const gameRef = useRef(new GoGame(boardSize));
  const aiRef = useRef(new GoAI(aiLevel));
  const [board, setBoard] = useState(gameRef.current.state.board);
  const [currentPlayer, setCurrentPlayer] = useState(gameRef.current.state.currentPlayer);
  const [captures, setCaptures] = useState(gameRef.current.state.captures);
  const [lastMove, setLastMove] = useState<Position | null>(null);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState<{ black: number; white: number } | null>(null);
  const [isAIThinking, setIsAIThinking] = useState(false);
  const [moveCount, setMoveCount] = useState(0);
  const [showResignModal, setShowResignModal] = useState(false);
  const [showBackModal, setShowBackModal] = useState(false);

  const { width, height } = Dimensions.get('window');
  // 应用强制横屏,所以判断宽度是否足够大
  const isSmallScreen = width < 800;

  const updateState = useCallback(() => {
    const game = gameRef.current;
    setBoard(game.state.board.map(r => [...r]));
    setCurrentPlayer(game.state.currentPlayer);
    setCaptures({ ...game.state.captures });
    setLastMove(game.state.lastMove ? { ...game.state.lastMove } : null);
    setGameOver(game.state.gameOver);
    if (game.state.gameOver) {
      setScore(game.getScore());
    }
  }, []);

  const handleAIMove = useCallback(() => {
    if (gameRef.current.state.gameOver) return;
    setIsAIThinking(true);
    setTimeout(() => {
      const ai = aiRef.current;
      const move = ai.getMove(gameRef.current);
      if (move) {
        gameRef.current.playMove(move);
      } else {
        gameRef.current.pass();
      }
      updateState();
      setIsAIThinking(false);
    }, 300);
  }, [updateState]);

  useEffect(() => {
    if (mode === 'pve' && currentPlayer === 'white' && !gameOver && !isAIThinking) {
      handleAIMove();
    }
  }, [currentPlayer, mode, gameOver, isAIThinking, handleAIMove]);

  const handlePress = useCallback((pos: Position) => {
    if (gameOver || isAIThinking) return;
    if (mode === 'pve' && currentPlayer === 'white') return;

    const game = gameRef.current;
    const success = game.playMove(pos);
    if (success) {
      setMoveCount(prev => prev + 1);
      updateState();
    }
  }, [gameOver, isAIThinking, mode, currentPlayer, updateState]);

  const handlePass = useCallback(() => {
    if (gameOver || isAIThinking) return;
    if (mode === 'pve' && currentPlayer === 'white') return;

    gameRef.current.pass();
    setMoveCount(prev => prev + 1);
    updateState();
  }, [gameOver, isAIThinking, mode, currentPlayer, updateState]);

  const handleResign = useCallback(() => {
    if (gameOver) return;
    setShowResignModal(true);
  }, [gameOver]);

  const handleBack = useCallback(() => {
    if (!gameOver && moveCount > 0) {
      setShowBackModal(true);
    } else {
      onBack();
    }
  }, [gameOver, moveCount, onBack]);

  const confirmResign = useCallback(() => {
    setShowResignModal(false);
    gameRef.current.state.gameOver = true;
    updateState();
  }, [updateState]);

  const handleNewGame = useCallback(() => {
    gameRef.current = new GoGame(boardSize);
    setMoveCount(0);
    setScore(null);
    updateState();
  }, [boardSize, updateState]);

  const playerLabel = currentPlayer === 'black' ? '黑棋' : '白棋';
  const modeLabel = mode === 'pvp' ? '双人对弈' : '电脑对手';

  return (
    <View style={[styles.container, isSmallScreen && styles.containerSmall]}>
      <TouchableOpacity style={styles.backIcon} onPress={handleBack}>
        <Text style={styles.backIconText}>←</Text>
      </TouchableOpacity>

      <View style={[styles.leftPanel, isSmallScreen && styles.leftPanelSmall]}>
        <GoBoard
          board={board}
          boardSize={boardSize}
          lastMove={lastMove}
          onPress={handlePress}
          disabled={isAIThinking || gameOver}
        />
      </View>

      <View style={[styles.rightPanel, isSmallScreen && styles.rightPanelSmall]}>
        <ScrollView contentContainerStyle={styles.rightScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.infoCard}>
            <Text style={styles.modeLabel}>{modeLabel}</Text>
            <Text style={styles.boardSizeLabel}>{boardSize}×{boardSize} 棋盘</Text>
          </View>

          <View style={styles.turnContainer}>
            <View style={styles.turnIndicator}>
              <View style={[styles.turnDot, { backgroundColor: currentPlayer === 'black' ? '#333' : '#ddd', borderColor: currentPlayer === 'black' ? '#333' : '#bbb' }]} />
              <Text style={styles.turnText}>
                {isAIThinking ? '电脑思考中...' : gameOver ? '游戏结束' : `${playerLabel}走棋`}
              </Text>
            </View>
          </View>

          <View style={styles.capturesContainer}>
            <View style={styles.captureRow}>
              <View style={[styles.captureStone, { backgroundColor: '#333' }]} />
              <Text style={styles.captureLabel}>黑提子: {captures.black}</Text>
            </View>
            <View style={styles.captureRow}>
              <View style={[styles.captureStone, { backgroundColor: '#eee', borderColor: '#ccc', borderWidth: 1 }]} />
              <Text style={styles.captureLabel}>白提子: {captures.white}</Text>
            </View>
            <Text style={styles.moveCount}>第 {moveCount} 手</Text>
          </View>

          {gameOver && score && (
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreTitle}>最终比分</Text>
              <Text style={styles.scoreText}>黑棋: {score.black} 目</Text>
              <Text style={styles.scoreText}>白棋: {score.white} 目</Text>
              <Text style={styles.winnerText}>
                {score.black > score.white ? '黑棋获胜!' : '白棋获胜!'}
              </Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            {!gameOver && (
              <TouchableOpacity style={[styles.actionButton, styles.resignButton]} onPress={handleResign}>
                <Text style={styles.actionButtonText}>认输</Text>
              </TouchableOpacity>
            )}
            {gameOver && (
              <TouchableOpacity style={[styles.actionButton, styles.newGameButton]} onPress={handleNewGame}>
                <Text style={styles.actionButtonText}>再来一局</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>

      <Modal visible={showResignModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>确认认输</Text>
            <Text style={styles.modalMsg}>确定要认输吗？这局将结束。</Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowResignModal(false)}>
                <Text style={styles.modalCancelText}>再想想</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={confirmResign}>
                <Text style={styles.modalConfirmText}>认输</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showBackModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>返回首页</Text>
            <Text style={styles.modalMsg}>对局还没结束，确定要离开吗？</Text>
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowBackModal(false)}>
                <Text style={styles.modalCancelText}>继续下棋</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={onBack}>
                <Text style={styles.modalConfirmText}>离开</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#F5E6D3',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: '5%',
  },
  containerSmall: {
    flexDirection: 'column',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  backIcon: {
    position: 'absolute',
    top: '1.5%',
    left: '1.5%',
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(93,58,26,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIconText: {
    fontSize: 26,
    color: '#5D3A1A',
    fontWeight: 'bold',
  },
  leftPanel: {
    flex: 1.1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: '3%',
  },
  leftPanelSmall: {
    flex: 0,
    marginTop: 56,
    paddingRight: 0,
  },
  rightPanel: {
    width: '20%',
    minWidth: 160,
    maxWidth: 240,
    paddingVertical: 8,
    justifyContent: 'center',
  },
  rightPanelSmall: {
    width: '100%',
    paddingVertical: 12,
    marginTop: 12,
  },
  rightScroll: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    flexGrow: 1,
  },
  infoCard: {
    backgroundColor: '#FFF8EE',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    width: '100%',
  },
  modeLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#5D3A1A',
  },
  boardSizeLabel: {
    fontSize: 13,
    color: '#8B6914',
    marginTop: 2,
  },
  turnContainer: {
    width: '100%',
    alignItems: 'center',
  },
  turnIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#FFF8EE',
    borderRadius: 6,
    width: '100%',
  },
  turnText: {
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
    color: '#5D3A1A',
  },
  turnDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  capturesContainer: {
    backgroundColor: '#FFF8EE',
    borderRadius: 8,
    padding: 10,
    width: '100%',
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  captureStone: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  captureLabel: {
    fontSize: 14,
    color: '#5D3A1A',
  },
  moveCount: {
    fontSize: 12,
    color: '#8B6914',
    textAlign: 'center',
    marginTop: 6,
  },
  scoreContainer: {
    backgroundColor: '#FFF8EE',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    alignItems: 'center',
  },
  scoreTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#5D3A1A',
    marginBottom: 6,
  },
  scoreText: {
    fontSize: 14,
    color: '#5D3A1A',
    marginBottom: 2,
  },
  winnerText: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#D32F2F',
    marginTop: 6,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    justifyContent: 'center',
  },
  actionButton: {
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 20,
    alignItems: 'center',
  },
  resignButton: {
    backgroundColor: '#D32F2F',
  },
  newGameButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 32,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    backgroundColor: '#FFF8EE',
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 28,
    alignItems: 'center',
    width: 280,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#5D3A1A',
    marginBottom: 8,
  },
  modalMsg: {
    fontSize: 15,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalBtnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: '#E0D5C8',
  },
  modalCancelText: {
    fontSize: 15,
    color: '#5D3A1A',
    fontWeight: '600',
  },
  modalConfirmBtn: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: '#D32F2F',
  },
  modalConfirmText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
});
