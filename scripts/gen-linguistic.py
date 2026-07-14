# -*- coding: utf-8 -*-
"""为课程里的 300 字生成语言学数据：拼音、部首、部件（拆字）。

- 拼音：pypinyin（带声调符号）。多音字取最常用读音，需人工抽查。
- 拆字：hanzi_chaizi（汉字 -> 部件列表），Apache-2.0。
- 输出：scripts/generated/linguistic.json  { "日": {"pinyin": "rì", "components": ["口","一"]}, ... }

用法：python scripts/gen-linguistic.py
输入字表：从 scripts/generated/charlist.json 读取（由 build-content 前置步骤写出），
         若不存在则回退到内置读取 curriculum 的方式（这里用命令行传入）。
"""
import json
import os
import sys

from pypinyin import lazy_pinyin, Style
from hanzi_chaizi import HanziChaizi

HERE = os.path.dirname(os.path.abspath(__file__))
GEN_DIR = os.path.join(HERE, "generated")
CHARLIST_PATH = os.path.join(GEN_DIR, "charlist.json")
OUT_PATH = os.path.join(GEN_DIR, "linguistic.json")


def main():
    if not os.path.exists(CHARLIST_PATH):
        print(f"缺少字表 {CHARLIST_PATH}，请先运行 build-content 的导出步骤。", file=sys.stderr)
        sys.exit(1)

    with open(CHARLIST_PATH, "r", encoding="utf-8") as f:
        chars = json.load(f)

    hc = HanziChaizi()
    result = {}
    for ch in chars:
        # 拼音（带声调），多音字取默认最常用读音。
        py = lazy_pinyin(ch, style=Style.TONE)
        pinyin = py[0] if py else ""

        # 拆字：可能失败（生僻或库中无），失败则给单字本身。
        try:
            comps = hc.query(ch)
            components = list(comps) if comps else [ch]
        except Exception:
            components = [ch]

        result[ch] = {"pinyin": pinyin, "components": components}

    os.makedirs(GEN_DIR, exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"✓ 已生成 {len(result)} 字的语言学数据 -> scripts/generated/linguistic.json")


if __name__ == "__main__":
    main()
