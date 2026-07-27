# -*- coding: utf-8 -*-
"""
暖音色音效合成器 —— 为「宝宝识字」自制契合软萌 3D 画风的 UI 音效。
不用裸振荡器（那是「电子哔」的根源）；而是模拟真实敲击类乐器的物理特征：
  1. 丰富泛音叠加，且高次泛音衰减更快（马林巴/木琴/音乐盒的木质、金属质感来源）；
  2. 敲击瞬态（极短噪声/click，给「被敲响」的实感）；
  3. 轻微失谐（inharmonicity，让铃铛/音乐盒不呆板）；
  4. 指数衰减包络 + 极快 attack（自然、有机）；
  5. 尾部小混响（premium app 的「空间感/高级感」）。

输出标准 WAV（44.1kHz / 16bit / 单声道）→ public/_audition/*.wav
浏览器与 iPad Safari 均原生支持 wav，无需 ffmpeg 转码。

用法：python scripts/gen-warm-sfx.py
"""
import numpy as np
import os
import struct
import wave

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "public", "_audition")
os.makedirs(OUT, exist_ok=True)

# ---------- 基础工具 ----------

def t_arr(dur):
    return np.linspace(0, dur, int(SR * dur), endpoint=False)

def env_exp(dur, attack=0.004, decay=None, floor=1e-4):
    """快 attack + 指数衰减包络。decay 为 None 时衰减到 dur 末端。"""
    n = int(SR * dur)
    t = np.linspace(0, dur, n, endpoint=False)
    a = int(SR * attack)
    e = np.ones(n)
    if a > 0:
        e[:a] = np.linspace(0, 1, a)
    # 指数衰减
    tau = (decay if decay else dur) / 3.5
    e[a:] = np.exp(-(t[a:] - t[a]) / tau)
    return e

def midi(n):
    """MIDI 音高 → 频率。用音名方便写旋律：A4=69=440。"""
    return 440.0 * 2 ** ((n - 69) / 12.0)

# 常用音名 → MIDI
NOTE = {
    'C4': 60, 'D4': 62, 'E4': 64, 'F4': 65, 'G4': 67, 'A4': 69, 'B4': 71,
    'C5': 72, 'D5': 74, 'E5': 76, 'F5': 77, 'G5': 79, 'A5': 81, 'B5': 83,
    'C6': 84, 'D6': 86, 'E6': 88, 'F6': 89, 'G6': 91, 'A6': 93,
    'Cs5': 73, 'Ds5': 75, 'Fs5': 78, 'Gs5': 80, 'As5': 82,
    'Cs6': 85, 'Ds6': 87, 'Fs6': 90,
}

def hz(name):
    return midi(NOTE[name])

# ---------- 音色引擎 ----------

def marimba(freq, dur=0.5, gain=0.5, attack=0.003):
    """马林巴/木琴：木质、温暖。基频 + 强第4泛音（马林巴标志）+ 弱高次，快速衰减。"""
    t = t_arr(dur)
    # 马林巴的泛音结构：1, 3.9(≈4), 9.2 —— 非整数，木条振动特征
    partials = [(1.0, 1.0, dur), (3.93, 0.42, dur * 0.55), (9.2, 0.18, dur * 0.3)]
    sig = np.zeros(len(t))
    for mult, amp, pdur in partials:
        e = env_exp(dur, attack=attack, decay=pdur)
        sig += amp * np.sin(2 * np.pi * freq * mult * t) * e
    # 敲击瞬态：极短噪声 burst，给「木槌敲击」实感
    click_n = int(SR * 0.006)
    click = np.random.randn(click_n) * np.exp(-np.linspace(0, 6, click_n)) * 0.25
    sig[:click_n] += click
    sig *= gain / (np.max(np.abs(sig)) + 1e-9)
    return sig

