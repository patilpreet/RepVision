# ⚡ RepVision - AI Multi-Exercise Workout & Rep Tracker

Real-time computer vision workout and rep tracker with adaptive One Euro smoothing, multi-exercise biomechanical tracking, manual mode, session logging, and tiered motivational sound effects.

Works natively in the **Web Browser (Mobile & PC)** and on **Desktop (Python Windows/Mac/Linux)**.

---

## 🌟 Key Features

- **Multi-Exercise Library**: Tracks 23 exercises across 7 muscle groups plus machine/cable manual mode.
- **Biomechanical Angle & Visibility Tracking**:
  - Dynamically extracts landmarks across shoulders, elbows, wrists, hips, knees, and ankles.
  - **Visibility Filtering**: Joints with visibility < 0.5 are filtered out to eliminate wild camera artifacts.
  - **Smart Side Selection (`best` vs. `both`)**: Automatically picks the clearest side for side-view movements, and blends both limbs for frontal exercises.
- **Adaptive One Euro Filter**: Removes landmark jitter when holding still while preserving zero lag during fast lifts.
- **Direction-Aware Rep Counter (`RepCounter`)**:
  - Supports **curl-like** movements ($start > end$) and **press-like** movements ($start < end$).
  - Built-in hysteresis, minimum range of motion threshold (`minRange`), and minimum rep duration (`minRepMs`) to reject wobbles and half-reps.
  - **Timer Mode**: Accurately clocks isometric holds (e.g., plank) while your body alignment stays within tolerance.
- **Tiered Audio & Voice SFX**:
  - **Reps 1 to 19**: Workout bell chime + vocal counting ("1", "2", "3"...).
  - **Reps 20 to 34**: High-energy audio motivation track.
  - **Reps 35+**: High-tier milestone celebration track.
- **Manual Mode**: Clean large-button interface for cable, machine, or off-camera sets.
- **Session Log**: Local storage persistence for sets completed today, with reps/seconds, weight used, and timestamps.
- **Live Angle Tuning Panel**: Instant on-screen debugging and real-time threshold calibration with keyboard shortcut `d`.

---

## 🏋️ Exercise Library

| Muscle Group | Exercise | Tracking Mode | View | Active Joints | Default Angles (Start ➔ End) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Biceps** | Hammer Curl | Angle (`both`) | Front | Shoulder–Elbow–Wrist | $150^\circ \rightarrow 60^\circ$ |
| | Dumbbell Bicep Curl | Angle (`both`) | Front | Shoulder–Elbow–Wrist | $150^\circ \rightarrow 60^\circ$ |
| **Triceps** | Overhead Tricep Extension | Angle (`best`) | Side | Shoulder–Elbow–Wrist | $60^\circ \rightarrow 160^\circ$ |
| | Tricep Rope/Bar Pushdown | Angle (`best`) | Side | Shoulder–Elbow–Wrist | $90^\circ \rightarrow 160^\circ$ |
| | Bench Dip | Angle (`best`) | Side | Shoulder–Elbow–Wrist | $160^\circ \rightarrow 90^\circ$ |
| **Chest** | Push-up | Angle (`best`) | Side | Shoulder–Elbow–Wrist | $160^\circ \rightarrow 90^\circ$ |
| | Dumbbell Chest Press | Angle (`best`) | Side | Shoulder–Elbow–Wrist | $160^\circ \rightarrow 80^\circ$ |
| **Shoulders** | Overhead Dumbbell Press | Angle (`both`) | Front | Shoulder–Elbow–Wrist | $80^\circ \rightarrow 160^\circ$ |
| | Lateral Raise | Angle (`both`) | Front | Hip–Shoulder–Elbow | $20^\circ \rightarrow 80^\circ$ |
| | Front Raise | Angle (`best`) | Side | Hip–Shoulder–Elbow | $20^\circ \rightarrow 80^\circ$ |
| **Back** | Pull-up | Angle (`both`) | Front | Shoulder–Elbow–Wrist | $160^\circ \rightarrow 70^\circ$ |
| | Lat Pulldown | Angle (`both`) | Front | Shoulder–Elbow–Wrist | $160^\circ \rightarrow 70^\circ$ |
| | Single-Arm Dumbbell Row | Angle (`best`) | Side | Shoulder–Elbow–Wrist | $160^\circ \rightarrow 80^\circ$ |
| | Barbell/Dumbbell Deadlift | Angle (`best`) | Side | Shoulder–Hip–Knee | $100^\circ \rightarrow 165^\circ$ |
| **Legs** | Barbell/Goblet Squat | Angle (`best`) | Side | Hip–Knee–Ankle | $165^\circ \rightarrow 90^\circ$ |
| | Walking / Static Lunge | Angle (`best`) | Side | Hip–Knee–Ankle | $160^\circ \rightarrow 95^\circ$ |
| | Seated Leg Extension | Angle (`best`) | Side | Hip–Knee–Ankle | $90^\circ \rightarrow 165^\circ$ |
| | Glute Bridge | Angle (`best`) | Side | Shoulder–Hip–Knee | $110^\circ \rightarrow 165^\circ$ |
| **Core** | Floor Sit-up | Angle (`best`) | Side | Shoulder–Hip–Knee | $130^\circ \rightarrow 80^\circ$ |
| | Hanging Leg Raise | Angle (`best`) | Side | Shoulder–Hip–Knee | $170^\circ \rightarrow 90^\circ$ |
| | Forearm Plank | Timer (`hold`) | Side | Shoulder–Hip–Ankle | $160^\circ - 195^\circ$ (Hold Range) |
| **Manual** | Back Extension, Face Pull, Cable Row, Machine Exercise | Manual | — | — | Large `+1` button counter |

---

## 📱 How to Switch Exercises

