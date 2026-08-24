"""Round lock for the gauntlet loop.

A round rebuilds the bundle, restarts the dev app and commits. Two of
them in one checkout race each other's build output and git index, so a
tick that arrives while a round is live must exit rather than "help".

The lock is a file holding a unix timestamp. It expires on its own after
LOCK_TTL_S so a round that dies mid-way cannot wedge the loop until
someone notices.
"""

import os
import sys
import time

LOCK = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".round-lock")
LOCK_TTL_S = 90 * 60


def age():
    try:
        with open(LOCK) as f:
            return time.time() - float(f.read().strip())
    except (OSError, ValueError):
        return None


def main():
    action = sys.argv[1] if len(sys.argv) > 1 else "status"
    a = age()
    held = a is not None and a < LOCK_TTL_S

    if action == "acquire":
        if held:
            print("BUSY (held %d min)" % (a / 60))
            return 1
        with open(LOCK, "w") as f:
            f.write(str(time.time()))
        print("ACQUIRED")
        return 0

    if action == "release":
        try:
            os.remove(LOCK)
        except OSError:
            pass
        print("RELEASED")
        return 0

    print("BUSY (held %d min)" % (a / 60) if held else "FREE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
