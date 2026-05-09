/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable no-empty */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Router, Request, Response } from 'express';
import { Readable, pipeline } from 'stream';

declare const fetch: any;

const router = Router();

// Fonction utilitaire pour ajouter les en-têtes CORS
const addCorsHeaders = (res: Response) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
  return res;
};

// Petit utilitaire de pause
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Fetch avec retries et backoff pour gérer 429/5xx temporaires
async function fetchWithRetries(
  url: string,
  init: any,
  attempts = 3,
): Promise<any> {
  let lastResp: any;
  for (let i = 0; i < attempts; i++) {
    const resp: any = await fetch(url as any, init as any);
    lastResp = resp;

    // Si OK, retourner immédiatement
    if (resp.ok) return resp;

    // Si 429/503/502, attendre et retenter (si tentative restante)
    if ([429, 503, 502].includes(resp.status) && i < attempts - 1) {
      const retryAfter = resp.headers.get('retry-after');
      let delay = 500 * Math.pow(2, i) + Math.floor(Math.random() * 300);
      if (retryAfter) {
        // retry-after peut être secondes ou date HTTP
        const secs = Number(retryAfter);
        if (!Number.isNaN(secs)) {
          delay = Math.min((secs || 1) * 1000, 8000);
        } else {
          const date = new Date(retryAfter).getTime();
          if (!Number.isNaN(date)) {
            delay = Math.min(Math.max(date - Date.now(), 500), 8000);
          }
        }
      }
      await sleep(delay);
      continue;
    }

    // Pour autres statuts non OK: ne pas retenter
    return resp;
  }
  // Si on sort de la boucle, retourner la dernière réponse non OK
  return lastResp;
}

// Endpoint proxy pour contourner le CORS des playlists M3U externes
router.get('/m3u', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'URL parameter is required',
      });
    }

    // Validation de l'URL
    try {
      new URL(url);
    } catch {
      return res.status(400).json({
        error: 'Invalid URL format',
      });
    }

    // Récupérer le contenu M3U depuis l'URL externe
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const m3uContent = await response.text();

    // Vérifier que le contenu est un fichier M3U valide
    if (!m3uContent.trim().startsWith('#EXTM3U')) {
      throw new Error('Invalid M3U file format');
    }

    // Retourner le contenu M3U avec les bons headers
    addCorsHeaders(res);
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');

    res.send(m3uContent);
  } catch (error: any) {
    console.error('Erreur lors du proxy M3U:', error);
    res.status(500).json({
      error: 'Failed to fetch M3U content',
      details: error.message,
    });
  }
});

