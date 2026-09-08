"""Generate CodeNotch app icon: dark rounded square, three usage rings, notch cut."""
from PIL import Image, ImageDraw


def rounded_rect_mask(size, radius):
    m = Image.new("L", (size, size), 0)
    d = ImageDraw.Draw(m)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill=255)
    return m


def draw_ring(draw, cx, cy, r, width, frac, color, track=(40, 40, 46, 255)):
    bbox = [cx - r, cy - r, cx + r, cy + r]
    start = -90
    end = start + 360 * max(frac, 0.035)
    draw.arc(bbox, start=start, end=end, fill=track, width=width)
    if frac > 0:
        draw.arc(bbox, start=start, end=end, fill=color, width=width)


S = 256
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)

# dark rounded-square base
d.rounded_rectangle([4, 4, S - 4, S - 4], radius=56, fill=(18, 18, 22, 255))

# three rings, staggered like the widget (overall ring + two providers)
draw_ring(d, 78, 128, 44, 14, 0.55, (52, 211, 153, 255))    # emerald
draw_ring(d, 152, 128, 44, 14, 0.30, (52, 211, 153, 255))   # emerald
# amber "getting low" accent on the third ring
draw_ring(d, 203, 128, 30, 11, 0.75, (251, 191, 36, 255), track=(40, 40, 46, 255))

# notch cut at top center (the design language's signature)
notch_w, notch_h = 64, 14
d.rectangle([S // 2 - notch_w // 2, 4, S // 2 + notch_w // 2, 4 + notch_h], fill=(0, 0, 0, 0))

img.save("build/icon.png")

# Windows .ico with multiple sizes
img.save("build/icon.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
print("icons written")
