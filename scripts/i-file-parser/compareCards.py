#!/usr/bin/env python3
"""Card-by-card comparison of two MARS .i files."""
import sys

def parse_cards(filepath):
    cards = {}
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            line = line.rstrip('\n')
            if not line or line.startswith('*') or line.startswith('=') or line.startswith('.'):
                continue
            parts = line.split()
            if not parts:
                continue
            card_num = parts[0]
            if not card_num[0].isdigit():
                continue
            try:
                int(card_num)
            except ValueError:
                continue
            cards[card_num] = ' '.join(parts[1:]) if len(parts) > 1 else ''
    return cards

def num_equal(a, b):
    try:
        fa, fb = float(a), float(b)
        if fa == 0 and fb == 0:
            return True
        return abs(fa - fb) < 1e-10 * max(abs(fa), abs(fb), 1)
    except:
        return False

def words_equal(ow, ew):
    if len(ow) != len(ew):
        return False
    return all(a == b or num_equal(a, b) for a, b in zip(ow, ew))

def categorize(file1, file2):
    orig = parse_cards(file1)
    expo = parse_cards(file2)

    only_orig = [(k, orig[k]) for k in sorted(orig) if k not in expo]
    only_expo = [(k, expo[k]) for k in sorted(expo) if k not in orig]

    format_only = []
    functional = []

    for k in sorted(orig):
        if k not in expo:
            continue
        if orig[k] == expo[k]:
            continue
        ow = orig[k].split()
        ew = expo[k].split()
        if words_equal(ow, ew):
            format_only.append(k)
        else:
            functional.append((k, orig[k], expo[k]))

    print(f"=== 비교 결과 ===")
    print(f"원본 카드: {len(orig)}, Export 카드: {len(expo)}")
    print(f"원본만 존재: {len(only_orig)}")
    print(f"Export만 존재: {len(only_expo)}")
    print(f"포맷만 다름 (기능 동일): {len(format_only)}")
    print(f"기능적 차이: {len(functional)}")
    print()

    if only_orig:
        print(f"--- 원본만 존재 ({len(only_orig)}개) ---")
        for k, v in only_orig[:30]:
            print(f"  {k}: {v[:80]}")
        if len(only_orig) > 30:
            print(f"  ... 외 {len(only_orig)-30}개")
        print()

    if only_expo:
        print(f"--- Export만 존재 ({len(only_expo)}개) ---")
        for k, v in only_expo[:30]:
            print(f"  {k}: {v[:80]}")
        if len(only_expo) > 30:
            print(f"  ... 외 {len(only_expo)-30}개")
        print()

    if functional:
        print(f"--- 기능적 차이 ({len(functional)}개) ---")
        for k, o, e in functional[:50]:
            ow = o.split()
            ew = e.split()
            diffs = []
            maxlen = max(len(ow), len(ew))
            for i in range(maxlen):
                wo = ow[i] if i < len(ow) else 'N/A'
                we = ew[i] if i < len(ew) else 'N/A'
                if wo != we and not num_equal(wo, we):
                    diffs.append(f"W{i+1}:{wo}→{we}")
            print(f"  {k}: {', '.join(diffs[:5])}")
        if len(functional) > 50:
            print(f"  ... 외 {len(functional)-50}개")

if __name__ == '__main__':
    categorize(sys.argv[1], sys.argv[2])
