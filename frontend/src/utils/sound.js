import { Audio } from 'expo-av';

const DEFAULT_SOUND_URL = 'https://actions.google.com/sounds/v1/alarms/beep_short.ogg';

export async function playCookedSound(customUrl) {
  const soundUrl = customUrl || DEFAULT_SOUND_URL;
  let sound;
  try {
    const result = await Audio.Sound.createAsync(
      { uri: soundUrl },
      { shouldPlay: true, volume: 1.0 }
    );
    sound = result.sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (status && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
      }
    });
  } catch (e) {
    // noop
  }
}


