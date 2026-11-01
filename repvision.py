
"""
RepVision - count hammer curls from a video.

Pipeline: OpenCV (read frames) -> MediaPipe Pose (joints) -> One Euro filter (smoothing)
          -> angle + state machine (rep count) -> Pillow (overlay) -> FFmpeg (export + audio)

Usage:
    python repvision.py input.mp4 output.mp4
"""
import argparse
import math
import subprocess
from collections import deque

import cv2
import numpy as np
import mediapipe as mp
from PIL import Image, ImageDraw, ImageFont

mp_pose = mp.solutions.pose
LM = mp_pose.PoseLandmark

# ---------------- settings ----------------
DOWN_ANGLE = 150      # elbow angle above this  = arm extended (down)
UP_ANGLE = 60         # elbow angle below this  = arm fully curled (up)
MIN_VISIBILITY = 0.5  # ignore landmarks MediaPipe is unsure about
TRAIL_LEN = 20        # how many past wrist positions to draw
JOINTS = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_ELBOW,
          LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST]
BONES = [(LM.LEFT_SHOULDER, LM.LEFT_ELBOW), (LM.LEFT_ELBOW, LM.LEFT_WRIST),
         (LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW), (LM.RIGHT_ELBOW, LM.RIGHT_WRIST),
         (LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER)]


# ---------------- 1. adaptive smoothing (fixes jitter) ----------------
class OneEuro:
    """Smooths hard when the signal is slow, lightly when it moves fast."""

    def __init__(self, fps, min_cutoff=1.5, beta=0.02, d_cutoff=1.0):
        self.fps, self.min_cutoff, self.beta, self.d_cutoff = fps, min_cutoff, beta, d_cutoff
        self.x_prev, self.dx_prev = None, 0.0

    def _alpha(self, cutoff):
        tau = 1.0 / (2 * math.pi * cutoff)
        return 1.0 / (1.0 + tau * self.fps)

    def __call__(self, x):
        if self.x_prev is None:
            self.x_prev = x
            return x
        dx = (x - self.x_prev) * self.fps
        a_d = self._alpha(self.d_cutoff)
        dx_hat = a_d * dx + (1 - a_d) * self.dx_prev
        a = self._alpha(self.min_cutoff + self.beta * abs(dx_hat))
        x_hat = a * x + (1 - a) * self.x_prev
        self.x_prev, self.dx_prev = x_hat, dx_hat
        return x_hat


# ---------------- 2. geometry ----------------
def angle_at(a, b, c):
    """Angle in degrees at point b formed by a-b-c."""
    ba, bc = np.array(a) - np.array(b), np.array(c) - np.array(b)
    denom = np.linalg.norm(ba) * np.linalg.norm(bc)
    if denom < 1e-6:
        return None
    cos = np.clip(np.dot(ba, bc) / denom, -1.0, 1.0)
    return float(np.degrees(np.arccos(cos)))


# ---------------- 3. rep counter (state machine) ----------------
class RepCounter:
    def __init__(self):
        self.reps = 0
        self.stage = None  # None -> "down" -> "up" -> "down" (rep!)

    def update(self, ang):
        if ang is None:
            return
        if ang > DOWN_ANGLE:
            self.stage = "down"
        elif ang < UP_ANGLE and self.stage == "down":
            self.stage = "up"
            self.reps += 1

    @property
    def status(self):
        return {None: "Ready", "down": "Down", "up": "Curl!"}[self.stage]


# ---------------- 4. overlay drawing (Pillow) ----------------
_font_cache = {}


def font(size):
    if size not in _font_cache:
        try:
            _font_cache[size] = ImageFont.truetype("DejaVuSans-Bold.ttf", size)
        except OSError:
            _font_cache[size] = ImageFont.load_default(size)
    return _font_cache[size]


