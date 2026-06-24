import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { GameMode, BoardSize, AILevel } from '../game/types';

interface HomeScreenProps {
  onStartGame: (mode: GameMode, boardSize: BoardSize, aiLevel?: AILevel) => void;
}

export function HomeScreen({ onStartGame }: HomeScreenProps) {
  const [selectedSize, setSelectedSize] = useState<BoardSize>(9);
  const [selectedMode, setSelectedMode] = useState<GameMode>('pve');
  const [selectedAILevel] = useState<AILevel>('medium');

  const { width, height } = Dimensions.get('window');
  // 应用强制横屏,判断宽度
  const isSmallScreen = width < 800;

  const sizes: { value: BoardSize; label: string; desc: string }[] = [
    { value: 9, label: '9×9', desc: '初学者推荐' },
    { value: 13, label: '13×13', desc: '进阶练习' },
    { value: 19, label: '19×19', desc: '标准棋盘' },
  ];

  const handleStart = () => {
    onStartGame(selectedMode, selectedSize, selectedMode === 'pve' ? selectedAILevel : undefined);
  };

  return (
    <View style={[styles.container, isSmallScreen && styles.containerSmall]}>
      <View style={styles.titleArea}>
        <Text style={[styles.title, isSmallScreen && styles.titleSmall]}>暖暖围棋</Text>
        <Text style={[styles.motto, isSmallScreen && styles.mottoSmall]}>每一步都是成长</Text>
      </View>

      <View style={[styles.mainRow, isSmallScreen && styles.mainRowSmall]}>
        <View style={[styles.leftCol, isSmallScreen && styles.leftColSmall]}>
          <Text style={[styles.sectionTitle, isSmallScreen && styles.sectionTitleSmall]}>棋盘大小</Text>
          <View style={[styles.sizeRow, isSmallScreen && styles.sizeRowSmall]}>
            {sizes.map(s => {
              const active = selectedSize === s.value;
              return (
                <TouchableOpacity
                  key={s.value}
                  style={[styles.sizeButton, active && styles.sizeButtonActive, isSmallScreen && styles.sizeButtonSmall]}
                  onPress={() => setSelectedSize(s.value)}
                >
                  <Text style={[styles.sizeButtonText, active && styles.sizeButtonTextActive]}>{s.label}</Text>
                  <Text style={[styles.sizeButtonDesc, active && styles.sizeButtonDescActive]}>{s.desc}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {!isSmallScreen && <View style={styles.divider} />}

        <View style={[styles.rightCol, isSmallScreen && styles.rightColSmall]}>
          <Text style={[styles.sectionTitle, isSmallScreen && styles.sectionTitleSmall]}>游戏模式</Text>
          <View style={[styles.modeRow, isSmallScreen && styles.modeRowSmall]}>
            <TouchableOpacity
              style={[styles.modeButton, selectedMode === 'pve' ? styles.pveActive : styles.modeInactive, isSmallScreen && styles.modeButtonSmall]}
              onPress={() => setSelectedMode('pve')}
            >
              <Text style={[styles.modeTitle, selectedMode !== 'pve' && styles.modeTitleInactive]}>电脑对手</Text>
              <Text style={[styles.modeDesc, selectedMode !== 'pve' && styles.modeDescInactive]}>和电脑下棋</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modeButton, selectedMode === 'pvp' ? styles.pvpActive : styles.modeInactive, isSmallScreen && styles.modeButtonSmall]}
              onPress={() => setSelectedMode('pvp')}
            >
              <Text style={[styles.modeTitle, selectedMode !== 'pvp' && styles.modeTitleInactive]}>双人对弈</Text>
              <Text style={[styles.modeDesc, selectedMode !== 'pvp' && styles.modeDescInactive]}>和朋友一起下棋</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <TouchableOpacity style={[styles.startButton, isSmallScreen && styles.startButtonSmall]} onPress={handleStart}>
          <Text style={[styles.startButtonText, isSmallScreen && styles.startButtonTextSmall]}>开始</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5E6D3',
    paddingHorizontal: '5%',
    paddingTop: 20,
    paddingBottom: 24,
  },
  containerSmall: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  titleArea: {
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#5D3A1A',
  },
  titleSmall: {
    fontSize: 28,
  },
  motto: {
    fontSize: 13,
    color: '#B89A6A',
    marginTop: 4,
    letterSpacing: 2,
  },
  mottoSmall: {
    fontSize: 12,
    marginTop: 2,
  },
  mainRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  mainRowSmall: {
    flexDirection: 'column',
    gap: 12,
  },
  leftCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  leftColSmall: {
    width: '100%',
  },
  divider: {
    width: 2,
    height: '70%',
    backgroundColor: '#D4A574',
    opacity: 0.5,
  },
  rightCol: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightColSmall: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#5D3A1A',
    marginBottom: 12,
  },
  sectionTitleSmall: {
    fontSize: 16,
    marginBottom: 8,
  },
  sizeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sizeRowSmall: {
    gap: 8,
  },
  sizeButton: {
    backgroundColor: '#FFF8EE',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#D4A574',
    minWidth: 80,
    opacity: 0.6,
  },
  sizeButtonSmall: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: 70,
  },
  sizeButtonActive: {
    borderColor: '#8B4513',
    backgroundColor: '#FFEFD5',
    opacity: 1,
  },
  sizeButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#B89A6A',
  },
  sizeButtonTextActive: {
    color: '#5D3A1A',
  },
  sizeButtonDesc: {
    fontSize: 11,
    color: '#B89A6A',
    marginTop: 2,
  },
  sizeButtonDescActive: {
    color: '#8B6914',
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modeRowSmall: {
    gap: 8,
  },
  modeButton: {
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: 'center',
    minWidth: 130,
    borderWidth: 3,
  },
  modeButtonSmall: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    minWidth: 110,
  },
  pvpActive: {
    backgroundColor: '#E8F5E9',
    borderColor: '#4CAF50',
  },
  pveActive: {
    backgroundColor: '#E3F2FD',
    borderColor: '#2196F3',
  },
  modeInactive: {
    backgroundColor: '#F0EDE8',
    borderColor: '#C8C0B4',
  },
  modeTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  modeTitleInactive: {
    color: '#999',
  },
  modeDesc: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  modeDescInactive: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 4,
  },
  bottomRow: {
    alignItems: 'center',
    paddingTop: 16,
  },
  startButton: {
    backgroundColor: '#8B4513',
    paddingVertical: 16,
    paddingHorizontal: 64,
    borderRadius: 30,
  },
  startButtonSmall: {
    paddingVertical: 12,
    paddingHorizontal: 48,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  startButtonTextSmall: {
    fontSize: 18,
  },
});
