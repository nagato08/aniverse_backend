/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion */
import type { Request, Response } from 'express';
import https from 'https';
import http from 'http';
import { URL } from 'url';

export const proxyStream = (req: Request, res: Response) => {
  try {
    const targetUrl = req.query.url as string;

    if (!targetUrl) {
      return res.status(400).json({ error: 'URL parameter is required' });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(targetUrl);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res
        .status(400)
        .json({ error: 'Only HTTP and HTTPS protocols are allowed' });
    }

    console.log(`[Proxy] Proxying request to: ${targetUrl}`);

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cache-Control',
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Content-Length, Content-Range',
    );

    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }

    const httpModule = parsedUrl.protocol === 'https:' ? https : http;

    const options: https.RequestOptions | http.RequestOptions = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.pathname + parsedUrl.search,
      method: req.method,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        Connection: 'keep-alive',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(req.headers.range && { Range: req.headers.range }),
        ...(req.headers['if-modified-since'] && {
          'If-Modified-Since': req.headers['if-modified-since'] as string,
        }),
        ...(req.headers['if-none-match'] && {
          'If-None-Match': req.headers['if-none-match'] as string,
        }),
      },
    };

    const proxyReq = httpModule.request(options, (proxyRes) => {
      console.log(
        `[Proxy] Response status: ${proxyRes.statusCode} for ${targetUrl}`,
      );
      res.statusCode = proxyRes.statusCode || 200;

      Object.keys(proxyRes.headers).forEach((key) => {
        const value = proxyRes.headers[key as keyof typeof proxyRes.headers];
        if (value !== undefined) {
          if (
            [
              'content-type',
              'content-length',
              'content-range',
              'accept-ranges',
              'last-modified',
              'etag',
              'cache-control',
              'expires',
            ].includes(key.toLowerCase())
          ) {
            res.setHeader(key, value as any);
          }
        }
      });

      proxyRes.pipe(res);

      proxyRes.on('error', (err) => {
        console.error(`[Proxy] Response error for ${targetUrl}:`, err);
        if (!res.headersSent) {
          res.status(502).json({ error: 'Proxy response error' });
        }
      });
    });

    proxyReq.on('error', (err) => {
      console.error(`[Proxy] Request error for ${targetUrl}:`, err);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Proxy request error',
          details: (err as Error).message,
        });
      }
    });

    proxyReq.setTimeout(30000, () => {
      console.error(`[Proxy] Timeout for ${targetUrl}`);
      proxyReq.destroy();
      if (!res.headersSent) {
        res.status(504).json({ error: 'Proxy timeout' });
      }
    });

    if (req.readable) {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  } catch (error) {
    console.error('[Proxy] Unexpected error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal proxy error' });
    }
  }
};

module.exports = { proxyStream };
