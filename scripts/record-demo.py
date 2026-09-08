#!/usr/bin/env python
"""CodeNotch demo recorder v3: OS cursor glides for the camera, CDP drives the UI.
Sequence: resting pill -> hover expand -> gear -> settings -> back -> collapse."""
import json
import subprocess
import time

PROJECT = r"C:\Users\gopal\projects\forge\codenotch-win"
DEMO = PROJECT + r"\demo"
CURSOR = PROJECT + r"\scripts\cursor.ps1"
ORIGIN = (1632, 856)  # demo window client origin (verified; RDP moved it bottom-right)

# viewport targets (verified by hit-testing):
PILL_VP = (307, 245)      # pill center
GEAR_VP = (353, 27)       # gear in EXPANDED header (click verified -> opens Settings)


def os_cursor(x, y):
    subprocess.run(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", CURSOR, "-x", str(x), "-y", str(y)],
        check=True, capture_output=True, timeout=30,
    )


def cdp_input(action, vx, vy):
    subprocess.run(
        ["node", PROJECT + r"\scripts\demo-input.cjs", action, str(vx), str(vy), "9335"],
        check=True, capture_output=True, timeout=30,
    )


def state():
    out = subprocess.run(
        ["node", PROJECT + r"\scripts\demo-state.cjs", "9335"],
        capture_output=True, text=True, check=True, timeout=30,
    )
    return out.stdout.strip()


def coords(what):
    out = subprocess.run(
        ["node", PROJECT + r"\scripts\demo-coords.cjs", what],
        capture_output=True, text=True, check=True, timeout=30,
        env={"CN_PORT": "9335", "CN_WIN_X": str(ORIGIN[0]), "CN_WIN_Y": str(ORIGIN[1]), "SYSTEMROOT": r"C:\Windows"},
    )
    return json.loads(out.stdout.strip())


# --- reset to pill -----------------------------------------------------------
cdp_input("move", 10, 10)
os_cursor(1700, 1100)
time.sleep(1.5)
print("reset:", state())
assert state().startswith("169"), "did not collapse"

# --- record ------------------------------------------------------------------
print("recording…")
ffmpeg = subprocess.Popen(
    [
        "ffmpeg", "-y",
        "-f", "gdigrab", "-framerate", "30", "-offset_x", "1860", "-offset_y", "0",
        "-video_size", "700x420", "-draw_mouse", "1", "-i", "desktop",
        "-t", "15",
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "medium", "-crf", "23",
        DEMO + r"\demo-raw.mp4",
    ],
    stdout=subprocess.DEVNULL,
    stderr=subprocess.DEVNULL,
)
time.sleep(3.0)  # ACT 1: resting pill

# ACT 2: hover expand — glide the visible cursor while CDP drives the UI
os_cursor(1870, 1125)  # start glide from inside the capture, below-left of pill
cdp_input("move", *PILL_VP)
os_cursor(ORIGIN[0] + PILL_VP[0], ORIGIN[1] + PILL_VP[1])
time.sleep(4.0)  # expansion + time to read
print("expanded:", state())
assert state().startswith("376"), "did not expand"

# ACT 3: click gear -> settings
os_cursor(1985, 880)
cdp_input("click", *GEAR_VP)
os_cursor(ORIGIN[0] + GEAR_VP[0], ORIGIN[1] + GEAR_VP[1])
time.sleep(3.0)  # settings panel on screen
print("settings:", state())

# ACT 4: leave -> card collapses (works from settings too: mouseleave = collapsed)
os_cursor(1750, 1150)
cdp_input("move", 10, 10)
os_cursor(1700, 1100)
time.sleep(2.5)  # collapse
print("final:", state())
assert state().startswith("169"), "did not collapse at end"

print("waiting for ffmpeg to finish on its own…")
ffmpeg.wait(timeout=30)  # -t 15 makes it self-finalize the MP4
print("done")
