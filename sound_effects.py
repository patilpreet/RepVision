"""
Sound effects and voice rep counting for RepVision.
Plays a chime sound effect and speaks the rep number (1, 2, 3, 4, 5...) on each completed rep.
"""
import os
import queue
import threading
import numpy as np
import pygame

class RepSoundPlayer:
    def __init__(self, sounds_dir="sounds"):
        self.sounds_dir = sounds_dir
        self.mixer_ready = False
        self.chime = None
        self.reset_sound = None
        self.custom_20_plus_sound = None
        self.custom_35_plus_sound = None
        self.voice_cache = {}
        self.tts_queue = queue.Queue()
        self.tts_thread = None

        self._init_mixer()
        self._load_sounds()
        self._start_tts_worker()

    def _init_mixer(self):
        try:
            if not pygame.mixer.get_init():
                pygame.mixer.init(frequency=44100, size=-16, channels=2, buffer=512)
            pygame.mixer.set_num_channels(8)
            self.mixer_ready = True
        except Exception as e:
            print(f"[SoundManager] Pygame mixer init note: {e}")
            self.mixer_ready = False

    def _load_sounds(self):
        if not self.mixer_ready:
            return

        # 1. Synthesize bell chime SFX (instant D5/A5 pleasant workout chime)
        try:
            sample_rate = 44100
            duration = 0.22
            t = np.linspace(0, duration, int(sample_rate * duration), False)
            tone = (0.6 * np.sin(2 * np.pi * 587.33 * t) + 0.4 * np.sin(2 * np.pi * 880.0 * t)) * np.exp(-t * 12)
            audio = np.int16(tone * 32767)
            stereo = np.column_stack((audio, audio))
            self.chime = pygame.sndarray.make_sound(stereo)
            self.chime.set_volume(0.8)
        except Exception as e:
            print(f"[SoundManager] Chime synthesis error: {e}")

        # 2. Synthesize reset tone
        try:
            t = np.linspace(0, 0.15, int(44100 * 0.15), False)
            tone = (0.5 * np.sin(2 * np.pi * 330.0 * t)) * np.exp(-t * 15)
            audio = np.int16(tone * 32767)
            stereo = np.column_stack((audio, audio))
            self.reset_sound = pygame.sndarray.make_sound(stereo)
            self.reset_sound.set_volume(0.6)
        except Exception as e:
            pass

        # 3. Pre-load voice files if available in sounds/
        if os.path.isdir(self.sounds_dir):
            for filename in os.listdir(self.sounds_dir):
                if filename.endswith(".wav"):
                    name = os.path.splitext(filename)[0]
                    if name.isdigit():
                        try:
                            filepath = os.path.join(self.sounds_dir, filename)
                            snd = pygame.mixer.Sound(filepath)
                            snd.set_volume(1.0)
                            self.voice_cache[int(name)] = snd
                        except Exception:
                            pass

        # 4. Custom sound for 20 to 34 reps
        custom_candidates_20 = [
            os.path.join(self.sounds_dir, "custom_20_plus.mp3"),
            r"c:\Users\PREET\Downloads\modi-ji-bkl (1).mp3"
        ]
        for cpath in custom_candidates_20:
            if os.path.exists(cpath):
                try:
                    self.custom_20_plus_sound = pygame.mixer.Sound(cpath)
                    self.custom_20_plus_sound.set_volume(1.0)
                    print(f"[SoundManager] Loaded custom sound for 20-34 reps: {cpath}")
                    break
                except Exception as e:
                    print(f"[SoundManager] Error loading custom audio {cpath}: {e}")

        # 5. Custom sound for 35 reps and above (replaces on 35+)
        custom_candidates_35 = [
            os.path.join(self.sounds_dir, "custom_35_plus.mp3"),
            r"c:\Users\PREET\Downloads\lund-pakad-ke-tarazu-ki-tarah-cid.mp3"
        ]
        for cpath in custom_candidates_35:
            if os.path.exists(cpath):
                try:
                    self.custom_35_plus_sound = pygame.mixer.Sound(cpath)
                    self.custom_35_plus_sound.set_volume(1.0)
                    print(f"[SoundManager] Loaded custom sound for >= 35 reps: {cpath}")
                    break
                except Exception as e:
                    print(f"[SoundManager] Error loading custom audio {cpath}: {e}")

    def _start_tts_worker(self):
        def _worker():
            engine = None
            while True:
                num = self.tts_queue.get()
                if num is None:
                    break
                try:
                    if engine is None:
                        import pyttsx3
                        engine = pyttsx3.init()
                        engine.setProperty('rate', 185)
                    engine.say(str(num))
                    engine.runAndWait()
                except Exception as ex:
                    # Windows fallback beep if TTS fails
                    try:
                        import winsound
                        winsound.Beep(880, 150)
                    except Exception:
                        pass
                self.tts_queue.task_done()

        self.tts_thread = threading.Thread(target=_worker, daemon=True)
        self.tts_thread.start()

    def play_rep(self, rep_number: int):
        """Plays the chime SFX and speaks the rep number (1, 2, 3...)."""
        if not self.mixer_ready:
            self.tts_queue.put(rep_number)
            return

        # Play chime SFX on channel 0
        if self.chime:
            try:
                ch0 = pygame.mixer.Channel(0)
                ch0.play(self.chime)
            except Exception:
                pass

        # For 35 reps and above: play 35+ custom audio on Channel 2
        # For 20 to 34 reps: play 20+ custom audio on Channel 2
        if rep_number >= 35 and self.custom_35_plus_sound:
            try:
                ch2 = pygame.mixer.Channel(2)
                ch2.play(self.custom_35_plus_sound)
            except Exception as e:
                print(f"[SoundManager] Custom 35+ sound playback error: {e}")
        elif rep_number >= 20 and self.custom_20_plus_sound:
            try:
                ch2 = pygame.mixer.Channel(2)
                ch2.play(self.custom_20_plus_sound)
            except Exception as e:
                print(f"[SoundManager] Custom 20+ sound playback error: {e}")

        # Play rep voice on channel 1 (if pre-cached) or send to TTS queue
        if rep_number in self.voice_cache:
            try:
                ch1 = pygame.mixer.Channel(1)
                ch1.play(self.voice_cache[rep_number])
            except Exception:
                self.tts_queue.put(rep_number)
        else:
            self.tts_queue.put(rep_number)

    def play_reset(self):
        """Stops active sounds and plays reset feedback."""
        if self.mixer_ready:
            try:
                pygame.mixer.stop()
                if self.reset_sound:
                    self.reset_sound.play()
            except Exception:
                pass
        # Clear any queued numbers in TTS
        while not self.tts_queue.empty():
            try:
                self.tts_queue.get_nowait()
                self.tts_queue.task_done()
            except Exception:
                break

    def close(self):
        self.tts_queue.put(None)
        if self.mixer_ready and pygame.mixer.get_init():
            try:
                pygame.mixer.quit()
            except Exception:
                pass

