"""A CONNECT proxy so a phone with no internet can borrow this PC's.

The old Redmi is blocked at the AP: DNS resolves, ICMP answers, and TCP
443 times out to every host, while this machine on the same subnet
reaches GitHub fine. That is the network refusing the device, and no
setting on the device fixes it.

So the phone's traffic comes over the USB cable instead:

    python usb_proxy.py                       # this, on the PC
    adb reverse tcp:8888 tcp:8888             # phone's localhost -> here
    adb shell settings put global http_proxy 127.0.0.1:8888

and to put it back, which MUST happen when the run is done:

    adb shell settings put global http_proxy :0
    adb reverse --remove tcp:8888

Plain HTTP CONNECT tunnelling only -- no interception, no certificate,
nothing decrypted. TLS is end to end between the phone and the site; this
process only shovels bytes. Bound to 127.0.0.1 so nothing on the office
network can reach it.
"""

import select
import socket
import sys
import threading

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8888
BUF = 65536


def pipe(a, b):
    try:
        while True:
            r, _, _ = select.select([a, b], [], [], 60)
            if not r:
                break
            for s in r:
                data = s.recv(BUF)
                if not data:
                    return
                (b if s is a else a).sendall(data)
    except Exception:
        pass


def handle(client):
    try:
        client.settimeout(20)
        head = b""
        while b"\r\n\r\n" not in head:
            chunk = client.recv(BUF)
            if not chunk:
                return
            head += chunk
            if len(head) > 65536:
                return
        line = head.split(b"\r\n", 1)[0].decode("latin1")
        parts = line.split()
        if len(parts) < 2:
            return

        if parts[0].upper() == "CONNECT":
            host, _, port = parts[1].rpartition(":")
            port = int(port or 443)
        else:
            # Plain HTTP through a proxy arrives as an absolute URL.
            url = parts[1]
            if "://" not in url:
                return
            rest = url.split("://", 1)[1]
            hostport = rest.split("/", 1)[0]
            host, _, p = hostport.partition(":")
            port = int(p or 80)

        up = socket.create_connection((host, port), timeout=20)

        if parts[0].upper() == "CONNECT":
            client.sendall(b"HTTP/1.1 200 Connection Established\r\n\r\n")
        else:
            up.sendall(head)

        client.settimeout(None)
        up.settimeout(None)
        pipe(client, up)
        try:
            up.close()
        except Exception:
            pass
    except Exception:
        pass
    finally:
        try:
            client.close()
        except Exception:
            pass


def main():
    srv = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    srv.bind(("127.0.0.1", PORT))
    srv.listen(128)
    print("usb proxy on 127.0.0.1:%d -- ctrl-c to stop" % PORT, flush=True)
    while True:
        c, _ = srv.accept()
        threading.Thread(target=handle, args=(c,), daemon=True).start()


if __name__ == "__main__":
    main()
