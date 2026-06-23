import React, { useState, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { HomeScreen } from './src/screens/HomeScreen';
import { GameScreen } from './src/screens/GameScreen';
import { GameMode, BoardSize, AILevel } from './src/game/types';

type Screen = 'home' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [gameMode, setGameMode] = useState<GameMode>('pvp');
  const [boardSize, setBoardSize] = useState<BoardSize>(9);
  const [aiLevel, setAILevel] = useState<AILevel>('easy');

  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
  }, []);

  const handleStartGame = (mode: GameMode, size: BoardSize, level?: AILevel) => {
    setGameMode(mode);
    setBoardSize(size);
    if (level) setAILevel(level);
    setScreen('game');
  };

  const handleBack = () => {
    setScreen('home');
  };

  return (
    <View style={styles.container}>
      <StatusBar hidden />
      {screen === 'home' && <HomeScreen onStartGame={handleStartGame} />}
      {screen === 'game' && (
        <GameScreen
          mode={gameMode}
          boardSize={boardSize}
          aiLevel={aiLevel}
          onBack={handleBack}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5E6D3',
  },
});
