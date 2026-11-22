'use client';

import { useEffect } from 'react';
import { bootHistomap } from '../engine/boot';

export default function HistomapClient() {
  useEffect(() => {
    bootHistomap();
  }, []);

  return (
    <>
      <h2 className="ar-pre" id="ar-pre" aria-live="polite">
        <span>
          Technology <em>Histomap</em>
        </span>
        <small>3.3 million BCE to 2026</small>
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
            Technology
          </span>
          <span className="ln" style={{ ['--i' as string]: 1 }}>
            Histomap
          </span>
        </h2>
        <canvas className="sp-cv" aria-hidden="true" />
        <svg className="sp-svg" aria-hidden="true" />
        <p className="ar-vh">
          A spiral timeline of 4,823 records: 4,295 from 1026 to 2026, one turn per century, and 528 along
          eight roots reaching back to 3.3 million BCE, with eight objects marked: Su Song&apos;s clock 1092,
          Jikji 1377, Gutenberg&apos;s press 1450, Newcomen engine 1712, telegraph 1844, transistor 1947, World
          Wide Web 1991, GPT-6 Astra 2026.
        </p>
        <div className="sp-tb">
          <div className="sp-tb-n">
            <b>4,823</b> <span>sourced</span>
          </div>
          <div className="sp-tb-k">
            3.3 million BCE to 2026, one turn per century from 1026, roots before
          </div>
          <button type="button" className="sp-start" data-a="enter">
            Start <span aria-hidden="true">&rarr;</span>
          </button>
        </div>
      </section>

      <a className="skip" href="#stage">
        Skip to the map
      </a>

      <div className="app" id="app">
        <header className="topbar">
          <div className="brand">
            <h1>
              Technology <em>Histomap</em>
            </h1>
            <span className="made" hidden>
              Made with WebGPU &amp; Three.js
            </span>
            <span className="yrs">3.3M BCE &middot; 2026</span>
          </div>
          <nav className="views" id="views" aria-label="Pages" />
          <nav className="subnav" id="subnav" aria-label="Tabs on this page" hidden />
          <div className="screens" id="screens" role="group" aria-label="Screens of this tab" hidden />
          <div className="search" role="search">
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
              Search
            </label>
            <input
              id="q"
              type="search"
              placeholder="Search the record"
              autoComplete="off"
              aria-controls="search-results"
            />
            <div className="search-results" id="search-results" role="listbox" hidden />
          </div>
        </header>

        <div className="filterbar" id="filterbar" role="region" aria-label="Filters">
          <span className="lbl sc" hidden>
            Domains
          </span>
          <div className="chips" id="chips" hidden />
          <div className="fsel">
            <label className="sc lbl" htmlFor="type-sel">
              Type
            </label>
            <select id="type-sel" />
          </div>
          <div className="fsel">
            <label className="sc lbl" htmlFor="thread-sel">
              Thread
            </label>
            <select id="thread-sel" />
          </div>
          <div className="fsel fyr">
            <label className="sc lbl" htmlFor="y-from">
              From
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
              To
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
              Years shown; the timeline below follows them
            </span>
          </div>
          <button className="btn-ghost" id="reset" type="button">
            Reset
          </button>
          <span className="count" id="count" />
          <div className="reg-sw" id="reg-sw" role="group" aria-label="Which events the map draws" hidden>
            <span className="sc lbl">Draw</span>
            <div className="toggle">
              <button
                type="button"
                data-reg="landmarks"
                title="One entry per episode at significance 5, so the past is not drowned by the present"
              >
                Landmarks
              </button>
              <button type="button" data-reg="all" title="Every event in the record">
                All
              </button>
            </div>
            <button
              type="button"
              className="btn-ghost reg-ov"
              data-ov=""
              aria-pressed="false"
              title="Five European period names, Renaissance to the second industrial revolution, drawn as overlays"
            >
              European period names
            </button>
          </div>
        </div>

        <main className="stage" id="stage" tabIndex={-1} />

        <footer className="scrubber" aria-label="Year range">
          <div className="scrub-label">
            <span className="sc">Years</span>
            <span className="rng" id="rng">
              3.3 million BCE to 2026
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
        Filters
      </button>

      <div
        className="drawer evidence"
        id="drawer"
        role="dialog"
        aria-label="Evidence panel"
        aria-hidden="true"
      >
        <div className="drawer-head">
          <div className="drawer-top">
            <div className="kicker sc" id="dk" />
            <button
              className="icon-btn"
              id="dclose"
              type="button"
              aria-label="Close evidence panel"
            >
              <svg viewBox="0 0 14 14" stroke="currentColor" strokeWidth="1.5">
                <path d="M2 2l10 10M12 2 2 12" />
              </svg>
            </button>
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