def musicbox(freq, dur=0.9, gain=0.5, attack=0.002):
    """音乐盒：明亮、清脆、带金属甜味 + 长 shimmer 尾。泛音接近整数但略失谐。"""
    t = t_arr(dur)
    partials = [(1.0, 1.0, dur), (2.01, 0.5, dur * 0.7), (3.02, 0.3, dur * 0.5),
                (4.05, 0.16, dur * 0.35), (5.4, 0.08, dur * 0.25)]
    sig = np.zeros(len(t))
    for mult, amp, pdur in partials:
        e = env_exp(dur, attack=attack, decay=pdur)
        sig += amp * np.sin(2 * np.pi * freq * mult * t) * e
    sig *= gain / (np.max(np.abs(sig)) + 1e-9)
    return sig

def kalimba(freq, dur=0.6, gain=0.5):
    """卡林巴/拇指琴：圆润、温柔弹拨，泛音少而软。"""
    t = t_arr(dur)
    partials = [(1.0, 1.0, dur), (2.0, 0.35, dur * 0.6), (3.0, 0.12, dur * 0.4)]
    sig = np.zeros(len(t))
    for mult, amp, pdur in partials:
        e = env_exp(dur, attack=0.004, decay=pdur)
        sig += amp * np.sin(2 * np.pi * freq * mult * t) * e
    sig *= gain / (np.max(np.abs(sig)) + 1e-9)
    return sig

def bell(freq, dur=1.2, gain=0.5):
    """软铃铛/钟琴：失谐泛音（含小三度以上），清亮但不刺耳。"""
    t = t_arr(dur)
    # 钟的经典失谐泛音比：0.56,1,1.19,1.71,2,2.74,3,3.76,4.07（取子集，软化）
    partials = [(1.0, 1.0, dur), (1.19, 0.55, dur * 0.8), (1.71, 0.3, dur * 0.6),
                (2.0, 0.28, dur * 0.5), (2.74, 0.14, dur * 0.35), (3.0, 0.1, dur * 0.3)]
    sig = np.zeros(len(t))
    for mult, amp, pdur in partials:
        e = env_exp(dur, attack=0.002, decay=pdur)
        sig += amp * np.sin(2 * np.pi * freq * mult * t) * e
    sig *= gain / (np.max(np.abs(sig)) + 1e-9)
    return sig

def bubble(f_start=900, f_end=380, dur=0.13, gain=0.55):
    """水泡「啵」：正弦快速下滑 + 谐振感，圆润不尖。"""
    t = t_arr(dur)
    # 指数下滑更像水泡
    f = f_start * (f_end / f_start) ** (t / dur)
    phase = 2 * np.pi * np.cumsum(f) / SR
    e = env_exp(dur, attack=0.002, decay=dur * 0.7)
    sig = np.sin(phase) * e
    # 加一点二次泛音软化
    sig += 0.25 * np.sin(2 * phase) * e
    sig *= gain / (np.max(np.abs(sig)) + 1e-9)
    return sig

def woodblock(freq=800, dur=0.09, gain=0.5):
    """木鱼/木块轻敲：短促、干、木质。"""
    t = t_arr(dur)
    partials = [(1.0, 1.0, dur), (2.7, 0.4, dur * 0.5), (5.1, 0.15, dur * 0.3)]
    sig = np.zeros(len(t))
    for mult, amp, pdur in partials:
        e = env_exp(dur, attack=0.001, decay=pdur)
        sig += amp * np.sin(2 * np.pi * freq * mult * t) * e
    click_n = int(SR * 0.004)
    sig[:click_n] += np.random.randn(click_n) * np.exp(-np.linspace(0, 8, click_n)) * 0.2
    sig *= gain / (np.max(np.abs(sig)) + 1e-9)
    return sig

def noise_sweep(f_lo=1200, f_hi=4000, dur=0.18, gain=0.3, up=False):
    """翻页/挥动：带通噪声扫频，柔和的 whoosh。"""
    n = int(SR * dur)
    noise = np.random.randn(n)
    # 简单一阶低通逐样本，截止频率随时间移动 —— 近似带通扫
    t = np.linspace(0, 1, n)
    cutoff = (f_lo + (f_hi - f_lo) * (t if up else (1 - t)))
    out = np.zeros(n)
    prev = 0.0
    for i in range(n):
        alpha = np.clip(cutoff[i] / (SR / 2), 0.01, 0.99)
        prev = prev + alpha * (noise[i] - prev)
        out[i] = prev
    # 钟形音量包络（中间响两头弱），whoosh 感
    win = np.sin(np.pi * t) ** 1.5
    out *= win
    out *= gain / (np.max(np.abs(out)) + 1e-9)
    return out