// Endpoint proxy pour les flux HLS (segments .ts et manifestes .m3u8)
router.get('/stream', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'URL parameter is required',
      });
    }

    // Validation de l'URL
    let upstreamUrl: URL;
    try {
      upstreamUrl = new URL(url);
    } catch {
      return res.status(400).json({
        error: 'Invalid URL format',
      });
    }

    console.log(`Proxying HLS stream: ${url}`);

    // Récupérer les en-têtes de la requête originale pour les transmettre
    const headers: { [key: string]: string } = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      Accept: '*/*',
      'Accept-Language': 'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
      Origin: upstreamUrl.origin,
      Referer: upstreamUrl.origin + '/',
      Connection: 'keep-alive',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
    };

    if (req.headers.range) {
      headers.range = req.headers.range as string;
    }

    // Timeout via AbortController
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort('timeout'), 30000);

    // Abandonner la requête amont si le client se ferme/abandonne
    const onClientClosed = () => {
      try {
        controller.abort('client_closed');
      } catch {}
    };
    req.on('aborted', onClientClosed);
    req.on('close', onClientClosed);
    res.on('close', onClientClosed);

    // Récupérer le contenu depuis l'URL externe (avec retries sur 429/5xx)
    const response = await fetchWithRetries(
      url as string,
      { headers, signal: controller.signal },
      3,
    );
    clearTimeout(t);

    // Détecter si le contenu est un manifeste m3u8 (selon URL ou content-type)
    let contentType = (
      response.headers.get('content-type') || ''
    ).toLowerCase();
    let isM3U8Url = upstreamUrl.pathname.toLowerCase().endsWith('.m3u8');
    let isM3U8 =
      isM3U8Url ||
      contentType.includes('application/vnd.apple.mpegurl') ||
      contentType.includes('application/x-mpegurl');

    let originalText: string | undefined;

    // Fallback: si les entêtes ne sont pas concluants mais que la ressource est OK,
    // tenter de détecter un manifeste M3U8 en lisant le corps (petit fichier texte)
    if (!isM3U8 && response.ok) {
      try {
        const cloned = (response as any).clone?.() ?? response;
        const peekText = await cloned.text();
        if (peekText.trimStart().startsWith('#EXTM3U')) {
          isM3U8 = true;
          originalText = peekText;
          contentType = 'application/vnd.apple.mpegurl';
          console.log(`[Proxy] M3U8 detected by content sniffing for: ${url}`);
        }
      } catch (e) {
        // Impossible de lire le texte (probablement binaire), ignorer
      }
    }

    // Si c'est un manifeste M3U8 et la réponse est OK, réécrire les URLs internes pour passer par notre proxy
    if (response.ok && isM3U8) {
      const text = originalText ?? (await response.text());
      const baseUrl = new URL(url as string);
      const proxyBase = req.baseUrl || '/api/proxy';

      const rewriteUriAttr = (line: string) => {
        // Réécrire URI="..." en URI="<protocol>://<host><proxy>/stream|segment?url=..."
        return line.replace(/URI="([^"]+)"/g, (_match, uri) => {
          let abs: string;
          try {
            abs = new URL(uri, baseUrl).toString();
          } catch {
            abs = uri; // garder tel quel si invalide
          }
          const isPlaylist = abs.toLowerCase().endsWith('.m3u8');
          // Détecter automatiquement le protocole basé sur la requête
          const protocol =
            req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
          const host = req.get('host');
          const proxied = `${protocol}://${host}${proxyBase}/${isPlaylist ? 'stream' : 'segment'}?url=${encodeURIComponent(abs)}`;
          return `URI="${proxied}"`;
        });
      };

      const rewritten = text
        .split('\n')
        .map((rawLine: string) => {
          const line = rawLine.trimEnd();
          if (line.startsWith('#')) {
            // Lignes de directives: réécriture des attributs URI si présents
            return rewriteUriAttr(line);
          }
          // Lignes de chemin (segments ou sous-playlists)
          const trimmed = line.trim();
          if (!trimmed) return line; // ligne vide
          let abs: string;
          try {
            abs = new URL(trimmed, baseUrl).toString();
          } catch {
            abs = trimmed;
          }
          const isPlaylist = abs.toLowerCase().endsWith('.m3u8');
          // Détecter automatiquement le protocole basé sur la requête
          const protocol =
            req.get('x-forwarded-proto') || (req.secure ? 'https' : 'http');
          const host = req.get('host');
          const proxied = `${protocol}://${host}${proxyBase}/${isPlaylist ? 'stream' : 'segment'}?url=${encodeURIComponent(abs)}`;
          return proxied;
        })
        .join('\n');

      addCorsHeaders(res);
      // Ne pas renvoyer les headers d'origine (content-length invalide après réécriture)
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
      console.log(`[Proxy] Rewrote M3U8 manifest for: ${url}`);
      res.status(200).send(rewritten);
      return;
    }

    // Pour les segments (.ts, .m4s, etc.) ou autres ressources (ou erreurs): proxy tel quel
    // Copier les en-têtes de la réponse
    response.headers.forEach((value: string, key: string) => {
      // Eviter d'envoyer un encodage incompatible
      const kl = key.toLowerCase();
      if (kl === 'content-encoding' || kl === 'transfer-encoding') return;
      res.setHeader(key, value);
    });

    // Ajouter les en-têtes CORS
    addCorsHeaders(res);

    // Définir le bon type de contenu en fonction de l'extension du fichier uniquement si OK et si non fourni
    if (response.ok) {
      const hasContentType = !!response.headers.get('content-type');
      if (!hasContentType) {
        if ((url as string).toLowerCase().includes('.m3u8')) {
          res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        } else if ((url as string).toLowerCase().endsWith('.ts')) {
          res.setHeader('Content-Type', 'video/mp2t');
        }
      }
    }

    // Définir le statut de la réponse et streamer le contenu (même pour erreurs 4xx/5xx)
    res.status(response.status);

    if (response.body && typeof (Readable as any).fromWeb === 'function') {
      // Streamer directement sans bufferiser
      const readable = Readable.fromWeb(response.body as any);

      // Nettoyage si le client annule/la connexion se ferme
      let closedStream = false;
      const onAbortOrClose = () => {
        if (closedStream) return;
        closedStream = true;
        try {
          (readable as any).destroy(new Error('client_closed'));
        } catch {}
        try {
          // Détruire la réponse seulement si pas déjà terminée
          if (!(res as any).writableEnded && !(res as any).destroyed) {
            (res as any).destroy();
          }
        } catch {}
      };
      req.on('aborted', onAbortOrClose);
      req.on('close', onAbortOrClose);
      res.on('close', onAbortOrClose);

      pipeline(
        readable as any,
        res as any,
        (err: NodeJS.ErrnoException | null) => {
          if (err) {
            const benign =
              err.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
              err.code === 'ECONNRESET' ||
              (err as any).name === 'AbortError' ||
              (err as any).message === 'client_closed' ||
              ((err as any).message || '')
                .toLowerCase()
                .includes('client closed');
            if (benign) {
              console.warn(
                'Pipeline closed early (annulation client probable):',
                err.code || (err as any).name,
              );
            } else {
              console.error('Pipeline error:', err);
            }
          }
        },
      );
    } else {
      // Fallback: bufferiser si body non streamable
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
  } catch (error: any) {
    console.error('Erreur lors du proxy HLS:', error);
    res.status(500).json({
      error: 'Failed to fetch HLS content',
      details: error.message,
    });
  }
});

