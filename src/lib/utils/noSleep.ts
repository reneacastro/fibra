/**
 * Combina WakeLock API + truque de vídeo inline silencioso pra iOS.
 * iOS Safari ignora WakeLock em PWA instalado; o vídeo em loop
 * força o webkit a não dormir a tela enquanto toca.
 *
 * Baseado em https://github.com/richtr/NoSleep.js (simplificado).
 */

// Vídeo 10KB base64 — 5 segundos 320x240 preto, loopado
// Mantemos a string aqui pra não precisar hostear o arquivo.
const VIDEO_DATA_URL =
  'data:video/mp4;base64,' +
  'AAAAIGZ0eXBtcDQyAAACAGlzb21pc28yYXZjMW1wNDEAAAAIZnJlZQAABmttZGF0AAACawYF//9n' +
  '3EXpvebZSLeWLNgg2SPu73gyNjQgLSBjb3JlIDE0MiAtIEguMjY0L01QRUctNCBBVkMgY29kZWMg' +
  'LSBDb3B5bGVmdCAyMDAzLTIwMTQgLSBodHRwOi8vd3d3LnZpZGVvbGFuLm9yZy94MjY0Lmh0bWwg' +
  'LSBvcHRpb25zOiBjYWJhYz0xIHJlZj0zIGRlYmxvY2s9MTowOjAgYW5hbHlzZT0weDM6MHgxMTMg' +
  'bWU9aGV4IHN1Ym1lPTcgcHN5PTEgcHN5X3JkPTEuMDA6MC4wMCBtaXhlZF9yZWY9MSBtZV9yYW5n' +
  'ZT0xNiBjaHJvbWFfbWU9MSB0cmVsbGlzPTEgOHg4ZGN0PTEgY3FtPTAgZGVhZHpvbmU9MjEsMTEg' +
  'ZmFzdF9wc2tpcD0xIGNocm9tYV9xcF9vZmZzZXQ9LTIgdGhyZWFkcz02IGxvb2thaGVhZF90aHJl' +
  'YWRzPTEgc2xpY2VkX3RocmVhZHM9MCBucj0wIGRlY2ltYXRlPTEgaW50ZXJsYWNlZD0wIGJsdXJh' +
  'eV9jb21wYXQ9MCBjb25zdHJhaW5lZF9pbnRyYT0wIGJmcmFtZXM9MyBiX3B5cmFtaWQ9MiBiX2Fk' +
  'YXB0PTEgYl9iaWFzPTAgZGlyZWN0PTEgd2VpZ2h0Yj0xIG9wZW5fZ29wPTAgd2VpZ2h0cD0yIGtl' +
  'eWludD0yNTAga2V5aW50X21pbj0yNSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9v' +
  'a2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBt' +
  'YXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAAFZliIQL8mKAAKvMnJyc' +
  'nJycnJycnXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX' +
  'XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXhH/////4gAAAMAHIAAHgVOg' +
  'AAAA';

class NoSleep {
  private video: HTMLVideoElement | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  enabled = false;

  async enable() {
    if (this.enabled) return;
    this.enabled = true;

    // Tenta WakeLock API primeiro (Android Chrome, desktop)
    const w = (navigator as Navigator & {
      wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinel> };
    }).wakeLock;
    if (w) {
      try {
        this.wakeLock = await w.request('screen');
      } catch {
        // ignora — cai no fallback de vídeo
      }
    }

    // Fallback pra iOS: video inline tocando em loop segura o webkit
    if (!this.video) {
      this.video = document.createElement('video');
      this.video.setAttribute('title', 'FIBRA GPS');
      this.video.setAttribute('playsinline', '');
      this.video.muted = true;
      this.video.loop = true;
      this.video.src = VIDEO_DATA_URL;
      this.video.style.position = 'fixed';
      this.video.style.top = '-100px';
      this.video.style.left = '-100px';
      this.video.style.width = '1px';
      this.video.style.height = '1px';
      document.body.appendChild(this.video);
    }
    try {
      await this.video.play();
    } catch {
      // ignora — alguns browsers bloqueiam autoplay
    }
  }

  async disable() {
    if (!this.enabled) return;
    this.enabled = false;
    if (this.wakeLock) {
      try { await this.wakeLock.release(); } catch { /* noop */ }
      this.wakeLock = null;
    }
    if (this.video) {
      this.video.pause();
      this.video.removeAttribute('src');
      this.video.load();
      this.video.remove();
      this.video = null;
    }
  }
}

let instance: NoSleep | null = null;
export function getNoSleep(): NoSleep {
  if (!instance) instance = new NoSleep();
  return instance;
}
