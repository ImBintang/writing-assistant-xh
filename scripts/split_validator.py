#!/usr/bin/env python3
# scripts/split_validator.py
# Anomaly detection script for writing-assistant.
# Reads _meta.json path from stdin JSON, updates it with anomaly records,
# writes the result JSON to stdout. All logging goes to stderr.
#
# Input (stdin):  { "metaPath": "/path/to/_meta.json" }
# Output (stdout): { "success": true, "meta": { ... } } or { "success": false, "error": "..." }

import sys
import json
import os
import re
from pathlib import Path
from collections import Counter


# ==============================================================================
# Anomaly Detection Functions
# ==============================================================================

def detect_orphan_titles(meta: dict, source_text: str, lines: list) -> list:
    """Detect chapter titles that are likely body-text references, not real headings.

    Uses a 4-factor weighted scoring system:
      A: Blank-line isolation  (0-3 points)
      B: Content volume         (0-3 points)
      C: Title uniqueness       (0-2 points)
      D: Positional plausibility (0-2 points)

    Chapters scoring <= 4 total are flagged as orphan_title.
    """
    anomalies = []
    chapters = meta.get('chapters', [])
    total_chapters = len(chapters)

    if not chapters:
        return anomalies

    for ch in chapters:
        if ch.get('type') == 'preamble':
            continue

        score = 0

        # Factor A: Blank-line isolation (0-3)
        line_idx = ch['lineStart'] - 1  # convert to 0-based
        if line_idx < len(lines):
            # A1: Title is the only content on its line
            title_line = lines[line_idx].strip()
            if title_line and title_line == ch['title']:
                score += 1
            else:
                # Line has extra content before/after the title text
                pass

        # A2: Line before is empty/whitespace-only
        if line_idx > 0 and not lines[line_idx - 1].strip():
            score += 1

        # A3: Line after is empty/whitespace-only
        if line_idx + 1 < len(lines) and not lines[line_idx + 1].strip():
            score += 1

        # Factor B: Content volume (0-3)
        char_count = ch['charCount']
        if char_count >= 200:
            score += 1
        if char_count >= 500:
            score += 1
        if char_count >= 1000:
            score += 1

        # Factor C: Title uniqueness (0-2)
        # Normalize title text for searching (collapse whitespace)
        title_text = ch['title'].strip()
        # Count exact occurrences in the full source text
        occurrences = source_text.count(title_text)
        if occurrences == 1:
            score += 2
        elif occurrences <= 3:
            score += 1
        # else: >3 occurrences, 0 points (likely a catchphrase/refrain)

        # Factor D: Positional plausibility (0-2)
        if ch['index'] <= 5:
            score += 2
        elif ch['index'] <= 15:
            score += 1

        # Judgment
        if score <= 4:
            anomalies.append({
                'chapterIndex': ch['index'],
                'type': 'orphan_title',
                'severity': 'warning',
                'message': (
                    f'章节 "{ch["title"]}" 疑似为正文引述而非真实章节标题 '
                    f'(评分: {score}/10)。请人工确认。'
                ),
                'details': {
                    'score': score,
                    'blankLineScore': min(3, sum([
                        1 if (line_idx < len(lines) and
                              lines[line_idx].strip() == ch['title']) else 0,
                        1 if (line_idx > 0 and
                              not lines[line_idx - 1].strip()) else 0,
                        1 if (line_idx + 1 < len(lines) and
                              not lines[line_idx + 1].strip()) else 0,
                    ])),
                    'contentScore': min(3, sum([
                        1 if char_count >= 200 else 0,
                        1 if char_count >= 500 else 0,
                        1 if char_count >= 1000 else 0,
                    ])),
                    'uniquenessScore': (2 if occurrences == 1 else
                                        1 if occurrences <= 3 else 0),
                    'positionScore': (2 if ch['index'] <= 5 else
                                      1 if ch['index'] <= 15 else 0),
                    'titleOccurrences': occurrences,
                },
            })

    return anomalies


