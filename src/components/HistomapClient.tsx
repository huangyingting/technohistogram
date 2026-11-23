'use client';

import { useEffect, useRef, useState } from 'react';
import { bootHistomap } from '../engine/boot';
import { getLang, setLang, onLangChange, syncHtmlLang, type Lang } from '../lib/i18n';
import {
  getThemeId,
  setTheme,
  onThemeChange,
  syncHtmlTheme,
  THEMES,
  THEME_ORDER,
  type ThemeId,
} from '../lib/theme';
import { assetUrl } from '../lib/basePath';
import { DOMAINS } from '../lib/palette';
import { state as S, set as setStore, subscribe } from '../lib/store';
import { db, ensureNow, onData } from '../lib/data';
import { startTour, endTour } from '../lib/tour';

interface EpochPreset {
  id: string;
  year: number;
  zh: string;
  en: string;
  range: [number, number];
}

const EPOCH_PRESETS: EpochPreset[] = [
  { id: 'roots', year: -50000, zh: '远古', en: 'Roots', range: [-3400000, 1025] },
  { id: 'song', year: 1092, zh: '1092 宋元', en: '1092', range: [1026, 1399] },
  { id: 'print', year: 1450, zh: '1450 活字', en: '1450', range: [1400, 1699] },
  { id: 'steam', year: 1780, zh: '1780 蒸汽', en: '1780', range: [1700, 1899] },
  { id: 'chip', year: 1947, zh: '1947 芯片', en: '1947', range: [1900, 1979] },
  { id: 'web', year: 1991, zh: '1991 互联', en: '1991', range: [1980, 2016] },
  { id: 'ai', year: 2026, zh: '2026 智能', en: 'AI 2026', range: [2017, 2030] },
];