def splash(dur=0.22, gain=0.5):
    """入水「扑通」：低频下滑 + 水花噪声。"""
    t = t_arr(dur)
    f = 520 * (110 / 520) ** (t / dur)
    phase = 2 * np.pi * np.cumsum(f) / SR
    e = env_exp(dur, attack=0.002, decay=dur * 0.6)
    body = np.sin(phase) * e
    # 水花：高频噪声，快速衰减
    noise = np.random.randn(len(t)) * np.exp(-t / (dur * 0.18)) * 0.3
    sig = body + noise
    sig *= gain / (np.max(np.abs(sig)) + 1e-9)
    return sig

# ---------- 组合 / 混音工具 ----------

def place(canvas, sig, at):
    """把 sig 叠加到 canvas 的 at 秒处。"""
    i = int(SR * at)
    end = i + len(sig)
    if end > len(canvas):
        canvas = np.concatenate([canvas, np.zeros(end - len(canvas))])
    canvas[i:end] += sig
    return canvas

def blank(dur):
    return np.zeros(int(SR * dur))

def reverb(sig, amount=0.16, decay=0.28):
    """极简 Schroeder 风格尾混响：几个衰减延迟叠加，给空间感/高级感。"""
    out = sig.copy()
    for delay_ms, g in [(23, 0.6), (37, 0.5), (53, 0.42), (71, 0.34)]:
        d = int(SR * delay_ms / 1000)
        tail = np.zeros(len(sig) + d)
        tail[d:d + len(sig)] += sig * g
        # 衰减重复
        fb = tail.copy()
        for k in range(1, 4):
            shift = d * k
            if shift < len(fb):
                fb[shift:] += tail[:len(fb) - shift] * (decay ** k)
        if len(fb) > len(out):
            out = np.concatenate([out, np.zeros(len(fb) - len(out))])
        out[:len(fb)] += fb * amount
    return out

def finalize(sig, peak=0.82, tail=0.06):
    """软限幅 + 归一 + 末尾留白防爆音。"""
    sig = reverb(sig)
    m = np.max(np.abs(sig)) + 1e-9
    sig = sig / m * peak
    # 软饱和（tanh）去掉尖峰的硬感
    sig = np.tanh(sig * 1.1) / np.tanh(1.1)
    sig = np.concatenate([sig, np.zeros(int(SR * tail))])
    return sig

def save(name, sig):
    sig = np.clip(sig, -1, 1)
    data = (sig * 32767).astype('<i2').tobytes()
    path = os.path.join(OUT, name + ".wav")
    with wave.open(path, 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)
    return path

# =====================================================================
# 18+ 音效定义 —— 每类给 2-3 个变体（v1/v2/v3），供人耳挑选，不堆重复。
# =====================================================================

