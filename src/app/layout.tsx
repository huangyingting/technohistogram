import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import { BASE_PATH, assetUrl } from '../lib/basePath';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'Technology Histomap',
  description:
    '4,823 records of technology on one spiral timeline, from 3.3 million BCE to 2026, each with its source. One turn per century since 1026; eight roots reach further back.',
  manifest: assetUrl('/app.webmanifest'),
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Histomap',
  },
  icons: {
    icon: [
      { url: assetUrl('/icon.svg'), type: 'image/svg+xml' },
      { url: assetUrl('/favicon-32.png'), sizes: '32x32', type: 'image/png' },
    ],
    apple: [{ url: assetUrl('/apple-touch-icon.png') }],
  },
  openGraph: {
    type: 'website',
    siteName: 'Technology Histomap',
    title: 'Technology Histomap',
    description:
      '4,823 records of technology on one spiral timeline, from 3.3 million BCE to 2026, each with its source. One turn per century since 1026; eight roots reach further back.',
    images: [
      {
        url: assetUrl('/assets/og-spiral.png'),
        width: 1200,
        height: 630,
        alt: 'Spiral timeline of 4,823 technology records, one turn per century from 1026 to 2026, roots reaching back to 3.3 million BCE, drawn on a dark ground',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Technology Histomap',
    description:
      '4,823 records of technology on one spiral timeline, from 3.3 million BCE to 2026, each with its source. One turn per century since 1026; eight roots reach further back.',
    images: [assetUrl('/assets/og-spiral.png')],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#06081a',
};

const FONT_FACE_CSS = `
@font-face { font-family: 'Instrument Sans'; src: url('${assetUrl('/assets/fonts/instrument-sans-400.ttf')}') format('truetype'); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: 'Instrument Sans'; src: url('${assetUrl('/assets/fonts/instrument-sans-500.ttf')}') format('truetype'); font-weight: 500; font-style: normal; font-display: swap; }
@font-face { font-family: 'Instrument Sans'; src: url('${assetUrl('/assets/fonts/instrument-sans-600.ttf')}') format('truetype'); font-weight: 600; font-style: normal; font-display: swap; }
@font-face { font-family: 'Instrument Serif'; src: url('${assetUrl('/assets/fonts/instrument-serif-1.ttf')}') format('truetype'); font-weight: 400; font-style: normal; font-display: swap; }
@font-face { font-family: 'Instrument Serif'; src: url('${assetUrl('/assets/fonts/instrument-serif-2.ttf')}') format('truetype'); font-weight: 400; font-style: italic; font-display: swap; }
`;

const PREBOOT_SCRIPT = `(function(){
  try {
    var B = ${JSON.stringify(BASE_PATH)};
    var h = location.hash.slice(1);
    if (!h || /(^|&)intro=1(&|$)/.test(h) || !/(^|&)(v|e|tr|m)=/.test(h)) {
      document.documentElement.classList.add('arrive', 'arrival-mode');
      window.__ARRIVAL = true;
    }
    var P = (window.__pre = {});
    var f = function(u) { P[u] = fetch(u); P[u].catch(function(){}); return P[u]; };
    f(B + '/data/manifest.json')
      .then(function(r) { return r.clone().json(); })
      .then(function(m) {
        var v = m && m.version ? '?v=' + m.version : '';
        f(B + '/data/events_core.json' + v);
        f(B + '/data/ai_models.json' + v);
        if (window.__ARRIVAL) f(B + '/data/events_past.json' + v);
      })
      .catch(function(){});
    if (window.__ARRIVAL) {
      var A = (window.__arr = {});
      A.data = fetch(B + '/arrival/data2.json');
      A.data.catch(function(){});
      A.pics = fetch(B + '/data/pictures.json').then(function(r) { return r.json(); });
      A.sheets = A.pics.then(function(j) {
        var n = 0, p = (j && j.pictures) || [], out = [];
        for (var i = 0; i < p.length; i++) if (p[i].atlas >= n) n = p[i].atlas + 1;
        for (var k = 0; k < n; k++) {
          var q = fetch(B + '/arrival/thumb' + k + '.jpg', { priority: 'low' }).then(function(r) {
            if (!r.ok) throw new Error('sheet ' + r.status);
            return r.blob();
          });
          q.catch(function(){});
          out.push(q);
        }
        return out;
      });
      A.sheets.catch(function(){});
    }
  } catch (e) {}
})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <style dangerouslySetInnerHTML={{ __html: FONT_FACE_CSS }} />
        <link
          rel="preload"
          href={assetUrl('/assets/fonts/instrument-serif-1.ttf')}
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href={assetUrl('/assets/fonts/instrument-serif-2.ttf')}
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <link
          rel="preload"
          href={assetUrl('/assets/fonts/instrument-sans-400.ttf')}
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />
        <script dangerouslySetInnerHTML={{ __html: PREBOOT_SCRIPT }} />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
