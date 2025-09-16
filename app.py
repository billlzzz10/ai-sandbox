#!/usr/bin/env python3
"""Legacy entry point for the AI Agent Sandbox.

The runtime has moved to Node.js/Express (see ``server.js``). This stub is kept
only to provide a helpful message if someone attempts to run the old Python
script directly.
"""
from __future__ import annotations

import sys


def main() -> int:
    message = (
        "The Python engine has been replaced by the Express server.\n"
        "Run `npm install` once, then start the new runtime with `npm start`."
    )
    print(message)
    return 0


if __name__ == "__main__":
    sys.exit(main())
