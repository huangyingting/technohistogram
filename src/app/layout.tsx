import type { Metadata, Viewport } from 'next';
import '../styles/globals.css';
import { BASE_PATH, assetUrl } from '../lib/basePath';

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: '技术演进全图 · Technology Histomap',
  description:
    '从公元前 330 万年到 2026 年：在一座三维螺旋星图上呈现 4,828 条附有原始文献出处的世界技术史记录。自公元 1026 年起每世纪旋转一圈，八条远古根脉追溯人类技术起源。',
  manifest: assetUrl('/app.webmanifest'),
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: '技术演进全图',
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
    siteName: '技术演进全图 · Technology Histomap',
    title: '技术演进全图 · Technology Histomap',
    description:
      '从公元前 330 万年到 2026 年：三维 WebGPU 螺旋星图呈现 4,828 条技术史考证记录，支持中英双语即时切换。',
    images: [
      {
        url: assetUrl('/assets/og-spiral.png'),
        width: 1200,
        height: 630,
        alt: '技术演进全图：涵盖公元前 330 万年至 2026 年共 4,828 条技术史记录的三维螺旋时间轴',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: '技术演进全图 · Technology Histomap',
    description:
      '从公元前 330 万年到 2026 年：三维 WebGPU 螺旋星图呈现 4,828 条技术史考证记录，支持中英双语即时切换。',
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
    var lang = 'zh';
    try {
      var sp = new URLSearchParams(location.search);
      var qLang = sp.get('lang');
      var saved = localStorage.getItem('histomap_lang');
      if (qLang === 'en' || qLang === 'zh') lang = qLang;
      else if (saved === 'en' || saved === 'zh') lang = saved;
    } catch (e) {}
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : 'en';
    document.documentElement.dataset.lang = lang;
    var h = location.hash.slice(1);
    if (!h || /(^|&)intro=1(&|$)/.test(h) || !/(^|&)(v|e|tr|m)=/.test(h)) {
      document.documentElement.classList.add('arrive', 'arrival-mode');
      window.__ARRIVAL = true;
    }
    var P = (window.__pre = {});
    var f = function(u) { P[u] = fetch(u); P[u].catch(function(){}); return P[u]; };
    f(B + '/data/zh_i18n.json');
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
    <html lang="zh-CN" data-lang="zh" suppressHydrationWarning>
      <head>
        <meta name="mobile-web-app-capable" content="yes" />
        <style dangerouslySetInnerHTML={{ __html: FONT_FACE_CSS }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;600&family=Noto+Serif+SC:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
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