1. Tap the **Exercise Pill** in the top navigation bar (e.g. `Hammer Curl ▾`).
2. A bottom sheet / modal will appear with muscle category tabs (`Biceps`, `Triceps`, `Chest`, `Shoulders`, `Back`, `Legs`, `Core`, `Manual`).
3. Tap on any exercise card to switch.
4. RepVision will immediately configure:
   - Required skeleton joint lines and angle overlays.
   - Recommended camera placement tip banner.
   - Start and end angle thresholds (including any custom overrides you've saved).
   - Camera or Manual mode layout.
5. Your choice is automatically persisted to `localStorage` and will reload on your next session.

---

## 📷 Camera Placement Tips

Getting reliable pose tracking depends on clear sightlines:

- **Front View Exercises** (e.g. Hammer Curl, Shoulder Press, Lateral Raise, Pull-up):
  - Place your phone upright against a water bottle or stand around 5–8 feet (1.5–2.5 m) away.
  - Ensure both arms and shoulders are visible within the camera frame.
- **Side View Exercises** (e.g. Squat, Lunge, Push-up, Bench Dip, Deadlift, Plank):
  - Stand or position your mat **sideways** (approx. $90^\circ$) to the camera lens.
  - Position the camera around knee or hip height so all 3 tracking joints (e.g. Hip, Knee, Ankle for squats) remain in view throughout the entire range of motion.
  - The engine uses `sides: "best"` to automatically focus on whichever side of your body has greater landmark confidence, avoiding noise from occluded limbs.
- **Lighting**: Avoid strong direct backlighting (e.g., bright windows directly behind you).

---

## 🖐️ Manual Mode

For exercises where camera tracking is impractical (such as machine seated rows, cable face pulls, or back hyperextensions):
- Select **Manual** from the exercise picker, or choose exercises like `Face Pull`, `Cable Row`, or `Machine Exercise`.
- The camera is deactivated to conserve phone battery.
- A high-contrast, gym-friendly screen displays a giant **+1 Rep** tap target.
- Full support for **Undo Rep**, **Reset**, and **Finish Set**.
- Audio cues (bell + voice counting and tier motivation tracks) continue to play on every rep.

---

## 🛠️ Live Debug & Angle Tuning Panel

Everyone's limb proportions, mobility, and exercise form vary. RepVision includes a live tuning helper to inspect and adapt angle thresholds to your personal biomechanics:

### How to Open
- Click the **Tune** icon (`Tune` slider button) in the top action bar, OR
- Press the **`d`** key on your physical keyboard.

### What it Displays
- **Live Angle**: Real-time smoothed angle reading of your active joints.
- **Stage**: Current movement state (`extended`, `contracting`, `holding`, etc.).
- **Joint Visibility**: Real-time confidence scores for the 3 tracked landmarks (values $\ge 0.5$ indicate confident tracking).
- **FPS**: Real-time camera processing framerate.

### How to Tune Angles
1. Open the Debug Panel while performing the exercise in front of your camera.
2. Observe the **Live Angle** reading at the peak of your extension/start position and the peak of your contraction/end position.
3. Adjust the **Start Angle** and **End Angle** numerical inputs in the panel.
4. Click **Save Overrides** to store them in your browser's `localStorage`.
5. Your custom thresholds will now take precedence for that exercise.
6. Click **Reset to Defaults** at any time to restore the original factory values.

---

## 📐 Tuning Guide by Exercise Type

If an exercise is missing reps or triggering prematurely:

### 1. Curl-like Movements ($Start > End$)
- *Examples*: Bicep curls, pull-ups, push-ups, squats, dips, sit-ups.
- **Start Angle**: The relaxed/starting extension (e.g., $150^\circ$ for curls, $165^\circ$ for squats). If reps don't arm, make this number slightly smaller (e.g., reduce $150^\circ \rightarrow 140^\circ$).
- **End Angle**: The peak contraction/inflection point (e.g., $60^\circ$ for curls, $90^\circ$ for parallel squats). If you can't reach deep enough to trigger a count, increase this number (e.g., adjust $90^\circ \rightarrow 100^\circ$ for squat depth).

### 2. Press-like Movements ($Start < End$)
- *Examples*: Overhead tricep extensions, shoulder presses, lateral raises, tricep pushdowns, leg extensions.
- **Start Angle**: The bottom/loaded position (e.g., $80^\circ$ for shoulder press, $60^\circ$ for tricep extension).
- **End Angle**: The lockout/top position (e.g., $160^\circ$ for tricep extension). If you don't fully lock out joints, reduce the target (e.g., $160^\circ \rightarrow 150^\circ$).

### 3. Isometric Holds / Timer Mode
- *Examples*: Plank.
- Measures the straightness of the shoulder-hip-ankle line ($160^\circ$ to $195^\circ$).
- If slight hip sag prematurely stops the timer, widen the lower bound (e.g., $150^\circ$).

---

## 📝 Session Log & History

- Tap **Finish Set** at any point during or after your set.
- A popup lets you record an optional weight (in kg/lbs).
- The set is saved with a timestamp, exercise name, rep count (or hold time in seconds), weight, and tracking mode.
- Tap the **Log** icon in the top bar to inspect today's sets or delete any recorded set.
- All log data is stored locally in your browser (`localStorage`) with zero external network or database dependencies.

---

## 💻 Local Development & Testing

### Running Unit Tests (Node.js)
```bash
node test/counter.test.js
```
Validates normal reps, threshold bounce rejection, half-rep rejection, press-like exercises, timer mode holds, minimum duration filtering, and manual controls.

### Running Local Web Server
```bash
python server.py
# or
npx serve .
```
Navigate to `http://localhost:8000`.

### Desktop Python Version
```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\venv\Scripts\Activate.ps1
python live.py
```
