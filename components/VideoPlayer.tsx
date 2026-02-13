import { useState, useRef } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '@/constants/theme';

interface VideoPlayerProps {
  uri: string;
  style?: object;
}

export function VideoPlayer({ uri, style }: VideoPlayerProps) {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  const togglePlayPause = async () => {
    try {
      if (isPlaying) {
        await videoRef.current?.pauseAsync();
      } else {
        await videoRef.current?.playAsync();
      }
      setIsPlaying(!isPlaying);
      setShowOverlay(!isPlaying);
    } catch (e) {
      console.warn('Video toggle error:', e);
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    const playing = status.isPlaying;
    setIsPlaying(playing);
    if (playing) {
      setShowOverlay(false);
    } else if (status.didJustFinishAndNotReset) {
      setShowOverlay(true);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      activeOpacity={1}
      onPress={togglePlayPause}
    >
      <Video
        ref={videoRef}
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={ResizeMode.COVER}
        useNativeControls={false}
        shouldPlay={false}
        isLooping
        onPlaybackStatusUpdate={onPlaybackStatusUpdate}
      />
      {showOverlay && (
        <View style={styles.overlay} pointerEvents="none">
          <View style={styles.playButton}>
            <Ionicons name="play" size={48} color="#fff" />
          </View>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
