"""Auxiliar do validar-visual.mjs: compara capturas e monta uma imagem única de baixa resolução.

Uso (JSON no stdin):
  {"cmd": "diff", "a": "baseline.png", "b": "atual.png"}      -> {"pct": 0.0, "tamanho": false}
  {"cmd": "montagem", "itens": [{"arq": "x.jpg", "rotulo": "dashboard desktop"}], "saida": "m.jpg"}
"""
import json
import sys

from PIL import Image, ImageChops, ImageDraw


def diff(a, b):
    A, B = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    if A.size != B.size:
        return {"pct": 100.0, "tamanho": True}
    d = ImageChops.difference(A, B).convert("L").point(lambda v: 255 if v > 24 else 0)
    return {"pct": round(d.histogram()[255] * 100 / (A.width * A.height), 3), "tamanho": False}


def montagem(itens, saida, largura_max=1800, altura_linha=620):
    quadros = []
    for it in itens:
        im = Image.open(it["arq"]).convert("RGB")
        f = min(1.0, altura_linha / im.height)
        im = im.resize((max(1, int(im.width * f)), max(1, int(im.height * f))), Image.LANCZOS)
        quadros.append((it["rotulo"], im))
    gap, topo = 12, 22
    linhas, atual, w = [], [], 0
    for q in quadros:
        if atual and w + q[1].width + gap > largura_max:
            linhas.append(atual)
            atual, w = [], 0
        atual.append(q)
        w += q[1].width + gap
    if atual:
        linhas.append(atual)
    alturas = [max(q[1].height for q in l) + topo + gap for l in linhas]
    tela = Image.new("RGB", (largura_max, sum(alturas) + gap), (24, 24, 30))
    dr, y = ImageDraw.Draw(tela), gap
    for l, h in zip(linhas, alturas):
        x = gap
        for rot, im in l:
            dr.text((x, y), rot, fill=(220, 220, 235))
            tela.paste(im, (x, y + topo))
            x += im.width + gap
        y += h
    tela.crop((0, 0, largura_max, y)).save(saida, "JPEG", quality=60)
    return {"saida": saida}


if __name__ == "__main__":
    c = json.load(sys.stdin)
    r = diff(c["a"], c["b"]) if c["cmd"] == "diff" else montagem(c["itens"], c["saida"])
    print(json.dumps(r))