// Endpoint proxy pour les segments TS
router.get('/segment', async (req: Request, res: Response) => {
  try {
    const { url } = req.query;

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        error: 'URL parameter is required',
      });
    }

    // Validation de l'URL
    let upstreamUrl: URL;
    try {
      upstreamUrl = new URL(url);
    } catch {
      return res.status(400).json({
        error: 'Invalid URL format',
      });
    }

    console.log(`Proxying TS segment: \`${url}\``);

    // En-têtes pour contourner/proxy adéquatement l'origine
    const headers: { [key: string]: string } = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
      Accept: '*/*',
      'Accept-Language': 'fr,fr-FR;q=0.9,en-US;q=0.8,en;q=0.7',
      Origin: upstreamUrl.origin,
      Referer: upstreamUrl.origin + '/',
      Connection: 'keep-alive',
      'Sec-Fetch-Mode': 'cors',
      'Sec-Fetch-Site': 'cross-site',
    };

    if (req.headers.range) {
      headers.range = req.headers.range as string;
    }

    // Timeout via AbortController
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort('timeout'), 30000);

    // Abandonner la requête amont si le client se ferme/abandonne
    const onClientClosed = () => {
      try {
        controller.abort('client_closed');
      } catch {}
    };
    req.on('aborted', onClientClosed);
    req.on('close', onClientClosed);
    res.on('close', onClientClosed);

    // Récupérer le contenu depuis l'URL externe (avec retries)
    const response = await fetchWithRetries(
      url as string,
      { headers, signal: controller.signal },
      3,
    );
    clearTimeout(t);

    // Copier les en-têtes de la réponse
    response.headers.forEach((value: string, key: string) => {
      // Eviter d'envoyer un encodage incompatible
      const kl = key.toLowerCase();
      if (kl === 'content-encoding' || kl === 'transfer-encoding') return;
      res.setHeader(key, value);
    });

    // Ajouter les en-têtes CORS
    addCorsHeaders(res);

    // Définir le bon type de contenu seulement si OK et non défini
    if (response.ok) {
      const hasContentType = !!response.headers.get('content-type');
      if (!hasContentType) {
        res.setHeader('Content-Type', 'video/mp2t');
      }
    }

    // Définir le statut de la réponse
    res.status(response.status);

    if (response.body && typeof (Readable as any).fromWeb === 'function') {
      // Streamer directement sans bufferiser
      const readable = Readable.fromWeb(response.body as any);

      // Nettoyage si le client annule/la connexion se ferme
      let closedSeg = false;
      const onAbortOrCloseSeg = () => {
        if (closedSeg) return;
        closedSeg = true;
        try {
          (readable as any).destroy(new Error('client_closed'));
        } catch {}
        try {
          if (!(res as any).writableEnded && !(res as any).destroyed) {
            (res as any).destroy();
          }
        } catch {}
      };
      req.on('aborted', onAbortOrCloseSeg);
      req.on('close', onAbortOrCloseSeg);
      res.on('close', onAbortOrCloseSeg);

      pipeline(
        readable as any,
        res as any,
        (err: NodeJS.ErrnoException | null) => {
          if (err) {
            const benign =
              err.code === 'ERR_STREAM_PREMATURE_CLOSE' ||
              err.code === 'ECONNRESET' ||
              (err as any).name === 'AbortError' ||
              (err as any).message === 'client_closed' ||
              ((err as any).message || '')
                .toLowerCase()
                .includes('client closed');
            if (benign) {
              console.warn(
                'Pipeline closed early (annulation client probable):',
                err.code || (err as any).name,
              );
            } else {
              console.error('Pipeline error:', err);
            }
          }
        },
      );
    } else {
      // Fallback: bufferiser si body non streamable
      const buffer = await response.arrayBuffer();
      res.send(Buffer.from(buffer));
    }
  } catch (error: any) {
    console.error('Erreur lors du proxy segment TS:', error);
    res.status(500).json({
      error: 'Failed to fetch TS segment',
      details: error.message,
    });
  }
});

module.exports = router;
