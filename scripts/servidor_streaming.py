#!/usr/bin/env python3
"""
Servidor de Streaming & Placar Bike Polo (LAN / Local Network / Mobile / OBS).

Fornece sincronização de baixa latência em rede local para:
  - Celular 1 (Live streaming / Moblin / Streamlabs): /streaming/overlay/ajustado
  - Celular 2 (Mesa de arbitragem / Chrome / Termux): /streaming/mesa
  - Computador da transmissão (OBS / vMix): /streaming/overlay (1920x1080)

Recursos:
  - Concorrência otimista com controle de revisão (rev)
  - Sincronização de relógio entre múltiplos aparelhos via header X-Server-Time
  - Controle de presença (/api/streaming/hello)
  - Suporte total a CORS para integração com Vite dev server e navegadores
  - Salvamento atômico em data/streaming/state.json e data/streaming/teams.json
  - Zero dependências externas (apenas biblioteca padrão Python 3)

Uso:
  python3 scripts/servidor_streaming.py           (porta padrão 8787)
  python3 scripts/servidor_streaming.py 9000      (porta personalizada)
  python3 scripts/servidor_streaming.py --help    (ajuda)
"""

import json
import os
import socket
import sys
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

if '--help' in sys.argv or '-h' in sys.argv:
    print(__doc__)
    sys.exit(0)

PORT = 8787
if len(sys.argv) > 1 and sys.argv[1].isdigit():
    PORT = int(sys.argv[1])
elif len(sys.argv) > 2 and sys.argv[1] == '--port' and sys.argv[2].isdigit():
    PORT = int(sys.argv[2])

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, 'data', 'streaming')
os.makedirs(DATA_DIR, exist_ok=True)

lock = threading.Lock()
cache = {}

for name in ('state', 'teams'):
    path = os.path.join(DATA_DIR, f'{name}.json')
    try:
        with open(path, 'rb') as f:
            cache[name] = f.read()
    except FileNotFoundError:
        cache[name] = b'null'


def rev_of(raw):
    try:
        o = json.loads(raw)
        return int(o['rev']) if isinstance(o, dict) and o.get('rev') is not None else None
    except Exception:
        return None


cur_rev = rev_of(cache['state'])
presence = {}
now_ms = lambda: int(time.time() * 1000)


def save(name, body):
    path = os.path.join(DATA_DIR, f'{name}.json')
    tmp = path + '.tmp'
    with open(tmp, 'wb') as f:
        f.write(body)
    os.replace(tmp, path)


class StreamingHandler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Server-Time', str(now_ms()))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Server-Time, Cache-Control')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.end_headers()

    def _json(self, code, body):
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self):
        n = int(self.headers.get('Content-Length') or 0)
        return self.rfile.read(n)

    def _hello(self, data):
        try:
            h = json.loads(data) if data else None
            if isinstance(h, dict) and h.get('id'):
                presence[str(h['id'])] = {
                    'id': str(h['id']),
                    'name': str(h.get('name', '')),
                    'role': str(h.get('role', '')),
                    'seen': now_ms(),
                }
        except Exception:
            pass
        alive = [p for p in presence.values() if now_ms() - p['seen'] < 7000]
        return self._json(200, json.dumps(alive).encode())

    def do_GET(self):
        p = self.path.split('?')[0]
        if p in ('/api/ping', '/api/streaming/ping'):
            return self._json(200, b'{"ok":true}')
        if p in ('/api/hello', '/api/streaming/hello'):
            return self._hello(None)
        if p in ('/api/state', '/api/streaming/state'):
            with lock:
                body = cache.get('state', b'null')
            return self._json(200, body)
        if p in ('/api/teams', '/api/streaming/teams'):
            with lock:
                body = cache.get('teams', b'null')
            return self._json(200, body)

        # Rejeita requisições para scripts
        if p.endswith('.py') or p.endswith('.sh') or p.endswith('.bat') or p.endswith('.php'):
            return self._json(404, b'{"ok":false,"erro":"recurso protegido"}')

        return super().do_GET()

    def do_POST(self):
        global cur_rev
        p = self.path.split('?')[0]
        body = self._body()

        if p in ('/api/hello', '/api/streaming/hello'):
            return self._hello(body)

        if p not in ('/api/state', '/api/streaming/state', '/api/teams', '/api/streaming/teams'):
            return self._json(404, b'{"ok":false}')

        try:
            obj = json.loads(body)
        except Exception:
            return self._json(400, b'{"ok":false,"erro":"JSON invalido"}')

        name = 'state' if 'state' in p else 'teams'
        with lock:
            if name == 'state' and cur_rev is not None and isinstance(obj, dict) and obj.get('rev') is not None:
                req_rev = int(obj['rev'])
                if req_rev != cur_rev + 1 and req_rev <= cur_rev:
                    # Conflito de versão (alguém enviou antes): devolve o estado atual
                    return self._json(409, cache.get('state', b'null'))

            cache[name] = body
            if name == 'state' and isinstance(obj, dict) and obj.get('rev') is not None:
                cur_rev = int(obj['rev'])

            try:
                save(name, body)
            except OSError as e:
                print('Aviso: falha ao salvar disco:', name, '->', e)

        return self._json(200, b'{"ok":true}')


def local_ips():
    ips = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ips.add(info[4][0])
    except Exception:
        pass
    for target in ('172.20.10.1', '192.168.43.1', '8.8.8.8'):
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect((target, 80))
            ips.add(s.getsockname()[0])
            s.close()
        except Exception:
            pass
    return sorted(ip for ip in ips if not ip.startswith('127.'))


if __name__ == '__main__':
    srv = ThreadingHTTPServer(('0.0.0.0', PORT), StreamingHandler)
    print('========================================================')
    print(f'  SERVIDOR DE STREAMING BIKE POLO (Porta {PORT})')
    print('========================================================')
    print(f'  Neste computador / celular: http://localhost:{PORT}/streaming/mesa')
    for ip in local_ips():
        print(f'  Celulares na rede (Mesa)  : http://{ip}:{PORT}/streaming/mesa')
        print(f'  Celular da Live (Moblin)  : http://{ip}:{PORT}/streaming/overlay/ajustado')
        print(f'  OBS Studio (Browser Source: http://{ip}:{PORT}/streaming/overlay')
    print('--------------------------------------------------------')
    print('  Pressione Ctrl+C para encerrar.')
    print('========================================================')
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        print('\nServidor encerrado.')
