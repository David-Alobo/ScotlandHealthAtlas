"""Serve the story page locally without browser caching, so every change shows on a plain reload.

Usage (from web/): python tools/serve.py [port]
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class NoCache(SimpleHTTPRequestHandler):
    """Static files with headers telling the browser not to keep a copy."""

    def end_headers(self) -> None:
        """Add no-store headers before the blank line."""
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("Expires", "0")
        super().end_headers()


def main() -> None:
    """Serve web/ on 127.0.0.1."""
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    root = Path(__file__).resolve().parents[1]
    server = ThreadingHTTPServer(("127.0.0.1", port), partial(NoCache, directory=str(root)))
    print(f"serving {root} at http://127.0.0.1:{port}/ (no caching)")
    server.serve_forever()


if __name__ == "__main__":
    main()
