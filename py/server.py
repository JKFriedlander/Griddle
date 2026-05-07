#!/usr/bin/env python3
"""
Dev server for grid-game.
Serves static files + a small write API for the puzzle admin panel.

Endpoints:
  GET  /api/config              → puzzles/config.json
  POST /api/config              → write { "active": "<id>" } to puzzles/config.json
  GET  /api/puzzles             → list of puzzle metadata from puzzles/*.json
  POST /api/puzzles/<id>        → write puzzle JSON to puzzles/<id>.json
"""
import json
import os
import re
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8080
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUZZLES_DIR = os.path.join(ROOT, 'puzzles')


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/api/config':
            self._send_file(os.path.join(PUZZLES_DIR, 'config.json'))
        elif self.path == '/api/puzzles':
            self._list_puzzles()
        else:
            super().do_GET()

    def do_POST(self):
        if self.path == '/api/config':
            self._receive_json(self._write_config)
        elif re.match(r'^/api/puzzles/[\w-]+$', self.path):
            puzzle_id = self.path.split('/')[-1]
            self._receive_json(lambda data: self._write_puzzle(puzzle_id, data))
        else:
            self.send_error(404)

    # ── helpers ──────────────────────────────────────────────────────────────

    def _send_file(self, path):
        try:
            with open(path) as f:
                body = f.read().encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self._cors()
            self.end_headers()
            self.wfile.write(body)
        except FileNotFoundError:
            self.send_error(404)

    def _list_puzzles(self):
        puzzles = []
        try:
            with open(os.path.join(PUZZLES_DIR, 'config.json')) as f:
                config = json.load(f)
            active = config.get('active')
        except Exception:
            active = None

        for fname in sorted(os.listdir(PUZZLES_DIR)):
            if not fname.endswith('.json') or fname == 'config.json':
                continue
            try:
                with open(os.path.join(PUZZLES_DIR, fname)) as f:
                    data = json.load(f)
                puzzles.append({
                    'id':          data.get('id', fname[:-5]),
                    'title':       data.get('title', fname[:-5]),
                    'description': data.get('description', ''),
                    'difficulty':  data.get('difficulty', ''),
                    'active':      data.get('id', fname[:-5]) == active,
                })
            except Exception:
                pass

        body = json.dumps(puzzles).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self._cors()
        self.end_headers()
        self.wfile.write(body)

    def _receive_json(self, handler):
        length = int(self.headers.get('Content-Length', 0))
        try:
            data = json.loads(self.rfile.read(length))
            handler(data)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self._cors()
            self.end_headers()
            self.wfile.write(b'{"ok":true}')
        except Exception as e:
            self.send_error(400, str(e))

    def _write_config(self, data):
        if 'active' not in data:
            raise ValueError('missing "active" key')
        with open(os.path.join(PUZZLES_DIR, 'config.json'), 'w') as f:
            json.dump({'active': data['active']}, f, indent=2)

    def _write_puzzle(self, puzzle_id, data):
        if not re.match(r'^[\w-]+$', puzzle_id):
            raise ValueError('invalid puzzle id')
        data['id'] = puzzle_id
        path = os.path.join(PUZZLES_DIR, f'{puzzle_id}.json')
        with open(path, 'w') as f:
            json.dump(data, f, indent=2)

    def _cors(self):
        self.send_header('Access-Control-Allow-Origin', '*')

    def log_message(self, fmt, *args):
        print(f'  {self.address_string()} {fmt % args}')


if __name__ == '__main__':
    os.chdir(ROOT)
    print(f'Grid-game dev server running at http://localhost:{PORT}')
    HTTPServer(('', PORT), Handler).serve_forever()
