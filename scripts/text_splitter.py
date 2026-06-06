#!/usr/bin/env python3
# scripts/text_splitter.py
# Chapter splitting script for writing-assistant.
# Reads JSON input from stdin, writes JSON result to stdout.
# All logging goes to stderr.
#
# Input (stdin):  { "filePath": "...", "outputDir": "...", "sourceName": "..." }
# Output (stdout): { "success": true, "meta": { ... } } or { "success": false, "error": "..." }

import sys
import json
import os
import re
from pathlib import Path


# ==============================================================================
# Chinese Number Conversion
# ==============================================================================

CHINESE_DIGITS = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
    '壹': 1, '贰': 2, '叁': 3, '肆': 4,
    '伍': 5, '陆': 6, '柒': 7, '捌': 8, '玖': 9,
    '两': 2,
}

CHINESE_MULTIPLIERS = {
    '十': 10, '拾': 10,
    '百': 100, '佰': 100,
    '千': 1000, '仟': 1000,
    '万': 10000,
    '亿': 100000000,
}


def chinese_to_arabic(cn_str: str) -> int:
    """Convert a Chinese numeral string to an Arabic integer.

    Examples:
        '一百二十三' -> 123
        '十' -> 10
        '三百零五' -> 305
        '一千零一夜' -> 1001  (though '夜' would be ignored)
        '二十' -> 20
    """
    if not cn_str:
        return 0

    # If already plain Arabic digits, parse directly
    if cn_str.isdigit():
        return int(cn_str)

    total = 0       # accumulated value below 万/亿
    segment = 0     # current segment being built
    final_total = 0 # value above 万/亿 boundaries

    for char in cn_str:
        if char in CHINESE_DIGITS:
            segment = CHINESE_DIGITS[char]
        elif char in CHINESE_MULTIPLIERS:
            mult = CHINESE_MULTIPLIERS[char]
            if segment == 0:
                segment = 1  # bare multiplier: "十" = 10
            segment *= mult

            if mult >= 10000:  # 万 or 亿 boundary
                final_total += segment
                segment = 0
            elif mult >= 1000:  # 千 ends sub-thousand group
                total += segment
                segment = 0
        # Characters not in our maps are ignored
        # (e.g. trailing title text like "章" or "卷")

    total += segment
    return final_total + total


def extract_number(num_str: str) -> int:
    """Extract a normalized chapter number from a matched number string.
    Handles both Chinese and Arabic numerals, as well as mixed forms
    like '一百二十三' or '123'.
    """
    num_str = num_str.strip()
    if not num_str:
        return 0
    if num_str.isdigit():
        return int(num_str)
    return chinese_to_arabic(num_str)


# ==============================================================================
# Encoding Detection
# ==============================================================================

def detect_and_read(file_path: str) -> tuple:
    """Read a text file with automatic encoding detection.

    Returns (text_content, encoding_name).
    Tries common encodings in order, falling back to latin-1.
    """
    with open(file_path, 'rb') as f:
        raw = f.read()

    # Encodings to try, in priority order
    candidates = ['utf-8-sig', 'utf-8', 'gbk', 'gb2312', 'gb18030']

    for encoding in candidates:
        try:
            text = raw.decode(encoding)
            # Heuristic quality check: if the decoded text contains the
            # Unicode replacement character (U+FFFD), the encoding was
            # probably wrong (except for latin-1 which decodes everything).
            if '�' in text:
                continue
            return text, encoding
        except (UnicodeDecodeError, UnicodeError):
            continue

    # Absolute fallback — latin-1 maps every byte 1:1 to a codepoint
    return raw.decode('latin-1', errors='replace'), 'latin-1'


# ==============================================================================
# Regex Patterns (in priority order)
# ==============================================================================

# Helper: Chinese digit character class for regex patterns
CN_DIGIT_CHARS = '零一二三四五六七八九十百千万壹贰叁肆伍陆柒捌玖'

PATTERNS = [
    # 1. Chinese chapters: "第1章", "第一章", "第一百二十三章 ..."
    {
        'name': 'chapter',
        'regex': re.compile(
            r'^第([' + CN_DIGIT_CHARS + r'\d]+)章\s*(.*)$'
        ),
        'num_group': 1,
    },
    # 2. Chinese volumes/parts/sections: "第一卷", "第二部", "第三篇"
    {
        'name': 'volume',
        'regex': re.compile(
            r'^第([' + CN_DIGIT_CHARS + r'\d]+)([卷部篇])\s*(.*)$'
        ),
        'num_group': 1,
    },
    # 3. Number-only headers: "1. 重生", "1、重生", "1 重生"
    #    Only matches if the line starts with a number followed by a delimiter
    {
        'name': 'numbered',
        'regex': re.compile(
            r'^([' + CN_DIGIT_CHARS + r'\d]+)[\.、\s]+(.+)$'
        ),
        'num_group': 1,
    },
    # 4. Chinese sections: "第一节", "第十二节 ..."
    {
        'name': 'section',
        'regex': re.compile(
            r'^第([' + CN_DIGIT_CHARS + r'\d]+)节\s*(.*)$'
        ),
        'num_group': 1,
    },
    # 5. English chapters: "Chapter 1", "CHAPTER 2: ..."
    {
        'name': 'chapter_en',
        'regex': re.compile(
            r'^[Cc][Hh][Aa][Pp][Tt][Ee][Rr]\s+(\d+)(.*)$'
        ),
        'num_group': 1,
    },
]


