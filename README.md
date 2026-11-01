# ⚡ RepVision - AI Hammer Curl Rep Counter

Real-time computer vision hammer-curl rep counter with adaptive One Euro smoothing, multi-channel sound effects, and voice counting. 

Works natively on **Desktop (Windows/Mac/Linux)** and in the **Web Browser (Mobile & PC)**.

---

## 🌟 Features

- **MediaPipe Pose Tracking**: Real-time 3D landmark tracking of shoulders, elbows, and wrists.
- **Adaptive One Euro Filter**: Removes landmark jitter when holding still while preserving zero lag during fast curls.
- **Bi-Arm Integration**: Combines signals from left and right arms to prevent false double-counting.
- **Tiered Audio & Voice SFX**:
  - **Reps 1 to 19**: Workout bell chime + vocal counting ("1", "2", "3"...).
  - **Reps 20 to 34**: Custom audio motivation track.
  - **Reps 35+**: High-tier audio milestone track.
- **Mobile & PC Responsive Web Version**: Pure client-side WebAssembly MediaPipe for instant camera tracking on iOS Safari, Android Chrome, and desktop browsers.
- **Native Desktop App**: Python OpenCV + Pygame low-latency runner.

---

## 🚀 How to Run

### 1. Web Version (Mobile & PC)
Host it directly with **GitHub Pages** (Settings -> Pages -> Deploy from branch `main`), or test locally:

```bash
python server.py
```
- Open `http://localhost:8000` on your PC.
- Or open `http://<your-local-ip>:8000` on your phone on the same Wi-Fi network.

### 2. Native Desktop App (Windows)
Double-click `run.bat` or run:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\venv\Scripts\Activate.ps1
python live.py
```

#### Controls:
- **`q`** or **`Esc`**: Exit
- **`r`**: Reset counter to 0
- **`m`**: Toggle mirror mode

---

## 📁 Project Structure

```
├── index.html          # Web application (Mobile & PC)
├── style.css           # Glassmorphism dark gym UI
├── app.js              # MediaPipe Pose web tracking logic
├── server.py           # Local web server runner
├── live.py             # Native desktop app entry point
├── repvision_live.py   # Desktop live webcam loop
├── repvision.py        # Shared pose geometry & video exporter
├── sound_effects.py    # Pygame mixer & multi-channel audio engine
├── sounds/             # 1-100 wav voice count + custom audio tracks
├── run.bat             # 1-click Windows desktop runner
└── run.ps1             # PowerShell desktop runner
```

