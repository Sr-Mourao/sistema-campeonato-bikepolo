# Uso (na raiz do projeto, com Pillow instalado): python scripts/recortar_artes.py
# Lê as artes originais de ARTES/ e grava os recortes em public/identidade/artes/.
# Recorta o fundo branco das artes: o branco ligado à borda e as áreas de
# branco PURO presas entre braço e corpo. O pelo branco pintado tem textura
# e tom creme, então fica.
from PIL import Image, ImageDraw, ImageFilter
import sys
src, out = 'ARTES/', 'public/identidade/artes/'
KEY = (1, 254, 2)

def cut(name, maxside=900):
    im = Image.open(src + name).convert('RGB')
    if max(im.size) > maxside: im.thumbnail((maxside, maxside))
    w, h = im.size
    work = im.copy(); wp = work.load(); ip = im.load()
    step = max(4, w // 80)
    seeds = [(x, 0) for x in range(0, w, step)] + [(x, h - 1) for x in range(0, w, step)] + \
            [(0, y) for y in range(0, h, step)] + [(w - 1, y) for y in range(0, h, step)]
    for sx, sy in seeds:
        p = wp[sx, sy]
        if p != KEY and min(p) > 215: ImageDraw.floodfill(work, (sx, sy), KEY, thresh=60)
    # áreas brancas presas: testa a pureza de cada uma
    k = 0
    for y in range(0, h, 3):
        for x in range(0, w, 3):
            p = wp[x, y]
            if p[0] > 200 and min(p) > 215:
                k += 1; tag = (3, k % 250, (k // 250) % 250 + 3)
                ImageDraw.floodfill(work, (x, y), tag, thresh=60)
                pts = [(xx, yy) for yy in range(max(0, y - 120), min(h, y + 120)) for xx in range(max(0, x - 120), min(w, x + 120)) if wp[xx, yy] == tag]
                pure = sum(1 for xx, yy in pts if min(ip[xx, yy]) >= 250)
                if len(pts) > 600 and pure / len(pts) > 0.97:
                    ImageDraw.floodfill(work, (x, y), KEY, thresh=0)
    mask = Image.new('L', (w, h), 255); mp = mask.load()
    for y in range(h):
        for x in range(w):
            if wp[x, y] == KEY: mp[x, y] = 0
    mask = mask.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
    rgba = im.convert('RGBA'); rgba.putalpha(mask)
    return rgba.crop(mask.getbbox())

def save(img, name):
    img.save(out + name + '.webp', 'WEBP', quality=88, method=6); print(name, img.size)

def trim(img): return img.crop(img.getchannel('A').getbbox())

save(cut('LOBOS_00002.png'), 'lobo-comemora')
save(cut('LOBOS_00001.png'), 'lobo-taco')
save(cut('LOBOS_00004 (1).png'), 'lobo-encostado')
duo = cut('LOBOS_00003.png', 1100); W, H = duo.size; a = duo.getchannel('A')
cols = [sum(1 for y in range(0, H, 4) if a.getpixel((x, y)) > 20) for x in range(W)]
gap = min(range(W // 3, 2 * W // 3), key=lambda x: cols[x])
save(trim(duo.crop((0, 0, gap, H))), 'lobo-duvida')
save(trim(duo.crop((gap, 0, W, H))), 'lobo-bravo')
save(cut('BRACO_00004.png'), 'braco-taco')
save(cut('BRACO_00003.png'), 'braco-bola')
save(cut('TRAVE_00001.png'), 'trave')