def build():
    made = []

    def emit(group, variant, sig):
        name = f"{group}__{variant}"
        save(name, finalize(sig))
        made.append((group, variant, name))

    # --- tap 点击：短促木质单音 ---
    emit('tap', 'marimba', marimba(hz('C6'), dur=0.14, gain=0.5))
    emit('tap', 'kalimba', kalimba(hz('G5'), dur=0.16, gain=0.5))
    emit('tap', 'woodblock', woodblock(900, dur=0.08))

    # --- correct 答对：上行两音，愉悦 ---
    c = blank(0.5); c = place(c, marimba(hz('E5'), 0.28), 0); c = place(c, marimba(hz('A5'), 0.34), 0.11)
    emit('correct', 'marimba-up', c)
    c = blank(0.6); c = place(c, musicbox(hz('E5'), 0.4), 0); c = place(c, musicbox(hz('B5'), 0.5), 0.12)
    emit('correct', 'musicbox-up', c)
    c = blank(0.55); c = place(c, kalimba(hz('G5'), 0.3), 0); c = place(c, kalimba(hz('C6'), 0.4), 0.1)
    emit('correct', 'kalimba-up', c)

    # --- wrong 答错：柔和低音，不吓人（下行小三度，温润）---
    c = blank(0.5); c = place(c, marimba(hz('E4'), 0.3, gain=0.4), 0); c = place(c, marimba(hz('C4'), 0.36, gain=0.4), 0.13)
    emit('wrong', 'marimba-soft', c)
    c = blank(0.5); c = place(c, kalimba(hz('D4'), 0.34, gain=0.4), 0); c = place(c, kalimba(hz('A4') / 2, 0.36, gain=0.4), 0.12)
    emit('wrong', 'kalimba-soft', c)

    # --- swoosh 翻页：柔和 whoosh ---
    emit('swoosh', 'soft', noise_sweep(900, 3000, dur=0.2, gain=0.32))
    emit('swoosh', 'up', noise_sweep(700, 3200, dur=0.18, gain=0.32, up=True))

    # --- star 得星：三连上行 music-box，闪亮 + shimmer ---
    c = blank(0.9)
    for i, nm in enumerate(['A5', 'Cs6', 'E6']):
        c = place(c, musicbox(hz(nm), 0.5), 0.09 * i)
    emit('star', 'musicbox', c)
    c = blank(0.9)
    for i, nm in enumerate(['G5', 'B5', 'D6']):
        c = place(c, bell(hz(nm), 0.6, gain=0.4), 0.08 * i)
    emit('star', 'bell', c)

    # --- coin 金币：清脆双击（钟琴）---
    c = blank(0.45); c = place(c, bell(hz('B5'), 0.28, gain=0.45), 0); c = place(c, bell(hz('E6'), 0.34, gain=0.45), 0.07)
    emit('coin', 'bell', c)
    c = blank(0.4); c = place(c, musicbox(hz('C6'), 0.22), 0); c = place(c, musicbox(hz('G6'), 0.3), 0.06)
    emit('coin', 'musicbox', c)

    # --- chest 开宝箱：琶音上行 + shimmer 尾 ---
    c = blank(1.2)
    for i, nm in enumerate(['C5', 'E5', 'G5', 'C6']):
        c = place(c, musicbox(hz(nm), 0.6), 0.1 * i)
    c = place(c, bell(hz('E6'), 0.8, gain=0.3), 0.45)  # 顶部 shimmer
    emit('chest', 'musicbox-arp', c)
    c = blank(1.2)
    for i, nm in enumerate(['C5', 'G5', 'C6', 'E6']):
        c = place(c, marimba(hz(nm), 0.5), 0.09 * i)
    emit('chest', 'marimba-arp', c)

    # --- levelup 升级：欢快三连 + 尾音 ---
    c = blank(1.0)
    for i, nm in enumerate(['E5', 'G5', 'C6']):
        c = place(c, marimba(hz(nm), 0.4), 0.11 * i)
    c = place(c, bell(hz('C6'), 0.7, gain=0.35), 0.33)
    emit('levelup', 'marimba', c)
    c = blank(1.0)
    for i, nm in enumerate(['C5', 'E5', 'G5', 'C6']):
        c = place(c, musicbox(hz(nm), 0.5), 0.1 * i)
    emit('levelup', 'musicbox', c)

    # --- pop 气泡破：水泡「啵」 ---
    emit('pop', 'bubble-hi', bubble(1000, 380, dur=0.12))
    emit('pop', 'bubble-mid', bubble(720, 260, dur=0.13))

    # --- whack 敲击：软木槌闷击 ---
    emit('whack', 'wood', woodblock(280, dur=0.12, gain=0.5))
    emit('whack', 'soft', marimba(hz('C4') / 2 * 3, dur=0.14, gain=0.5))

    # --- heartbreak 惋惜：柔和下行两音，比 wrong 更轻 ---
    c = blank(0.7); c = place(c, kalimba(hz('G4'), 0.4, gain=0.38), 0); c = place(c, kalimba(hz('E4'), 0.44, gain=0.36), 0.16)
    emit('heartbreak', 'kalimba', c)
    c = blank(0.7); c = place(c, musicbox(hz('A4'), 0.4, gain=0.36), 0); c = place(c, musicbox(hz('F4'), 0.46, gain=0.34), 0.15)
    emit('heartbreak', 'musicbox', c)

    # --- victory 闯关胜利：暖小旋律（马林巴 + 铃铛收尾）---
    c = blank(1.6)
    mel = [('C5', 0), ('E5', 0.12), ('G5', 0.24), ('C6', 0.36), ('G5', 0.52), ('C6', 0.64)]
    for nm, at in mel:
        c = place(c, marimba(hz(nm), 0.5), at)
    c = place(c, bell(hz('C6'), 1.0, gain=0.3), 0.64)
    emit('victory', 'marimba-melody', c)
    c = blank(1.6)
    for nm, at in mel:
        c = place(c, musicbox(hz(nm), 0.55), at)
    emit('victory', 'musicbox-melody', c)

    # --- fail 失败：温和下行三音，不吓人 ---
    c = blank(1.0)
    for i, nm in enumerate(['A4', 'F4', 'D4']):
        c = place(c, kalimba(hz(nm), 0.45, gain=0.38), 0.14 * i)
    emit('fail', 'kalimba', c)
    c = blank(1.0)
    for i, nm in enumerate(['G4', 'E4', 'C4']):
        c = place(c, marimba(hz(nm), 0.42, gain=0.4), 0.14 * i)
    emit('fail', 'marimba', c)

    # --- tick 滴答：极短木质 ---
    emit('tick', 'wood', woodblock(1100, dur=0.05, gain=0.4))
    emit('tick', 'kalimba', kalimba(hz('C6'), dur=0.07, gain=0.4))

    # --- splash 入水 ---
    emit('splash', 'plop', splash(dur=0.22))
    emit('splash', 'soft', splash(dur=0.28, gain=0.45))

    # --- pluck 摘取：卡林巴单弹 ---
    emit('pluck', 'kalimba', kalimba(hz('D6'), dur=0.3, gain=0.5))
    emit('pluck', 'marimba', marimba(hz('E6'), dur=0.22, gain=0.5))

    # --- combo 连击：上行两音（可变调，这里出中间调）---
    c = blank(0.4); c = place(c, marimba(hz('E5'), 0.2), 0); c = place(c, marimba(hz('A5'), 0.26), 0.07)
    emit('combo', 'marimba', c)
    c = blank(0.4); c = place(c, musicbox(hz('G5'), 0.24), 0); c = place(c, musicbox(hz('C6'), 0.3), 0.06)
    emit('combo', 'musicbox', c)

    # --- achievement 成就/每日奖励：温柔通知音 ---
    c = blank(1.1)
    for i, nm in enumerate(['G5', 'C6', 'E6']):
        c = place(c, musicbox(hz(nm), 0.6), 0.13 * i)
    c = place(c, bell(hz('G5'), 0.9, gain=0.28), 0)
    emit('achievement', 'musicbox', c)
    c = blank(1.0); c = place(c, bell(hz('C6'), 0.8, gain=0.4), 0); c = place(c, bell(hz('G6'), 0.9, gain=0.35), 0.14)
    emit('achievement', 'bell', c)

    return made


if __name__ == '__main__':
    np.random.seed(7)  # 固定噪声，结果可复现
    made = build()
    # 分组统计
    from collections import defaultdict
    g = defaultdict(list)
    for grp, var, name in made:
        g[grp].append(var)
    print(f"✓ 已合成 {len(made)} 个暖音色候选 → public/_audition/")
    for grp, vs in g.items():
        print(f"   - {grp}: {', '.join(vs)}")