def match_chapter_title(line: str) -> dict | None:
    """Try to match a line against all chapter title patterns.

    Returns a dict with {name, number, title, rest} on match, or None.
    """
    for pattern in PATTERNS:
        m = pattern['regex'].match(line)
        if m:
            num_str = m.group(pattern['num_group'])
            number = extract_number(num_str)

            # Build the title from the matched groups
            if pattern['name'] == 'chapter':
                rest = m.group(2).strip()
                title = f"第{num_str}章"
                if rest:
                    title += f" {rest}"
            elif pattern['name'] == 'volume':
                vol_type = m.group(2)
                rest = m.group(3).strip()
                title = f"第{num_str}{vol_type}"
                if rest:
                    title += f" {rest}"
            elif pattern['name'] == 'numbered':
                rest = m.group(2).strip()
                title = f"{num_str}. {rest}"
            elif pattern['name'] == 'section':
                rest = m.group(2).strip()
                title = f"第{num_str}节"
                if rest:
                    title += f" {rest}"
            elif pattern['name'] == 'chapter_en':
                rest = m.group(2).strip()
                title = f"Chapter {num_str}{rest}"
            else:
                title = line.strip()

            return {
                'pattern': pattern['name'],
                'number': number,
                'title': title,
            }

    return None


# ==============================================================================
# Main Splitting Logic
# ==============================================================================

def split_text(file_path: str, output_dir: str, source_name: str) -> dict:
    """Main entry point: read, split, write chapters, return metadata."""

    # --- Step 1: Detect encoding and read ---
    text, encoding = detect_and_read(file_path)
    lines = text.splitlines(keepends=True)  # preserve line endings
    bare_lines = text.splitlines()           # without line endings for matching
    print(f"[splitter] Detected encoding: {encoding}, {len(lines)} lines",
          file=sys.stderr)

    # --- Step 2: Scan for chapter title matches ---
    matches = []  # list of {line_index, pattern, number, title}
    for i, line in enumerate(bare_lines):
        result = match_chapter_title(line.strip())
        if result:
            matches.append({
                'line': i,
                'pattern': result['pattern'],
                'number': result['number'],
                'title': result['title'],
            })

    print(f"[splitter] Found {len(matches)} chapter title matches",
          file=sys.stderr)

    if not matches:
        return {
            'sourceFile': source_name,
            'sourceHash': '',
            'totalChapters': 0,
            'encoding': encoding,
            'chapters': [],
            'anomalies': [],
        }

    # --- Step 3: Build chapter boundaries ---
    chapters = []

    # Content before the first match becomes preamble (chapter_000)
    first_match_line = matches[0]['line']
    if first_match_line > 0:
        preamble_content = ''.join(lines[:first_match_line]).strip()
        if preamble_content:
            chapters.append({
                'index': 0,
                'title': '前言',
                'type': 'preamble',
                'lineStart': 1,
                'lineEnd': first_match_line,
                'charCount': len(preamble_content),
            })

    for idx in range(len(matches)):
        match = matches[idx]
        start_line = match['line']
        end_line = (matches[idx + 1]['line']
                    if idx + 1 < len(matches)
                    else len(lines))

        chapter_lines = lines[start_line:end_line]
        content = ''.join(chapter_lines)

        chapters.append({
            'index': idx + 1,
            'title': match['title'],
            'type': 'chapter' if match['pattern'] in ('chapter', 'chapter_en')
                    else match['pattern'],
            'lineStart': start_line + 1,  # 1-based
            'lineEnd': end_line,           # 1-based, exclusive -> inclusive
            'charCount': len(content),
        })

    # --- Step 4: Normalize numbering and assign file names ---
    # Sort chapters by index, assign sequential file names
    for i, ch in enumerate(chapters):
        # chapter_000 for preamble, chapter_NNN for real chapters
        display_index = ch['index']
        ch['fileName'] = f"chapter_{display_index:03d}.txt"

    total_chapters = len(chapters)

    # --- Step 5: Write chapter files ---
    os.makedirs(output_dir, exist_ok=True)

    for ch in chapters:
        start_line = ch['lineStart'] - 1  # convert back to 0-based
        end_line = ch['lineEnd']
        content_lines = lines[start_line:end_line]
        content = ''.join(content_lines)

        file_name = ch['fileName']
        file_path_out = os.path.join(output_dir, file_name)
        with open(file_path_out, 'w', encoding='utf-8') as f:
            f.write(content)

        print(f"[splitter] Wrote {file_name} ({ch['charCount']} chars)",
              file=sys.stderr)

    # --- Step 6: Build metadata ---
    # Normalize chapters list for _meta.json (remove internal fields)
    meta_chapters = []
    for ch in chapters:
        meta_chapters.append({
            'index': ch['index'],
            'title': ch['title'],
            'fileName': ch['fileName'],
            'lineStart': ch['lineStart'],
            'lineEnd': ch['lineEnd'],
            'charCount': ch['charCount'],
            'type': ch.get('type', 'chapter'),
        })

    # Compute sourceHash from the file content
    import hashlib
    with open(file_path, 'rb') as f:
        file_hash = hashlib.sha256(f.read()).hexdigest()

    meta = {
        'sourceFile': source_name,
        'sourceHash': file_hash,
        'sourceId': file_hash[:8],
        'totalChapters': total_chapters,
        'encoding': encoding,
        'status': 'pending',
        'createdAt': '',
        'updatedAt': '',
        'chapters': meta_chapters,
        'anomalies': [],
    }

    # Write _meta.json
    meta_path = os.path.join(output_dir, '_meta.json')
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"[splitter] Wrote _meta.json with {total_chapters} chapters",
          file=sys.stderr)

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
        file_path = params['filePath']
        output_dir = params['outputDir']
        source_name = params.get('sourceName', os.path.basename(file_path))

        if not os.path.exists(file_path):
            print(json.dumps({
                'success': False,
                'error': f'File not found: {file_path}',
            }))
            sys.exit(0)

        meta = split_text(file_path, output_dir, source_name)

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
