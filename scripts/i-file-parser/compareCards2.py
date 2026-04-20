#!/usr/bin/env python3
"""Card-by-card comparison - strips inline comments, handles number formats."""
import sys, re

def parse_cards(filepath):
    cards = {}
    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        for line in f:
            line = line.rstrip('\n')
            if not line or line.startswith('*') or line.startswith('=') or line.startswith('.'):
                continue
            # Strip inline comments: anything after standalone *
            # But keep * that's part of data (e.g., card numbers)
            parts = line.split()
            if not parts or not parts[0][0].isdigit():
                continue
            try:
                int(parts[0])
            except ValueError:
                continue
            # Remove inline comment words (starting with *)
            data_words = []
            for p in parts[1:]:
                if p.startswith('*'):
                    break
                data_words.append(p)
            cards[parts[0]] = data_words
    return cards

def num_equal(a, b):
    try:
        fa, fb = float(a), float(b)
        if fa == 0 and fb == 0:
            return True
        return abs(fa - fb) < 1e-6 * max(abs(fa), abs(fb), 1)
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

    format_only = 0
    functional = []

    for k in sorted(orig):
        if k not in expo:
            continue
        ow, ew = orig[k], expo[k]
        if ow == ew:
            continue
        if words_equal(ow, ew):
            format_only += 1
        else:
            functional.append((k, ow, ew))

    # Categorize functional diffs
    cats = {}
    for k, ow, ew in functional:
        cn = int(k)
        if cn < 1000:
            cat = 'global'
        elif cn < 10000000:
            ccc = cn // 10000
            xxxx = cn % 10000
            cat = f'hydro_{xxxx//100:02d}xx'
        elif cn < 20000000:
            local = cn % 10000
            cat = f'hs_{local//100:02d}xx'
        elif cn < 20300000:
            cat = 'general_table'
        elif cn < 20600000:
            cat = 'control_system'
        else:
            cat = 'other'
        if cat not in cats:
            cats[cat] = []
        cats[cat].append((k, ow, ew))

    print(f"=== 비교 결과 ===")
    print(f"원본: {len(orig)}, Export: {len(expo)}")
    print(f"원본만: {len(only_orig)}, Export만: {len(only_expo)}")
    print(f"포맷만 다름: {format_only}")
    print(f"기능적 차이: {len(functional)}")
    print()

    for cat in sorted(cats):
        items = cats[cat]
        print(f"[{cat}] {len(items)}개:")
        for k, ow, ew in items[:5]:
            diffs = []
            maxlen = max(len(ow), len(ew))
            for i in range(maxlen):
                wo = ow[i] if i < len(ow) else '-'
                we = ew[i] if i < len(ew) else '-'
                if wo != we and not num_equal(wo, we):
                    diffs.append(f"W{i+1}:{wo}→{we}")
            print(f"  {k}: {', '.join(diffs[:4])}")
        if len(items) > 5:
            print(f"  ... 외 {len(items)-5}개")
        print()

if __name__ == '__main__':
    categorize(sys.argv[1], sys.argv[2])
