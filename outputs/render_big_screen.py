# -*- coding: utf-8 -*-
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os

W, H = 1920, 1080
OUT = "outputs/big-screen-current-interface.png"
FONT = "C:/Windows/Fonts/NotoSansSC-VF.ttf"


def make_font(size):
    return ImageFont.truetype(FONT, size)


img = Image.new("RGB", (W, H), "#07162d")
d = ImageDraw.Draw(img)

for y in range(H):
    t = y / H
    d.line([(0, y), (W, y)], fill=(int(7 + 5 * t), int(20 + 18 * t), int(45 + 28 * t)))

for radius, alpha in [(520, 55), (380, 65), (240, 75)]:
    glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.ellipse((W // 2 - radius, 70 - radius, W // 2 + radius, 70 + radius), fill=(42, 129, 190, alpha))
    glow = glow.filter(ImageFilter.GaussianBlur(90))
    img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")

d = ImageDraw.Draw(img)


def text(x, y, s, size=18, fill="#dff9ff", anchor=None):
    d.text((x, y), s, font=make_font(size), fill=fill, anchor=anchor)


def panel(x, y, w, h, title):
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    ld.rounded_rectangle((x, y, x + w, y + h), radius=8, fill=(12, 44, 88, 190), outline=(66, 170, 255, 110), width=1)
    global img, d
    img = Image.alpha_composite(img.convert("RGBA"), layer).convert("RGB")
    d = ImageDraw.Draw(img)
    d.rectangle((x + 1, y + 1, x + w - 1, y + 46), fill=(28, 91, 170))
    d.line((x, y + 46, x + w, y + 46), fill=(76, 177, 255), width=1)
    if title:
        tw = d.textlength(title, font=make_font(22))
        text(x + (w - tw) / 2, y + 7, title, 22, "#f4fbff")


def bar(x, y, w, h, pct, fill="#30f4ff"):
    d.rounded_rectangle((x, y, x + w, y + h), radius=h // 2, fill=(28, 66, 105))
    fw = max(0, min(w, int(w * pct)))
    if fw:
        d.rounded_rectangle((x, y, x + fw, y + h), radius=h // 2, fill=fill)


def kpi(x, y, w, h, label, value, note, color="#fff"):
    d.rounded_rectangle((x, y, x + w, y + h), radius=8, fill=(9, 36, 82), outline=(50, 120, 190), width=1)
    text(x + 16, y + 14, label, 18, "#a8d8f2")
    text(x + 16, y + 47, str(value), 42, color)
    text(x + 16, y + 98, note, 14, "#75abc9")


def ell(s, n):
    return s if len(s) <= n else s[: n - 1] + "…"


d.rounded_rectangle((42, 36, 84, 78), radius=8, fill="#18d9c2")
text(98, 42, "除湿机生产进度小程序", 24, "#fff")
text(W // 2, 31, "生产进度监控大屏", 38, "#f5feff", anchor="ma")
text(1878, 48, "接口样例更新时间：2026/06/28", 20, "#9ccde9", anchor="ra")
d.line((42, 104, 1878, 104), fill=(88, 196, 255), width=1)

x1, x2, x3 = 42, 574, 1368
colw, centerw = 510, 772
y0, gap, h1, h3 = 132, 22, 258, 354

panel(x1, y0, colw, h1, "项目概览")
for i, (lab, val, pct, warn) in enumerate([("项目总数", 2, 1, False), ("进行中", 2, 1, False), ("已完成", 0, 0, False), ("已逾期", 0, 0, True)]):
    yy = y0 + 70 + i * 42
    text(x1 + 24, yy, lab, 17)
    bar(x1 + 130, yy + 5, 280, 13, pct, "#ff607e" if warn else "#30f4ff")
    text(x1 + 444, yy - 2, str(val), 18, "#fff", anchor="ra")
text(x1 + 24, y0 + 228, "来源：getDashboardStats().projects", 14, "#85b8d3")

panel(x2, y0, centerw, h1, "")
kw = (centerw - 70) // 4
for i, item in enumerate([
    ("项目总数", 2, "listProjects()", "#fff"),
    ("设备总数", 2, "listDevices()", "#23f2ff"),
    ("任务总数", 3, "listTasks()", "#fff"),
    ("未关闭 QB", 1, "listQb({open})", "#ff527d"),
]):
    kpi(x2 + 18 + i * (kw + 12), y0 + 72, kw, 126, *item)

panel(x3, y0, colw, h1, "QB 异常")
for i, (lab, val, pct, warn) in enumerate([("QB 总数", 1, 1, False), ("未关闭", 1, 1, True), ("已关闭", 0, 0, False), ("超30天", 1, 1, True)]):
    yy = y0 + 70 + i * 42
    text(x3 + 24, yy, lab, 17)
    bar(x3 + 130, yy + 5, 280, 13, pct, "#ff607e" if warn else "#30f4ff")
    text(x3 + 444, yy - 2, str(val), 18, "#fff", anchor="ra")
text(x3 + 24, y0 + 228, "来源：getDashboardStats().qb", 14, "#85b8d3")

panel(x1, y0 + h1 + gap, colw, h1, "设备状态分布")
for i, (lab, val, pct) in enumerate([("设备总数", 2, 1), ("生产中", 2, 1), ("已延期", 0, 0), ("未知", 2, 1)]):
    yy = y0 + h1 + gap + 70 + i * 42
    text(x1 + 24, yy, lab, 17)
    bar(x1 + 130, yy + 5, 280, 13, pct)
    text(x1 + 444, yy - 2, str(val), 18, "#fff", anchor="ra")
text(x1 + 24, y0 + h1 + gap + 228, "来源：getDashboardStats().devices", 14, "#85b8d3")

panel(x2, y0 + h1 + gap, centerw, h1 + h3 + gap, "当前接口数据主视图")
cx, cy = x2 + centerw // 2, y0 + h1 + gap + 190
poly = [(cx - 250, cy + 55), (cx + 80, cy - 50), (cx + 285, cy + 35), (cx - 60, cy + 145)]
d.polygon(poly, outline="#45d2ff", fill=(13, 77, 139))
for i in range(12):
    t = i / 11
    d.line((poly[0][0] * (1 - t) + poly[3][0] * t, poly[0][1] * (1 - t) + poly[3][1] * t, poly[1][0] * (1 - t) + poly[2][0] * t, poly[1][1] * (1 - t) + poly[2][1] * t), fill=(60, 170, 220), width=1)
for i in range(10):
    t = i / 9
    d.line((poly[0][0] * (1 - t) + poly[1][0] * t, poly[0][1] * (1 - t) + poly[1][1] * t, poly[3][0] * (1 - t) + poly[2][0] * t, poly[3][1] * (1 - t) + poly[2][1] * t), fill=(60, 170, 220), width=1)
d.line((cx - 215, cy + 55, cx + 210, cy + 25), fill="#ff527d", width=8)
d.line((cx - 180, cy + 112, cx + 180, cy + 70), fill="#ff527d", width=5)
for label, pos, color in [("项目", (cx - 285, cy - 25), "#23f2ff"), ("任务", (cx + 280, cy - 20), "#23f2ff"), ("QB", (cx - 25, cy + 20), "#3fffd0")]:
    x, y = pos
    d.ellipse((x - 42, y - 42, x + 42, y + 42), fill=color, outline="#fff", width=1)
    text(x, y - 15, label, 22, "#042344", anchor="ma")

left, top, tw, th = x2 + 22, y0 + h1 + gap + 430, centerw - 44, 222
d.rectangle((left, top, left + tw, top + th), fill=(5, 23, 52), outline=(79, 178, 255))
headers = ["项目编号", "项目名称", "设备数", "任务数", "进度", "QB"]
widths = [140, 230, 82, 82, 150, 70]
x = left
for h, wid in zip(headers, widths):
    d.rectangle((x, top, x + wid, top + 42), fill=(40, 112, 200))
    text(x + 10, top + 8, h, 16, "#d8f2ff")
    x += wid
for r, row in enumerate([("C26-0501", "除湿机试点项目", "0", "0", 0.28, "0"), ("C26-0422", "中创新航藤洲", "2", "16", 0.13, "1")]):
    y = top + 42 + r * 54
    x = left
    for i, (val, wid) in enumerate(zip(row, widths)):
        d.line((left, y + 54, left + tw, y + 54), fill=(83, 177, 255), width=1)
        if i == 4:
            bar(x + 10, y + 22, wid - 20, 10, val)
        elif i == 5:
            text(x + 24, y + 13, val, 18, "#ff81a0" if val == "1" else "#7df7ff")
        else:
            text(x + 10, y + 13, str(val), 16)
        x += wid

panel(x3, y0 + h1 + gap, colw, h1, "任务概览")
for i, (lab, val, pct, warn) in enumerate([("任务总数", 3, 1, False), ("进行中", 1, 0.33, False), ("待部门派单", 1, 0.33, True), ("处理中", 1, 0.33, False)]):
    yy = y0 + h1 + gap + 70 + i * 42
    text(x3 + 24, yy, lab, 17)
    bar(x3 + 154, yy + 5, 256, 13, pct, "#ff607e" if warn else "#30f4ff")
    text(x3 + 444, yy - 2, str(val), 18, "#fff", anchor="ra")
text(x3 + 24, y0 + h1 + gap + 228, "来源：getDashboardStats().tasks", 14, "#85b8d3")

panel(x1, y0 + (h1 + gap) * 2, colw, h3, "当前任务明细")
tl, tt = x1 + 14, y0 + (h1 + gap) * 2 + 58
cols = [90, 140, 168, 84]
x = tl
for h, wid in zip(["类型", "项目/设备", "工序/QB", "状态"], cols):
    d.rectangle((x, tt, x + wid, tt + 38), fill=(40, 112, 200))
    text(x + 7, tt + 8, h, 14, "#d8f2ff")
    x += wid
for r, item in enumerate([("生产任务", "C26-0422-01", "电气设计", "进行中"), ("待分配", "C26-0422-02", "结构设计", "待派单"), ("QB待处理", "C26-0422", "电柜风扇防护网不贴合", "处理中")]):
    y = tt + 38 + r * 58
    x = tl
    for i, (val, wid) in enumerate(zip(item, cols)):
        d.line((tl, y + 58, tl + sum(cols), y + 58), fill=(83, 177, 255), width=1)
        text(x + 7, y + 17, ell(val, 10 if i != 2 else 13), 14)
        x += wid

panel(x3, y0 + (h1 + gap) * 2, colw, h3, "当前接口未提供")
for i, line in enumerate(["工单产出趋势、良品数、不良品数、员工绩效 Top5、工序产量报工", "当前 service 接口没有对应字段，本稿不展示虚构数据。"]):
    text(x3 + colw // 2, y0 + (h1 + gap) * 2 + 118 + i * 42, line, 18, "#9ccde9", anchor="ma")
text(x3 + 24, y0 + (h1 + gap) * 2 + 272, "建议新增：workOrders / productionReports / qualityRecords / getWorkshopScreenStats()", 13, "#85b8d3")

text(42, 1056, "数据一对一来源：services/data-service.js 的 getDashboardStats / listProjects / listQb / listTasks；当前为 mock 样例数据截图。", 14, "#9ed3ef")

os.makedirs(os.path.dirname(OUT), exist_ok=True)
img.save(OUT)
print(os.path.abspath(OUT))
