#!/usr/bin/env python3
"""Local server with /games/<slug> → games/index.html (SPA-style routes)."""
import os
import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5500


class VixoHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def _rewrite_game_slug_path(self):
        parsed = urlparse(self.path)
        path = parsed.path

        if path.startswith("/games/") and path not in ("/games", "/games/"):
            relative = path.lstrip("/").split("?", 1)[0]
            fs_path = os.path.join(ROOT, relative.replace("/", os.sep))
            if not os.path.isfile(fs_path) and not os.path.isdir(fs_path.rstrip(os.sep)):
                self.path = "/games/index.html"
                if parsed.query:
                    self.path += "?" + parsed.query

    def do_GET(self):
        self._rewrite_game_slug_path()
        return super().do_GET()

    def do_HEAD(self):
        self._rewrite_game_slug_path()
        return super().do_HEAD()

    def log_message(self, format, *args):
        if args and "200" in str(args[1]):
            return
        super().log_message(format, *args)


if __name__ == "__main__":
    print("")
    print("  VixoGames server running")
    print("  Home:  http://localhost:%s/index.html" % PORT)
    print("  Game:  http://localhost:%s/games/SOME-GAME-SLUG" % PORT)
    print("         (slug = namespace from GamePix, e.g. war-the-knights)")
    print("")
    print("  Press Ctrl+C to stop")
    print("")
    HTTPServer(("", PORT), VixoHandler).serve_forever()
