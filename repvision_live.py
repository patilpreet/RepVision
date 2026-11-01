"""
RepVision Live - Real-time webcam hammer-curl rep counter with audio feedback and voice counting.

Usage:
    python repvision_live.py
    python live.py
"""
import argparse
import sys
from collections import deque

import cv2
import numpy as np
import mediapipe as mp

import repvision as rv
from sound_effects import RepSoundPlayer

# ---------------- Live Webcam Loop ----------------
def run_live(camera_id=0, mirror=True):
    print("=" * 60)
    print("RepVision - Live Hammer Curl Rep Counter")
    print("Audio: SFX Chime + Voice Counting (1, 2, 3, 4, 5...)")
    print("Press 'q' or ESC to exit")
    print("Press 'r' to reset rep count")
    print("Press 'm' to toggle mirror mode")
    print("=" * 60)

    cap = cv2.VideoCapture(camera_id)
    if not cap.isOpened():
        print(f"[Error] Could not open camera {camera_id}.")
        print("Please check that your webcam is connected and not in use by another app.")
        return

    # Set preferred resolution
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)

    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or fps <= 0 or np.isnan(fps):
        fps = 30.0

    sound_player = RepSoundPlayer()

    pose = rv.mp_pose.Pose(
        model_complexity=1,
        smooth_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    xy_filters = {j: (rv.OneEuro(fps), rv.OneEuro(fps)) for j in rv.JOINTS}
    angle_filter = rv.OneEuro(fps, min_cutoff=1.0, beta=0.01)
    trails = {"L": deque(maxlen=rv.TRAIL_LEN), "R": deque(maxlen=rv.TRAIL_LEN)}
    counter = rv.RepCounter()
    prev_reps = 0

    window_name = "RepVision - Live Hammer Curl Rep Counter"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    try:
        while True:
            ok, frame = cap.read()
            if not ok:
                print("[Warning] Failed to grab frame from camera.")
                break

            if mirror:
                frame = cv2.flip(frame, 1)

            h, w = frame.shape[:2]
            res = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
            pts = {}
            if res.pose_landmarks:
                for j in rv.JOINTS:
                    lm = res.pose_landmarks.landmark[j]
                    if lm.visibility < rv.MIN_VISIBILITY:
                        continue
                    fx, fy = xy_filters[j]
                    pts[j] = (fx(lm.x * w), fy(lm.y * h))

            # Elbow angle per arm
            arms = {
                rv.LM.LEFT_ELBOW: (rv.LM.LEFT_SHOULDER, rv.LM.LEFT_ELBOW, rv.LM.LEFT_WRIST),
                rv.LM.RIGHT_ELBOW: (rv.LM.RIGHT_SHOULDER, rv.LM.RIGHT_ELBOW, rv.LM.RIGHT_WRIST)
            }
            angles = {}
            for elbow, (s_, e_, w_) in arms.items():
                if all(k in pts for k in (s_, e_, w_)):
                    angles[elbow] = rv.angle_at(pts[s_], pts[e_], pts[w_])
                else:
                    angles[elbow] = None

            # Combine both arms into ONE signal
            valid = [a for a in angles.values() if a is not None]
            if valid:
                combined = angle_filter(sum(valid) / len(valid))
                counter.update(combined)

            # Trigger audio chime + voice rep count (1, 2, 3...) on rep count
            if counter.reps > prev_reps:
                print(f"[REP COUNTED] -> {counter.reps}")
                sound_player.play_rep(counter.reps)
                prev_reps = counter.reps

            # Hand trails
            if rv.LM.LEFT_WRIST in pts:
                trails["L"].append(pts[rv.LM.LEFT_WRIST])
            if rv.LM.RIGHT_WRIST in pts:
                trails["R"].append(pts[rv.LM.RIGHT_WRIST])

            out = rv.draw_overlay(frame, pts, angles, trails, counter)

            # Small helper hint at the bottom
            hint_text = "q: Quit | r: Reset | m: Mirror"
            cv2.putText(out, hint_text, (24, h - 20), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 1, cv2.LINE_AA)

            cv2.imshow(window_name, out)
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or key == 27:  # 'q' or Esc
                break
            elif key == ord('r'):
                counter.reps = 0
                counter.stage = None
                prev_reps = 0
                sound_player.play_reset()
                print("[Reset] Rep counter reset to 0.")
            elif key == ord('m'):
                mirror = not mirror
                print(f"[Mirror] Mirror mode: {'ON' if mirror else 'OFF'}")
    finally:
        cap.release()
        cv2.destroyAllWindows()
        sound_player.close()

def main():
    parser = argparse.ArgumentParser(description="RepVision - Live Hammer Curl Rep Counter")
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    parser.add_argument("--no-mirror", action="store_true", help="Disable mirror mode")
    args = parser.parse_args()

    run_live(camera_id=args.camera, mirror=not args.no_mirror)

if __name__ == "__main__":
    main()