def detect_missing_chapters(chapters: list) -> list:
    """Detect gaps in the chapter numbering sequence."""
    anomalies = []
    # Filter out preamble and sort by index
    real_chapters = [ch for ch in chapters if ch.get('type') != 'preamble']
    if len(real_chapters) < 2:
        return anomalies

    indices = sorted(ch['index'] for ch in real_chapters)
    for i in range(len(indices) - 1):
        gap = indices[i + 1] - indices[i]
        if gap > 1:
            for missing in range(indices[i] + 1, indices[i + 1]):
                anomalies.append({
                    'chapterIndex': missing,
                    'type': 'missing_chapter',
                    'severity': 'warning',
                    'message': (
                        f'章节序号跳跃：第{indices[i]}章后直接到'
                        f'第{indices[i+1]}章，缺少第{missing}章'
                    ),
                    'details': {
                        'prevChapter': indices[i],
                        'nextChapter': indices[i + 1],
                        'missingIndex': missing,
                    },
                })

    return anomalies


def detect_duplicate_chapters(chapters: list) -> list:
    """Detect chapters with duplicate indices."""
    anomalies = []
    index_counts = Counter(ch['index'] for ch in chapters)

    duplicates = {idx: count for idx, count in index_counts.items()
                  if count > 1}

    if duplicates:
        for idx, count in duplicates.items():
            dup_chapters = [ch for ch in chapters if ch['index'] == idx]
            titles = [ch['title'] for ch in dup_chapters]
            anomalies.append({
                'chapterIndex': idx,
                'type': 'duplicate_chapter',
                'severity': 'error',
                'message': (
                    f'第{idx}章出现{count}次匹配：{", ".join(titles)}'
                ),
                'details': {
                    'count': count,
                    'titles': titles,
                },
            })

    return anomalies


def detect_empty_chapters(chapters: list) -> list:
    """Detect chapters with insufficient content (< 100 characters)."""
    anomalies = []
    for ch in chapters:
        if ch['charCount'] < 100:
            anomalies.append({
                'chapterIndex': ch['index'],
                'type': 'empty_chapter',
                'severity': 'warning',
                'message': (
                    f'章节 "{ch["title"]}" 内容过短'
                    f'（{ch["charCount"]}字），可能拆分有误'
                ),
                'details': {
                    'charCount': ch['charCount'],
                    'threshold': 100,
                },
            })

    return anomalies


def detect_oversized_chapters(chapters: list) -> list:
    """Detect chapters significantly larger than average (> 3x mean)."""
    anomalies = []
    real_chapters = [ch for ch in chapters
                     if ch.get('type') != 'preamble' and ch['charCount'] > 0]

    if len(real_chapters) < 3:
        return anomalies

    mean_count = sum(ch['charCount'] for ch in real_chapters) / len(real_chapters)
    threshold = mean_count * 3

    for ch in real_chapters:
        if ch['charCount'] > threshold:
            anomalies.append({
                'chapterIndex': ch['index'],
                'type': 'oversized_chapter',
                'severity': 'info',
                'message': (
                    f'章节 "{ch["title"]}" 长度异常'
                    f'（{ch["charCount"]}字，平均{mean_count:.0f}字）'
                ),
                'details': {
                    'charCount': ch['charCount'],
                    'average': round(mean_count),
                    'threshold': round(threshold),
                    'ratio': round(ch['charCount'] / mean_count, 1),
                },
            })

    return anomalies


def detect_title_format_issues(chapters: list) -> list:
    """Detect chapters with non-standard title formats."""
    anomalies = []
    # Standard patterns for Chinese novels
    standard_patterns = [
        r'^第[零一二三四五六七八九十百千万\d]+章',              # chapter: 第N章
        r'^[Cc][Hh][Aa][Pp][Tt][Ee][Rr]\s+\d+',              # chapter_en: Chapter N (full case-insensitive)
        r'^第[零一二三四五六七八九十百千万\d]+[卷部篇]',         # volume: 第N卷/部/篇
        r'^[零一二三四五六七八九十百千万\d]+[\.、\s]',          # numbered: N. / N、title
        r'^第[零一二三四五六七八九十百千万\d]+节',              # section: 第N节
    ]

    for ch in chapters:
        if ch.get('type') == 'preamble':
            continue

        title = ch['title']
        is_standard = any(re.match(pat, title) for pat in standard_patterns)

        if not is_standard:
            anomalies.append({
                'chapterIndex': ch['index'],
                'type': 'title_format',
                'severity': 'info',
                'message': (
                    f'章节 "{title}" 标题格式非标准格式，'
                    f'请确认是否为正确章节边界'
                ),
                'details': {
                    'title': title,
                    'matchedPattern': ch.get('type', 'unknown'),
                },
            })

    return anomalies


