#!/usr/bin/env python
"""CodeNotch demo recorder — FINAL FINAL.
All UI driving via CDP (trusted input + dispatched events): proven reliable.
Cursor stays parked outside the capture region the whole video."""
import subprocess
import time

PROJECT = r"C:\Users\gopal\projects\forge\codenotch-win"
DEMO = PROJECT + r"\demo"
PORT = "9335"

PILL = (307, 245)
GEAR = (353, 27)


def run(cmd):
    return subprocess.run(cmd, capture_output=True, text=True, timeout=30, check=True)


def cdp_input(action, vx, vy):
    run(["node", PROJECT + r"\scripts\demo-input.cjs", action, str(vx), str(vy), PORT])


def collapse():
    run(["node", PROJECT + r"\scripts\demo-collapse.cjs", PORT])


def state():
    return run(["node", PROJECT + r"\scripts\demo-state.cjs", PORT]).stdout.strip()


# --- reset -------------------------------------------------------------------
collapse()
time.sleep(1.5)
print("reset:", state())
assert state().startswith("169"), "did not collapse"

# --- record ------------------------------------------------------------------
print("recording…")
ffmpeg = subprocess.Popen(
    [
        "ffmpeg", "-y",
        "-f", "gdigrab", "-framerate", "30", "-offset_x", "1120", "-offset_y", "880",
        "-video_size", "700x390", "-draw_mouse", "0", "-i", "desktop",
        "-t", "16",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "23",
        DEMO + r"\demo-raw.mp4",
    ],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(3.0)  # ACT 1: resting pill

cdp_input("move", *PILL)
time.sleep(4.0)  # ACT 2: expanded card
print("expanded:", state())
assert state().startswith("376"), "did not expand"

cdp_input("click", *GEAR)
time.sleep(3.0)  # ACT 3: settings
print("settings:", state())
assert "Settings" in state(), "did not open settings"

collapse()
time.sleep(1.5)  # ACT 4: collapse
print("final:", state())
assert state().startswith("169"), "did not collapse"

print("waiting for ffmpeg…")
ffmpeg.wait(timeout=30)
print("done")
