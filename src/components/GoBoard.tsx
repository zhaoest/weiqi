import React, { useCallback, useMemo } from 'react';
import { View, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Svg, { Line, Circle, Rect } from 'react-native-svg';
import { Position, BoardSize, Intersection } from '../game/types';

interface GoBoardProps {
  board: Intersection[][];
  boardSize: BoardSize;
  lastMove: Position | null;
  onPress: (pos: Position) => void;
  disabled?: boolean;
}

const STAR_POINTS: Record<BoardSize, Position[]> = {
  9: [
    { row: 2, col: 2 }, { row: 2, col: 6 },
    { row: 6, col: 2 }, { row: 6, col: 6 },
    { row: 4, col: 4 },
  ],
  13: [
    { row: 3, col: 3 }, { row: 3, col: 9 },
    { row: 9, col: 3 }, { row: 9, col: 9 },
    { row: 6, col: 6 },
  ],
  19: [
    { row: 3, col: 3 }, { row: 3, col: 9 }, { row: 3, col: 15 },
    { row: 9, col: 3 }, { row: 9, col: 9 }, { row: 9, col: 15 },
    { row: 15, col: 3 }, { row: 15, col: 9 }, { row: 15, col: 15 },
  ],
};

export function GoBoard({ board, boardSize, lastMove, onPress, disabled }: GoBoardProps) {
  const cellSize = useMemo(() => {
    const { width, height } = Dimensions.get('window');
    const isSmallScreen = width < 800;
    
    // 棋盘应该保持正方形
    // 大屏幕: 棋盘占可用空间的 58%
    // 小屏幕: 棋盘占可用空间的 65%
    const availableWidth = isSmallScreen ? width * 0.65 : width * 0.54;
    const availableHeight = height * 0.88;
    
    // 取较小的值确保棋盘是正方形
    const maxSize = Math.min(availableWidth, availableHeight);
    
    return Math.floor(maxSize / (boardSize - 1 + 1.4));
  }, [boardSize]);

  const padding = Math.floor(cellSize * 0.7);
  const svgSize = cellSize * (boardSize - 1) + padding * 2;
  const stoneRadius = cellSize * 0.43;
  const starPointRadius = cellSize * 0.1;

  const gridLines = useMemo(() => {
    const lines: JSX.Element[] = [];
    for (let i = 0; i < boardSize; i++) {
      lines.push(
        <Line
          key={`h${i}`}
          x1={padding}
          y1={padding + i * cellSize}
          x2={padding + (boardSize - 1) * cellSize}
          y2={padding + i * cellSize}
          stroke="#2a1a0a"
          strokeWidth={i === 0 || i === boardSize - 1 ? 1.5 : 0.8}
        />
      );
      lines.push(
        <Line
          key={`v${i}`}
          x1={padding + i * cellSize}
          y1={padding}
          x2={padding + i * cellSize}
          y2={padding + (boardSize - 1) * cellSize}
          stroke="#2a1a0a"
          strokeWidth={i === 0 || i === boardSize - 1 ? 1.5 : 0.8}
        />
      );
    }
    return lines;
  }, [boardSize, cellSize, padding]);

  const stars = useMemo(() => {
    const points = STAR_POINTS[boardSize] || [];
    return points.map((p, i) => (
      <Circle
        key={`star${i}`}
        cx={padding + p.col * cellSize}
        cy={padding + p.row * cellSize}
        r={starPointRadius}
        fill="#2a1a0a"
      />
    ));
  }, [boardSize, cellSize, padding, starPointRadius]);

  const stones = useMemo(() => {
    const elements: JSX.Element[] = [];
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const color = board[r][c];
        if (color) {
          const cx = padding + c * cellSize;
          const cy = padding + r * cellSize;
          const isLast = lastMove && lastMove.row === r && lastMove.col === c;

          if (color === 'white') {
            elements.push(
              <Circle
                key={`shadow-${r}-${c}`}
                cx={cx + 1.5}
                cy={cy + 1.5}
                r={stoneRadius}
                fill="rgba(0,0,0,0.25)"
              />
            );
          }

          elements.push(
            <Circle
              key={`stone-${r}-${c}`}
              cx={cx}
              cy={cy}
              r={stoneRadius}
              fill={color === 'black' ? '#1a1a1a' : '#f5f5f0'}
              stroke={color === 'black' ? '#000' : '#bbb'}
              strokeWidth={0.5}
            />
          );

          if (color === 'black') {
            elements.push(
              <Circle
                key={`shine-${r}-${c}`}
                cx={cx - stoneRadius * 0.25}
                cy={cy - stoneRadius * 0.25}
                r={stoneRadius * 0.15}
                fill="rgba(255,255,255,0.2)"
              />
            );
          }

          if (isLast) {
            const markerColor = color === 'black' ? '#ff6b6b' : '#ff6b6b';
            elements.push(
              <Circle
                key={`last-${r}-${c}`}
                cx={cx}
                cy={cy}
                r={stoneRadius * 0.25}
                fill={markerColor}
              />
            );
          }
        }
      }
    }
    return elements;
  }, [board, boardSize, lastMove, cellSize, padding, stoneRadius]);

  const handlePress = useCallback((row: number, col: number) => {
    if (!disabled) {
      onPress({ row, col });
    }
  }, [disabled, onPress]);

  const touchTargets = useMemo(() => {
    const targets: JSX.Element[] = [];
    for (let r = 0; r < boardSize; r++) {
      for (let c = 0; c < boardSize; c++) {
        const cx = padding + c * cellSize;
        const cy = padding + r * cellSize;
        targets.push(
          <TouchableOpacity
            key={`touch-${r}-${c}`}
            onPress={() => handlePress(r, c)}
            style={{
              position: 'absolute',
              left: cx - cellSize / 2,
              top: cy - cellSize / 2,
              width: cellSize,
              height: cellSize,
            }}
            activeOpacity={0.7}
          />
        );
      }
    }
    return targets;
  }, [boardSize, cellSize, padding, handlePress]);

  return (
    <View style={styles.container}>
      <View style={{ width: svgSize, height: svgSize }}>
        <Svg width={svgSize} height={svgSize}>
          <Rect x={0} y={0} width={svgSize} height={svgSize} fill="#DCB35C" rx={4} />
          {gridLines}
          {stars}
          {stones}
        </Svg>
        <View style={StyleSheet.absoluteFill}>
          {touchTargets}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