def draw_overlay(frame_bgr, pts, angles, trails, counter):
    h, w = frame_bgr.shape[:2]
    s = w / 720.0  # scale everything to video width so it looks right at any resolution
    img = Image.fromarray(cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2RGB)).convert("RGBA")
    layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # hand trails (fade in toward newest point)
    for dq in trails.values():
        pts_list = list(dq)
        for i in range(1, len(pts_list)):
            alpha = int(255 * i / len(pts_list))
            d.line([pts_list[i - 1], pts_list[i]], fill=(90, 230, 210, alpha),
                   width=max(2, int(5 * s)))

    # skeleton
    for a, b in BONES:
        if a in pts and b in pts:
            d.line([pts[a], pts[b]], fill=(60, 220, 120, 255), width=max(2, int(4 * s)))
    r = max(4, int(7 * s))
    for j in JOINTS:
        if j in pts:
            x, y = pts[j]
            d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, 255),
                      outline=(60, 220, 120, 255), width=2)

    # elbow angle labels
    for elbow, ang in angles.items():
        if elbow in pts and ang is not None:
            x, y = pts[elbow]
            d.text((x + 12 * s, y - 10 * s), f"{int(ang)}\u00b0", font=font(int(20 * s)),
                   fill=(255, 255, 255, 255))

    # counter card
    m, cw, ch = int(24 * s), int(220 * s), int(120 * s)
    d.rounded_rectangle([m, m, m + cw, m + ch], radius=int(16 * s), fill=(10, 25, 30, 210))
    d.text((m + 16 * s, m + 10 * s), "REPS", font=font(int(15 * s)), fill=(150, 200, 200, 255))
    d.text((m + 16 * s, m + 28 * s), str(counter.reps), font=font(int(52 * s)),
           fill=(255, 255, 255, 255))
    d.text((m + 120 * s, m + 62 * s), counter.status, font=font(int(22 * s)),
           fill=(90, 230, 210, 255))

    out = Image.alpha_composite(img, layer).convert("RGB")
    return cv2.cvtColor(np.array(out), cv2.COLOR_RGB2BGR)


# ---------------- 5. FFmpeg writer (export + keep audio) ----------------
def open_ffmpeg(src, dst, w, h, fps):
    cmd = ["ffmpeg", "-y", "-loglevel", "error",
           "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{w}x{h}", "-r", str(fps), "-i", "-",
           "-i", src,
           "-map", "0:v", "-map", "1:a?",          # video from pipe, audio (if any) from original
           "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
           "-c:a", "aac", "-shortest", dst]
    return subprocess.Popen(cmd, stdin=subprocess.PIPE)


# ---------------- 6. main loop ----------------
def main():
    ap = argparse.ArgumentParser(description="RepVision - Hammer curl rep counter")
    ap.add_argument("input", nargs="?", default=None, help="Input video file path (leave blank for live camera)")
    ap.add_argument("output", nargs="?", default=None, help="Output video file path")
    args = ap.parse_args()

    if not args.input:
        import repvision_live
        repvision_live.main()
        return

    if not args.output:
        print("[Error] When an input video is specified, an output file path is required: python repvision.py <input> <output>")
        return

    cap = cv2.VideoCapture(args.input)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    ff = open_ffmpeg(args.input, args.output, w, h, fps)

    pose = mp_pose.Pose(model_complexity=1, smooth_landmarks=True,
                        min_detection_confidence=0.5, min_tracking_confidence=0.5)

    # one filter per coordinate of each joint, plus one for the combined angle
    xy_filters = {j: (OneEuro(fps), OneEuro(fps)) for j in JOINTS}
    angle_filter = OneEuro(fps, min_cutoff=1.0, beta=0.01)
    trails = {"L": deque(maxlen=TRAIL_LEN), "R": deque(maxlen=TRAIL_LEN)}
    counter = RepCounter()
    last_angles = {LM.LEFT_ELBOW: None, LM.RIGHT_ELBOW: None}

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        res = pose.process(cv2.cvtColor(frame, cv2.COLOR_BGR2RGB))
        pts, vis = {}, {}
        if res.pose_landmarks:
            for j in JOINTS:
                lm = res.pose_landmarks.landmark[j]
                if lm.visibility < MIN_VISIBILITY:
                    continue
                fx, fy = xy_filters[j]
                # smooth in pixel space, on the SAME frame we draw on -> no alignment drift
                pts[j] = (fx(lm.x * w), fy(lm.y * h))
                vis[j] = lm.visibility

        # elbow angle per arm
        arms = {LM.LEFT_ELBOW: (LM.LEFT_SHOULDER, LM.LEFT_ELBOW, LM.LEFT_WRIST),
                LM.RIGHT_ELBOW: (LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW, LM.RIGHT_WRIST)}
        angles = {}
        for elbow, (s_, e_, w_) in arms.items():
            if all(k in pts for k in (s_, e_, w_)):
                angles[elbow] = angle_at(pts[s_], pts[e_], pts[w_])
                last_angles[elbow] = angles[elbow]
            else:
                angles[elbow] = None

        # combine both arms into ONE signal (fixes double counting)
        valid = [a for a in angles.values() if a is not None]
        if valid:
            combined = angle_filter(sum(valid) / len(valid))
            counter.update(combined)

        # hand trails
        if LM.LEFT_WRIST in pts:
            trails["L"].append(pts[LM.LEFT_WRIST])
        if LM.RIGHT_WRIST in pts:
            trails["R"].append(pts[LM.RIGHT_WRIST])

        out = draw_overlay(frame, pts, angles, trails, counter)
        ff.stdin.write(out.tobytes())

    cap.release()
    ff.stdin.close()
    ff.wait()


if __name__ == "__main__":
    main()