export default function HistomapClient() {
  const [lang, setLangState] = useState<Lang>(() => getLang());
  const [themeId, setThemeState] = useState<ThemeId>(() => getThemeId());
  const [openMenu, setOpenMenu] = useState<'domains' | 'tours' | 'themes' | 'help' | null>(null);
  const [activeDomains, setActiveDomains] = useState<Set<string>>(
    () => new Set(DOMAINS.map((d) => d.id)),
  );
  const [activeTour, setActiveTour] = useState<string>('');
  const [tourList, setTourList] = useState<any[]>([]);
  const [camYear, setCamYear] = useState<number>(2026);
  const [pulledBack, setPulledBack] = useState<boolean>(false);
  const [hasQuery, setHasQuery] = useState<boolean>(false);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  const zh = lang === 'zh';

  useEffect(() => {
    syncHtmlLang();
    syncHtmlTheme();
    setLangState(getLang());
    setThemeState(getThemeId());
    bootHistomap();

    if (
      typeof navigator !== 'undefined' &&
      'serviceWorker' in navigator &&
      location.protocol.startsWith('http')
    ) {
      navigator.serviceWorker.register(assetUrl('/sw.js')).catch(() => {});
    }

    const offTheme = onThemeChange((spec) => {
      setThemeState(spec.id);
    });

    const offLang = onLangChange((l) => {
      setLangState(l);
      setTourList([...((Array.isArray(db.tours) ? db.tours : (db.tours as any)?.tours) || [])]);
    });

    const offStore = subscribe((s) => {
      setActiveDomains(new Set(s.domains));
      setActiveTour(s.tour || '');
      setHasQuery(Boolean(s.q));
    });

    const syncTours = () => {
      const list = (Array.isArray(db.tours) ? db.tours : (db.tours as any)?.tours) || [];
      if (list.length) setTourList([...list]);
    };
    const offData = onData(() => syncTours());
    ensureNow('tours').then(syncTours).catch(() => {});

    const poll = window.setInterval(() => {
      const hx = (window as any).__helix;
      if (hx) {
        const y = Math.round(hx.target ?? hx.year ?? 2026);
        setCamYear((prev) => (prev === y ? prev : y));
        const pb = (hx.pull ?? 0) > 0.48;
        setPulledBack((prev) => (prev === pb ? prev : pb));
      }
    }, 180);

    const onDocDown = (ev: MouseEvent) => {
      if (!toolbarRef.current) return;
      if (!toolbarRef.current.contains(ev.target as Node)) {
        setOpenMenu(null);
      }
    };
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') {
        setOpenMenu(null);
      } else if (
        (ev.key === '/' && !ev.metaKey && !ev.ctrlKey && !ev.altKey) ||
        ((ev.metaKey || ev.ctrlKey) && ev.key.toLowerCase() === 'k')
      ) {
        const tgt = ev.target as HTMLElement | null;
        if (tgt && tgt.closest('input, textarea, select, [contenteditable]')) return;
        const q = document.getElementById('q') as HTMLInputElement | null;
        if (q) {
          ev.preventDefault();
          q.focus();
          q.select();
        }
      }
    };
    document.addEventListener('pointerdown', onDocDown);
    document.addEventListener('keydown', onKey);

    return () => {
      offTheme();
      offLang();
      offStore();
      offData();
      window.clearInterval(poll);
      document.removeEventListener('pointerdown', onDocDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const allDomCount = DOMAINS.length;
  const filteredDomCount = activeDomains.size < allDomCount ? activeDomains.size : 0;

  const handleDomainClick = (id: string) => {
    const cur = new Set(S.domains);
    if (cur.size === allDomCount) {
      // First click focuses directly on this domain for instant single-click exploration
      setStore({ domains: new Set([id]) });
      return;
    }
    if (cur.has(id)) {
      if (cur.size === 1) {
        // Clicking the sole active domain restores all 16 domains
        setStore({ domains: new Set(DOMAINS.map((d) => d.id)) });
      } else {
        cur.delete(id);
        setStore({ domains: cur });
      }
    } else {
      cur.add(id);
      setStore({ domains: cur });
    }
  };

  const resetAllDomains = () => {
    setStore({ domains: new Set(DOMAINS.map((d) => d.id)) });
  };

  const jumpToEpoch = (yr: number) => {
    const hx = (window as any).__helix;
    if (hx) {
      if ((hx.pull ?? 0) > 0.4) hx.pullBack?.(false);
      hx.travelTo?.(yr, { dur: 1050 });
      setCamYear(yr);
      setPulledBack(false);
    } else {
      setStore({ at: String(yr) });
    }
  };

  const toggleOverview = () => {
    const hx = (window as any).__helix;
    if (hx?.pullBack) {
      hx.pullBack();
      setPulledBack((p) => !p);
    }
  };

  const openForecastSheet = () => {
    const hx = (window as any).__helix;
    if (hx?.openForecasts) {
      if ((hx.pull ?? 0) > 0.4) hx.pullBack?.(false);
      hx.openForecasts();
      setOpenMenu(null);
    }
  };

  return (
    <>
      <h2 className="ar-pre" id="ar-pre" aria-live="polite">
        {zh ? (
          <>
            <span>
              技术演进<em>全图</em>
            </span>
            <small>公元前 330 万年 — 2026 年 · 点击任意处进入星图</small>
          </>
        ) : (
          <>
            <span>
              Technology <em>Histomap</em>
            </span>
            <small>3.3 million BCE to 2026 · Click anywhere to enter</small>
          </>
        )}
      </h2>

      <section
        className="intro spiral sp-boot"
        id="intro"
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-h"
        tabIndex={-1}
      >
        <h2 id="intro-h" className="sp-hl">
          <span className="ln" style={{ ['--i' as string]: 0 }}>
            {zh ? '技术演进' : 'Technology'}
          </span>
          <span className="ln" style={{ ['--i' as string]: 1 }}>
            {zh ? '全图' : 'Histomap'}
          </span>
        </h2>
        <canvas className="sp-cv" aria-hidden="true" />
        <svg className="sp-svg" aria-hidden="true" />
        <p className="ar-vh">
          {zh
            ? '涵盖 4,828 条世界技术史考证记录的三维螺旋时间轴：自 1026 至 2026 年每世纪旋转一圈，八条远古根脉追溯至公元前 330 万年。'
            : 'A spiral timeline of 4,828 records from 3.3 million BCE to 2026, one turn per century from 1026, with eight roots reaching back to antiquity.'}
        </p>
        <div className="sp-tb">
          <div className="sp-tb-n">
            <b>4,828</b> <span>{zh ? '条考证史料' : 'sourced'}</span>
          </div>
          <div className="sp-tb-k">
            {zh
              ? '公元前 330 万年 — 2026 年 · 每世纪一圈'
              : '3.3 million BCE to 2026, one turn per century'}
          </div>
          <button type="button" className="sp-start" data-a="enter">
            {zh ? '进入星图' : 'Start'} <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </section>

      <a className="skip" href="#stage">
        {zh ? '跳至主星图' : 'Skip to the map'}
      </a>

      <div className="app" id="app">
        <header className="topbar">
          <div
            className="brand"
            role="button"
            tabIndex={0}
            title={zh ? '返回 2026 年前沿视角' : 'Return to 2026'}
            onClick={() => jumpToEpoch(2026)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                jumpToEpoch(2026);
              }
            }}
          >
            <div className="brand-main">
              <h1>
                {zh ? (
                  <>
                    技术演进<em>全图</em>
                  </>
                ) : (
                  <>
                    Technology <em>Histomap</em>
                  </>
                )}
              </h1>
              <span className="yrs">
                {zh ? '前330万年 — 2026' : '3.3M BCE · 2026'}
              </span>
            </div>
            <span className="made" hidden>
              {zh ? '三维技术史星图 · WebGPU 驱动' : 'Technology Histomap · WebGPU'}
            </span>
          </div>

          <nav className="views" id="views" aria-label={zh ? '页面导航' : 'Pages'} />
          <nav className="subnav" id="subnav" aria-label={zh ? '子视图' : 'Tabs on this page'} hidden />
          <div className="screens" id="screens" role="group" aria-label={zh ? '分屏' : 'Screens'} hidden />

          {/* Quick Epoch & View Control Rail */}
          <nav
            className="hx-quickrail"
            aria-label={zh ? '历史纪元快速跳转' : 'Quick epoch navigation'}
          >
            <div className="hx-epochs">
              {EPOCH_PRESETS.map((ep) => {
                const isActive =
                  !pulledBack && camYear >= ep.range[0] && camYear <= ep.range[1];
                return (
                  <button
                    key={ep.id}
                    type="button"
                    className={`hx-ep-btn${isActive ? ' active' : ''}`}
                    onClick={() => jumpToEpoch(ep.year)}
                    title={zh ? `跳转至 ${ep.zh}` : `Jump to ${ep.en}`}
                  >
                    {zh ? ep.zh : ep.en}
                  </button>
                );
              })}
            </div>
            <span className="hx-rail-sep" aria-hidden="true" />
            <div className="hx-cam-btns">
              <button
                type="button"
                className={`hx-ep-btn cam${pulledBack ? ' active' : ''}`}
                onClick={toggleOverview}
                aria-pressed={pulledBack}
                title={zh ? '拉远镜头俯瞰千年全貌（双击空白处亦可切换）' : 'Pull back for millennium overview'}
              >
                {zh ? '全景' : 'Overview'}
              </button>
              <button
                type="button"
                className="hx-ep-btn cam accent"
                onClick={openForecastSheet}
                title={zh ? '查看 2026—2076 未来技术预测时间锥' : 'Open 2026–2076 future forecasts'}
              >
                {zh ? '远景' : '2050+'}
              </button>
            </div>
          </nav>

          {/* Right Toolbar: Domains, Guided Tours, Search, Language Switcher, Help */}
          <div className="hx-toolbar" ref={toolbarRef}>
            <div className="hx-pop-wrap">
              <button
                type="button"
                className={`hx-tool-btn${openMenu === 'domains' || filteredDomCount > 0 ? ' active' : ''}`}
                aria-expanded={openMenu === 'domains'}
                onClick={() => setOpenMenu((m) => (m === 'domains' ? null : 'domains'))}
                title={zh ? '按 16 个技术领域筛选星图' : 'Filter by 16 technology domains'}
              >
                <span className="hx-dot-grid" aria-hidden="true">
                  <i style={{ background: '#e2735a' }} />
                  <i style={{ background: '#48b4e0' }} />
                  <i style={{ background: '#38b892' }} />
                  <i style={{ background: '#e9b85c' }} />
                </span>
                <span>{zh ? '领域' : 'Domains'}</span>
                {filteredDomCount > 0 && (
                  <b className="hx-badge">{filteredDomCount}</b>
                )}
              </button>

              {openMenu === 'domains' && (
                <div className="hx-pop dom-pop" role="dialog" aria-label={zh ? '技术领域筛选' : 'Domain filters'}>
                  <div className="hx-pop-head">
                    <div>
                      <strong>{zh ? '十六大技术领域' : '16 Technology Domains'}</strong>
                      <small>
                        {zh
                          ? '点击领域聚焦单看，再次点击可叠加多选'
                          : 'Click a domain to focus; click more to combine'}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="hx-pop-link"
                      onClick={resetAllDomains}
                      disabled={filteredDomCount === 0}
                    >
                      {zh ? '显示全部' : 'Show all'}
                    </button>
                  </div>
                  <div className="hx-dom-grid">
                    {DOMAINS.map((d) => {
                      const on = activeDomains.has(d.id);
                      const dimmed = filteredDomCount > 0 && !on;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          className={`hx-dom-chip${on && filteredDomCount > 0 ? ' selected' : ''}${dimmed ? ' off' : ''}`}
                          onClick={() => handleDomainClick(d.id)}
                          aria-pressed={on}
                        >
                          <i style={{ background: d.color }} />
                          <span>{d.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="hx-pop-wrap">
              <button
                type="button"
                className={`hx-tool-btn${openMenu === 'tours' || activeTour ? ' active' : ''}`}
                aria-expanded={openMenu === 'tours'}
                onClick={() => {
                  ensureNow('tours', 'past').then(() => {
                    const list = (Array.isArray(db.tours) ? db.tours : (db.tours as any)?.tours) || [];
                    if (list.length) setTourList([...list]);
                  });
                  setOpenMenu((m) => (m === 'tours' ? null : 'tours'));
                }}
                title={zh ? '开启策展主题导览漫游' : 'Start a curated guided walk'}
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M2.5 13.5 6 5.5l8-3-3.5 8-8 3Z" />
                  <circle cx="8" cy="8" r="1.3" fill="currentColor" stroke="none" />
                </svg>
                <span>{zh ? '导览' : 'Tours'}</span>
              </button>

              {openMenu === 'tours' && (
                <div className="hx-pop tour-pop" role="dialog" aria-label={zh ? '主题导览' : 'Guided tours'}>
                  <div className="hx-pop-head">
                    <div>
                      <strong>{zh ? '策展主题漫游' : 'Curated Thread Walks'}</strong>
                      <small>
                        {zh
                          ? '跟随历史脉络，沿螺旋自动漫游关键节点'
                          : 'Follow curated historical threads across the coil'}
                      </small>
                    </div>
                    {activeTour && (
                      <button
                        type="button"
                        className="hx-pop-link"
                        onClick={() => {
                          endTour();
                          setOpenMenu(null);
                        }}
                      >
                        {zh ? '退出导览' : 'End walk'}
                      </button>
                    )}
                  </div>
                  <div className="hx-tour-list">
                    {tourList.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        className={`hx-tour-item${activeTour === t.id ? ' on' : ''}`}
                        onClick={() => {
                          startTour(t.id, 0, { autoplay: true });
                          setOpenMenu(null);
                        }}
                      >
                        <div className="hx-tour-top">
                          <span className="hx-tour-title">
                            <i style={{ background: t.color || '#5eead4' }} />
                            {t.title}
                          </span>
                          <span className="hx-tour-steps">
                            {zh ? `${t.steps?.length || 0} 站` : `${t.steps?.length || 0} stops`}
                          </span>
                        </div>
                        {t.subtitle && <p className="hx-tour-sub">{t.subtitle}</p>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className={`search${hasQuery ? ' has-q' : ''}`} role="search">
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                aria-hidden="true"
              >
                <circle cx="7" cy="7" r="4.5" />
                <path d="M10.5 10.5 14 14" />
              </svg>
              <label className="sr-only" htmlFor="q">
                {zh ? '搜索史料记录' : 'Search'}
              </label>
              <input
                id="q"
                type="search"
                placeholder={zh ? '搜索史料 / 拼音 / 朝代…' : 'Search / Pinyin / Era…'}
                autoComplete="off"
                aria-controls="search-results"
              />
              <kbd className="hx-kbd" aria-hidden="true">/</kbd>
              <div className="search-results" id="search-results" role="listbox" hidden />
            </div>

            <div className="hx-pop-wrap hx-theme-wrap">
              <button
                type="button"
                id="theme-toggle"
                className={`hx-tool-btn hx-theme-btn${openMenu === 'themes' ? ' active' : ''}`}
                aria-expanded={openMenu === 'themes'}
                aria-label={zh ? `切换主题（当前：${THEMES[themeId].zh}）` : `Switch theme (${THEMES[themeId].en})`}
                onClick={() => setOpenMenu((m) => (m === 'themes' ? null : 'themes'))}
                title={zh ? `视觉主题：${THEMES[themeId].zh}` : `Visual theme: ${THEMES[themeId].en}`}
              >
                <span
                  className="hx-theme-swatch"
                  style={{
                    background: THEMES[themeId].accent,
                    boxShadow: `0 0 0 2px ${THEMES[themeId].night}`,
                  }}
                  aria-hidden="true"
                />
                <span className="hx-theme-lbl">
                  {zh ? THEMES[themeId].zhShort : THEMES[themeId].enShort}
                </span>
              </button>
              {openMenu === 'themes' && (
                <div className="hx-pop theme-pop" role="dialog" aria-label={zh ? '切换主题风格' : 'Select visual theme'}>
                  <div className="hx-pop-head">
                    <div>
                      <strong>{zh ? '星图视觉主题' : 'Visual Atmosphere'}</strong>
                      <small>{zh ? '实时切换 WebGPU 着色器与界面色板' : 'Live WebGPU shader & UI palette'}</small>
                    </div>
                  </div>
                  <div className="hx-theme-list">
                    {THEME_ORDER.map((tid) => {
                      const spec = THEMES[tid];
                      const active = themeId === tid;
                      return (
                        <button
                          key={tid}
                          type="button"
                          data-theme-opt={tid}
                          className={`hx-theme-item${active ? ' on' : ''}`}
                          aria-pressed={active}
                          onClick={() => {
                            setTheme(tid);
                            setOpenMenu(null);
                          }}
                        >
                          <span
                            className="hx-theme-preview"
                            style={{
                              background: spec.night,
                              borderColor: spec.accent,
                            }}
                            aria-hidden="true"
                          >
                            <i style={{ background: spec.accent }} />
                            <i style={{ background: spec.accentWarm }} />
                          </span>
                          <span className="hx-theme-meta">
                            <strong>{zh ? spec.zh : spec.en}</strong>
                            <span>{zh ? spec.subZh : spec.subEn}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div
              className="hx-lang-sw"
              role="group"
              aria-label={zh ? '语言切换' : 'Language switcher'}
            >
              <button
                type="button"
                className={zh ? 'on' : ''}
                aria-pressed={zh}
                onClick={() => setLang('zh')}
                title="切换为简体中文"
              >
                中
              </button>
              <button
                type="button"
                className={!zh ? 'on' : ''}
                aria-pressed={!zh}
                onClick={() => setLang('en')}
                title="Switch to English"
              >
                EN
              </button>
            </div>

            <div className="hx-pop-wrap hx-help-wrap">
              <button
                type="button"
                className={`hx-icon-pill${openMenu === 'help' ? ' active' : ''}`}
                aria-label={zh ? '操作指南' : 'Controls guide'}
                aria-expanded={openMenu === 'help'}
                onClick={() => setOpenMenu((m) => (m === 'help' ? null : 'help'))}
                title={zh ? '交互与快捷键指南' : 'Controls & shortcuts'}
              >
                ?
              </button>
              {openMenu === 'help' && (
                <div className="hx-pop help-pop" role="dialog" aria-label={zh ? '操作指南' : 'Controls guide'}>
                  <div className="hx-pop-head">
                    <strong>{zh ? '星图交互指南' : 'Navigation Guide'}</strong>
                  </div>
                  <dl className="hx-help-list">
                    <div>
                      <dt>{zh ? '滚轮 / 上下滑动' : 'Scroll / Swipe'}</dt>
                      <dd>{zh ? '沿每世纪一圈的螺旋穿梭年代' : 'Travel forward & back through time'}</dd>
                    </div>
                    <div>
                      <dt>{zh ? '按住拖拽星环' : 'Drag the coil'}</dt>
                      <dd>{zh ? '微调三维倾角与环绕观察视角' : 'Orbit & tilt the 3D spiral camera'}</dd>
                    </div>
                    <div>
                      <dt>{zh ? '双击空白背景' : 'Double-click sky'}</dt>
                      <dd>{zh ? '在聚焦阅读与千年全景俯瞰间切换' : 'Toggle millennium overview camera'}</dd>
                    </div>
                    <div>
                      <dt>{zh ? '点击光点 / 卡片' : 'Click grain / card'}</dt>
                      <dd>{zh ? '展开文献考证、人物脉络与原始出处' : 'Open primary sources & evidence panel'}</dd>
                    </div>
                    <div>
                      <dt>{zh ? '因果脉络聚光灯' : '3D Lineage Spotlight'}</dt>
                      <dd>{zh ? '选中事件后按 L 或点击「脉络」，高亮前因与后世影响弧线' : 'Press L or click Lineage to trace ancestors & descendants in 3D'}</dd>
                    </div>
                    <div>
                      <dt>{zh ? '键盘巡航与快捷键' : 'Keyboard Cruise'}</dt>
                      <dd>{zh ? '↑ ↓ 或 J K 逐条巡航史料 · ← → 步进年代 · / 搜索 · Esc 关闭' : '↑ ↓ or J K cruise events · ← → step eras · / search · Esc close'}</dd>
                    </div>
                  </dl>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="filterbar" id="filterbar" role="region" aria-label={zh ? '筛选器' : 'Filters'}>
          <span className="lbl sc" hidden>
            {zh ? '领域' : 'Domains'}
          </span>
          <div className="chips" id="chips" hidden />
          <div className="fsel">
            <label className="sc lbl" htmlFor="type-sel">
              {zh ? '类型' : 'Type'}
            </label>
            <select id="type-sel" />
          </div>
          <div className="fsel">
            <label className="sc lbl" htmlFor="thread-sel">
              {zh ? '脉络' : 'Thread'}
            </label>
            <select id="thread-sel" />
          </div>
          <div className="fsel fyr">
            <label className="sc lbl" htmlFor="y-from">
              {zh ? '起' : 'From'}
            </label>
            <input
              id="y-from"
              type="number"
              inputMode="numeric"
              min={-3310000}
              max={2026}
              step={1}
              defaultValue={-3310000}
              aria-describedby="y-help"
            />
            <label className="sc lbl" htmlFor="y-to">
              {zh ? '止' : 'To'}
            </label>
            <input
              id="y-to"
              type="number"
              inputMode="numeric"
              min={1026}
              max={2026}
              step={1}
              defaultValue={2026}
            />
            <span className="sr-only" id="y-help">
              {zh ? '当前显示的年份范围' : 'Years shown; the timeline below follows them'}
            </span>
          </div>
          <button className="btn-ghost" id="reset" type="button">
            {zh ? '重置' : 'Reset'}
          </button>
          <span className="count" id="count" />
          <div className="reg-sw" id="reg-sw" role="group" aria-label={zh ? '绘制粒度' : 'Which events the map draws'} hidden>
            <span className="sc lbl">{zh ? '显示' : 'Draw'}</span>
            <div className="toggle">
              <button
                type="button"
                data-reg="landmarks"
                title={zh ? '仅展示 5 级里程碑事件' : 'Landmarks only'}
              >
                {zh ? '里程碑' : 'Landmarks'}
              </button>
              <button type="button" data-reg="all" title={zh ? '展示全部考证记录' : 'Every event in the record'}>
                {zh ? '全部' : 'All'}
              </button>
            </div>
            <button
              type="button"
              className="btn-ghost reg-ov"
              data-ov=""
              aria-pressed="false"
            >
              {zh ? '历史时期标注' : 'European period names'}
            </button>
          </div>
        </div>

        <main className="stage" id="stage" tabIndex={-1} />

        <footer className="scrubber" aria-label={zh ? '年份跨度' : 'Year range'}>
          <div className="scrub-label">
            <span className="sc">{zh ? '年代' : 'Years'}</span>
            <span className="rng" id="rng">
              {zh ? '公元前 330 万年 至 2026 年' : '3.3 million BCE to 2026'}
            </span>
          </div>
          <div className="scrub-svg" id="scrub" />
          <div className="scrub-pill" id="fpill" hidden />
        </footer>
      </div>

      <button
        className="fab-filter mobile-only"
        id="fab"
        type="button"
        aria-expanded="false"
        aria-controls="filterbar"
      >
        {zh ? '筛选' : 'Filters'}
      </button>

      <div
        className="drawer evidence"
        id="drawer"
        role="dialog"
        aria-label={zh ? '史料考证面板' : 'Evidence panel'}
        aria-hidden="true"
      >
        <div
          className="drawer-grip"
          id="dgrip"
          role="button"
          tabIndex={0}
          aria-label={zh ? '上下拖拽或点击切换面板高度' : 'Drag or tap to resize sheet'}
        >
          <span />
        </div>
        <div className="drawer-head">
          <div className="drawer-top">
            <div className="kicker sc" id="dk" />
            <div className="drawer-actions">
              <button
                className="da-btn"
                id="dlineage"
                type="button"
                aria-pressed="false"
                hidden
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <circle cx="3.2" cy="8" r="1.8" />
                  <circle cx="12.8" cy="4" r="1.8" />
                  <circle cx="12.8" cy="12" r="1.8" />
                  <path d="M5 7.3 11 4.7M5 8.7l6 2.6" />
                </svg>
                <span className="da-lbl">{zh ? '脉络' : 'Lineage'}</span>
              </button>
              <button
                className="da-btn"
                id="dposter"
                type="button"
                hidden
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <rect x="2.2" y="2" width="11.6" height="12" rx="1.8" />
                  <path d="M5 6h6M5 8.8h4M10.2 10.5h1.5v1.5h-1.5z" />
                </svg>
                <span className="da-lbl">{zh ? '海报' : 'Poster'}</span>
              </button>
              <button
                className="da-btn"
                id="dshare"
                type="button"
                hidden
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <path d="M6.6 9.4 9.4 6.6M5.2 10.8l-1.1 1.1a2.2 2.2 0 0 1-3.1-3.1l1.6-1.6a2.2 2.2 0 0 1 3.1 0M10.8 5.2l1.1-1.1a2.2 2.2 0 0 1 3.1 3.1l-1.6 1.6a2.2 2.2 0 0 1-3.1 0" />
                </svg>
                <span className="da-lbl">{zh ? '链接' : 'Link'}</span>
              </button>
              <button
                className="icon-btn"
                id="dclose"
                type="button"
                aria-label={zh ? '关闭面板' : 'Close evidence panel'}
              >
                <svg viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5">
                  <path d="M2 2l10 10M12 2 2 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="drawer-title" id="dt" />
        </div>
        <div className="drawer-body" id="db" />
        <div className="drawer-foot" id="df" hidden />
      </div>

      <div className="tip" id="tip" aria-hidden="true" />
    </>
  );
}
