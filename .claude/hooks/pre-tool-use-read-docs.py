#!/usr/bin/env python3
"""PreToolUse: inject relevant .claude/ documentation before an Edit or Write."""

import json
import os
import re
import sys


def find_docs(rel_path: str, context_map_path: str) -> list:
    if not os.path.exists(context_map_path):
        return []

    with open(context_map_path) as f:
        lines = f.readlines()

    docs = []
    seen = set()

    for line in lines:
        if not line.startswith('|') or '---' in line:
            continue
        parts = [p.strip() for p in line.split('|')]
        parts = [p for p in parts if p]
        if len(parts) < 2:
            continue

        # Extract pattern from backticks; fall back to raw cell text
        m = re.match(r'`([^`]+)`', parts[0])
        pattern = m.group(1) if m else parts[0].strip()

        # Strip trailing " directory" suffix and trailing slash
        clean = re.sub(r'\s+directory$', '', pattern).strip().rstrip('/')

        # Skip topic-based entries (e.g. "Scoring, bonuses, run logic")
        if ' ' in clean:
            continue

        matched = (
            rel_path == clean
            or rel_path.endswith('/' + clean)
            or rel_path.startswith(clean + '/')
            or ('/' + clean + '/') in rel_path
        )

        if matched:
            for doc in re.findall(r'`([^`]+)`', parts[1]):
                if doc not in seen and (doc.startswith('.claude/') or doc.startswith('docs/')):
                    seen.add(doc)
                    docs.append(doc)

    return docs


def main():
    try:
        data = json.load(sys.stdin)
    except (json.JSONDecodeError, ValueError):
        sys.exit(0)

    file_path = data.get('tool_input', {}).get('file_path', '')
    if not file_path:
        sys.exit(0)

    cwd = os.getcwd()
    rel_path = file_path[len(cwd) + 1:] if file_path.startswith(cwd + '/') else file_path.lstrip('./')

    # Don't inject docs when editing documentation files themselves
    if rel_path.startswith('.claude/') or rel_path.startswith('docs/'):
        sys.exit(0)

    docs = find_docs(rel_path, '.claude/context-map.md')
    if not docs:
        sys.exit(0)

    sections = ['--- Relevant documentation for this edit ---\n']
    for doc in docs:
        if os.path.exists(doc):
            with open(doc) as f:
                sections.append(f'### {doc}\n\n{f.read()}')

    if len(sections) <= 1:
        sys.exit(0)

    print(json.dumps({
        'hookSpecificOutput': {
            'hookEventName': 'PreToolUse',
            'additionalContext': '\n\n'.join(sections),
        }
    }))


if __name__ == '__main__':
    main()