# ==============================================================================
# Main Validation Logic
# ==============================================================================

def validate(meta_path: str) -> dict:
    """Load _meta.json, run all anomaly detectors, update and return metadata."""

    # Load existing metadata
    with open(meta_path, 'r', encoding='utf-8') as f:
        meta = json.load(f)

    chapters = meta.get('chapters', [])
    all_anomalies = []

    if not chapters:
        print("[validator] No chapters found, skipping validation",
              file=sys.stderr)
        meta['anomalies'] = []
        return meta

    # Determine the chapters directory and original file
    chapters_dir = os.path.dirname(meta_path)

    # Reconstruct original file path
    originals_dir = os.path.join(os.path.dirname(chapters_dir), 'originals')
    original_path = os.path.join(originals_dir, meta.get('sourceFile', ''))

    # Try to read the original source text for holistic analysis
    source_text = ''
    lines = []
    try:
        with open(original_path, 'r', encoding='utf-8') as f:
            source_text = f.read()
            lines = source_text.splitlines()
        print(f"[validator] Loaded original text: {len(lines)} lines",
              file=sys.stderr)
    except FileNotFoundError:
        # If original not found, still run checks that don't need source text
        print(f"[validator] Original file not found at {original_path}, "
              f"running limited checks", file=sys.stderr)
        # Build lines from chapter files instead
        for ch in chapters:
            ch_path = os.path.join(chapters_dir, ch['fileName'])
            try:
                with open(ch_path, 'r', encoding='utf-8') as f:
                    lines.extend(f.read().splitlines())
            except FileNotFoundError:
                pass
        source_text = '\n'.join(lines)

    # Run all detectors
    print("[validator] Running orphan_title detection...", file=sys.stderr)
    all_anomalies.extend(detect_orphan_titles(meta, source_text, lines))
    print(f"[validator]   -> {len(all_anomalies)} orphan_title(s) found",
          file=sys.stderr)

    # Count orphans added so far for tracking
    orphan_count = len(all_anomalies)

    print("[validator] Running missing_chapter detection...", file=sys.stderr)
    missing = detect_missing_chapters(chapters)
    all_anomalies.extend(missing)
    print(f"[validator]   -> {len(missing)} missing_chapter(s) found",
          file=sys.stderr)

    print("[validator] Running duplicate_chapter detection...", file=sys.stderr)
    dups = detect_duplicate_chapters(chapters)
    all_anomalies.extend(dups)
    print(f"[validator]   -> {len(dups)} duplicate_chapter(s) found",
          file=sys.stderr)

    print("[validator] Running empty_chapter detection...", file=sys.stderr)
    empties = detect_empty_chapters(chapters)
    all_anomalies.extend(empties)
    print(f"[validator]   -> {len(empties)} empty_chapter(s) found",
          file=sys.stderr)

    print("[validator] Running oversized_chapter detection...", file=sys.stderr)
    oversized = detect_oversized_chapters(chapters)
    all_anomalies.extend(oversized)
    print(f"[validator]   -> {len(oversized)} oversized_chapter(s) found",
          file=sys.stderr)

    print("[validator] Running title_format detection...", file=sys.stderr)
    format_issues = detect_title_format_issues(chapters)
    all_anomalies.extend(format_issues)
    print(f"[validator]   -> {len(format_issues)} title_format issue(s) found",
          file=sys.stderr)

    # Update metadata
    meta['anomalies'] = all_anomalies

    # Write updated _meta.json
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"[validator] Total anomalies: {len(all_anomalies)}", file=sys.stderr)
    print(f"[validator] Updated _meta.json at {meta_path}", file=sys.stderr)

    return meta


# ==============================================================================
# Entry Point
# ==============================================================================

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print(json.dumps({
                'success': False,
                'error': 'No input provided on stdin',
            }))
            sys.exit(0)

        params = json.loads(raw_input)
        meta_path = params['metaPath']

        if not os.path.exists(meta_path):
            print(json.dumps({
                'success': False,
                'error': f'Metadata file not found: {meta_path}',
            }))
            sys.exit(0)

        meta = validate(meta_path)

        print(json.dumps({
            'success': True,
            'meta': meta,
        }, ensure_ascii=False))
        sys.stdout.flush()

    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e),
        }, ensure_ascii=False))
        sys.stdout.flush()
        sys.exit(0)


if __name__ == '__main__':
    main()
