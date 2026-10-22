/* @ds-bundle: {"format":4,"namespace":"HijriFirstDaftar_1aa0fe","components":[{"name":"DayCell","sourcePath":"daftar/components/calendar/DayCell.jsx"},{"name":"MiniMonth","sourcePath":"daftar/components/calendar/MiniMonth.jsx"},{"name":"Button","sourcePath":"daftar/components/core/Button.jsx"},{"name":"ConfidenceChip","sourcePath":"daftar/components/core/ConfidenceChip.jsx"},{"name":"EventChip","sourcePath":"daftar/components/core/EventChip.jsx"},{"name":"HijriMark","sourcePath":"daftar/components/core/HijriMark.jsx"},{"name":"ViewSwitcher","sourcePath":"daftar/components/core/ViewSwitcher.jsx"},{"name":"AhdTracker","sourcePath":"daftar/components/deen/AhdTracker.jsx"},{"name":"AnchoredTasks","sourcePath":"daftar/components/deen/AnchoredTasks.jsx"},{"name":"SalahTimes","sourcePath":"daftar/components/deen/SalahTimes.jsx"}],"sourceHashes":{"daftar/components/calendar/DayCell.jsx":"597c63991d87","daftar/components/calendar/MiniMonth.jsx":"5b71d5f0ed78","daftar/components/core/Button.jsx":"c56a28c8833d","daftar/components/core/ConfidenceChip.jsx":"72f6a9855afd","daftar/components/core/EventChip.jsx":"ae0a95e02e04","daftar/components/core/HijriMark.jsx":"fcb3f1fb5919","daftar/components/core/ViewSwitcher.jsx":"3b397f844234","daftar/components/deen/AhdTracker.jsx":"51b00c46d35b","daftar/components/deen/AnchoredTasks.jsx":"77babb0a879a","daftar/components/deen/SalahTimes.jsx":"50ee287fb00b","daftar/desktop/composer.jsx":"c448d0d50137","daftar/desktop/detail.jsx":"2b1e0276f642","daftar/desktop/findtime.jsx":"3f7789282b17","daftar/desktop/onboarding.jsx":"f05e93283f2b","daftar/desktop/panes.jsx":"c5fc7f286f36","daftar/docs/design-tokens.js":"1a3703579e4a","daftar/mobile/CalViews.jsx":"efbb79fc03f5","daftar/mobile/MobileRoot.jsx":"e6403cbee399","daftar/mobile/Screens.jsx":"91568e5d2624","daftar/mobile/Sheets.jsx":"dd9b12abb302"},"inlinedExternals":[],"unexposedExports":[{"name":"accents","sourcePath":"daftar/docs/design-tokens.js"},{"name":"calendars","sourcePath":"daftar/docs/design-tokens.js"},{"name":"motion","sourcePath":"daftar/docs/design-tokens.js"},{"name":"radius","sourcePath":"daftar/docs/design-tokens.js"},{"name":"rules","sourcePath":"daftar/docs/design-tokens.js"},{"name":"themes","sourcePath":"daftar/docs/design-tokens.js"},{"name":"type","sourcePath":"daftar/docs/design-tokens.js"}]} */

(() => {

const __ds_ns = (window.HijriFirstDaftar_1aa0fe = window.HijriFirstDaftar_1aa0fe || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// daftar/components/calendar/DayCell.jsx
try { (() => {
const React = window.React;
const e = React.createElement;
/** One month-grid day. Borderless language: hairline right/bottom rules come from the grid, not the cell. */
function DayCell({
  hijri,
  greg,
  today,
  selected,
  dim,
  moon,
  tag,
  tagStyle,
  page,
  trace,
  chips = [],
  anchored,
  chipVariant = 'square',
  span,
  onSelect,
  style
}) {
  const chipRow = (c, i) => chipVariant === 'bar' ? e('div', {
    key: i,
    style: {
      borderRadius: 'var(--r-sm)',
      padding: '3px 8px',
      font: '600 10.5px var(--font-ui)',
      marginTop: 5,
      background: c.color,
      color: c.ink,
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, c.time ? e('span', {
    style: {
      opacity: .7,
      fontFamily: 'var(--font-mono-true)',
      fontSize: 9
    }
  }, c.time + ' ') : null, c.label) : e('div', {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      minWidth: 0,
      marginTop: 6
    }
  }, e('div', {
    style: {
      width: 8,
      height: 8,
      borderRadius: 2,
      flex: 'none',
      background: c.color
    }
  }), c.time ? e('div', {
    style: {
      font: '500 9.5px var(--font-mono-true)',
      color: 'var(--text-faint)',
      flex: 'none'
    }
  }, c.time) : null, e('div', {
    style: {
      font: '600 11.5px var(--font-ui)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, c.label));
  return e('div', {
    onClick: onSelect,
    style: {
      borderRight: '1px solid var(--hairline)',
      borderBottom: '1px solid var(--hairline)',
      padding: 'var(--cell-pad)',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      boxSizing: 'border-box',
      opacity: dim ? .4 : 1,
      background: selected ? 'var(--elev)' : 'transparent',
      ...style
    }
  }, e('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, e('div', {
    style: {
      minWidth: 26,
      height: 26,
      borderRadius: 'var(--r-sm)',
      display: 'grid',
      placeItems: 'center',
      font: 'var(--text-daynum)',
      background: today ? 'var(--ink)' : 'transparent',
      color: today ? 'var(--bg)' : dim ? 'var(--text-faint)' : 'var(--ink)'
    }
  }, hijri), e('div', {
    style: {
      font: '500 10px var(--font-mono-true)',
      color: 'var(--text-faint)'
    }
  }, greg), moon ? e('svg', {
    width: 12,
    height: 12,
    viewBox: '0 0 24 24'
  }, e('path', {
    fill: 'var(--gold-ink)',
    d: 'M13.2 2.5a9.5 9.5 0 1 0 8.3 13.2A7.3 7.3 0 0 1 13.2 2.5z'
  })) : null, e('div', {
    style: {
      flex: 1
    }
  }), tag ? e('div', {
    style: {
      font: '600 8px var(--font-mono-true)',
      letterSpacing: '.08em',
      whiteSpace: 'nowrap',
      color: 'var(--gold-ink)',
      ...tagStyle
    }
  }, tag) : null, page ? e('div', {
    style: {
      font: '800 11px var(--font-ui)',
      color: 'var(--accent)'
    }
  }, '¶') : null), span ? e('div', {
    style: {
      height: 20,
      marginTop: 7,
      display: 'flex',
      alignItems: 'center',
      padding: '0 9px',
      font: '600 11px var(--font-ui)',
      color: 'var(--ink)',
      flex: 'none',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      background: span.bg,
      marginLeft: span.edge === 's' ? 0 : -12,
      marginRight: span.edge === 'e' ? 0 : -12,
      borderLeft: span.edge === 's' ? '3px solid ' + span.color : 'none',
      borderRadius: span.edge === 's' ? '2px 0 0 2px' : span.edge === 'e' ? '0 2px 2px 0' : 0
    }
  }, span.label || '') : null, chips.map(chipRow), anchored ? e('div', {
    style: {
      font: '600 8px var(--font-mono-true)',
      letterSpacing: '.06em',
      color: 'var(--gold-ink)',
      marginTop: 6
    }
  }, anchored) : null, e('div', {
    style: {
      flex: 1
    }
  }), trace ? e('div', {
    style: {
      font: 'italic 400 10.5px/1.4 var(--font-quote)',
      color: 'var(--journal-trace)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      paddingTop: 4
    }
  }, trace) : null);
}
Object.assign(__ds_scope, { DayCell });
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/components/calendar/DayCell.jsx", error: String((e && e.message) || e) }); }

// daftar/components/calendar/MiniMonth.jsx
try { (() => {
const React = window.React;
const e = React.createElement;
function MiniMonth({
  title = 'RAMAḌĀN 1447',
  weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'],
  leading = 3,
  days = 30,
  today,
  selected,
  onSelect,
  yearLabel = '1447 AH · year →',
  onYear
}) {
  const cells = [];
  for (let i = 0; i < leading; i++) cells.push(e('div', {
    key: 'b' + i
  }));
  for (let d = 1; d <= days; d++) {
    const isT = d === today,
      isS = d === selected;
    cells.push(e('div', {
      key: d,
      onClick: () => onSelect && onSelect(d),
      style: {
        textAlign: 'center',
        font: '500 11px var(--font-mono-true)',
        height: 28,
        lineHeight: '28px',
        borderRadius: 'var(--r-sm)',
        cursor: 'pointer',
        background: isT ? 'var(--ink)' : 'transparent',
        color: isT ? 'var(--bg)' : 'var(--ink)',
        fontWeight: isT ? 700 : 500,
        boxShadow: isS && !isT ? 'inset 0 0 0 1.5px var(--text-muted)' : 'none'
      }
    }, d));
  }
  return e('div', {
    style: {
      background: 'var(--elev)',
      border: '1px solid var(--elev-border)',
      borderRadius: 'var(--r-lg)',
      padding: '13px 14px'
    }
  }, e('div', {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 7
    }
  }, e('div', {
    style: {
      font: '700 9px var(--font-mono-true)',
      letterSpacing: '.14em',
      color: 'var(--text-muted)'
    }
  }, title), e('div', {
    style: {
      flex: 1
    }
  }), e('div', {
    onClick: onYear,
    style: {
      font: '600 9.5px var(--font-mono-true)',
      color: 'var(--text-muted)',
      cursor: 'pointer'
    }
  }, yearLabel)), e('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7,1fr)',
      gap: 2,
      marginTop: 9
    }
  }, weekdays.map((w, i) => e('div', {
    key: 'w' + i,
    style: {
      textAlign: 'center',
      font: '700 8.5px var(--font-mono-true)',
      color: 'var(--text-muted)',
      padding: '2px 0'
    }
  }, w)), cells));
}
Object.assign(__ds_scope, { MiniMonth });
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/components/calendar/MiniMonth.jsx", error: String((e && e.message) || e) }); }

// daftar/components/core/Button.jsx
try { (() => {
const React = window.React;
function Button({
  variant = 'primary',
  children,
  onClick,
  style
}) {
  const base = {
    font: '700 11.5px var(--font-ui)',
    borderRadius: 'var(--r-sm)',
    padding: '8px 12px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    border: '1px solid transparent',
    transition: 'filter var(--dur-fast) var(--ease-settle), background var(--dur-fast) var(--ease-settle)',
    userSelect: 'none'
  };
  const variants = {
    primary: {
      background: 'var(--btn-primary-bg)',
      color: 'var(--btn-primary-ink)'
    },
    outline: {
      background: 'transparent',
      color: 'var(--ink)',
      border: '1px solid var(--line)'
    },
    quiet: {
      background: 'transparent',
      color: 'var(--text-muted)'
    },
    surface: {
      background: 'var(--surface-2)',
      color: 'var(--ink)',
      border: '1px solid var(--line)'
    }
  };
  return React.createElement('div', {
    style: {
      ...base,
      ...(variants[variant] || variants.primary),
      ...style
    },
    onClick
  }, children);
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/components/core/Button.jsx", error: String((e && e.message) || e) }); }

// daftar/components/core/ConfidenceChip.jsx
try { (() => {
const React = window.React;
function ConfidenceChip({
  state = 'provisional',
  label
}) {
  const s = {
    provisional: {
      color: 'var(--gold-ink)',
      border: '1px dashed var(--gold)'
    },
    confirmed: {
      color: 'var(--green)',
      border: '1px solid var(--line)'
    },
    firm: {
      color: 'var(--text-muted)',
      border: '1px solid var(--line)'
    }
  }[state] || {};
  const showMoon = !label && state === 'provisional';
  const text = label || {
    provisional: '±1 pending',
    confirmed: 'CONFIRMED',
    firm: 'FIRM'
  }[state];
  const crescent = React.createElement('svg', {
    width: 10,
    height: 10,
    viewBox: '0 0 24 24',
    style: {
      verticalAlign: '-1px',
      marginRight: 4
    }
  }, React.createElement('path', {
    fill: 'var(--gold-ink)',
    d: 'M13.2 2.5a9.5 9.5 0 1 0 8.3 13.2A7.3 7.3 0 0 1 13.2 2.5z'
  }));
  return React.createElement('span', {
    style: {
      font: '600 9px var(--font-mono-true)',
      letterSpacing: '.06em',
      borderRadius: 999,
      padding: '3px 9px',
      ...s
    }
  }, showMoon ? crescent : null, text);
}
Object.assign(__ds_scope, { ConfidenceChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/components/core/ConfidenceChip.jsx", error: String((e && e.message) || e) }); }

// daftar/components/core/EventChip.jsx
try { (() => {
const React = window.React;
function EventChip({
  color = 'var(--cal-personal)',
  ink = 'var(--cal-personal-ink)',
  time,
  label,
  variant = 'square'
}) {
  if (variant === 'bar') {
    return React.createElement('div', {
      style: {
        borderRadius: 'var(--r-sm)',
        padding: '3px 8px',
        font: '600 10.5px var(--font-ui)',
        background: color,
        color: ink,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, time ? React.createElement('span', {
      style: {
        opacity: .7,
        fontFamily: 'var(--font-mono-true)',
        fontSize: 9
      }
    }, time + ' ') : null, label);
  }
  return React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      minWidth: 0
    }
  }, React.createElement('div', {
    style: {
      width: 8,
      height: 8,
      borderRadius: 2,
      flex: 'none',
      background: color
    }
  }), time ? React.createElement('div', {
    style: {
      font: '500 9.5px var(--font-mono-true)',
      color: 'var(--text-faint)',
      flex: 'none'
    }
  }, time) : null, React.createElement('div', {
    style: {
      font: '600 11.5px var(--font-ui)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, label));
}
Object.assign(__ds_scope, { EventChip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/components/core/EventChip.jsx", error: String((e && e.message) || e) }); }

// daftar/components/core/HijriMark.jsx
try { (() => {
const React = window.React;
let _uid = 0;
/* The finalized Hijri First mark: a gold crescent on a night tile.
   Look is driven by the --logo-* tokens, so tweaking those (or the props) updates every instance. */
function HijriMark({
  size = 40,
  tile = true,
  variant = 'night',
  crescent,
  radius
}) {
  const id = React.useMemo(() => 'hm' + ++_uid, []);
  const px = typeof size === 'number' ? size + 'px' : size;
  const TILES = {
    night: 'var(--logo-tile)',
    paper: 'radial-gradient(120% 120% at 32% 22%, #ffffff, #e4e1d8)',
    gold: 'linear-gradient(150deg, #d4af6a, #b98d43)',
    flat: '#141414'
  };
  const CR = crescent || (variant === 'gold' ? '#141414' : variant === 'paper' ? '#b98d43' : 'var(--logo-crescent)');
  const svg = React.createElement('svg', {
    viewBox: '0 0 100 100',
    width: '68%',
    height: '68%',
    style: {
      display: 'block'
    }
  }, React.createElement('defs', null, React.createElement('mask', {
    id
  }, React.createElement('rect', {
    width: 100,
    height: 100,
    fill: '#fff'
  }), React.createElement('circle', {
    cx: 63,
    cy: 42,
    r: 27,
    fill: '#000'
  }))), React.createElement('circle', {
    cx: 50,
    cy: 50,
    r: 31,
    fill: CR,
    mask: 'url(#' + id + ')'
  }));
  if (!tile) {
    return React.createElement('span', {
      style: {
        display: 'inline-grid',
        placeItems: 'center',
        width: px,
        height: px
      }
    }, svg);
  }
  return React.createElement('span', {
    style: {
      display: 'inline-grid',
      placeItems: 'center',
      width: px,
      height: px,
      flex: 'none',
      borderRadius: radius || 'var(--logo-radius)',
      background: TILES[variant] || TILES.night
    }
  }, svg);
}
Object.assign(__ds_scope, { HijriMark });
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/components/core/HijriMark.jsx", error: String((e && e.message) || e) }); }

// daftar/components/core/ViewSwitcher.jsx
try { (() => {
const React = window.React;
function ViewSwitcher({
  views = ['Day', '3 Days', 'Week', 'Month', 'Year'],
  value = 'Month',
  onChange
}) {
  const ix = Math.max(0, views.indexOf(value));
  const go = d => onChange && onChange(views[(ix + d + views.length) % views.length]);
  const arrow = (d, ch) => React.createElement('div', {
    onClick: () => go(d),
    style: {
      width: 24,
      height: 25,
      borderRadius: 'var(--r-sm)',
      display: 'grid',
      placeItems: 'center',
      cursor: 'pointer',
      color: 'var(--text-faint)',
      fontSize: 13
    }
  }, ch);
  return React.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      background: 'var(--zebra)',
      borderRadius: 'var(--r-sm)',
      padding: 3,
      gap: 1,
      width: 'fit-content'
    }
  }, arrow(-1, '‹'), React.createElement('div', {
    style: {
      font: '600 11px var(--font-mono-true)',
      width: 54,
      textAlign: 'center',
      color: 'var(--ink)'
    }
  }, value), arrow(1, '›'));
}
Object.assign(__ds_scope, { ViewSwitcher });
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/components/core/ViewSwitcher.jsx", error: String((e && e.message) || e) }); }

// daftar/components/deen/AhdTracker.jsx
try { (() => {
const React = window.React;
const e = React.createElement;
/** ʿAhd — last seven nights. Kept = green; missed = QUIET hairline (never red); tonight = dashed gold. */
function AhdTracker({
  routines = [],
  onEdit,
  editLabel = 'routines →'
}) {
  return e('div', null, e('div', {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 7
    }
  }, e('div', {
    style: {
      font: '700 9px var(--font-mono-true)',
      letterSpacing: '.14em',
      color: 'var(--text-muted)'
    }
  }, 'ʿAHD — LAST SEVEN NIGHTS'), e('div', {
    style: {
      flex: 1
    }
  }), onEdit ? e('div', {
    onClick: onEdit,
    style: {
      font: '700 10px var(--font-ui)',
      color: 'var(--text-muted)',
      cursor: 'pointer'
    }
  }, editLabel) : null), e('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 10
    }
  }, routines.map((g, i) => e('div', {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, e('div', {
    style: {
      font: '600 11px var(--font-ui)',
      width: 110,
      flex: 'none',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, g.name), e('div', {
    style: {
      flex: 1,
      display: 'flex',
      gap: 3
    }
  }, g.nights.map((x, k) => e('div', {
    key: k,
    style: {
      flex: 1,
      height: 13,
      borderRadius: 1,
      boxSizing: 'border-box',
      background: x === 1 ? 'var(--green)' : 'transparent',
      border: x === 1 ? 'none' : x === -1 ? '1px dashed var(--gold)' : '1px solid var(--line)'
    }
  }))), e('div', {
    style: {
      font: '500 9.5px var(--font-mono-true)',
      color: 'var(--text-faint)',
      width: 26,
      textAlign: 'right',
      flex: 'none'
    }
  }, g.nights.filter(x => x === 1).length + '/' + g.nights.filter(x => x !== -1).length)))), e('div', {
    style: {
      font: '500 9.5px/1.5 var(--font-ui)',
      color: 'var(--text-faint)',
      marginTop: 9
    }
  }, 'a missed night simply scrolls away — quiet, never red.'));
}
Object.assign(__ds_scope, { AhdTracker });
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/components/deen/AhdTracker.jsx", error: String((e && e.message) || e) }); }

// daftar/components/deen/AnchoredTasks.jsx
try { (() => {
const React = window.React;
const e = React.createElement;
function AnchoredTasks({
  tasks = [],
  onToggle,
  source = 'Google'
}) {
  return e('div', null, e('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, e('div', {
    style: {
      font: '700 9px var(--font-mono-true)',
      letterSpacing: '.14em',
      color: 'var(--text-muted)'
    }
  }, 'TASKS'), e('div', {
    style: {
      flex: 1
    }
  }), source ? e('div', {
    style: {
      font: '600 8px var(--font-mono-true)',
      color: 'var(--text-faint)',
      background: 'var(--zebra)',
      borderRadius: 8,
      padding: '2px 7px'
    }
  }, source) : null), e('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 9
    }
  }, tasks.map((t, i) => e('div', {
    key: i,
    onClick: () => onToggle && onToggle(i),
    style: {
      display: 'flex',
      gap: 9,
      alignItems: 'baseline',
      cursor: 'pointer'
    }
  }, e('div', {
    style: {
      width: 14,
      height: 14,
      borderRadius: 'var(--r-sm)',
      border: '1.5px solid var(--text-faint)',
      boxSizing: 'border-box',
      flex: 'none',
      alignSelf: 'center',
      background: t.done ? 'var(--green)' : 'transparent',
      borderColor: t.done ? 'var(--green)' : 'var(--text-faint)'
    }
  }), e('div', {
    style: {
      minWidth: 0
    }
  }, e('div', {
    style: {
      font: '700 7.5px var(--font-mono-true)',
      letterSpacing: '.1em',
      color: 'var(--gold-ink)'
    }
  }, t.when), e('div', {
    style: {
      font: '600 11.5px/1.35 var(--font-ui)',
      color: t.done ? 'var(--text-faint)' : 'var(--ink)',
      textDecoration: t.done ? 'line-through' : 'none'
    }
  }, t.label))))));
}
Object.assign(__ds_scope, { AnchoredTasks });
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/components/deen/AnchoredTasks.jsx", error: String((e && e.message) || e) }); }

// daftar/components/deen/SalahTimes.jsx
try { (() => {
const React = window.React;
const e = React.createElement;
function SalahTimes({
  rows = [],
  nextIndex = -1,
  authority = 'Moonsighting Committee Worldwide',
  place = 'London',
  arabic = true,
  footer
}) {
  return e('div', {
    style: {
      background: 'var(--elev)',
      border: '1px solid var(--elev-border)',
      borderRadius: 'var(--r-lg)',
      padding: '13px 14px'
    }
  }, e('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, e('div', {
    style: {
      font: '700 9px var(--font-mono-true)',
      letterSpacing: '.14em',
      color: 'var(--text-muted)'
    }
  }, 'PRAYER TIMES'), e('div', {
    style: {
      flex: 1
    }
  }), e('div', {
    style: {
      font: '500 8.5px var(--font-mono-true)',
      color: 'var(--text-faint)'
    }
  }, place)), e('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      marginTop: 6
    }
  }, rows.map((r, i) => e('div', {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8,
      padding: '5.5px 8px',
      margin: '0 -8px',
      borderRadius: 'var(--r-sm)',
      background: i === nextIndex ? 'var(--elev)' : 'transparent',
      boxShadow: i === nextIndex ? 'inset 0 0 0 1px var(--elev-border)' : 'none'
    }
  }, e('div', {
    style: {
      font: '600 12.5px var(--font-ui)',
      color: r.dim ? 'var(--text-faint)' : 'var(--ink)'
    }
  }, r.name), arabic && r.ar ? e('div', {
    style: {
      fontFamily: 'var(--font-arabic)',
      fontSize: 13,
      color: 'var(--text-faint)'
    }
  }, r.ar) : null, e('div', {
    style: {
      flex: 1
    }
  }), e('div', {
    style: {
      font: '500 12px var(--font-mono-true)',
      color: 'var(--text-muted)'
    }
  }, r.time)))), e('div', {
    style: {
      font: '500 8.5px/1.6 var(--font-mono-true)',
      color: 'var(--text-faint)',
      marginTop: 6
    }
  }, authority), footer ? e('div', {
    style: {
      borderTop: '1px solid var(--line)',
      marginTop: 7,
      paddingTop: 8,
      font: '500 11px var(--font-ui)',
      color: 'var(--text-muted)'
    }
  }, footer) : null);
}
Object.assign(__ds_scope, { SalahTimes });
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/components/deen/SalahTimes.jsx", error: String((e && e.message) || e) }); }

// daftar/desktop/composer.jsx
try { (() => {
/* Quick event composer + overlay host + toast — Daftar desktop kit. */
const {
  useState: useCState,
  useEffect: useCEffect
} = React;
const HN = ['', 'Muḥarram', 'Ṣafar', 'Rabīʿ al-Awwal', 'Rabīʿ al-Thānī', 'Jumādā al-Ūlā', 'Jumādā al-Thāniyah', 'Rajab', 'Shaʿbān', 'Ramaḍān', 'Shawwāl', 'Dhū al-Qaʿdah', 'Dhū al-Ḥijjah'];
const CALS = [['p', 'Personal', 'var(--cal-personal)'], ['d', 'Deen', 'var(--cal-deen)'], ['f', 'Family', 'var(--cal-family)'], ['w', 'Work', 'var(--cal-work)']];
const gregOf = d => {
  const g = new Date(2026, 1, 17 + d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][g.getDay()] + ' ' + g.getDate() + ' ' + g.toLocaleString('en', {
    month: 'short'
  });
};
function Seg({
  options,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      background: 'var(--zebra)',
      borderRadius: 'var(--r-sm)',
      padding: 3,
      gap: 2,
      width: 'fit-content'
    }
  }, options.map(o => /*#__PURE__*/React.createElement("button", {
    key: o,
    onClick: () => onChange(o),
    style: {
      border: 'none',
      cursor: 'pointer',
      font: '600 11px var(--font-mono)',
      padding: '5px 12px',
      borderRadius: 'var(--r-sm)',
      background: value === o ? 'var(--surface)' : 'transparent',
      color: value === o ? 'var(--ink)' : 'var(--text-faint)',
      boxShadow: value === o ? '0 1px 3px rgba(0,0,0,.22)' : 'none'
    }
  }, o)));
}
function Composer({
  day: day0,
  edit,
  onClose,
  onFindTime
}) {
  const [kind, setKind] = useCState(edit && edit.kind === 'Task' ? 'Task' : 'Event');
  const [title, setTitle] = useCState(edit ? edit.title : '');
  const [day, setDay] = useCState(day0 || 13);
  const [allDay, setAllDay] = useCState(edit ? edit.time === 'all-day' : false);
  const [start, setStart] = useCState(edit && /^\d{1,2}:\d{2}$/.test(edit.time) ? edit.time : '18:30');
  const [end, setEnd] = useCState('19:15');
  const [pin, setPin] = useCState('hijri');
  const [cal, setCal] = useCState(edit ? edit.k : kindDefault(kind));
  const [rem, setRem] = useCState('30 min before');
  function kindDefault(k) {
    return k === 'Task' ? 'd' : 'p';
  }
  useCEffect(() => {
    const k = e => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, []);
  const save = () => {
    const t = allDay ? 'all-day' : start,
      ti = title.trim() || 'Untitled';
    if (edit) {
      if (day === day0) window.updKitEvent(day, edit.ix, cal, t, ti);else {
        window.delKitEvent(day0, edit.ix);
        window.addKitEvent(day, cal, t, ti);
      }
      window.daftarToast && window.daftarToast(`Updated “${ti}”`);
    } else {
      window.addKitEvent && window.addKitEvent(day, cal, t, ti);
      window.daftarToast && window.daftarToast(`${kind} added to ${day} Ramaḍān${pin === 'hijri' ? ' · pinned to Hijri' : ' · pinned to Gregorian'}`);
    }
    onClose();
  };
  const lbl = {
    font: '700 8.5px var(--font-mono)',
    letterSpacing: '.14em',
    color: 'var(--text-muted)'
  };
  const radio = on => ({
    flex: 1,
    textAlign: 'left',
    cursor: 'pointer',
    background: on ? 'var(--accent-soft)' : 'var(--elev)',
    border: '1px solid ' + (on ? 'var(--accent)' : 'var(--elev-border)'),
    borderRadius: 'var(--r-sm)',
    padding: '8px 10px'
  });
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    className: "df-scrim",
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "df-card",
    style: {
      width: 460,
      gap: 14
    },
    role: "dialog",
    "aria-label": "New event",
    onMouseDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(Seg, {
    options: ['Event', 'Task'],
    value: kind,
    onChange: k => {
      setKind(k);
      setCal(kindDefault(k));
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "df-x",
    onClick: onClose,
    "aria-label": "Close"
  }, "\u2715")), /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: title,
    onChange: e => setTitle(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') save();
    },
    placeholder: kind === 'Task' ? 'Add task' : 'Add title',
    style: {
      background: 'none',
      border: 'none',
      borderBottom: '1px solid var(--line)',
      padding: '4px 1px 9px',
      font: '600 16px var(--font-ui)',
      color: 'var(--ink)',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "df-x",
    style: {
      width: 22,
      height: 22,
      fontSize: 13
    },
    onClick: () => setDay(d => Math.max(1, d - 1))
  }, "\u2039"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12.5px var(--font-ui)'
    }
  }, day, " Rama\u1E0D\u0101n 1447"), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 10,
      color: 'var(--text-faint)'
    }
  }, gregOf(day)), /*#__PURE__*/React.createElement("button", {
    className: "df-x",
    style: {
      width: 22,
      height: 22,
      fontSize: 13
    },
    onClick: () => setDay(d => Math.min(30, d + 1))
  }, "\u203A"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      cursor: 'pointer',
      font: '500 11px var(--font-ui)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => setAllDay(a => !a),
    style: {
      width: 13,
      height: 13,
      borderRadius: 3,
      border: '1.5px solid ' + (allDay ? 'var(--green)' : 'var(--text-faint)'),
      background: allDay ? 'var(--green)' : 'transparent',
      boxSizing: 'border-box'
    }
  }), /*#__PURE__*/React.createElement("span", {
    onClick: () => setAllDay(a => !a)
  }, "All-day")), !allDay && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "df-input",
    style: {
      width: 58,
      font: '500 11px var(--font-mono)',
      textAlign: 'center'
    },
    value: start,
    onChange: e => setStart(e.target.value),
    "aria-label": "Start time"
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-faint)'
    }
  }, "\u2013"), /*#__PURE__*/React.createElement("input", {
    className: "df-input",
    style: {
      width: 58,
      font: '500 11px var(--font-mono)',
      textAlign: 'center'
    },
    value: end,
    onChange: e => setEnd(e.target.value),
    "aria-label": "End time"
  }))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: lbl
  }, "PIN TO"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      marginTop: 7
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: radio(pin === 'hijri'),
    onClick: () => setPin('hijri')
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 11.5px var(--font-ui)',
      color: 'var(--ink)'
    }
  }, "Hijri"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 9.5px/1.3 var(--font-ui)',
      color: 'var(--text-faint)',
      marginTop: 1
    }
  }, "moves with the crescent")), /*#__PURE__*/React.createElement("button", {
    style: radio(pin === 'greg'),
    onClick: () => setPin('greg')
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 11.5px var(--font-ui)',
      color: 'var(--ink)'
    }
  }, "Gregorian"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 9.5px/1.3 var(--font-ui)',
      color: 'var(--text-faint)',
      marginTop: 1
    }
  }, "fixed to the solar date")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 18
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: lbl
  }, "CALENDAR"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      marginTop: 7
    }
  }, CALS.map(([k, name, c]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    title: name,
    onClick: () => setCal(k),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 5,
      cursor: 'pointer',
      background: cal === k ? 'var(--zebra)' : 'none',
      border: '1px solid ' + (cal === k ? 'var(--line)' : 'transparent'),
      borderRadius: 999,
      padding: '4px 9px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: 3,
      background: c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 10.5px var(--font-ui)',
      color: cal === k ? 'var(--ink)' : 'var(--text-faint)'
    }
  }, name))))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: lbl
  }, "REMINDER"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 7
    }
  }, /*#__PURE__*/React.createElement(DfSelect, {
    value: rem,
    options: ['No reminder', '10 min before', '30 min before', '1 hour before', 'At Maghrib the night before'],
    onChange: setRem,
    width: "100%"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      borderTop: '1px solid var(--line)',
      paddingTop: 13
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "df-link",
    onClick: onFindTime
  }, "\u1E62al\u0101h-aware \xB7 find a time with others \u2192"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "df-btn",
    onClick: save
  }, edit ? 'Update' : 'Create')))), document.body);
}
function OverlayHost() {
  const [composer, setComposer] = useCState(null);
  const [ft, setFt] = useCState(false);
  const [detail, setDetail] = useCState(null);
  const [settings, setSettings] = useCState(false);
  const [prayer, setPrayer] = useCState(false);
  const [alerts, setAlerts] = useCState(false);
  const [palette, setPalette] = useCState(false);
  const [shortcuts, setShortcuts] = useCState(false);
  const [onboard, setOnboard] = useCState(false);
  const [tour, setTour] = useCState(false);
  const [toast, setToast] = useCState(null);
  useCEffect(() => {
    window.openComposer = arg => setComposer(typeof arg === 'object' ? arg : {
      day: arg
    });
    window.openFindTime = () => setFt(true);
    window.openDetail = (day, ix) => setDetail({
      day,
      ix
    });
    window.openSettings = () => setSettings(true);
    window.openPrayerPane = () => setPrayer(true);
    window.openAlerts = () => setAlerts(true);
    window.openPalette = () => setPalette(true);
    window.openShortcuts = () => setShortcuts(true);
    window.openOnboarding = () => setOnboard(true);
    window.openTour = () => setTour(true);
    if (!localStorage.getItem('daftar_onboarded_v1') && !new URLSearchParams(location.search).has('embed')) setOnboard(true);
    let tm;
    const show = t => {
      setToast(t);
      clearTimeout(tm);
      tm = setTimeout(() => setToast(null), 3600);
    };
    window.daftarToast = msg => show({
      msg
    });
    window.daftarToastUndo = (msg, undo) => show({
      msg,
      undo
    });
    const key = e => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette(true);
        return;
      }
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA' || e.metaKey || e.ctrlKey) return;
      const kk = e.key.toLowerCase();
      if (kk === 'f') setFt(true);
      if (kk === 'c') setComposer({
        day: 13
      });
      if (e.key === '?') setShortcuts(true);
      const vm = {
        d: 'day',
        w: 'week',
        m: 'month',
        a: 'agenda',
        j: 'sijill',
        y: 'year'
      };
      if (vm[kk] && window.setView) window.setView(vm[kk]);
      if (kk === 'g' && window.togGview) window.togGview();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  return /*#__PURE__*/React.createElement(React.Fragment, null, composer && /*#__PURE__*/React.createElement(Composer, {
    day: composer.day,
    edit: composer.edit,
    onClose: () => setComposer(null),
    onFindTime: () => {
      setComposer(null);
      setFt(true);
    }
  }), ft && /*#__PURE__*/React.createElement(FindTimePop, {
    onClose: () => setFt(false)
  }), detail && /*#__PURE__*/React.createElement(EventDetail, {
    day: detail.day,
    ix: detail.ix,
    onClose: () => setDetail(null)
  }), settings && /*#__PURE__*/React.createElement(SettingsModal, {
    onClose: () => setSettings(false)
  }), prayer && /*#__PURE__*/React.createElement(PrayerPane, {
    onClose: () => setPrayer(false),
    onSettings: () => {
      setPrayer(false);
      setSettings(true);
    }
  }), alerts && /*#__PURE__*/React.createElement(AlertsPane, {
    onClose: () => setAlerts(false)
  }), palette && /*#__PURE__*/React.createElement(CmdPalette, {
    onClose: () => setPalette(false)
  }), shortcuts && /*#__PURE__*/React.createElement(ShortcutsPane, {
    onClose: () => setShortcuts(false)
  }), onboard && /*#__PURE__*/React.createElement(Onboarding, {
    onClose: () => setOnboard(false),
    onTour: () => setTour(true)
  }), tour && /*#__PURE__*/React.createElement(TourOverlay, {
    onClose: () => setTour(false)
  }), toast && /*#__PURE__*/React.createElement("div", {
    role: "status",
    "aria-live": "polite",
    style: {
      position: 'fixed',
      bottom: 26,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 80,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 999,
      padding: '9px 15px',
      font: '600 11px var(--font-mono)',
      color: 'var(--ink)',
      boxShadow: '0 8px 24px rgba(0,0,0,.4)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--green)'
    }
  }), toast.msg, toast.undo && /*#__PURE__*/React.createElement("button", {
    className: "df-link",
    style: {
      font: '700 11px var(--font-mono)'
    },
    onClick: () => {
      toast.undo();
      setToast(null);
    }
  }, "Undo")));
}
ReactDOM.createRoot(document.getElementById('overlay-root')).render(React.createElement(OverlayHost));
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/desktop/composer.jsx", error: String((e && e.message) || e) }); }

// daftar/desktop/detail.jsx
try { (() => {
/* Event detail popover — Daftar desktop kit. */
const {
  useState: useDState,
  useEffect: useDEffect
} = React;
const DCALS = {
  p: ['Personal', 'var(--cal-personal)'],
  d: ['Deen', 'var(--cal-deen)'],
  f: ['Family', 'var(--cal-family)'],
  w: ['Work', 'var(--cal-work)']
};
const dGreg = d => {
  const g = new Date(2026, 1, 17 + d);
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][g.getDay()] + ', ' + g.getDate() + ' ' + g.toLocaleString('en', {
    month: 'long'
  });
};
function maghribCtx(time) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!m) return null;
  const t = +m[1] * 60 + +m[2],
    end = t + 45,
    MAG = 1065;
  if (end <= MAG) {
    const d = MAG - end;
    return `Ends ${d >= 60 ? Math.floor(d / 60) + ' h ' + (d % 60 ? d % 60 + ' min' : '') : d + ' min'} before Maghrib (17:45)`;
  }
  if (t < MAG) return 'Overlaps Maghrib (17:45) — iftar time';
  return 'After Maghrib — belongs to the next night';
}
function DIcon({
  d,
  s = 15
}) {
  return /*#__PURE__*/React.createElement("svg", {
    width: s,
    height: s,
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: d
  }));
}
function EventDetail({
  day,
  ix,
  onClose
}) {
  const ev = window.getKitEvent && window.getKitEvent(day, ix);
  const [menu, setMenu] = useDState(false);
  useDEffect(() => {
    const k = e => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, []);
  if (!ev) return null;
  const [k, time, title] = ev;
  const [calName, calColor] = DCALS[k] || DCALS.p;
  const ctx = maghribCtx(time);
  const act = (label, fn) => () => {
    fn ? fn() : window.daftarToast(label + ' — stubbed in this kit');
  };
  const row = {
    display: 'flex',
    alignItems: 'center',
    gap: 9,
    font: '500 11.5px var(--font-ui)',
    color: 'var(--text-muted)'
  };
  const ico = {
    color: 'var(--text-faint)',
    flex: 'none'
  };
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    className: "df-scrim",
    style: {
      background: 'rgba(0,0,0,.35)'
    },
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "df-card",
    style: {
      width: 400,
      gap: 13
    },
    role: "dialog",
    "aria-label": "Event details",
    onMouseDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      margin: '-6px -8px 0 0',
      justifyContent: 'flex-end',
      position: 'relative'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "df-x",
    title: "Edit",
    onClick: () => {
      onClose();
      window.openComposer({
        day,
        edit: {
          ix,
          k,
          time,
          title
        }
      });
    }
  }, /*#__PURE__*/React.createElement(DIcon, {
    d: "M4 20l4.5-1 11-11a2 2 0 0 0-3.5-3.5l-11 11L4 20z"
  })), /*#__PURE__*/React.createElement("button", {
    className: "df-x",
    title: "Delete",
    onClick: () => {
      const old = window.delKitEvent(day, ix);
      onClose();
      window.daftarToastUndo && window.daftarToastUndo('Deleted “' + title + '”', () => window.restoreKitEvent(day, ix, old));
    }
  }, /*#__PURE__*/React.createElement(DIcon, {
    d: "M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5"
  })), /*#__PURE__*/React.createElement("button", {
    className: "df-x",
    title: "Find a time with others",
    onClick: () => {
      onClose();
      window.openFindTime();
    }
  }, /*#__PURE__*/React.createElement(DIcon, {
    d: "M9 8.5a3 3 0 1 0 6 0 3 3 0 0 0-6 0zM4.5 19.5c.6-3.2 3.4-5 7.5-5s6.9 1.8 7.5 5"
  })), /*#__PURE__*/React.createElement("button", {
    className: "df-x",
    title: "More",
    onClick: () => setMenu(m => !m)
  }, /*#__PURE__*/React.createElement(DIcon, {
    d: "M12 5.5h.01M12 12h.01M12 18.5h.01"
  })), /*#__PURE__*/React.createElement("button", {
    className: "df-x",
    title: "Close",
    onClick: onClose
  }, "\u2715"), menu && /*#__PURE__*/React.createElement("div", {
    className: "df-results",
    style: {
      position: 'absolute',
      top: 30,
      right: 34,
      zIndex: 6,
      minWidth: 150
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "df-result",
    onClick: () => {
      window.addKitEvent(day, k, time, title + ' (copy)');
      setMenu(false);
      window.daftarToast('Duplicated');
    }
  }, "Duplicate"), /*#__PURE__*/React.createElement("button", {
    className: "df-result",
    onClick: act('Copy link')
  }, "Copy link"), /*#__PURE__*/React.createElement("button", {
    className: "df-result",
    onClick: act('Print')
  }, "Print"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 11,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 12,
      height: 12,
      borderRadius: 3,
      background: calColor,
      marginTop: 5,
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 16.5px var(--font-ui)',
      color: 'var(--ink)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 11.5px var(--font-ui)',
      color: 'var(--text-muted)',
      marginTop: 3
    }
  }, day, " Rama\u1E0D\u0101n 1447 \xB7 ", dGreg(day), time && time !== 'all-day' ? ` · ${time}` : ' · all day'))), ctx && /*#__PURE__*/React.createElement("div", {
    style: row
  }, /*#__PURE__*/React.createElement("span", {
    style: ico
  }, /*#__PURE__*/React.createElement(DIcon, {
    d: "M12 7.5V12l3 2M12 21a9 9 0 1 1 0-18 9 9 0 0 1 0 18z"
  })), ctx), /*#__PURE__*/React.createElement("div", {
    style: row
  }, /*#__PURE__*/React.createElement("span", {
    style: ico
  }, /*#__PURE__*/React.createElement(DIcon, {
    d: "M6.4 9.6a5.6 5.6 0 0 1 11.2 0c0 4.3 1.8 5.4 1.8 5.4H4.6s1.8-1.1 1.8-5.4zM10.2 19.6a2 2 0 0 0 3.6 0"
  })), "30 minutes before"), /*#__PURE__*/React.createElement("div", {
    style: row
  }, /*#__PURE__*/React.createElement("span", {
    style: ico
  }, /*#__PURE__*/React.createElement(DIcon, {
    d: "M12 12a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zM5 19.5c.6-3.4 3.2-5.1 7-5.1s6.4 1.7 7 5.1"
  })), "You \xB7 ", calName), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      borderTop: '1px solid var(--line)',
      paddingTop: 12
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "df-ghost",
    onClick: () => {
      onClose();
      window.openFindTime();
    }
  }, "\u1E62al\u0101h-aware invite")))), document.body);
}
Object.assign(window, {
  EventDetail
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/desktop/detail.jsx", error: String((e && e.message) || e) }); }

// daftar/desktop/findtime.jsx
try { (() => {
/* Ṣalāh-aware scheduling — Daftar port of the Hijri First FindTimeOverlay concept, restyled to Daftar tokens. */
const {
  useState,
  useRef,
  useEffect,
  useMemo
} = React;
document.head.insertAdjacentHTML('beforeend', `<style>
.df-scrim{position:fixed;inset:0;background:rgba(0,0,0,.62);z-index:60;display:grid;place-items:center;padding:16px}
.df-card{width:980px;max-width:96vw;max-height:calc(100vh - 32px);overflow-y:auto;background:var(--bg);border:1px solid var(--line);border-radius:var(--r-lg);padding:20px 22px;color:var(--ink);font-family:var(--font-ui);box-sizing:border-box;display:flex;flex-direction:column;gap:16px}
.df-mc{font:700 9px var(--font-mono);letter-spacing:.14em;color:var(--text-muted)}
.df-x{width:28px;height:28px;border:none;background:none;border-radius:var(--r-sm);display:grid;place-items:center;color:var(--text-faint);cursor:pointer;font-size:15px}
.df-x:hover{background:var(--zebra);color:var(--ink)}
.df-row{display:grid;grid-template-columns:128px 1fr;gap:10px;align-items:center;margin:10px 0}
.df-track{position:relative;height:32px;background:var(--elev);border:1px solid var(--elev-border);border-radius:var(--r-sm)}
.df-tick{position:absolute;top:0;bottom:0;width:1px;background:var(--hairline)}
.df-night{position:absolute;top:0;bottom:0;background:var(--zebra)}
.df-other{position:absolute;top:5px;bottom:5px;border:1px dashed color-mix(in srgb,var(--gold) 45%,transparent);border-radius:3px;box-sizing:border-box}
.df-band{position:absolute;top:2px;bottom:2px;border:1px solid var(--gold);background:color-mix(in srgb,var(--gold) 15%,transparent);border-radius:3px;box-sizing:border-box}
.df-sun{position:absolute;top:0;bottom:0;width:1.5px;background:var(--gold-ink);opacity:.65}
.df-now{position:absolute;top:-2px;bottom:-2px;width:1.5px;background:var(--accent)}
.df-lblrow{position:relative;height:24px;margin-top:2px}
.df-blbl{position:absolute;transform:translateX(-50%);font:500 8.5px var(--font-mono);color:var(--text-faint);white-space:nowrap;top:0}
.df-blbl b{color:var(--gold-ink);font-weight:700}
.df-blbl--r2{top:11px}
.df-axis{position:relative;height:14px}
.df-atick{position:absolute;transform:translateX(-50%);font:500 9px var(--font-mono);color:var(--text-faint);white-space:nowrap}
.df-atick--first{transform:none}
.df-body{position:relative}
.df-ovl{position:absolute;left:138px;right:0;top:20px;bottom:20px;cursor:crosshair}
.df-marker{position:absolute;top:0;bottom:0;background:color-mix(in srgb,var(--accent) 24%,transparent);border:1.5px solid var(--accent);border-radius:var(--r-sm);box-sizing:border-box;cursor:grab;min-width:8px}
.df-marker--clash{background:color-mix(in srgb,var(--alert) 22%,transparent);border-color:var(--alert)}
@keyframes dfshake{0%,100%{transform:translateX(0)}25%{transform:translateX(-3px)}75%{transform:translateX(3px)}}
.df-marker--shake{animation:dfshake 180ms var(--ease-settle,ease) 2}
.df-dur{position:absolute;top:2px;left:5px;font:700 9px var(--font-mono);color:var(--ink);white-space:nowrap}
.df-h{position:absolute;top:50%;transform:translateY(-50%);width:8px;height:20px;display:grid;place-items:center;cursor:ew-resize}
.df-h i{width:2.5px;height:14px;background:var(--accent);border-radius:2px;display:block}
.df-marker--clash .df-h i{background:var(--alert)}
.df-chiprow{position:relative;height:26px}
.df-chip{position:absolute;transform:translateX(-50%);white-space:nowrap;font:600 10px var(--font-mono);color:var(--text-muted);background:var(--surface);border:1px solid var(--line);border-radius:999px;padding:5px 11px}
.df-chip--clash{color:var(--alert);border-color:color-mix(in srgb,var(--alert) 55%,transparent)}
.df-pill{background:none;border:1px solid var(--line);border-radius:999px;padding:5px 11px;font:600 10.5px var(--font-mono);color:var(--text-muted);cursor:pointer}
.df-pill:hover{background:var(--zebra)}
.df-pill--on{background:var(--accent-soft);color:var(--accent);border-color:var(--accent)}
.df-btn{background:var(--btn-primary-bg);color:var(--btn-primary-ink);border:none;border-radius:var(--r-sm);padding:9px 14px;font:700 12px var(--font-ui);cursor:pointer}
.df-btn:hover{filter:brightness(1.06)}.df-btn:active{filter:brightness(.92)}
.df-btn--clash{background:transparent;border:1px solid var(--alert);color:var(--alert)}
.df-ghost{background:none;border:1px solid var(--line);border-radius:var(--r-sm);padding:8px 13px;font:600 11.5px var(--font-ui);color:var(--text-muted);cursor:pointer}
.df-ghost:hover{background:var(--zebra);color:var(--ink)}
.df-link{background:none;border:none;padding:0;font:600 11px var(--font-ui);color:var(--accent);cursor:pointer;text-decoration:none}
.df-link:hover{text-decoration:underline}
.df-input{background:var(--elev);border:1px solid var(--elev-border);border-radius:var(--r-sm);padding:7px 10px;font:500 11.5px var(--font-ui);color:var(--ink);box-sizing:border-box}
.df-input::placeholder{color:var(--text-faint)}
.df-results{background:var(--surface);border:1px solid var(--line);border-radius:var(--r-sm);overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.4)}
.df-result{display:block;width:100%;text-align:left;background:none;border:none;padding:8px 11px;font:500 11.5px var(--font-ui);color:var(--ink);cursor:pointer}
.df-result:hover{background:var(--zebra)}
.df-lg{display:inline-block;width:14px;height:8px;border-radius:2px;margin-right:5px;vertical-align:-1px}
</style>`);
const clampF = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const pctF = m => `${clampF(m, 0, 1440) / 1440 * 100}%`;
const snap15 = m => Math.round(m / 15) * 15;
const fmtL = (utc, off) => {
  const t = ((utc + off) % 1440 + 1440) % 1440;
  return String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0');
};
const durLbl = m => m < 60 ? `${m} min` : m % 60 === 0 ? `${m / 60} h` : `${Math.floor(m / 60)} h ${m % 60}`;
const NOW_UTC = 835,
  BAND = 45;
const bandify = (off, locals) => ['Fajr', 'Dhuhr', 'ʿAsr', 'Maghrib', 'ʿIshāʾ'].map((name, i) => {
  const s = ((locals[i] - off) % 1440 + 1440) % 1440;
  return {
    name,
    s,
    e: s + BAND,
    heavy: name === 'Maghrib'
  };
});
const mkP = (name, city, off, gmt, locals, sr, ss) => ({
  name,
  city,
  offMin: off,
  gmt,
  day: {
    bands: bandify(off, locals).map(b => ({
      ...b,
      who: name
    })),
    sunriseUtc: ((sr - off) % 1440 + 1440) % 1440,
    sunsetUtc: ((ss - off) % 1440 + 1440) % 1440
  }
});
const P_YOU = mkP('You', 'London', 0, 'GMT', [301, 737, 907, 1065, 1153], 394, 1065);
const P_AMMAR = mkP('Ammar', 'Kuala Lumpur', 480, 'GMT+8', [355, 795, 975, 1160, 1250], 430, 1160);
const CITY_LIB = [{
  label: 'Istanbul, Türkiye',
  n: 'Yusuf',
  mk: n => mkP(n, 'Istanbul', 180, 'GMT+3', [245, 795, 1030, 1225, 1325], 350, 1225)
}, {
  label: 'Jeddah, Saudi Arabia',
  n: 'Anas',
  mk: n => mkP(n, 'Jeddah', 180, 'GMT+3', [263, 748, 944, 1145, 1235], 347, 1145)
}, {
  label: 'Karachi, Pakistan',
  n: 'Hamza',
  mk: n => mkP(n, 'Karachi', 300, 'GMT+5', [270, 755, 975, 1160, 1250], 360, 1160)
}, {
  label: 'Cairo, Egypt',
  n: 'Omar',
  mk: n => mkP(n, 'Cairo', 120, 'GMT+2', [255, 770, 985, 1180, 1275], 355, 1180)
}, {
  label: 'Jakarta, Indonesia',
  n: 'Farhan',
  mk: n => mkP(n, 'Jakarta', 420, 'GMT+7', [285, 725, 930, 1085, 1160], 365, 1085)
}];
const clashAt = (bands, s, dur) => {
  const hits = bands.filter(b => [0, -1440, 1440].some(sh => s < b.e + sh && s + dur > b.s + sh));
  return hits.length === 0 ? null : hits.find(b => b.heavy) || hits[0];
};
const nightAt = (day, s, e) => {
  const inN = m => {
    const t = (m % 1440 + 1440) % 1440;
    return day.sunriseUtc < day.sunsetUtc ? t < day.sunriseUtc || t >= day.sunsetUtc : t >= day.sunsetUtc && t < day.sunriseUtc;
  };
  return inN(s) || inN(Math.max(s, e - 1));
};
const allBandsOf = ps => ps.flatMap(p => p.day.bands);
const clearFor = (ps, s, dur) => !clashAt(allBandsOf(ps), s, dur) && ps.every(p => !nightAt(p.day, s, s + dur));
function suggest(ps, dur) {
  const ok = [];
  for (let t = 0; t <= 1440 - dur; t += 15) if (clearFor(ps, t, dur)) ok.push(t);
  return ok.length ? [...new Set([ok[0], ok[Math.floor(ok.length / 2)], ok[ok.length - 1]])] : [];
}
function nextClear(ps, from, dur) {
  for (let t = snap15(from); t <= from + 360; t += 15) if (clearFor(ps, t, dur)) return t;
  return null;
}
function betweenPrayers(p, s) {
  const local = ((s + p.offMin) % 1440 + 1440) % 1440;
  const locs = p.day.bands.map(b => ({
    name: b.name,
    l: ((b.s + p.offMin) % 1440 + 1440) % 1440
  })).sort((a, b) => a.l - b.l);
  let bef = null,
    aft = null;
  for (const b of locs) {
    if (b.l <= local) bef = b;else if (!aft) aft = b;
  }
  return bef && aft ? `between ${bef.name} and ${aft.name}` : aft ? `before ${aft.name}` : bef ? `after ${bef.name}` : '';
}
const chipText = (clash, ps, s, e) => {
  if (clash) return `Crosses ${clash.name} (${clash.who}) — slide the block clear`;
  const np = ps.find(p => nightAt(p.day, s, e));
  const times = ps.slice(0, 2).map(p => `${fmtL(s, p.offMin)} ${p.name === 'You' ? 'you' : p.name}`).join(' · ');
  return np ? `${times} · night for ${np.name === 'You' ? 'you' : np.name}` : `${times} · clear for everyone`;
};
function TrackRow({
  person,
  others,
  onRemove
}) {
  const day = person.day,
    nights = [];
  if (day.sunriseUtc < day.sunsetUtc) {
    if (day.sunriseUtc > 5) nights.push([0, day.sunriseUtc]);
    if (day.sunsetUtc < 1435) nights.push([day.sunsetUtc, 1440]);
  } else if (day.sunsetUtc < day.sunriseUtc) nights.push([day.sunsetUtc, day.sunriseUtc]);
  const last = [-Infinity, -Infinity];
  const labels = [...day.bands].map(b => ({
    b,
    m: (b.s % 1440 + 1440) % 1440
  })).sort((x, y) => x.m - y.m).map(({
    b,
    m
  }) => {
    const row = m - last[0] >= 105 ? 0 : m - last[1] >= 105 ? 1 : 0;
    last[row] = m;
    return {
      b,
      m,
      row
    };
  });
  return /*#__PURE__*/React.createElement("div", {
    className: "df-row"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12.5px var(--font-ui)'
    }
  }, person.name, onRemove && /*#__PURE__*/React.createElement("button", {
    className: "df-x",
    style: {
      display: 'inline-grid',
      width: 18,
      height: 18,
      marginLeft: 5,
      verticalAlign: -4
    },
    "aria-label": `Remove ${person.name}`,
    onClick: onRemove
  }, "\xD7")), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 9.5px var(--font-mono)',
      color: 'var(--text-faint)'
    }
  }, person.city, " \xB7 ", person.gmt)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "df-track"
  }, Array.from({
    length: 8
  }, (_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "df-tick",
    style: {
      left: pctF(i * 180)
    }
  })), nights.map(([a, b], i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "df-night",
    style: {
      left: pctF(a),
      width: `${(b - a) / 1440 * 100}%`
    }
  })), others.flatMap(o => o.day.bands).map((b, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "df-other",
    title: `${b.name} — ${b.who}'s prayer`,
    style: {
      left: pctF((b.s % 1440 + 1440) % 1440),
      width: `${(b.e - b.s) / 1440 * 100}%`
    }
  })), [day.sunriseUtc, day.sunsetUtc].map((m, i) => /*#__PURE__*/React.createElement("span", {
    key: 's' + i,
    className: "df-sun",
    title: `${i === 0 ? 'Sunrise' : 'Sunset'} in ${person.city} · ${fmtL(m, person.offMin)}`,
    style: {
      left: pctF(m)
    }
  })), day.bands.map(b => /*#__PURE__*/React.createElement("span", {
    key: b.name,
    className: "df-band",
    title: `${b.name} · ${fmtL(b.s, person.offMin)} – ${fmtL(b.e, person.offMin)} ${person.city} time`,
    style: {
      left: pctF((b.s % 1440 + 1440) % 1440),
      width: `${(b.e - b.s) / 1440 * 100}%`,
      opacity: b.heavy ? 1 : 0.75
    }
  })), /*#__PURE__*/React.createElement("span", {
    className: "df-now",
    title: "Now",
    style: {
      left: pctF(NOW_UTC)
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "df-lblrow"
  }, labels.map(({
    b,
    m,
    row
  }) => /*#__PURE__*/React.createElement("span", {
    key: b.name,
    className: row === 1 ? 'df-blbl df-blbl--r2' : 'df-blbl',
    style: {
      left: pctF(m)
    }
  }, /*#__PURE__*/React.createElement("b", null, b.name), " ", fmtL(b.s, person.offMin))))));
}
function DualTimeline({
  people,
  sel,
  clash,
  editable,
  onChange,
  onRemovePerson,
  clashPulse
}) {
  const areaRef = useRef(null),
    dragRef = useRef(null);
  const posOf = x => {
    const r = areaRef.current && areaRef.current.getBoundingClientRect();
    return r ? snap15(clampF((x - r.left) / r.width * 1440, 0, 1440)) : 0;
  };
  useEffect(() => {
    if (!editable) return;
    const move = e => {
      const d = dragRef.current;
      if (!d || !onChange) return;
      const m = posOf(e.clientX);
      if (d.mode === 'draw') {
        const [a, b] = d.anchor <= m ? [d.anchor, m] : [m, d.anchor];
        onChange({
          s: a,
          e: Math.max(b, a + 15)
        });
      } else if (d.mode === 'move') {
        const s = clampF(snap15(m - d.grab), 0, 1440 - d.anchor);
        onChange({
          s,
          e: s + d.anchor
        });
      } else if (d.mode === 'resize-l') onChange({
        s: Math.min(m, d.anchor - 15),
        e: d.anchor
      });else onChange({
        s: d.anchor,
        e: Math.max(m, d.anchor + 15)
      });
    };
    const up = () => {
      dragRef.current = null;
    };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
    };
  }, [editable, onChange]);
  const begin = (mode, e) => {
    if (!editable || !onChange) return;
    e.preventDefault();
    const m = posOf(e.clientX);
    if (mode === 'draw') {
      dragRef.current = {
        mode,
        anchor: m,
        grab: 0
      };
      onChange({
        s: m,
        e: m + 15
      });
    } else if (mode === 'move' && sel) dragRef.current = {
      mode,
      anchor: sel.e - sel.s,
      grab: m - sel.s
    };else if (mode === 'resize-l' && sel) dragRef.current = {
      mode,
      anchor: sel.e,
      grab: 0
    };else if (sel) dragRef.current = {
      mode: 'resize-r',
      anchor: sel.s,
      grab: 0
    };
  };
  return /*#__PURE__*/React.createElement("div", {
    className: "df-body"
  }, /*#__PURE__*/React.createElement("div", {
    className: "df-row",
    style: {
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("div", {
    className: "df-axis"
  }, Array.from({
    length: 8
  }, (_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: i === 0 ? 'df-atick df-atick--first' : 'df-atick',
    style: {
      left: pctF(i * 180)
    }
  }, fmtL(i * 180, people[0].offMin))))), people.map((p, i) => /*#__PURE__*/React.createElement(TrackRow, {
    key: p.name + p.city,
    person: p,
    others: people.filter((_, j) => j !== i),
    onRemove: i >= 2 && onRemovePerson ? () => onRemovePerson(i) : undefined
  })), /*#__PURE__*/React.createElement("div", {
    className: "df-row",
    style: {
      margin: 0
    }
  }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("div", {
    className: "df-axis"
  }, Array.from({
    length: 8
  }, (_, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: i === 0 ? 'df-atick df-atick--first' : 'df-atick',
    style: {
      left: pctF(i * 180)
    }
  }, fmtL(i * 180, people[1].offMin))))), /*#__PURE__*/React.createElement("div", {
    ref: areaRef,
    className: "df-ovl",
    onPointerDown: e => {
      if (e.target === e.currentTarget) begin('draw', e);
    }
  }, sel !== null && /*#__PURE__*/React.createElement("div", {
    key: clashPulse || 0,
    className: `df-marker${clash !== null ? ' df-marker--clash df-marker--shake' : ''}`,
    style: {
      left: pctF(sel.s),
      width: `${(sel.e - sel.s) / 1440 * 100}%`
    },
    onPointerDown: e => {
      e.stopPropagation();
      begin('move', e);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "df-dur"
  }, durLbl(sel.e - sel.s)), editable && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    className: "df-h",
    style: {
      left: -5
    },
    onPointerDown: e => {
      e.stopPropagation();
      begin('resize-l', e);
    }
  }, /*#__PURE__*/React.createElement("i", null)), /*#__PURE__*/React.createElement("span", {
    className: "df-h",
    style: {
      right: -5
    },
    onPointerDown: e => {
      e.stopPropagation();
      begin('resize-r', e);
    }
  }, /*#__PURE__*/React.createElement("i", null))))));
}
function SentScreen({
  sel,
  people,
  onPreview,
  onDone,
  onBack
}) {
  const [copied, setCopied] = useState(false);
  const link = 'hijrifirst.app/#/e/' + btoa(`13R1447·${sel.s}·${sel.e - sel.s}`).replace(/=+$/, '') + '…';
  const invitees = people.slice(1);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 15,
      padding: '22px 10px 8px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      background: 'color-mix(in srgb,var(--green) 18%,transparent)',
      display: 'grid',
      placeItems: 'center',
      color: 'var(--green)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2.2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6L9 17l-5-5"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-title)'
    }
  }, "Event created \u2014 clear of everyone's prayers"), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-muted)',
      marginTop: 5
    }
  }, "Mon 13 Rama\u1E0D\u0101n \xB7 ", fmtL(sel.s, people[0].offMin), " \u2013 ", fmtL(sel.e, people[0].offMin), " your time", invitees.map(p => ` · ${fmtL(sel.s, p.offMin)} for ${p.name}`).join(''))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      width: 480,
      maxWidth: '92%'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "df-input",
    style: {
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      font: '500 11px var(--font-mono)',
      color: 'var(--text-muted)'
    }
  }, link), /*#__PURE__*/React.createElement("button", {
    className: "df-btn",
    onClick: () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }, copied ? 'Copied' : 'Copy link')), invitees.length > 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      width: 480,
      maxWidth: '92%',
      display: 'flex',
      flexDirection: 'column',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "df-mc"
  }, "GROUP LINK \xB7 1 OF ", invitees.length, " ACCEPTED"), invitees.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: p.name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      padding: '7px 11px',
      border: '1px solid var(--elev-border)',
      borderRadius: 'var(--r-sm)',
      background: 'var(--elev)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      borderRadius: '50%',
      background: 'var(--surface-2)',
      color: 'var(--text-muted)',
      display: 'grid',
      placeItems: 'center',
      font: '700 10px var(--font-ui)'
    }
  }, p.name[0]), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11.5px var(--font-ui)'
    }
  }, p.name), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 9.5,
      color: 'var(--text-faint)'
    }
  }, p.city, " \xB7 ", fmtL(sel.s, p.offMin)), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), i === 0 ? /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--green)'
    }
  }, "ACCEPTED \u2713") : /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 10,
      color: 'var(--text-faint)'
    }
  }, "awaiting reply")))), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 11.5px/1.5 var(--font-ui)',
      color: 'var(--text-faint)',
      textAlign: 'center',
      maxWidth: 460
    }
  }, "The link carries the time and everyone's cities \u2014 no account needed. Whoever opens it sees the meeting against ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--text-muted)'
    }
  }, "their own"), " prayer times and can accept or suggest another slot."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "df-ghost",
    onClick: onPreview
  }, "Preview what they'll see"), /*#__PURE__*/React.createElement("button", {
    className: "df-ghost",
    onClick: onBack
  }, "Change time"), /*#__PURE__*/React.createElement("button", {
    className: "df-btn",
    onClick: onDone
  }, "Done")));
}
function RecipientPreview({
  sel,
  people: sp,
  onExit
}) {
  const you = {
    ...sp[1],
    name: 'You'
  };
  const sender = {
    ...sp[0],
    name: 'Adam'
  };
  const people = [you, sender, ...sp.slice(2)];
  const [suggesting, setSuggesting] = useState(false);
  const [mySel, setMySel] = useState({
    s: sel.s,
    e: sel.e
  });
  const [copied, setCopied] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const active = suggesting ? mySel : sel;
  const clash = clashAt(allBandsOf(people), active.s, active.e - active.s);
  const recipClash = clashAt(you.day.bands, active.s, active.e - active.s);
  return /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      paddingBottom: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "df-mc",
    style: {
      color: 'var(--gold-ink)'
    }
  }, "RECIPIENT PREVIEW"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 11.5px var(--font-ui)',
      color: 'var(--text-faint)'
    }
  }, "what ", sp[1].name, " sees when he opens your link \u2014 no app, no account"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "df-link",
    onClick: onExit
  }, "\u2190 back to your link")), /*#__PURE__*/React.createElement("div", {
    style: {
      border: '1px solid var(--line)',
      borderRadius: 'var(--r-lg)',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '9px 14px',
      background: 'var(--surface-2)',
      borderBottom: '1px solid var(--line)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 22,
      height: 22,
      borderRadius: 'var(--r-sm)',
      background: 'var(--elev)',
      border: '1px solid var(--elev-border)',
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--font-arabic)',
      fontSize: 13
    }
  }, "\u062F"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 12px var(--font-ui)'
    }
  }, "Hijri First"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 11px var(--font-ui)',
      color: 'var(--text-faint)'
    }
  }, "\xB7 shared with you")), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '16px 18px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-title)'
    }
  }, "Sync with ", sp.slice(1).map(p => p.name).join(', ')), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11.5px var(--font-ui)',
      color: 'var(--text-muted)',
      marginTop: 3
    }
  }, "Adam invited you", people.length > 2 ? ` and ${people.length - 2} other${people.length > 3 ? 's' : ''}` : '', " \xB7 ", durLbl(sel.e - sel.s), " meeting")), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13px var(--font-ui)'
    }
  }, "13 Rama\u1E0D\u0101n 1447"), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 10,
      color: 'var(--text-faint)',
      marginTop: 2
    }
  }, "Monday, 2 March 2026"), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 600,
      marginTop: 4,
      color: recipClash !== null ? 'var(--alert)' : 'var(--ink)'
    }
  }, fmtL(active.s, you.offMin), " \u2013 ", fmtL(active.e, you.offMin), " your time ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-faint)',
      fontWeight: 400
    }
  }, "\xB7 ", fmtL(active.s, sender.offMin), " theirs")))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "df-chiprow"
  }, /*#__PURE__*/React.createElement("span", {
    className: `df-chip${clash !== null ? ' df-chip--clash' : ''}`,
    style: {
      left: `${clampF((active.s + active.e) / 2 / 1440, 0.06, 0.94) * 100}%`
    }
  }, recipClash !== null ? `Lands in your ${recipClash.name} window · ${fmtL(recipClash.s, you.offMin)} – ${fmtL(recipClash.e, you.offMin)}` : chipText(clash, people, active.s, active.e))), /*#__PURE__*/React.createElement(DualTimeline, {
    people: people,
    sel: active,
    clash: clash,
    editable: suggesting,
    onChange: setMySel
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 10.5px var(--font-ui)',
      color: 'var(--text-faint)'
    }
  }, "Times localized to each city \xB7 gold outlines are your prayers, dashed ones theirs \xB7 shaded ends are night"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), suggesting ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "df-ghost",
    onClick: () => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  }, copied ? 'Link copied' : `Copy suggestion · ${fmtL(mySel.s, you.offMin)} – ${fmtL(mySel.e, you.offMin)}`), /*#__PURE__*/React.createElement("button", {
    className: "df-btn",
    onClick: () => setSuggesting(false)
  }, "Back")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    className: "df-ghost",
    onClick: () => {
      setMySel({
        s: sel.s,
        e: sel.e
      });
      setSuggesting(true);
    }
  }, "Suggest another time"), /*#__PURE__*/React.createElement("button", {
    className: "df-btn",
    onClick: () => setAccepted(true)
  }, accepted ? 'Added ✓' : `${recipClash !== null ? 'Accept anyway' : 'Accept'} · add to calendar`))))));
}
function FindTimePop({
  onClose
}) {
  const [people, setPeople] = useState([P_YOU, P_AMMAR]);
  const [sel, setSel] = useState({
    s: 600,
    e: 645
  });
  const [settled, setSettled] = useState({
    s: 600,
    e: 645
  });
  const [hintOff, setHintOff] = useState(false);
  const [stage, setStage] = useState('pick');
  const [adding, setAdding] = useState(false);
  const [cityQ, setCityQ] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setSettled(sel), 250);
    return () => clearTimeout(t);
  }, [sel]);
  useEffect(() => {
    const k = e => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, []);
  const clash = clashAt(allBandsOf(people), settled.s, settled.e - settled.s);
  const wasClash = useRef(false);
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    if (clash !== null && !wasClash.current) setPulseKey(k => k + 1);
    wasClash.current = clash !== null;
  }, [clash]);
  const dur = settled.e - settled.s;
  const sugg = useMemo(() => suggest(people, dur), [people, dur]);
  const snapTo = clash !== null ? nextClear(people, settled.s, dur) : null;
  const results = cityQ.trim().length >= 2 ? CITY_LIB.filter(c => c.label.toLowerCase().includes(cityQ.trim().toLowerCase())) : [];
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    className: "df-scrim",
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "df-card",
    role: "dialog",
    "aria-label": "\u1E62al\u0101h-aware scheduling",
    onMouseDown: e => e.stopPropagation()
  }, stage === 'recipient' ? /*#__PURE__*/React.createElement(RecipientPreview, {
    sel: settled,
    people: people,
    onExit: () => setStage('sent')
  }) : stage === 'sent' ? /*#__PURE__*/React.createElement(SentScreen, {
    sel: settled,
    people: people,
    onPreview: () => setStage('recipient'),
    onDone: onClose,
    onBack: () => setStage('pick')
  }) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-title)'
    }
  }, "\u1E62al\u0101h-aware scheduling"), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 10,
      color: 'var(--text-faint)',
      marginTop: 3
    }
  }, "Mon 13 Rama\u1E0D\u0101n \xB7 each row is one person's day, in their own time")), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "df-x",
    onClick: onClose,
    "aria-label": "Close"
  }, "\u2715")), !hintOff && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: 'var(--elev)',
      border: '1px solid var(--elev-border)',
      borderRadius: 'var(--r-lg)',
      padding: '9px 12px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 11.5px/1.5 var(--font-ui)',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, "How to read this:"), " gold outlines are prayer windows, dashed ones the other person's, shading is night. Drag to sketch \u2014 red means it hits a prayer."), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "df-ghost",
    onClick: () => setHintOff(true)
  }, "Got it")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "df-mc"
  }, "CLEAR FOR EVERYONE"), sugg.map(t => /*#__PURE__*/React.createElement("button", {
    key: t,
    className: `df-pill${settled.s === t ? ' df-pill--on' : ''}`,
    onClick: () => {
      setSel({
        s: t,
        e: t + dur
      });
      setSettled({
        s: t,
        e: t + dur
      });
    }
  }, fmtL(t, 0), " \u2013 ", fmtL(t + dur, 0))), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), people.length < 4 && !adding && /*#__PURE__*/React.createElement("button", {
    className: "df-pill",
    style: {
      borderStyle: 'dashed'
    },
    onClick: () => setAdding(true)
  }, "+ Add a person"), adding && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      width: 230,
      display: 'inline-block'
    }
  }, /*#__PURE__*/React.createElement("input", {
    className: "df-input",
    style: {
      width: '100%'
    },
    placeholder: "Their city\u2026",
    value: cityQ,
    autoFocus: true,
    onChange: e => setCityQ(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Escape') {
        setAdding(false);
        setCityQ('');
      }
    }
  }), results.length > 0 && /*#__PURE__*/React.createElement("div", {
    className: "df-results",
    style: {
      position: 'absolute',
      top: '100%',
      left: 0,
      right: 0,
      zIndex: 5
    }
  }, results.map(c => /*#__PURE__*/React.createElement("button", {
    key: c.label,
    className: "df-result",
    onClick: () => {
      setPeople(ps => [...ps, c.mk(c.n)]);
      setAdding(false);
      setCityQ('');
    }
  }, c.label))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "df-chiprow"
  }, /*#__PURE__*/React.createElement("span", {
    key: pulseKey,
    className: `df-chip${clash !== null ? ' df-chip--clash' : ''}`,
    style: {
      left: `${clampF((settled.s + settled.e) / 2 / 1440, 0.06, 0.94) * 100}%`
    }
  }, chipText(clash, people, settled.s, settled.e), clash !== null && snapTo !== null && /*#__PURE__*/React.createElement("button", {
    className: "df-link",
    style: {
      marginLeft: 8,
      color: 'inherit',
      textDecoration: 'underline'
    },
    onClick: () => {
      setSel({
        s: snapTo,
        e: snapTo + dur
      });
      setSettled({
        s: snapTo,
        e: snapTo + dur
      });
    }
  }, "Move to ", fmtL(snapTo, 0), " \u2192"))), /*#__PURE__*/React.createElement(DualTimeline, {
    people: people,
    sel: sel,
    clash: clash,
    editable: true,
    onChange: setSel,
    clashPulse: pulseKey,
    onRemovePerson: i => setPeople(ps => ps.filter((_, j) => j !== i))
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      minWidth: 0
    }
  }, clash === null && /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11px var(--font-ui)',
      color: 'var(--gold-ink)'
    }
  }, people.slice(1).map(p => `${p.name} sees this at ${fmtL(settled.s, p.offMin)} — ${betweenPrayers(p, settled.s)}`).join(' · ')), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 9,
      color: 'var(--text-faint)'
    }
  }, "Drag to sketch \xB7 snaps to 15 min \xB7 London from your profile, other cities from the link"), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      display: 'flex',
      gap: 12,
      fontSize: 8.5,
      color: 'var(--text-faint)',
      alignItems: 'center',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "df-lg",
    style: {
      border: '1px solid var(--gold)',
      background: 'color-mix(in srgb,var(--gold) 15%,transparent)'
    }
  }), "prayer window"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "df-lg",
    style: {
      border: '1px dashed color-mix(in srgb,var(--gold) 45%,transparent)'
    }
  }), "theirs, on your row"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "df-lg",
    style: {
      background: 'var(--zebra)'
    }
  }), "night"), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("i", {
    className: "df-lg",
    style: {
      border: '1.5px solid var(--accent)',
      background: 'color-mix(in srgb,var(--accent) 24%,transparent)'
    }
  }), "your meeting"))), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: `df-btn${clash !== null ? ' df-btn--clash' : ''}`,
    onClick: () => {
      if (clash === null && window.addKitEvent) window.addKitEvent(13, 'w', fmtL(settled.s, 0), 'Sync — ' + people.slice(1).map(p => p.name).join(', '));
      setStage('sent');
    }
  }, clash !== null ? 'Create anyway' : 'Create event', " \xB7 ", fmtL(settled.s, 0), " \u2013 ", fmtL(settled.e, 0)))))), document.body);
}
Object.assign(window, {
  FindTimePop
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/desktop/findtime.jsx", error: String((e && e.message) || e) }); }

// daftar/desktop/onboarding.jsx
try { (() => {
/* First-run onboarding + live-action coach-mark tour — Daftar desktop kit. */
const {
  useState: useOState,
  useEffect: useOEffect
} = React;
const OTHEMES = [['Night', null, '#141414', '#1f1f1f'], ['Graphite', 'graphite', '#161616', '#1d1d1d'], ['Ash', 'ash', '#232327', '#2b2b30'], ['Parchment', 'parchment', '#f2efe6', '#fdfbf5'], ['Paper', 'paper', '#f4f3f0', '#fcfbf9']];
const OACCENTS = [['Sea glass', null, '#8fbcb0'], ['Lavender', 'lavender', '#a493d6'], ['Gold', 'gold', '#c9a45e'], ['Slate', 'slate', '#93a7c4']];
function Onboarding({
  onClose,
  onTour
}) {
  const [step, setStep] = useOState(0);
  const [theme, setTheme] = useOState(document.documentElement.getAttribute('data-theme'));
  const [accent, setAccent] = useOState(document.documentElement.getAttribute('data-accent'));
  const [bday, setBday] = useOState('');
  const done = tour => {
    localStorage.setItem('daftar_onboarded_v1', '1');
    onClose();
    if (tour) setTimeout(onTour, 250);
  };
  const applyT = t => {
    setTheme(t);
    t ? document.documentElement.setAttribute('data-theme', t) : document.documentElement.removeAttribute('data-theme');
  };
  const applyA = a => {
    setAccent(a);
    a ? document.documentElement.setAttribute('data-accent', a) : document.documentElement.removeAttribute('data-accent');
  };
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    className: "df-scrim",
    style: {
      zIndex: 70
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "df-card",
    style: {
      width: 470,
      gap: 16
    },
    role: "dialog",
    "aria-label": "Welcome"
  }, step === 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 12,
      padding: '18px 0 4px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 'var(--r-lg)',
      background: 'var(--elev)',
      border: '1px solid var(--elev-border)',
      display: 'grid',
      placeItems: 'center',
      fontFamily: 'var(--font-arabic)',
      fontSize: 27
    }
  }, "\u062F"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-title)',
      fontSize: 22
    }
  }, "Hijri First"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12.5px/1.65 var(--font-ui)',
      color: 'var(--text-muted)',
      textAlign: 'center',
      maxWidth: 360
    }
  }, "The notebook your days already keep. A Hijri-first calendar where the night precedes the day it names \u2014 with your prayers, your pages, and your word to yourself in one place.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'center',
      paddingBottom: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "df-ghost",
    onClick: () => done(false)
  }, "Skip"), /*#__PURE__*/React.createElement("button", {
    className: "df-btn",
    onClick: () => setStep(1)
  }, "Begin"))), step === 1 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-title)'
    }
  }, "Make it yours"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11.5px var(--font-ui)',
      color: 'var(--text-faint)',
      marginTop: 3
    }
  }, "Everything applies live \u2014 change it any time in Settings.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 7
    }
  }, OTHEMES.map(([name, attr, bg, card]) => /*#__PURE__*/React.createElement("button", {
    key: name,
    onClick: () => applyT(attr),
    style: {
      cursor: 'pointer',
      background: bg,
      border: '1.5px solid ' + (theme === attr ? 'var(--accent)' : 'var(--line)'),
      borderRadius: 'var(--r-lg)',
      padding: 7,
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 20,
      borderRadius: 4,
      background: card,
      border: '1px solid rgba(128,128,128,.25)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 9px var(--font-ui)',
      marginTop: 5,
      color: bg < '#8' ? '#e7e5e1' : '#26231d'
    }
  }, name)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7
    }
  }, OACCENTS.map(([name, attr, c]) => /*#__PURE__*/React.createElement("button", {
    key: name,
    onClick: () => applyA(attr),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      cursor: 'pointer',
      background: accent === attr ? 'var(--zebra)' : 'none',
      border: '1px solid ' + (accent === attr ? 'var(--line)' : 'transparent'),
      borderRadius: 999,
      padding: '4px 10px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 10px var(--font-ui)',
      color: 'var(--text-muted)'
    }
  }, name)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "df-ghost",
    onClick: () => done(false)
  }, "Skip"), /*#__PURE__*/React.createElement("button", {
    className: "df-btn",
    onClick: () => setStep(2)
  }, "Next"))), step === 2 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'var(--text-title)'
    }
  }, "Today is 13 Rama\u1E0D\u0101n 1447"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11.5px var(--font-ui)',
      color: 'var(--text-faint)',
      marginTop: 3
    }
  }, "Mon 2 Mar 2026 \xB7 confirmed by the sighting over London. Dashed dates near month ends may shift \xB11 day pending the crescent.")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--elev)',
      border: '1px solid var(--elev-border)',
      borderRadius: 'var(--r-lg)',
      padding: '12px 13px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "df-mc"
  }, "YOUR HIJRI BIRTHDAY \xB7 OPTIONAL"), /*#__PURE__*/React.createElement("input", {
    className: "df-input",
    style: {
      width: '100%',
      boxSizing: 'border-box',
      marginTop: 8
    },
    placeholder: "e.g. 7 Sha\u02BFb\u0101n",
    value: bday,
    onChange: e => setBday(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 10.5px var(--font-ui)',
      color: 'var(--text-faint)',
      marginTop: 6
    }
  }, "We mark it each year on the Hijri date \u2014 used only on your device.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      justifyContent: 'flex-end'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "df-ghost",
    onClick: () => done(false)
  }, "Not now"), /*#__PURE__*/React.createElement("button", {
    className: "df-btn",
    onClick: () => {
      if (bday.trim()) window.daftarToast('Birthday saved — ' + bday.trim());
      done(true);
    }
  }, "Show me around"))))), document.body);
}
const TOUR = [{
  sel: '#v-month',
  title: 'The month, night-first',
  body: 'Big Hijri dates, quiet Gregorian. Gold marks the sacred and the uncertain — ☾ sighting nights, ✦ possible Qadr, ±1 pending the crescent. Faint italic lines are your journal traces.',
  act: () => window.setView('month')
}, {
  sel: '#vsw',
  title: 'Six views',
  body: 'Day · Week · Month · Agenda · Journal · Year — cycle with the arrows, or press D, W, M, A, J, Y. G flips the month to Gregorian structure.',
  act: null
}, {
  sel: '#v-sijill',
  title: 'The Journal',
  body: 'Every row is one night-first day, Maghrib to Maghrib. Click a night to read its page — grateful, slipped, intention.',
  act: () => window.setView('sijill')
}, {
  sel: '#npanel',
  title: 'Tonight',
  body: 'The night opens at Maghrib. Three lines is enough — the ʿahd tracker below keeps your word to yourself, quietly, never red.',
  act: () => {
    window.setView('month');
    const p = document.getElementById('npanel');
    if (p && p.style.display === 'none') window.togPanel();
  }
}, {
  sel: '[data-tour="newevent"]',
  title: 'Events that know the prayers',
  body: 'Press C to create — pin to Hijri or Gregorian. Press F to find a time clear of everyone’s prayers, across time zones, and share it as a link.',
  act: null
}, {
  sel: '[data-tour="cmdk"]',
  title: 'Everything is a keystroke away',
  body: '⌘K opens the palette; ? shows every shortcut. Replay this tour from there any time.',
  act: null
}];
function TourOverlay({
  onClose
}) {
  const [i, setI] = useOState(0);
  const [rect, setRect] = useOState(null);
  const [ready, setReady] = useOState(false);
  useOEffect(() => {
    setReady(false);
    const stop = TOUR[i];
    if (stop.act) stop.act();
    const measure = () => {
      const el = document.querySelector(stop.sel);
      if (el) {
        const r = el.getBoundingClientRect();
        setRect({
          x: r.left,
          y: r.top,
          w: r.width,
          h: r.height
        });
      }
    };
    const t1 = setTimeout(measure, 180);
    const t2 = setTimeout(() => setReady(true), 1400);
    window.addEventListener('resize', measure);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      window.removeEventListener('resize', measure);
    };
  }, [i]);
  useOEffect(() => {
    const k = e => {
      if (e.key === 'Escape') onClose();
      if ((e.key === 'ArrowRight' || e.key === 'Enter') && ready) next();
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, [ready, i]);
  const next = () => {
    if (i >= TOUR.length - 1) {
      onClose();
      window.daftarToast('Tour complete — replay from ⌘K any time');
    } else setI(i + 1);
  };
  if (!rect) return null;
  const stop = TOUR[i];
  const below = rect.y + rect.h + 190 < window.innerHeight;
  const above = !below && rect.y > 190;
  const inside = !below && !above;
  const tipTop = below ? rect.y + rect.h + 12 : inside ? Math.max(14, rect.y + 14) : undefined;
  const tipBottom = above ? window.innerHeight - rect.y + 12 : undefined;
  const tipX = Math.max(14, Math.min(rect.x + rect.w / 2 - 160, window.innerWidth - 334));
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 75
    },
    onClick: () => {
      if (ready) next();
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      left: rect.x - 6,
      top: rect.y - 6,
      width: rect.w + 12,
      height: rect.h + 12,
      borderRadius: 10,
      border: '1.5px solid var(--gold)',
      boxShadow: '0 0 0 9999px rgba(0,0,0,.58)',
      transition: 'all 260ms var(--ease-settle)',
      pointerEvents: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "df-card",
    onClick: e => e.stopPropagation(),
    style: {
      position: 'fixed',
      left: tipX,
      top: tipTop,
      bottom: tipBottom,
      width: 320,
      gap: 9,
      padding: '14px 16px',
      boxShadow: '0 14px 40px rgba(0,0,0,.5)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "df-mc",
    style: {
      color: 'var(--gold-ink)'
    }
  }, i + 1, " OF ", TOUR.length), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "df-link",
    style: {
      color: 'var(--text-faint)'
    },
    onClick: onClose
  }, "Skip tour")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font-ui)'
    }
  }, stop.title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11.5px/1.6 var(--font-ui)',
      color: 'var(--text-muted)'
    }
  }, stop.body), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 9,
      color: 'var(--text-faint)',
      opacity: ready ? 1 : 0,
      transition: 'opacity 300ms'
    }
  }, "tap anywhere to continue"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "df-btn",
    disabled: !ready,
    style: {
      opacity: ready ? 1 : 0.4,
      cursor: ready ? 'pointer' : 'default'
    },
    onClick: next
  }, i >= TOUR.length - 1 ? 'Done' : 'Next')))), document.body);
}
Object.assign(window, {
  Onboarding,
  TourOverlay
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/desktop/onboarding.jsx", error: String((e && e.message) || e) }); }

// daftar/desktop/panes.jsx
try { (() => {
/* Settings modal, Prayer pane, Alerts pane, ⌘K palette, Shortcuts — Daftar desktop kit. */
const {
  useState: usePState,
  useEffect: usePEffect,
  useRef: usePRef
} = React;
function DfSelect({
  value,
  options,
  onChange,
  width
}) {
  const [open, setOpen] = usePState(false);
  const ref = usePRef(null);
  usePEffect(() => {
    const h = e => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return /*#__PURE__*/React.createElement("span", {
    ref: ref,
    style: {
      position: 'relative',
      display: 'inline-block',
      width: width || 200,
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "df-input",
    onClick: () => setOpen(o => !o),
    "aria-haspopup": "listbox",
    "aria-expanded": open,
    style: {
      width: '100%',
      boxSizing: 'border-box',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, value), /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'var(--text-faint)',
      strokeWidth: 2,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      flex: 'none',
      transform: open ? 'rotate(180deg)' : 'none',
      transition: 'transform 140ms var(--ease-settle)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6 9l6 6 6-6"
  }))), open && /*#__PURE__*/React.createElement("div", {
    className: "df-results",
    role: "listbox",
    style: {
      position: 'absolute',
      top: 'calc(100% + 4px)',
      left: 0,
      right: 0,
      zIndex: 95,
      maxHeight: 230,
      overflowY: 'auto',
      padding: 4,
      boxSizing: 'border-box'
    }
  }, options.map(o => /*#__PURE__*/React.createElement("button", {
    key: o,
    role: "option",
    "aria-selected": o === value,
    className: "df-result",
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      borderRadius: 'var(--r-sm)',
      background: o === value ? 'var(--zebra)' : 'none',
      boxSizing: 'border-box',
      width: '100%'
    },
    onClick: () => {
      onChange(o);
      setOpen(false);
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      width: 12,
      flex: 'none',
      color: 'var(--accent)',
      fontSize: 10
    }
  }, o === value ? '✓' : ''), o))));
}
function Tgl({
  on,
  set
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => set(!on),
    "aria-pressed": on,
    style: {
      width: 30,
      height: 17,
      borderRadius: 999,
      border: '1px solid ' + (on ? 'var(--green)' : 'var(--line)'),
      background: on ? 'color-mix(in srgb,var(--green) 40%,transparent)' : 'var(--zebra)',
      position: 'relative',
      cursor: 'pointer',
      padding: 0,
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 1.5,
      left: on ? 14 : 2,
      width: 11,
      height: 11,
      borderRadius: '50%',
      background: on ? 'var(--green)' : 'var(--text-faint)',
      transition: 'left 140ms var(--ease-settle)'
    }
  }));
}
const PMETHODS = {
  'Moonsighting Committee': ['05:01', '06:34', '12:17', '15:07', '17:45', '19:13'],
  'Muslim World League': ['04:52', '06:34', '12:17', '15:07', '17:45', '19:21'],
  'Umm al-Qura': ['04:58', '06:34', '12:17', '15:07', '17:45', '19:15'],
  'ISNA': ['05:09', '06:34', '12:17', '15:07', '17:45', '19:05']
};
const THEMES = [['Night', null, '#141414', '#1f1f1f'], ['Graphite', 'graphite', '#161616', '#1d1d1d'], ['Ash', 'ash', '#232327', '#2b2b30'], ['Dark gray', 'dark-gray', '#1b1b1e', '#232327'], ['Parchment', 'parchment', '#f2efe6', '#fdfbf5'], ['Paper', 'paper', '#f4f3f0', '#fcfbf9']];
const ACCENTS = [['Sea glass', null, '#8fbcb0'], ['Lavender', 'lavender', '#a493d6'], ['Gold', 'gold', '#c9a45e'], ['Slate', 'slate', '#93a7c4']];
const secLbl = {
  font: '700 8.5px var(--font-mono)',
  letterSpacing: '.14em',
  color: 'var(--text-muted)'
};
const srow = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '9px 0',
  borderBottom: '1px solid var(--zebra)'
};
const smain = {
  font: '500 12px var(--font-ui)',
  color: 'var(--ink)'
};
const ssub = {
  font: '400 10.5px var(--font-ui)',
  color: 'var(--text-faint)',
  marginTop: 2
};
function SettingsModal({
  onClose
}) {
  const [sec, setSec] = usePState('Location & prayer');
  const [method, setMethod] = usePState('Moonsighting Committee');
  const [prov, setProv] = usePState(true);
  const [bells, setBells] = usePState({
    Fajr: true,
    Dhuhr: false,
    'ʿAsr': true,
    Maghrib: true,
    'ʿIshāʾ': false
  });
  const [defRem, setDefRem] = usePState('30 min before');
  const [cals, setCals] = usePState({
    p: true,
    d: true,
    f: true,
    w: true
  });
  const [theme, setTheme] = usePState(document.documentElement.getAttribute('data-theme'));
  const [accent, setAccent] = usePState(document.documentElement.getAttribute('data-accent'));
  usePEffect(() => {
    const k = e => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, []);
  const applyTheme = t => {
    setTheme(t);
    t ? document.documentElement.setAttribute('data-theme', t) : document.documentElement.removeAttribute('data-theme');
  };
  const applyAccent = a => {
    setAccent(a);
    a ? document.documentElement.setAttribute('data-accent', a) : document.documentElement.removeAttribute('data-accent');
  };
  const setMethodU = m => {
    const prev = method;
    setMethod(m);
    window.daftarToastUndo('Method changed to ' + m, () => setMethod(prev));
  };
  const NAV = {
    SETTINGS: ['Location & prayer', 'Appearance', 'Calendars', 'Notifications'],
    DATA: ['Import & export', 'Account & sync']
  };
  const times = PMETHODS[method];
  const CALROWS = [['p', 'Personal', 'var(--cal-personal)'], ['d', 'Deen', 'var(--cal-deen)'], ['f', 'Family', 'var(--cal-family)'], ['w', 'Work', 'var(--cal-work)']];
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    className: "df-scrim",
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "df-card",
    style: {
      width: 720,
      padding: 0,
      flexDirection: 'row',
      gap: 0,
      minHeight: 480
    },
    role: "dialog",
    "aria-label": "Settings",
    onMouseDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 190,
      flex: 'none',
      borderRight: '1px solid var(--line)',
      padding: '18px 10px',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: 3
    }
  }, Object.entries(NAV).map(([grp, items]) => /*#__PURE__*/React.createElement(React.Fragment, {
    key: grp
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...secLbl,
      padding: '10px 10px 5px'
    }
  }, grp), items.map(it => /*#__PURE__*/React.createElement("button", {
    key: it,
    onClick: () => setSec(it),
    style: {
      textAlign: 'left',
      border: 'none',
      cursor: 'pointer',
      font: '500 12px var(--font-ui)',
      padding: '7px 10px',
      borderRadius: 'var(--r-sm)',
      background: sec === it ? 'var(--zebra)' : 'none',
      color: sec === it ? 'var(--ink)' : 'var(--text-muted)'
    }
  }, it))))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      padding: '18px 22px',
      boxSizing: 'border-box',
      overflowY: 'auto',
      maxHeight: 'calc(100vh - 64px)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-title)'
    }
  }, sec), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "df-x",
    onClick: onClose
  }, "\u2715")), sec === 'Location & prayer' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: srow
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smain
  }, "London, UK"), /*#__PURE__*/React.createElement("div", {
    style: ssub
  }, "manual \xB7 ", /*#__PURE__*/React.createElement("button", {
    className: "df-link",
    onClick: () => window.daftarToast('Located — London confirmed')
  }, "use my precise location"))), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 9,
      color: 'var(--gold-ink)',
      border: '1px dashed var(--gold)',
      borderRadius: 999,
      padding: '2px 8px'
    }
  }, "MANUAL")), /*#__PURE__*/React.createElement("div", {
    style: srow
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smain
  }, "Calculation method"), /*#__PURE__*/React.createElement("div", {
    style: ssub
  }, "applies instantly \u2014 undo from the snackbar")), /*#__PURE__*/React.createElement(DfSelect, {
    value: method,
    options: Object.keys(PMETHODS),
    onChange: setMethodU,
    width: 215
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 0,
      margin: '12px 0',
      border: '1px solid var(--elev-border)',
      background: 'var(--elev)',
      borderRadius: 'var(--r-sm)',
      overflow: 'hidden'
    }
  }, ['Fajr', 'Shurūq', 'Dhuhr', 'ʿAsr', 'Maghrib', 'ʿIshāʾ'].map((n, i) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      flex: 1,
      textAlign: 'center',
      padding: '8px 0',
      borderLeft: i ? '1px solid var(--hairline)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 8,
      fontWeight: 700,
      letterSpacing: '.1em',
      color: 'var(--text-faint)'
    }
  }, n.toUpperCase()), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11.5,
      marginTop: 3,
      color: i === 1 ? 'var(--text-faint)' : 'var(--ink)'
    }
  }, PMETHODS[method][i])))), /*#__PURE__*/React.createElement("div", {
    style: srow
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smain
  }, "Show provisional dates"), /*#__PURE__*/React.createElement("div", {
    style: ssub
  }, "dashed gold \xB11 near month ends, pending the sighting")), /*#__PURE__*/React.createElement(Tgl, {
    on: prov,
    set: setProv
  }))), sec === 'Appearance' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...secLbl,
      margin: '4px 0 8px'
    }
  }, "THEME"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 8
    }
  }, THEMES.map(([name, attr, bg, card]) => /*#__PURE__*/React.createElement("button", {
    key: name,
    onClick: () => applyTheme(attr),
    style: {
      cursor: 'pointer',
      textAlign: 'left',
      background: bg,
      border: '1.5px solid ' + (theme === attr ? 'var(--accent)' : 'var(--line)'),
      borderRadius: 'var(--r-lg)',
      padding: 9,
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 26,
      borderRadius: 5,
      background: card,
      border: '1px solid rgba(128,128,128,.25)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 10.5px var(--font-ui)',
      marginTop: 7,
      color: bg < '#8' ? '#e7e5e1' : '#26231d'
    }
  }, name)))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...secLbl,
      margin: '16px 0 8px'
    }
  }, "ACCENT"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8
    }
  }, ACCENTS.map(([name, attr, c]) => /*#__PURE__*/React.createElement("button", {
    key: name,
    onClick: () => applyAccent(attr),
    title: name,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      cursor: 'pointer',
      background: accent === attr ? 'var(--zebra)' : 'none',
      border: '1px solid ' + (accent === attr ? 'var(--line)' : 'transparent'),
      borderRadius: 999,
      padding: '5px 11px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 11,
      height: 11,
      borderRadius: '50%',
      background: c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 10.5px var(--font-ui)',
      color: 'var(--text-muted)'
    }
  }, name)))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...ssub,
      marginTop: 12
    }
  }, "The sun/moon toggle in the toolbar flips light \u2194 your last dark theme.")), sec === 'Calendars' && /*#__PURE__*/React.createElement("div", null, CALROWS.map(([k, name, c]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: srow
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: c
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smain
  }, name)), /*#__PURE__*/React.createElement(Tgl, {
    on: cals[k],
    set: v => setCals(s => ({
      ...s,
      [k]: v
    }))
  }))), /*#__PURE__*/React.createElement("div", {
    style: srow
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      border: '1px solid var(--line)'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smain
  }, "Google mirror"), /*#__PURE__*/React.createElement("div", {
    style: ssub
  }, "Your events sync into a separate Google calendar named \"Hijri First\". We never write to your main calendar.")), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 9,
      fontWeight: 700,
      color: 'var(--green)'
    }
  }, "CONNECTED"))), sec === 'Notifications' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...secLbl,
      margin: '4px 0 4px'
    }
  }, "PRAYER BELLS"), Object.keys(bells).map(n => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: srow
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smain
  }, n)), /*#__PURE__*/React.createElement(Tgl, {
    on: bells[n],
    set: v => setBells(s => ({
      ...s,
      [n]: v
    }))
  }))), /*#__PURE__*/React.createElement("div", {
    style: srow
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smain
  }, "Default event reminder")), /*#__PURE__*/React.createElement(DfSelect, {
    value: defRem,
    options: ['None', '10 min before', '30 min before', '1 hour before'],
    onChange: setDefRem,
    width: 160
  })), /*#__PURE__*/React.createElement("div", {
    style: srow
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smain
  }, "Moon-sighting announcements"), /*#__PURE__*/React.createElement("div", {
    style: ssub
  }, "follows your community's announcement")), /*#__PURE__*/React.createElement(Tgl, {
    on: true,
    set: () => {}
  }))), sec === 'Import & export' && /*#__PURE__*/React.createElement("div", null, [['Download .ics', 'your events, Hijri-pinned dates resolved to Gregorian'], ['Import calendar', '.ics from any calendar app'], ['Backup & restore', 'a single file with events, pages, and settings']].map(([t, s]) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: srow
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smain
  }, t), /*#__PURE__*/React.createElement("div", {
    style: ssub
  }, s)), /*#__PURE__*/React.createElement("button", {
    className: "df-ghost",
    onClick: () => window.daftarToast(t + ' — stubbed in this kit')
  }, t.split(' ')[0])))), sec === 'Account & sync' && /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: srow
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 26,
      height: 26,
      borderRadius: '50%',
      background: 'var(--surface-2)',
      border: '1px solid var(--line)',
      display: 'grid',
      placeItems: 'center',
      font: '800 11px var(--font-ui)',
      color: 'var(--text-muted)'
    }
  }, "A"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smain
  }, "Adam"), /*#__PURE__*/React.createElement("div", {
    style: ssub
  }, "adam@hijrifirst.app \xB7 used only on your device"))), /*#__PURE__*/React.createElement("div", {
    style: srow
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: smain
  }, "Google mirror"), /*#__PURE__*/React.createElement("div", {
    style: ssub
  }, "synced 2 m ago \xB7 read-only mirror")), /*#__PURE__*/React.createElement("button", {
    className: "df-ghost",
    onClick: () => window.daftarToast('Synced — up to date')
  }, "Sync now")))))), document.body);
}
function PrayerPane({
  onClose,
  onSettings
}) {
  usePEffect(() => {
    const k = e => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, []);
  const [bells, setBells] = usePState({
    Fajr: true,
    Shurūq: false,
    Dhuhr: false,
    'ʿAsr': true,
    Maghrib: true,
    'ʿIshāʾ': false
  });
  const rows = [['Fajr', 'الفجر', '05:01'], ['Shurūq', 'الشروق', '06:34'], ['Dhuhr', 'الظهر', '12:17'], ['ʿAsr', 'العصر', '15:07'], ['Maghrib', 'المغرب', '17:45'], ['ʿIshāʾ', 'العشاء', '19:13']];
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 55
    },
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "df-card",
    style: {
      position: 'absolute',
      left: 290,
      top: 96,
      width: 300,
      gap: 12,
      boxShadow: '0 14px 40px rgba(0,0,0,.45)'
    },
    role: "dialog",
    "aria-label": "Prayer times",
    onMouseDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--accent-soft)',
      border: '1px solid color-mix(in srgb,var(--accent) 35%,transparent)',
      borderRadius: 'var(--r-lg)',
      padding: '12px 13px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 15px var(--font-ui)'
    }
  }, "\u02BFAsr"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-arabic)',
      fontSize: 14,
      color: 'var(--text-muted)'
    }
  }, "\u0627\u0644\u0639\u0635\u0631"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, "15:07")), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 3,
      borderRadius: 2,
      background: 'var(--zebra)',
      margin: '9px 0 6px',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 3,
      width: '59%',
      background: 'var(--accent)'
    }
  })), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 9.5,
      color: 'var(--text-muted)'
    }
  }, "in 1 h 12 m \xB7 since Dhuhr 59%")), /*#__PURE__*/React.createElement("div", null, rows.map(([n, ar, t]) => /*#__PURE__*/React.createElement("div", {
    key: n,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      padding: '6px 2px',
      borderBottom: '1px solid var(--zebra)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12px var(--font-ui)',
      width: 62,
      color: n === 'Shurūq' ? 'var(--text-faint)' : 'var(--ink)'
    }
  }, n), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-arabic)',
      fontSize: 12,
      color: 'var(--text-faint)'
    }
  }, ar), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11.5,
      color: 'var(--text-muted)'
    }
  }, t), /*#__PURE__*/React.createElement("button", {
    className: "df-x",
    style: {
      width: 24,
      height: 24
    },
    title: bells[n] ? 'Bell on' : 'Bell off',
    onClick: () => setBells(s => ({
      ...s,
      [n]: !s[n]
    }))
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: bells[n] ? 'var(--gold-ink)' : 'var(--text-faint)',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6.4 9.6a5.6 5.6 0 0 1 11.2 0c0 4.3 1.8 5.4 1.8 5.4H4.6s1.8-1.1 1.8-5.4z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10.2 19.6a2 2 0 0 0 3.6 0"
  }), !bells[n] && /*#__PURE__*/React.createElement("path", {
    d: "M4 4l16 16"
  })))))), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 9.5,
      color: 'var(--text-faint)',
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, "London \xB7 Moonsighting Committee", /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "df-link",
    style: {
      font: '600 10px var(--font-ui)'
    },
    onClick: onSettings
  }, "change")), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 9,
      color: 'var(--text-faint)',
      borderTop: '1px solid var(--line)',
      paddingTop: 8
    }
  }, "Maghrib 17:45 begins 14 Rama\u1E0D\u0101n \u2014 the night precedes the day it names."))), document.body);
}
function AlertsPane({
  onClose
}) {
  usePEffect(() => {
    const k = e => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, []);
  const items = [['gold', 'Sighting night approaches', 'The Shawwāl crescent is sought on the eve of 29 Ramaḍān (Wed 18 Mar). Days 29–30 and Eid stay provisional (±1) until then.'], ['accent', 'Tonight’s page is open', 'Maghrib 17:45 opened the night of 14. Three lines is enough.'], ['green', 'Google mirror synced', 'All 4 calendars up to date · 2 m ago.']];
  const C = {
    gold: 'var(--gold-ink)',
    accent: 'var(--accent)',
    green: 'var(--green)'
  };
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    style: {
      position: 'fixed',
      inset: 0,
      zIndex: 55
    },
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "df-card",
    style: {
      position: 'absolute',
      right: 84,
      bottom: 120,
      width: 320,
      gap: 10,
      boxShadow: '0 14px 40px rgba(0,0,0,.45)'
    },
    role: "dialog",
    "aria-label": "Alerts",
    onMouseDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "df-mc"
  }, "ALERTS"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "df-link",
    onClick: () => {
      window.daftarToast('All read');
      onClose();
    }
  }, "mark all read")), items.map(([c, t, s]) => /*#__PURE__*/React.createElement("div", {
    key: t,
    style: {
      display: 'flex',
      gap: 9,
      padding: '9px 10px',
      background: 'var(--elev)',
      border: '1px solid var(--elev-border)',
      borderRadius: 'var(--r-lg)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: C[c],
      marginTop: 5,
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 11.5px var(--font-ui)'
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 10.5px/1.5 var(--font-ui)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, s)))))), document.body);
}
const CMDS = [['Go to Day', () => window.setView('day'), 'D'], ['Go to Week', () => window.setView('week'), 'W'], ['Go to Month', () => window.setView('month'), 'M'], ['Go to Agenda', () => window.setView('agenda'), 'A'], ['Go to Journal', () => window.setView('sijill'), 'J'], ['Go to Year', () => window.setView('year'), 'Y'], ['Toggle Gregorian structure', () => window.togGview(), 'G'], ['New event', () => window.openComposer(13), 'C'], ['Ṣalāh-aware · find a time', () => window.openFindTime(), 'F'], ['Open tonight’s page', () => window.daftarToast('Tonight’s page — stubbed in this kit'), ''], ['Prayer times', () => window.openPrayerPane(), ''], ['Alerts', () => window.openAlerts(), ''], ['Settings', () => window.openSettings(), ''], ['Keyboard shortcuts', () => window.openShortcuts(), '?'], ['Replay the tour', () => window.openTour(), ''], ['Replay onboarding', () => window.openOnboarding(), '']];
function CmdPalette({
  onClose
}) {
  const [q, setQ] = usePState('');
  const [ix, setIx] = usePState(0);
  const list = CMDS.filter(c => c[0].toLowerCase().includes(q.toLowerCase()));
  usePEffect(() => {
    setIx(0);
  }, [q]);
  const run = c => {
    onClose();
    setTimeout(c[1], 10);
  };
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    className: "df-scrim",
    style: {
      alignItems: 'flex-start',
      display: 'flex',
      justifyContent: 'center',
      paddingTop: '14vh'
    },
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "df-card",
    style: {
      width: 480,
      gap: 0,
      padding: 0,
      overflow: 'hidden'
    },
    role: "dialog",
    "aria-label": "Command palette",
    onMouseDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: q,
    placeholder: "Type a command\u2026",
    onChange: e => setQ(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowDown') setIx(i => Math.min(i + 1, list.length - 1));
      if (e.key === 'ArrowUp') setIx(i => Math.max(i - 1, 0));
      if (e.key === 'Enter' && list[ix]) run(list[ix]);
    },
    style: {
      width: '100%',
      boxSizing: 'border-box',
      background: 'none',
      border: 'none',
      borderBottom: '1px solid var(--line)',
      padding: '14px 16px',
      font: '500 14px var(--font-ui)',
      color: 'var(--ink)',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 300,
      overflowY: 'auto',
      overflowX: 'hidden',
      padding: 6,
      boxSizing: 'border-box'
    }
  }, list.map((c, i) => /*#__PURE__*/React.createElement("button", {
    key: c[0],
    onMouseEnter: () => setIx(i),
    onClick: () => run(c),
    style: {
      display: 'flex',
      width: '100%',
      boxSizing: 'border-box',
      alignItems: 'center',
      gap: 10,
      border: 'none',
      cursor: 'pointer',
      textAlign: 'left',
      padding: '9px 11px',
      borderRadius: 'var(--r-sm)',
      background: i === ix ? 'var(--zebra)' : 'none',
      color: 'var(--ink)',
      font: '500 12.5px var(--font-ui)'
    }
  }, c[0], /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), c[2] && /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 9.5,
      color: 'var(--text-faint)',
      border: '1px solid var(--line)',
      borderRadius: 4,
      padding: '1px 6px'
    }
  }, c[2]))), !list.length && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '14px 11px',
      font: '400 12px var(--font-ui)',
      color: 'var(--text-faint)'
    }
  }, "Nothing matches \"", q, "\".")))), document.body);
}
function ShortcutsPane({
  onClose
}) {
  usePEffect(() => {
    const k = e => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', k, true);
    return () => document.removeEventListener('keydown', k, true);
  }, []);
  const rows = [['D W M A J Y', 'switch view (Day · Week · Month · Agenda · Journal · Year)'], ['G', 'Gregorian structure on/off'], ['C', 'new event'], ['F', 'ṣalāh-aware · find a time'], ['⌘K', 'command palette'], ['?', 'this reference'], ['Esc', 'close any pane']];
  return ReactDOM.createPortal(/*#__PURE__*/React.createElement("div", {
    className: "df-scrim",
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "df-card",
    style: {
      width: 380,
      gap: 10
    },
    role: "dialog",
    "aria-label": "Keyboard shortcuts",
    onMouseDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'var(--text-title)'
    }
  }, "Keyboard"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "df-x",
    onClick: onClose
  }, "\u2715")), rows.map(([k, d]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 10.5,
      fontWeight: 700,
      border: '1px solid var(--line)',
      borderRadius: 4,
      padding: '3px 8px',
      minWidth: 46,
      textAlign: 'center'
    }
  }, k), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 11.5px var(--font-ui)',
      color: 'var(--text-muted)'
    }
  }, d))))), document.body);
}
Object.assign(window, {
  SettingsModal,
  PrayerPane,
  AlertsPane,
  CmdPalette,
  ShortcutsPane,
  Tgl
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/desktop/panes.jsx", error: String((e && e.message) || e) }); }

// daftar/docs/design-tokens.js
try { (() => {
// Daftar design tokens — flat JS export for the native (React Native) build.
// Names mirror the CSS custom properties in tokens/*.css. Night is the default theme.
const themes = {
  night: {
    bg: '#141414',
    surface: '#1f1f1f',
    surface2: '#262626',
    zebra: '#2b2b2b',
    ink: '#e7e5e1',
    textMuted: '#a3a09a',
    textFaint: '#757169',
    line: '#343434',
    hairline: 'rgba(255,255,255,.07)',
    elev: 'rgba(255,255,255,.035)',
    elevBorder: 'rgba(255,255,255,.055)',
    gold: '#c9a45e',
    goldInk: '#d4af6a',
    green: '#86a893',
    alert: '#d0604a',
    accent: '#8fbcb0',
    accentInk: '#12201c'
  },
  graphite: {
    bg: '#161616',
    surface: '#1d1d1d',
    surface2: '#232323',
    zebra: '#292929',
    ink: '#e9e8e4',
    textMuted: '#bab8b1',
    textFaint: '#8f8e88',
    line: '#2f2f2d',
    hairline: 'rgba(255,255,255,.07)',
    gold: '#c9a45e',
    goldInk: '#d4af6a',
    green: '#86a893',
    alert: '#d0604a',
    accent: '#8fbcb0',
    accentInk: '#12201c'
  },
  ash: {
    bg: '#232327',
    surface: '#2b2b30',
    surface2: '#313136',
    zebra: '#37373c',
    ink: '#eae9e6',
    textMuted: '#b3b1ac',
    textFaint: '#84827c',
    line: '#404046',
    hairline: 'rgba(255,255,255,.08)',
    gold: '#c9a45e',
    goldInk: '#d6b273',
    green: '#8fae9a',
    alert: '#d0604a',
    accent: '#8fbcb0',
    accentInk: '#12201c'
  },
  parchment: {
    bg: '#f2efe6',
    surface: '#fdfbf5',
    surface2: '#faf7ef',
    zebra: '#f0ece1',
    ink: '#26231d',
    textMuted: '#54503f',
    textFaint: '#9a9280',
    line: '#e6e0d1',
    hairline: 'rgba(0,0,0,.07)',
    gold: '#c9a45e',
    goldInk: '#a8823c',
    green: '#5d8270',
    alert: '#b3402e',
    accent: '#37655a',
    accentInk: '#ffffff'
  },
  paper: {
    bg: '#f4f3f0',
    surface: '#fcfbf9',
    surface2: '#faf9f6',
    zebra: '#eceae5',
    ink: '#1f1f1d',
    textMuted: '#54524c',
    textFaint: '#8a8880',
    line: '#e0dfd8',
    hairline: 'rgba(0,0,0,.06)',
    gold: '#a3803a',
    goldInk: '#8a6a2c',
    green: '#37655a',
    alert: '#b3402e',
    accent: '#37655a',
    accentInk: '#ffffff'
  }
};
const accents = {
  seaGlass: '#8fbcb0',
  lavender: '#a493d6',
  gold: '#c9a45e',
  slate: '#93a7c4'
};
const calendars = {
  personal: '#a493d6',
  deen: '#c9a45e',
  family: '#86a893',
  work: '#7f96b8'
};
const radius = {
  sm: 6,
  lg: 10,
  pill: 999
}; // --r-sm / --r-lg
const motion = {
  durFast: 120,
  durSlow: 260,
  easeSettle: [0.2, 0.7, 0.2, 1]
}; // nothing bouncy; reduced-motion → 0
const type = {
  ui: 'Inter',
  mono: 'IBMPlexMono',
  quote: 'Newsreader-Italic',
  arabic: 'Amiri',
  microcap: {
    fontFamily: 'IBMPlexMono',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.3
  },
  minBodyPx: 11.5
};
const rules = {
  gold: 'uncertainty + sacred marks only (±1, sighting, qadr, prayer bands) — never decoration, never an event color',
  green: 'the only success color (kept / confirmed / synced) — never pair with a red sibling',
  alert: 'scheduling clashes ONLY — never for missed deen'
};
let __ds_default_daftar_docs_design_tokens_1fl0vrt;
try {
  __ds_default_daftar_docs_design_tokens_1fl0vrt = {
    themes,
    accents,
    calendars,
    radius,
    motion,
    type,
    rules
  };
} catch {}
Object.assign(__ds_scope, { themes, accents, calendars, radius, motion, type, rules, __ds_default_daftar_docs_design_tokens_1fl0vrt });
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/docs/design-tokens.js", error: String((e && e.message) || e) }); }

// daftar/mobile/CalViews.jsx
try { (() => {
/* Calendar views — month, week strip, time grids (day/3-day/week) with prayer rules + drag-create clash check, year, schedule. Daftar mobile kit. */
const {
  useState: useCvState,
  useRef: useCvRef
} = React;
const MJOT = {
  1: 'slow start — but the fast held',
  3: 'short temper at ʿaṣr, named it',
  5: 'a good iftar — gratitude',
  8: 'work ate the afternoon wird',
  11: 'read with the kids after ʿishāʾ',
  13: 'a good duʿāʾ at iftar'
};
const MPRT = [['Fajr', 312], ['Shurūq', 400], ['Zuhr', 736], ['ʿAsr', 945], ['Maghrib', 1132], ['ʿIshāʾ', 1220]];
const PWIN = 25;
const mClash = (s, e) => {
  for (const [n, m] of MPRT) {
    if (n === 'Shurūq') continue;
    if (s < m + PWIN && e > m) return n;
  }
  return null;
};
const mFmt = m => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
const calColor = k => (MCALS.find(c => c[0] === k) || MCALS[0])[2];

/* ===== Month view — rebuilt 2026-07-28 (owner direction) =====
   Named event chips live in the cell again: a dot + the event's own words, sacred days as a
   gold-tinted label, "+n" for the rest. The numeral is a pill carrying the quiet Gregorian date;
   provisional days get a dashed gold underline rather than a border. The month swipes, and the
   selected day's agenda pulls up from a grabber under the grid — grid and list in one surface,
   so the grid can stay navigation while the words stay readable. Supersedes the text-free cell. */
const MCHIP = 9.5; /* below the 11px reading floor — an in-cell exception the owner asked for:
                   a 52pt cell can carry a readable *word* at 9.5 or an unreadable fragment at 11. The full
                   title is one tap away in the agenda below, so this text is a hint, not the reading surface. */
const MWD = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
function DayChips({
  evs,
  tall
}) {
  const floor = tall ? 34 : 23;
  if (!evs || !evs.length) return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      minHeight: floor
    }
  });
  const max = tall ? 3 : 2;
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      width: '100%',
      minWidth: 0,
      overflow: 'hidden',
      minHeight: floor
    }
  }, evs.slice(0, max).map((e, i) => e[3] === 'sacred' ? /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      display: 'block',
      font: `600 ${MCHIP}px/1.5 var(--font-ui)`,
      borderRadius: 4,
      padding: '0 4px',
      background: 'color-mix(in srgb,var(--gold) 15%,transparent)',
      color: 'var(--gold-ink)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      textAlign: 'left'
    }
  }, e[2]) : /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 3,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 4,
      height: 4,
      borderRadius: 1.5,
      flex: 'none',
      boxSizing: 'border-box',
      background: e[3] === 'task' ? 'transparent' : calColor(e[0]),
      border: e[3] === 'task' ? '1.2px solid ' + calColor(e[0]) : 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: `500 ${MCHIP}px var(--font-ui)`,
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      textAlign: 'left'
    }
  }, e[2]))), evs.length > max && /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 9.5,
      color: 'var(--text-faint)',
      paddingLeft: 7,
      textAlign: 'left'
    }
  }, "+", evs.length - max));
}
function MonthCal({
  month,
  events,
  sel,
  setSel,
  openDetail,
  openComposer,
  onSwipe,
  anim,
  onOpenDay
}) {
  const press = useCvRef(null),
    swipe = useCvRef(null),
    grab = useCvRef(null);
  const [agenda, setAgenda] = useCvState(false);
  const [pressing, setPressing] = useCvState(null);
  const down = d => {
    setPressing(d);
    press.current = setTimeout(() => {
      press.current = 'fired';
      setPressing(null);
      setSel(d);
      openComposer(d);
    }, 480);
  };
  const up = d => {
    setPressing(null);
    if (press.current === 'fired') {
      press.current = null;
      return;
    }
    clearTimeout(press.current);
    press.current = null;
    setSel(d);
  };
  const cancel = () => {
    setPressing(null);
    if (press.current && press.current !== 'fired') {
      clearTimeout(press.current);
      press.current = null;
    }
  };
  const gregOf = i => new Date(month.base[0], month.base[1], month.base[2] + i);
  const cells = [];
  for (let i = 0; i < month.startWd; i++) cells.push({
    n: month.prevDays - month.startWd + i + 1,
    other: true
  });
  for (let d = 1; d <= month.days; d++) cells.push({
    n: d,
    g: gregOf(d).getDate()
  });
  for (let t = 1; cells.length % 7; t++) cells.push({
    n: t,
    other: true
  });
  const selEvs = events[sel] || [];
  const selG = gregOf(sel);
  const isToday = month.today === sel;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      overflowY: 'auto',
      overflowX: 'hidden'
    },
    onPointerDown: e => {
      swipe.current = {
        x: e.clientX,
        y: e.clientY
      };
    },
    onPointerUp: e => {
      const s = swipe.current;
      swipe.current = null;
      if (!s || !onSwipe) return;
      const dx = e.clientX - s.x,
        dy = e.clientY - s.y;
      if (Math.abs(dx) < 56 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
      cancel();
      onSwipe(dx < 0 ? 1 : -1);
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7,1fr)',
      padding: '0 8px 5px',
      flex: 'none'
    }
  }, MWD.map((w, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    className: "mc",
    style: {
      textAlign: 'center',
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '.06em',
      color: i === 5 ? 'var(--gold-ink)' : 'var(--text-faint)'
    }
  }, w))), /*#__PURE__*/React.createElement("div", {
    key: month.name + agenda,
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7,1fr)',
      gridAutoRows: agenda ? 'auto' : '1fr',
      padding: '0 8px',
      flex: agenda ? 'none' : 1,
      minHeight: 0,
      animation: anim ? `mslide-${anim} 260ms var(--ease-settle)` : 'none'
    }
  }, cells.map((c, i) => {
    const evs = !c.other && events[c.n] || null;
    const today = !c.other && c.n === month.today,
      s = !c.other && sel === c.n,
      prov = !c.other && month.provisional && c.n > month.days - 2;
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      onPointerDown: () => !c.other && down(c.n),
      onPointerUp: () => !c.other && up(c.n),
      onPointerLeave: cancel,
      style: {
        minHeight: agenda ? 62 : 74,
        minWidth: 0,
        overflow: 'hidden',
        cursor: c.other ? 'default' : 'pointer',
        padding: '3px 1px 4px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        borderTop: '1px solid var(--hairline)',
        borderLeft: i % 7 === 0 ? 'none' : '1px solid color-mix(in srgb,var(--hairline) 60%,transparent)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 27,
        height: 24,
        padding: '0 5px',
        borderRadius: 999,
        display: 'inline-flex',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: 3,
        boxSizing: 'border-box',
        background: today ? 'var(--ink)' : s ? 'var(--elev)' : 'transparent',
        boxShadow: s && !today ? 'inset 0 0 0 1.5px var(--elev-border)' : 'none',
        animation: pressing === c.n && !c.other ? 'mpress 480ms linear forwards' : 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '650 15px var(--font-ui)',
        lineHeight: '24px',
        color: today ? 'var(--bg)' : c.other ? 'var(--text-faint)' : 'var(--ink)',
        opacity: c.other ? 0.45 : 1,
        borderBottom: prov ? '1.5px dashed color-mix(in srgb,var(--gold) 65%,transparent)' : 'none'
      }
    }, c.n), !c.other && /*#__PURE__*/React.createElement("span", {
      className: "mc",
      style: {
        fontSize: 11,
        lineHeight: '22px',
        color: today ? 'var(--bg)' : 'var(--text-faint)',
        opacity: today ? 0.72 : 1
      }
    }, c.g)), /*#__PURE__*/React.createElement(DayChips, {
      evs: evs,
      tall: !agenda
    }));
  })), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      if (grab.current === 'dragged') {
        grab.current = null;
        return;
      }
      setAgenda(a => !a);
    },
    "aria-expanded": agenda,
    "aria-label": agenda ? 'Hide the day' : 'Show the day',
    onPointerDown: e => {
      grab.current = {
        y: e.clientY
      };
    },
    onPointerUp: e => {
      const g = grab.current;
      if (!g || g === 'dragged') return;
      const dy = e.clientY - g.y;
      grab.current = null;
      if (dy < -24 && !agenda) {
        setAgenda(true);
        grab.current = 'dragged';
      } else if (dy > 24 && agenda) {
        setAgenda(false);
        grab.current = 'dragged';
      }
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 20px',
      padding: '8px 0 9px',
      background: 'transparent',
      border: 'none',
      cursor: 'grab',
      flex: 'none',
      touchAction: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 34,
      height: 4,
      borderRadius: 999,
      background: 'var(--line)'
    }
  })), agenda && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 'none',
      padding: '0 18px 74px'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onOpenDay,
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 9,
      width: '100%',
      background: 'none',
      border: 'none',
      padding: '0 0 4px',
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '650 16px var(--font-ui)',
      color: 'var(--ink)'
    }
  }, sel, " ", month.name), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, isToday ? 'today · ' : '', MWD[selG.getDay()].slice(0, 1) + MWD[selG.getDay()].slice(1).toLowerCase(), " ", selG.getDate(), " ", selG.toLocaleString('en', {
    month: 'short'
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-faint)'
    }
  }, "\u203A")), !selEvs.length && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12.5px var(--font-ui)',
      color: 'var(--text-faint)',
      padding: '10px 0'
    }
  }, "Nothing scheduled \u2014 a quiet day."), selEvs.map((ev, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => openDetail(sel, i),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      minHeight: 48,
      padding: '4px 0',
      borderBottom: i < selEvs.length - 1 ? '1px solid var(--zebra)' : 'none',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)',
      width: 56,
      flex: 'none'
    }
  }, /^\d/.test(ev[1]) ? ev[1] : ev[1] === '—' ? 'all day' : ev[1]), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 3,
      alignSelf: 'stretch',
      borderRadius: 2,
      margin: '7px 0',
      flex: 'none',
      background: ev[3] === 'sacred' ? 'var(--gold)' : ev[3] === 'task' ? 'transparent' : calColor(ev[0]),
      border: ev[3] === 'task' ? '1.4px solid ' + calColor(ev[0]) : 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: '600 13.5px var(--font-ui)',
      color: ev[3] === 'sacred' ? 'var(--gold-ink)' : 'var(--ink)'
    }
  }, ev[2]), ev[3] && /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      display: 'block',
      fontSize: 11,
      color: 'var(--text-faint)',
      marginTop: 1
    }
  }, ev[3] === 'sacred' ? 'sacred day' : 'task')))), month.coming && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.1em',
      color: 'var(--text-muted)',
      margin: '18px 0 2px'
    }
  }, "COMING UP"), month.coming.map(([t, note, prov], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      minHeight: 44,
      borderBottom: i < month.coming.length - 1 ? '1px solid var(--zebra)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 5,
      height: 5,
      background: prov ? 'var(--gold)' : 'var(--accent)',
      transform: 'rotate(45deg)',
      marginLeft: 3,
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 12.5px var(--font-ui)',
      color: 'var(--ink)',
      flex: 1
    }
  }, t), prov ? /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      letterSpacing: '.04em',
      color: 'var(--gold-ink)',
      border: '1px dashed var(--gold)',
      borderRadius: 999,
      padding: '3px 9px'
    }
  }, note) : /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-muted)'
    }
  }, note))))));
}

/* 1 Muḥarram 1447 is a Friday, so day d falls on weekday (4 + d) % 7 with 0 = Sunday. V1's week
   strip hard-coded 11–17 as Sun–Sat, which put Thursday's date under WED. */
const MWDAY = d => (4 + d) % 7;
const MWEEKSTART = d => d - MWDAY(d);
function WeekStrip({
  sel,
  onSel
}) {
  const start = MWEEKSTART(sel);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      padding: '0 14px 8px',
      flex: 'none'
    }
  }, ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((w, i) => {
    const day = start + i,
      on = sel === day,
      today = day === 14,
      out = day < 1 || day > 30;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      onClick: () => !out && onSel(day),
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        padding: '8px 0 6px',
        borderRadius: 'var(--r-lg)',
        cursor: out ? 'default' : 'pointer',
        border: 'none',
        background: on ? 'var(--btn-primary-bg)' : i === 5 ? 'var(--elev)' : 'transparent',
        opacity: out ? 0.35 : 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mc",
      style: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '.06em',
        color: on ? 'var(--btn-primary-ink)' : i === 5 ? 'var(--text-muted)' : 'var(--text-faint)'
      }
    }, w), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 15px var(--font-ui)',
        lineHeight: 1,
        color: on ? 'var(--btn-primary-ink)' : today ? 'var(--ink)' : 'var(--text-muted)'
      }
    }, out ? '·' : day), today && !on ? /*#__PURE__*/React.createElement("span", {
      style: {
        width: 4,
        height: 4,
        borderRadius: '50%',
        background: 'var(--ink)'
      }
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        height: 4
      }
    }));
  }));
}
const TG0 = 5,
  TG1 = 23;
const MNOW = 581; /* 9:41 — the one clock the whole kit uses */
/* Prayer labels live in the LEFT GUTTER, never in the event lane (docs §16.4) — in V1 they sat
   at the right edge of the lane and were overlapped by every afternoon event. */
function PrayerRule({
  name,
  y
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: y,
      zIndex: 3,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      borderTop: `1px ${name === 'Maghrib' ? 'solid' : 'dotted'} color-mix(in srgb,var(--gold) 45%,transparent)`
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      position: 'absolute',
      right: 'calc(100% + 5px)',
      top: -6,
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '.02em',
      color: 'var(--gold-ink)',
      background: 'var(--bg)',
      padding: '1px 2px',
      whiteSpace: 'nowrap'
    }
  }, name));
}
function TimeGrid({
  days,
  events,
  sel,
  onSel,
  onCreate,
  openDetail
}) {
  const pxh = days === 1 ? 56 : 44;
  const y = min => (min - TG0 * 60) / 60 * pxh;
  const H = (TG1 - TG0) * pxh;
  const hours = Array.from({
    length: TG1 - TG0
  }, (_, i) => TG0 + i);
  const base = days === 7 ? Math.max(1, MWEEKSTART(sel)) : days === 3 ? Math.min(Math.max(sel, 1), 28) : sel;
  const cols = Array.from({
    length: days
  }, (_, i) => base + i);
  const [drag, setDrag] = useCvState(null);
  const toMin = py => Math.round((TG0 * 60 + py / pxh * 60) / 15) * 15;
  const startDrag = col => e => {
    const r = e.currentTarget.getBoundingClientRect();
    setDrag({
      col,
      y0: e.clientY - r.top,
      y1: e.clientY - r.top
    });
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const moveDrag = e => {
    if (!drag) return;
    const r = e.currentTarget.getBoundingClientRect();
    setDrag(d => ({
      ...d,
      y1: Math.max(0, Math.min(H, e.clientY - r.top))
    }));
  };
  const endDrag = day => () => {
    if (!drag) return;
    const a = Math.min(drag.y0, drag.y1),
      b = Math.max(drag.y0, drag.y1);
    if (b - a > 10 && onCreate) {
      const s = toMin(a);
      onCreate(day, mFmt(s));
    }
    setDrag(null);
  };
  const evsOf = d => (events[d] || []).map((e, ix) => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(e[1]);
    return m ? {
      ix,
      s: +m[1] * 60 + +m[2],
      e: +m[1] * 60 + +m[2] + 60,
      k: e[0],
      t: e[2]
    } : null;
  }).filter(Boolean);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column'
    }
  }, days === 1 && /*#__PURE__*/React.createElement(WeekStrip, {
    sel: sel,
    onSel: onSel
  }), days > 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flex: 'none',
      padding: '0 14px 6px 46px'
    }
  }, cols.map(d => {
    const g = new Date(2026, 5, 25 + d),
      today = d === 14;
    return /*#__PURE__*/React.createElement("div", {
      key: d,
      onClick: () => onSel(d),
      style: {
        flex: 1,
        textAlign: 'center',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "mc",
      style: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '.05em',
        color: g.getDay() === 5 ? 'var(--text-muted)' : 'var(--text-faint)'
      }
    }, ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][g.getDay()]), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '700 13px var(--font-ui)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 3,
        width: 25,
        height: 25,
        borderRadius: 'var(--r-sm)',
        color: today ? 'var(--bg)' : 'var(--ink)',
        background: today ? 'var(--ink)' : 'transparent'
      }
    }, d));
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '6px 12px 20px 0'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: H,
      marginLeft: 46
    }
  }, hours.map(h => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: y(h * 60)
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      position: 'absolute',
      right: 'calc(100% + 8px)',
      top: -5,
      fontSize: 11,
      color: 'var(--text-faint)',
      whiteSpace: 'nowrap'
    }
  }, mFmt(h * 60)), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      height: 1,
      background: 'var(--hairline)'
    }
  }))), MPRT.filter(p => p[0] !== 'Shurūq').map(([n, m]) => m >= TG0 * 60 && m <= TG1 * 60 && /*#__PURE__*/React.createElement(PrayerRule, {
    key: n,
    name: n,
    y: y(m)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex'
    }
  }, cols.map((d, i) => /*#__PURE__*/React.createElement("div", {
    key: d,
    onPointerDown: startDrag(i),
    onPointerMove: moveDrag,
    onPointerUp: endDrag(d),
    style: {
      flex: 1,
      position: 'relative',
      touchAction: 'none',
      borderLeft: i > 0 ? '1px solid var(--hairline)' : 'none',
      background: days === 7 && new Date(2026, 5, 25 + d).getDay() === 5 ? 'var(--elev)' : 'transparent'
    }
  }, drag && drag.col === i && (() => {
    const a = Math.min(drag.y0, drag.y1),
      b = Math.max(drag.y0, drag.y1);
    const s = toMin(a),
      e2 = Math.max(toMin(a) + 15, toMin(b)),
      clash = mClash(s, e2);
    return /*#__PURE__*/React.createElement("div", {
      style: {
        position: 'absolute',
        left: 2,
        right: 2,
        top: y(s),
        height: Math.max(14, y(e2) - y(s)),
        zIndex: 4,
        border: `1.5px dashed ${clash ? 'var(--alert)' : 'var(--accent)'}`,
        borderRadius: 'var(--r-sm)',
        background: clash ? 'color-mix(in srgb,var(--alert) 14%,transparent)' : 'var(--accent-soft)',
        pointerEvents: 'none'
      }
    }, /*#__PURE__*/React.createElement("span", {
      className: "mc",
      style: {
        position: 'absolute',
        top: 3,
        left: 4,
        background: clash ? 'var(--alert)' : 'var(--accent)',
        color: clash ? '#fff' : 'var(--accent-ink)',
        fontSize: 11,
        fontWeight: 700,
        borderRadius: 999,
        padding: '2px 7px',
        whiteSpace: 'nowrap'
      }
    }, clash ? 'overlaps ' + clash : mFmt(s) + ' – ' + mFmt(e2)));
  })(), evsOf(d).map(ev => /*#__PURE__*/React.createElement("div", {
    key: ev.ix,
    onClick: () => openDetail(d, ev.ix),
    style: {
      position: 'absolute',
      left: 3,
      right: 3,
      top: y(ev.s),
      height: Math.max(22, y(ev.e) - y(ev.s)),
      zIndex: 2,
      background: `color-mix(in srgb,${calColor(ev.k)} 26%,transparent)`,
      borderLeft: `2.5px solid ${calColor(ev.k)}`,
      borderRadius: 'var(--r-sm)',
      padding: '4px 6px',
      overflow: 'hidden',
      cursor: 'pointer'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: `600 ${days === 7 ? 8.5 : 11.5}px var(--font-ui)`,
      lineHeight: 1.2,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap'
    }
  }, ev.t), days < 7 && /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-muted)',
      marginTop: 1
    }
  }, mFmt(ev.s), " \u2013 ", mFmt(ev.e)))), d === 14 && /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: y(MNOW),
      zIndex: 3,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      left: -3,
      top: -2.5,
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--ink)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      height: 1.5,
      background: 'var(--ink)'
    }
  }))))))));
}

/* F12 fix: index 8 was a second 'Muḥarram'; Ramaḍān was missing from the year entirely. */
const MMN = ['Muḥarram', 'Ṣafar', 'Rabīʿ I', 'Rabīʿ II', 'Jumādā I', 'Jumādā II', 'Rajab', 'Shaʿbān', 'Ramaḍān', 'Shawwāl', 'Dhū al-Qaʿdah', 'Dhū al-Ḥijjah'];
const MLEN = [30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29];
const mStartWd = m => {
  let off = 0;
  for (let k = 0; k < m; k++) off += MLEN[k];
  return ((5 + off) % 7 + 7) % 7;
};
function YearView({
  onOpenMonth
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      padding: '2px 18px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: '22px 24px'
    }
  }, MMN.map((m, mi) => /*#__PURE__*/React.createElement("button", {
    key: m,
    onClick: () => onOpenMonth(mi),
    style: {
      background: 'transparent',
      border: 'none',
      cursor: 'pointer',
      padding: 0,
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13.5px var(--font-ui)',
      color: mi === 0 ? 'var(--text-muted)' : 'var(--ink)',
      marginBottom: 7
    }
  }, m), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(7,1fr)',
      gap: 2
    }
  }, Array.from({
    length: mStartWd(mi)
  }).map((_, i) => /*#__PURE__*/React.createElement("span", {
    key: 'b' + i
  })), Array.from({
    length: MLEN[mi]
  }).map((_, i) => {
    const today = mi === 0 && i + 1 === 14;
    return /*#__PURE__*/React.createElement("span", {
      key: i,
      className: "mc",
      style: {
        fontSize: 11,
        textAlign: 'center',
        lineHeight: '15px',
        height: 15,
        borderRadius: 4,
        color: today ? 'var(--bg)' : mi > 0 ? 'var(--text-faint)' : 'var(--text-muted)',
        background: today ? 'var(--ink)' : 'transparent'
      }
    }, i + 1);
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9,
      marginTop: 18,
      padding: '11px 13px',
      border: '1px dashed var(--gold)',
      borderRadius: 'var(--r-lg)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 15,
      height: 15,
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 24 24",
    style: {
      width: 15,
      height: 15,
      display: 'block',
      fill: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  }))), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 11px/1.5 var(--font-ui)',
      color: 'var(--text-faint)'
    }
  }, "Later months are provisional \u2014 sighting-based month ends may shift dates by \xB11 day.")));
}
function ScheduleList({
  events,
  openDetail
}) {
  const [tab, setTab] = useCvState('Today');
  const evToMin = t => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(t);
    return m ? +m[1] * 60 + +m[2] : t === 'Maghrib' ? 1000 : 0;
  };
  // today = 14
  const today = (events[14] || []).map((e, ix) => ({
    ix,
    k: e[0],
    t: e[1],
    title: e[2],
    min: evToMin(e[1]),
    when: e[1] === 'Maghrib' ? 'before Maghrib' : '',
    task: e[0] === 'p'
  }));
  const items = [];
  MPRT.filter(p => p[0] !== 'Shurūq').forEach(([n, m]) => items.push({
    type: 'prayer',
    name: n,
    min: m
  }));
  today.forEach(e => items.push({
    type: 'ev',
    ...e
  }));
  items.sort((a, b) => a.min - b.min || (a.type === 'prayer' ? -1 : 1));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      overflowY: 'auto',
      padding: '2px 18px 20px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      margin: '4px 0 16px'
    }
  }, ['Today', 'Coming up'].map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    onClick: () => setTab(f),
    style: {
      fontSize: 12,
      fontWeight: 600,
      padding: '7px 15px',
      borderRadius: 999,
      border: '1px solid ' + (tab === f ? 'var(--line)' : 'transparent'),
      background: tab === f ? 'var(--zebra)' : 'transparent',
      color: tab === f ? 'var(--ink)' : 'var(--text-faint)',
      cursor: 'pointer'
    }
  }, f))), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.08em',
      color: 'var(--text-muted)',
      marginBottom: 12
    }
  }, "MU\u1E24ARRAM 1447"), items.map((it, i) => it.type === 'prayer' ? /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      margin: '14px 0 10px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.08em',
      color: 'var(--text-muted)',
      whiteSpace: 'nowrap'
    }
  }, it.name.toUpperCase(), " \xB7 ", mFmt(it.min)), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      height: 1,
      borderTop: '1px dotted color-mix(in srgb,var(--gold) 40%,transparent)'
    }
  }), it.name === 'Maghrib' && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "11",
    height: "11",
    viewBox: "0 0 24 24",
    style: {
      fill: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  })), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: 'var(--text-muted)'
    }
  }, "15 Mu\u1E25arram begins"))) : /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => openDetail(14, it.ix),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      padding: '10px 0',
      cursor: 'pointer'
    }
  }, it.task ? /*#__PURE__*/React.createElement("span", {
    style: {
      width: 17,
      height: 17,
      borderRadius: '50%',
      border: '1.6px solid var(--text-faint)',
      flex: 'none'
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: calColor(it.k),
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 13.5px var(--font-ui)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis'
    }
  }, it.title), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)',
      whiteSpace: 'nowrap'
    }
  }, it.when || mFmt(it.min).replace(/^(\d{1,2}):(\d{2})$/, (s, h, mm) => (+h > 12 ? +h - 12 : h) + ':' + mm + ' ' + (+h >= 12 ? 'PM' : 'AM'))))));
}
Object.assign(window, {
  MonthCal,
  TimeGrid,
  YearView,
  ScheduleList,
  MJOT,
  MMN
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/mobile/CalViews.jsx", error: String((e && e.message) || e) }); }

// daftar/mobile/MobileRoot.jsx
try { (() => {
/* Root: presentation stage (In the app / Lock screen / Widgets), phone frame, app chrome, tabs, FAB, toast — Daftar mobile kit. Muḥarram 1447 framing. */
const {
  useState: useRtState,
  useEffect: useRtEffect
} = React;
const MEV0 = {
  3: [['w', '09:00', 'Standup']],
  5: [['f', '19:00', 'Family dinner']],
  10: [['d', '—', 'ʿĀshūrāʾ', 'sacred'], ['d', 'Maghrib', 'ʿĀshūrāʾ fast'], ['w', '09:30', 'Board sync']],
  13: [['d', '—', 'White day', 'sacred']],
  14: [['w', '11:00', 'Project review'], ['d', '19:30', 'Qurʾān circle'], ['p', 'Maghrib', 'Pay zakat', 'task']],
  15: [['d', '—', 'White day', 'sacred'], ['d', '13:05', 'Jumuʿah · khuṭbah']],
  17: [['p', '08:15', 'Dentist']],
  21: [['p', 'Maghrib', 'Zakat due', 'task']],
  24: [['f', '—', 'Trip to Madinah']]
};
/* A second month, so the swipe has somewhere to go and the crescent's ±1 is visible in practice. */
const MEV1 = {
  1: [['d', '—', 'Ṣafar begins', 'sacred']],
  6: [['w', '09:00', 'Standup']],
  13: [['d', '—', 'White day', 'sacred']],
  15: [['d', '—', 'White day', 'sacred'], ['f', '18:30', 'Nikāḥ · cousin']],
  22: [['w', '10:00', 'Quarter close']]
};
const TODAY = 14;
const MONTHS = [{
  name: 'Muḥarram',
  year: 1447,
  days: 30,
  startWd: 5,
  prevDays: 30,
  base: [2026, 5, 25],
  today: TODAY,
  provisional: true,
  sub: 'today is 14 Muḥarram · Thu 9 Jul 2026',
  coming: [['Zakat due · 21 Muḥarram', 'in 7 days'], ['Muḥarram ends · 29 or 30', 'provisional', 1]]
}, {
  name: 'Ṣafar',
  year: 1447,
  days: 29,
  startWd: 0,
  prevDays: 30,
  base: [2026, 6, 25],
  today: null,
  provisional: true,
  sub: 'Jul – Aug 2026 · dates pending the crescent',
  coming: [['Ṣafar ends · 28 or 29', 'provisional', 1]]
}];
/* Re-haul phase 2 · desktop parity (docs/MOBILE-REHAUL.md §17.4.2).
   The desktop kit treats Agenda and Journal as *views of the calendar*, cycled by one switcher —
   not destinations. Mobile now does the same: Schedule stops being a tab (F4) and the ¶ overlay
   stops being a side door. Four peer tabs, seven calendar views, one switcher. */
const TABS = [['cal', 'Calendar', 'M3 4.5h18v15.5H3zM3 9.5h18M8 2.8v3.4M16 2.8v3.4'], ['prayer', 'Prayer', 'M12 3l7 6v11H5V9zM9.5 20v-4.5a2.5 2.5 0 0 1 5 0V20'], ['tasks', 'Tasks', 'M4 4h16v16H4zM8.5 12.3l2.4 2.4 4.8-5.2'], ['settings', 'Settings', 'M4 7.2h8.6M17.4 7.2H20M4 16.8h2.6M11.4 16.8H20M15 5a2.2 2.2 0 1 0 0 4.4A2.2 2.2 0 0 0 15 5zM9 14.6a2.2 2.2 0 1 0 0 4.4 2.2 2.2 0 0 0 0-4.4z']];
const CALVIEWS = [['day', 'Day', 'hours, with the prayers as backbone'], ['3day', '3-Day', 'three days side by side'], ['week', 'Week', 'the seven-column grid'], ['month', 'Month', 'the month at a glance'], ['agenda', 'Agenda', 'what is coming, as a list'], ['journal', 'Journal', 'the month of nights · muḥāsaba'], ['year', 'Year', 'all twelve months of 1447']];
const CALVIEW = k => CALVIEWS.find(v => v[0] === k) || CALVIEWS[3];

/* View switcher as a sheet, not a pill row (§17.2): returns ~40pt of vertical budget and
   matches the desktop's single-switcher semantics. */
function ViewSheet({
  value,
  onPick,
  onClose
}) {
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose,
    title: "View"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column'
    }
  }, CALVIEWS.map(([k, l, s]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => {
      onPick(k);
      onClose();
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minHeight: 48,
      padding: '7px 2px',
      background: 'none',
      border: 'none',
      borderBottom: '1px solid var(--zebra)',
      cursor: 'pointer',
      textAlign: 'left',
      color: 'var(--ink)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: (value === k ? '700' : '500') + ' 15px var(--font-ui)'
    }
  }, l), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      display: 'block',
      fontSize: 11,
      color: 'var(--text-faint)',
      marginTop: 2
    }
  }, s)), value === k && /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'var(--accent)',
      strokeWidth: 2.4,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6L9 17l-5-5"
  }))))));
}

/* Month picker (§17.2): tapping the title is the cheapest “go to date”. */
function MonthSheet({
  onPick,
  onClose,
  toast
}) {
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose,
    title: "Go to month"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3,1fr)',
      gap: 8
    }
  }, MMN.map((m, mi) => /*#__PURE__*/React.createElement("button", {
    key: m,
    onClick: () => {
      if (mi <= 1) onPick(mi);else toast(m + ' 1447 — outside this fixture');
      onClose();
    },
    style: {
      minHeight: 52,
      borderRadius: 'var(--r-sm)',
      border: '1px solid ' + (mi <= 1 ? 'var(--accent)' : 'var(--elev-border)'),
      background: mi <= 1 ? 'var(--accent-soft)' : 'var(--elev)',
      color: mi <= 1 ? 'var(--ink)' : 'var(--text-muted)',
      cursor: 'pointer',
      font: '600 12.5px var(--font-ui)',
      padding: '4px 6px'
    }
  }, m))), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      lineHeight: 1.5,
      color: 'var(--text-faint)',
      marginTop: 12
    }
  }, "Mu\u1E25arram and \u1E62afar carry data in this kit \u2014 swipe the grid to move between them. Later months are provisional: the crescent may shift them \xB11 day."), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      toast('Adjust to a local sighting — Umm al-Qura by default');
      onClose();
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      width: '100%',
      minHeight: 48,
      marginTop: 4,
      background: 'none',
      border: 'none',
      borderTop: '1px solid var(--zebra)',
      cursor: 'pointer',
      textAlign: 'left',
      color: 'var(--ink)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 13px var(--font-ui)',
      flex: 1
    }
  }, "Adjust to a local sighting"), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, "Umm al-Qura"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-faint)'
    }
  }, "\u203A")));
}
function Island() {
  const [open, setOpen] = useRtState(false);
  /* It is 9:41 — Fajr has passed, Zuhr is next. One clock across the island, the prayer screen and
     the lock screen; the three used to disagree (F13). Expanded state collapses itself, as a real
     Live Activity does, instead of sitting over the app's header forever. */
  const rows = [['Fajr', '05:12', 1], ['Zuhr', '12:16', 0], ['ʿAsr', '15:45', 0], ['Maghrib', '18:52', 0], ['ʿIshāʾ', '20:20', 0]];
  useRtEffect(() => {
    if (!open) return;
    const t = setTimeout(() => setOpen(false), 4200);
    return () => clearTimeout(t);
  }, [open]);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      top: 9,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 45
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setOpen(o => !o),
    "aria-expanded": open,
    style: {
      display: 'block',
      background: '#000',
      border: '1px solid rgba(255,255,255,.08)',
      borderRadius: open ? 22 : 999,
      padding: open ? '13px 16px' : '6px 13px',
      cursor: 'pointer',
      color: '#e7e5e1',
      transition: 'border-radius 220ms var(--ease-settle), padding 220ms var(--ease-settle)',
      boxShadow: '0 8px 22px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05)'
    }
  }, !open ? /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 17,
      height: 17,
      borderRadius: '50%',
      display: 'grid',
      placeItems: 'center',
      flex: 'none',
      background: 'radial-gradient(circle at 50% 50%, color-mix(in srgb,var(--gold) 30%,transparent), transparent 70%)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "10",
    height: "10",
    viewBox: "0 0 24 24",
    style: {
      display: 'block',
      fill: 'color-mix(in srgb,var(--gold) 86%,#fff6e6)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  }))), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '.01em',
      color: '#efece6'
    }
  }, "Zuhr 12:16"), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 1,
      height: 10,
      borderRadius: 1,
      background: 'rgba(255,255,255,.13)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 500,
      color: 'rgba(231,229,225,.58)'
    }
  }, "2h 35m")) : /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      width: 258
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.08em',
      color: 'var(--text-muted)'
    }
  }, "NEXT \xB7 ZUHR"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'rgba(231,229,225,.55)'
    }
  }, "12:16 PM \xB7 in 2h 35m")), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 4
    }
  }, rows.map(([n, t, done], i) => /*#__PURE__*/React.createElement("span", {
    key: n,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
      padding: '5px 0',
      borderRadius: 8,
      background: i === 1 ? 'rgba(201,164,94,.18)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.04em',
      color: done ? 'var(--green)' : i === 1 ? 'var(--text-muted)' : 'rgba(231,229,225,.5)'
    }
  }, n.toUpperCase()), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: done ? 'rgba(231,229,225,.45)' : '#e7e5e1'
    }
  }, t), /*#__PURE__*/React.createElement("span", {
    style: {
      width: 4,
      height: 4,
      borderRadius: '50%',
      background: done ? 'var(--green)' : i === 1 ? 'var(--gold)' : 'rgba(255,255,255,.14)'
    }
  })))))));
}
function StatusBar({
  dark
}) {
  const ink = dark ? '#e7e5e1' : 'var(--ink)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      padding: '14px 22px 4px',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 13,
      fontWeight: 600,
      color: ink
    }
  }, "9:41"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      gap: 6,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "11",
    viewBox: "0 0 16 12"
  }, /*#__PURE__*/React.createElement("g", {
    fill: ink
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0",
    y: "7",
    width: "3",
    height: "4",
    rx: "0.8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "4.3",
    y: "5",
    width: "3",
    height: "6",
    rx: "0.8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "8.6",
    y: "2.5",
    width: "3",
    height: "8.5",
    rx: "0.8"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "12.9",
    y: "0",
    width: "3",
    height: "11",
    rx: "0.8"
  }))), /*#__PURE__*/React.createElement("svg", {
    width: "23",
    height: "11",
    viewBox: "0 0 25 12"
  }, /*#__PURE__*/React.createElement("rect", {
    x: "0.5",
    y: "0.5",
    width: "21",
    height: "11",
    rx: "3",
    fill: "none",
    stroke: ink,
    opacity: "0.5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "2",
    y: "2",
    width: "17",
    height: "8",
    rx: "1.6",
    fill: ink
  }), /*#__PURE__*/React.createElement("rect", {
    x: "22.5",
    y: "3.8",
    width: "2",
    height: "4.4",
    rx: "1",
    fill: ink,
    opacity: "0.5"
  }))));
}
function IconBtn({
  d,
  onClick,
  title,
  dot
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    title: title,
    "aria-label": title,
    style: {
      width: 34,
      height: 34,
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center',
      position: 'relative',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: d
  })), dot && /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 7,
      right: 8,
      width: 5,
      height: 5,
      borderRadius: '50%',
      background: 'var(--ink)'
    }
  }));
}
function MApp() {
  const [tab, setTab] = useRtState('cal');
  const [calView, setCalView] = useRtState('month');
  const [events, setEvents] = useRtState({
    0: MEV0,
    1: MEV1
  });
  const [sel, setSel] = useRtState(TODAY);
  const [monthIdx, setMonthIdx] = useRtState(0);
  const [anim, setAnim] = useRtState(null);
  const [composer, setComposer] = useRtState(null);
  const [detail, setDetail] = useRtState(null);
  const [toastMsg, setToastMsg] = useRtState(null);
  const [widgets, setWidgets] = useRtState(false);
  const [viewSheet, setViewSheet] = useRtState(false);
  const [monthSheet, setMonthSheet] = useRtState(false);
  const [onboard, setOnboard] = useRtState(false);
  const toast = msg => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 2600);
  };
  const month = MONTHS[monthIdx];
  const evs = events[monthIdx];
  /* Every write lands in the month the user is looking at — creating from Ṣafar used to append to
     the Muḥarram fixture. */
  const addEvent = (day, ev, pin) => {
    setEvents(es => ({
      ...es,
      [monthIdx]: {
        ...es[monthIdx],
        [day]: [...(es[monthIdx][day] || []), ev]
      }
    }));
    setSel(day);
    toast('Added to ' + day + ' ' + month.name + (pin === 'hijri' ? ' · pinned to Hijri' : ''));
  };
  const updEvent = (day, ix, ev) => {
    setEvents(es => ({
      ...es,
      [monthIdx]: {
        ...es[monthIdx],
        [day]: es[monthIdx][day].map((e, j) => j === ix ? ev : e)
      }
    }));
    toast('Updated');
  };
  const delEvent = (day, ix) => {
    setEvents(es => ({
      ...es,
      [monthIdx]: {
        ...es[monthIdx],
        [day]: es[monthIdx][day].filter((_, j) => j !== ix)
      }
    }));
    setDetail(null);
    toast('Deleted');
  };
  const gLabel = d => {
    const g = new Date(month.base[0], month.base[1], month.base[2] + d);
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][g.getDay()] + ' ' + g.getDate() + ' ' + g.toLocaleString('en', {
      month: 'short'
    });
  };
  const openDetail = (d, ix) => setDetail({
    d,
    ix
  });
  const titles = {
    cal: null,
    prayer: 'Prayer times',
    tasks: 'Tasks',
    settings: 'Settings'
  };
  const subs = {
    tasks: '1 due today · before Maghrib'
  };
  const bell = /*#__PURE__*/React.createElement(IconBtn, {
    d: "M6.4 9.6a5.6 5.6 0 0 1 11.2 0c0 4.3 1.8 5.4 1.8 5.4H4.6s1.8-1.1 1.8-5.4zM10.2 19.6a2 2 0 0 0 3.6 0",
    title: "Alerts",
    dot: true,
    onClick: () => toast('3 upcoming reminders')
  });
  const goMonth = dir => {
    const n = Math.min(MONTHS.length - 1, Math.max(0, monthIdx + dir));
    if (n === monthIdx) return;
    setAnim(dir > 0 ? 'l' : 'r');
    setMonthIdx(n);
    setSel(Math.min(sel, MONTHS[n].days));
    setTimeout(() => setAnim(null), 300);
  };
  const pickView = k => {
    setCalView(k);
    if (k !== 'month') setMonthIdx(0);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement(Island, null), /*#__PURE__*/React.createElement(StatusBar, null), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 8,
      padding: '8px 20px 10px',
      flex: 'none'
    }
  }, tab === 'cal' ? /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0,
      display: 'flex',
      alignItems: 'center',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setMonthSheet(true),
    style: {
      display: 'inline-flex',
      alignItems: 'baseline',
      gap: 5,
      background: 'none',
      border: 'none',
      padding: 0,
      cursor: 'pointer',
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '650 17px var(--font-ui)',
      letterSpacing: '-.01em',
      whiteSpace: 'nowrap',
      color: 'var(--ink)'
    }
  }, month.name, " ", month.year), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 10,
      color: 'var(--text-faint)'
    }
  }, "\u25BE")), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => setViewSheet(true),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      height: 30,
      padding: '0 11px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink)',
      cursor: 'pointer',
      font: '600 12px var(--font-ui)',
      flex: 'none'
    }
  }, CALVIEW(calView)[1], /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 9,
      color: 'var(--text-faint)'
    }
  }, "\u25BE")), /*#__PURE__*/React.createElement("button", {
    onClick: () => {
      setMonthIdx(0);
      setSel(TODAY);
      pickView('month');
    },
    style: {
      height: 30,
      padding: '0 12px',
      borderRadius: 999,
      border: '1px solid var(--line)',
      background: 'transparent',
      color: 'var(--ink)',
      cursor: 'pointer',
      font: '600 12px var(--font-ui)',
      flex: 'none'
    }
  }, "Today"), bell) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '650 20px var(--font-ui)',
      letterSpacing: '-.02em'
    }
  }, titles[tab]), subs[tab] && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px var(--font-ui)',
      color: 'var(--text-muted)',
      marginTop: 3
    }
  }, subs[tab])), tab !== 'settings' && bell)), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0
    }
  }, tab === 'cal' && calView === 'month' && /*#__PURE__*/React.createElement(MonthCal, {
    month: month,
    events: evs,
    sel: sel,
    setSel: setSel,
    openDetail: openDetail,
    openComposer: d => setComposer({
      day: d
    }),
    onSwipe: goMonth,
    anim: anim,
    onOpenDay: () => pickView('day')
  }), tab === 'cal' && calView === 'week' && /*#__PURE__*/React.createElement(TimeGrid, {
    days: 7,
    events: evs,
    sel: sel,
    onSel: d => {
      setSel(d);
      setCalView('day');
    },
    onCreate: (d, t) => setComposer({
      day: d,
      start: t
    }),
    openDetail: openDetail
  }), tab === 'cal' && calView === '3day' && /*#__PURE__*/React.createElement(TimeGrid, {
    days: 3,
    events: evs,
    sel: sel,
    onSel: setSel,
    onCreate: (d, t) => setComposer({
      day: d,
      start: t
    }),
    openDetail: openDetail
  }), tab === 'cal' && calView === 'day' && /*#__PURE__*/React.createElement(TimeGrid, {
    days: 1,
    events: evs,
    sel: sel,
    onSel: setSel,
    onCreate: (d, t) => setComposer({
      day: d,
      start: t
    }),
    openDetail: openDetail
  }), tab === 'cal' && calView === 'year' && /*#__PURE__*/React.createElement(YearView, {
    onOpenMonth: mi => {
      if (mi <= 1) {
        setMonthIdx(mi);
        setSel(Math.min(sel, MONTHS[mi].days));
        pickView('month');
      } else toast(MMN[mi] + ' 1447 — outside this fixture');
    }
  }), tab === 'cal' && calView === 'agenda' && /*#__PURE__*/React.createElement(ScheduleList, {
    events: evs,
    openDetail: openDetail
  }), tab === 'cal' && calView === 'journal' && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minHeight: 0,
      padding: '0 14px',
      display: 'flex'
    }
  }, /*#__PURE__*/React.createElement(JournalScreen, null)), tab === 'prayer' && /*#__PURE__*/React.createElement(PrayerScreen, null), tab === 'tasks' && /*#__PURE__*/React.createElement(TasksScreen, {
    toast: toast
  }), tab === 'settings' && /*#__PURE__*/React.createElement(SettingsScreen, {
    toast: toast,
    onWidgets: () => setWidgets(true)
  })), (tab === 'cal' && calView !== 'year' && calView !== 'journal' || tab === 'tasks') && /*#__PURE__*/React.createElement("button", {
    onClick: () => setComposer({
      day: sel
    }),
    "aria-label": "New event",
    style: {
      position: 'absolute',
      right: 18,
      bottom: 96,
      width: 54,
      height: 54,
      borderRadius: 18,
      background: 'var(--surface-2)',
      color: 'var(--ink)',
      border: '1px solid var(--line)',
      cursor: 'pointer',
      boxShadow: '0 10px 28px rgba(0,0,0,.5)',
      display: 'grid',
      placeItems: 'center',
      zIndex: 30
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "22",
    height: "22",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2.2,
      strokeLinecap: 'round'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 5v14M5 12h14"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 'none',
      display: 'flex',
      borderTop: '1px solid color-mix(in srgb,var(--line) 55%,transparent)',
      background: 'color-mix(in srgb,var(--bg) 78%,transparent)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      padding: '8px 8px 14px',
      zIndex: 20
    }
  }, TABS.map(([k, label, d]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setTab(k),
    style: {
      flex: 1,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 4,
      padding: '5px 0',
      color: tab === k ? 'var(--ink)' : 'color-mix(in srgb,var(--text-faint) 75%,transparent)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "21",
    height: "21",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: d
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      fontWeight: tab === k ? 700 : 500
    }
  }, label)))), composer && /*#__PURE__*/React.createElement(MComposer, {
    day: composer.day,
    start0: composer.start,
    edit: composer.edit,
    mName: month.name,
    mMax: month.days,
    greg: gLabel,
    onClose: () => setComposer(null),
    onSave: (day, ev, pin) => {
      if (composer.edit) updEvent(composer.edit.day, composer.edit.ix, ev);else addEvent(day, ev, pin);
      setComposer(null);
    }
  }), detail && evs[detail.d] && evs[detail.d][detail.ix] && /*#__PURE__*/React.createElement(MDetail, {
    day: detail.d,
    ix: detail.ix,
    ev: evs[detail.d][detail.ix],
    mName: month.name,
    greg: gLabel,
    onClose: () => setDetail(null),
    onDelete: () => delEvent(detail.d, detail.ix),
    onEdit: () => {
      const [k, time, title] = evs[detail.d][detail.ix];
      setDetail(null);
      setComposer({
        day: detail.d,
        edit: {
          day: detail.d,
          ix: detail.ix,
          k,
          time,
          title
        }
      });
    }
  }), toastMsg && /*#__PURE__*/React.createElement("div", {
    role: "status",
    "aria-live": "polite",
    style: {
      position: 'absolute',
      bottom: 100,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      borderRadius: 999,
      padding: '9px 15px',
      font: '600 11px var(--font-mono)',
      color: 'var(--ink)',
      boxShadow: '0 8px 24px rgba(0,0,0,.4)',
      whiteSpace: 'nowrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: 'var(--green)'
    }
  }), toastMsg), widgets && /*#__PURE__*/React.createElement(WidgetsScreen, {
    onClose: () => setWidgets(false)
  }), viewSheet && /*#__PURE__*/React.createElement(ViewSheet, {
    value: calView,
    onPick: pickView,
    onClose: () => setViewSheet(false)
  }), monthSheet && /*#__PURE__*/React.createElement(MonthSheet, {
    onClose: () => setMonthSheet(false),
    toast: toast,
    onPick: mi => {
      setMonthIdx(mi);
      setSel(Math.min(sel, MONTHS[mi].days));
      pickView('month');
    }
  }), onboard && /*#__PURE__*/React.createElement(MOnboarding, {
    onClose: () => setOnboard(false)
  }));
}

/* ---- Lock screen mode ---- */
function LockScreen() {
  const notes = [['Fajr — 5:12 AM', 'Prayed · Jeddah · Umm al-Qura method', '5:12 AM', 'prayer'], ['Moon sighted — Safar begins at Maghrib', '2 Hijri-pinned events moved · Gregorian-pinned stayed', '9:12 PM', 'moon'], ['Qurʾān circle · 7:30 PM', 'After Maghrib — 15 Muḥarram has begun', '6:52 PM', 'prayer']];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(140% 90% at 70% 20%, #1a1a1e, #0c0c0e)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(Island, null), /*#__PURE__*/React.createElement("svg", {
    viewBox: "0 0 100 100",
    style: {
      position: 'absolute',
      right: -40,
      top: 150,
      width: 300,
      height: 300,
      opacity: 0.16
    }
  }, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("mask", {
    id: "lkm"
  }, /*#__PURE__*/React.createElement("rect", {
    width: "100",
    height: "100",
    fill: "#fff"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "64",
    cy: "40",
    r: "34",
    fill: "#000"
  }))), /*#__PURE__*/React.createElement("circle", {
    cx: "50",
    cy: "50",
    r: "40",
    fill: "#c9a45e",
    mask: "url(#lkm)"
  })), /*#__PURE__*/React.createElement(StatusBar, {
    dark: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 'none',
      textAlign: 'center',
      marginTop: 34
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 7,
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    style: {
      fill: 'currentColor'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  })), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 12.5,
      fontWeight: 700,
      letterSpacing: '.02em'
    }
  }, "Thursday 14 Mu\u1E25arram")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '200 74px/1 var(--font-ui)',
      color: '#f3f1ec',
      letterSpacing: '-.03em',
      marginTop: 6
    }
  }, "9:41"), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11.5,
      color: 'rgba(231,229,225,.55)',
      marginTop: 8
    }
  }, "9 July 2026 \xB7 Zuhr in 2h 35m"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 10,
      justifyContent: 'center',
      marginTop: 16
    }
  }, [['Zuhr 12:16', 'prayer'], ['1447 AH · day 14 of 355', 'moon']].map(([t, ic]) => /*#__PURE__*/React.createElement("span", {
    key: t,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: 'rgba(255,255,255,.06)',
      border: '1px solid rgba(255,255,255,.08)',
      borderRadius: 999,
      padding: '6px 12px'
    }
  }, ic === 'prayer' ? /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'var(--text-muted)',
      strokeWidth: 1.8,
      strokeLinejoin: 'round'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 3l7 6v11H5V9zM9.5 20v-4.5a2.5 2.5 0 0 1 5 0V20"
  })) : /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    style: {
      fill: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  })), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: '#e7e5e1'
    }
  }, t))))), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '0 14px',
      display: 'flex',
      flexDirection: 'column',
      gap: 9
    }
  }, notes.map(([t, b, when, ic], i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      background: 'rgba(20,20,22,.72)',
      backdropFilter: 'blur(8px)',
      border: '1px solid rgba(255,255,255,.07)',
      borderRadius: 18,
      padding: '12px 14px',
      display: 'flex',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 30,
      height: 30,
      borderRadius: 8,
      background: 'rgba(255,255,255,.06)',
      display: 'grid',
      placeItems: 'center',
      flex: 'none',
      color: 'var(--text-muted)'
    }
  }, ic === 'prayer' ? /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.7,
      strokeLinejoin: 'round'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 3l7 6v11H5V9zM9.5 20v-4.5a2.5 2.5 0 0 1 5 0V20"
  })) : /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    style: {
      fill: 'currentColor'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      minWidth: 0,
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.1em',
      color: 'rgba(231,229,225,.45)'
    }
  }, "HIJRI FIRST"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'rgba(231,229,225,.4)'
    }
  }, when)), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 12.5px var(--font-ui)',
      color: '#e7e5e1',
      marginTop: 2
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px/1.4 var(--font-ui)',
      color: 'rgba(231,229,225,.6)',
      marginTop: 1
    }
  }, b))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'space-between',
      padding: '22px 34px 26px',
      flex: 'none'
    }
  }, ['M12 3a6.5 6.5 0 0 0 8.5 8.5A9 9 0 1 1 12 3z', 'M5 7h14v12H5zM9 7V5h6v2M2 11h5'].map((d, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: 44,
      height: 44,
      borderRadius: '50%',
      background: 'rgba(255,255,255,.08)',
      display: 'grid',
      placeItems: 'center',
      color: 'rgba(231,229,225,.7)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "18",
    height: "18",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: d
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 120,
      height: 4,
      borderRadius: 2,
      background: 'rgba(255,255,255,.35)',
      margin: '0 auto 10px',
      flex: 'none'
    }
  }));
}

/* ---- Widgets home mode ---- */
function WidgetsHome() {
  const prayers = [['Fajr', '4:12'], ['Zuhr', '12:21'], ['ʿAsr', '3:47'], ['Maghrib', '7:04'], ['ʿIshāʾ', '8:36']];
  const week = [['SUN', 11], ['MON', 12], ['TUE', 13], ['WED', 14], ['THU', 15], ['FRI', 16], ['SAT', 17]];
  const card = {
    background: 'rgba(30,30,34,.9)',
    border: '1px solid rgba(255,255,255,.06)',
    borderRadius: 26,
    boxSizing: 'border-box'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      background: 'radial-gradient(130% 80% at 60% 10%, #171718, #0b0b0c)',
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement(StatusBar, {
    dark: true
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      padding: '2px 22px 8px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 16,
      color: 'rgba(231,229,225,.6)',
      letterSpacing: '.1em'
    }
  }, "\u2022\u2022\u2022")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '0 16px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...card,
      padding: '16px 17px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "12",
    height: "12",
    viewBox: "0 0 24 24",
    style: {
      fill: 'currentColor'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  })), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.08em'
    }
  }, "HIJRI FIRST")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '650 26px var(--font-ui)',
      letterSpacing: '-.02em',
      marginTop: 6
    }
  }, "14 Mu\u1E25arram ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--text-muted)'
    }
  }, "1447")), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)',
      marginTop: 2
    }
  }, "Thursday, 9 July")), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.1em',
      color: 'var(--text-muted)'
    }
  }, "\u02BFASR IN"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '650 26px var(--font-ui)',
      letterSpacing: '-.02em'
    }
  }, "1:24"), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, "at 3:47 PM"))), /*#__PURE__*/React.createElement("div", {
    style: {
      height: 3,
      borderRadius: 2,
      background: 'var(--zebra)',
      margin: '12px 0 11px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      height: 3,
      width: '55%',
      background: 'var(--ink)',
      borderRadius: 2
    }
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 3
    }
  }, prayers.map(([n, t], i) => /*#__PURE__*/React.createElement("span", {
    key: n,
    style: {
      flex: 1,
      textAlign: 'center',
      padding: '5px 0',
      borderRadius: 9,
      background: i === 2 ? 'rgba(255,255,255,.07)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      color: i === 2 ? 'var(--text-muted)' : 'var(--text-faint)',
      fontWeight: 700
    }
  }, n), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      marginTop: 2
    }
  }, t))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...card,
      flex: 1,
      padding: 16,
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.08em',
      color: 'var(--text-muted)'
    }
  }, "MU\u1E24ARRAM"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    style: {
      fill: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '300 52px/1 var(--font-ui)',
      marginTop: 12
    }
  }, "14"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, "Thu 9 Jul \xB7 1447 AH")), /*#__PURE__*/React.createElement("div", {
    style: {
      ...card,
      flex: 1,
      padding: 16,
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      width: 96,
      height: 96,
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "96",
    height: "96",
    viewBox: "0 0 96 96",
    style: {
      position: 'absolute',
      inset: 0
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "48",
    cy: "48",
    r: "42",
    fill: "none",
    stroke: "var(--zebra)",
    strokeWidth: "5"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "48",
    cy: "48",
    r: "42",
    fill: "none",
    stroke: "var(--gold)",
    strokeWidth: "5",
    strokeLinecap: "round",
    strokeDasharray: "264",
    strokeDashoffset: "120",
    transform: "rotate(-90 48 48)"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 19px var(--font-ui)'
    }
  }, "1:24"), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-muted)',
      fontWeight: 700
    }
  }, "\u02BFASR"))), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)',
      marginTop: 8
    }
  }, "then Maghrib 7:04"))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...card,
      padding: '14px 16px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12px var(--font-ui)'
    }
  }, "This week"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, "Mu\u1E25arram 1447")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginTop: 12
    }
  }, week.map(([w, d], i) => /*#__PURE__*/React.createElement("span", {
    key: w,
    style: {
      flex: 1,
      textAlign: 'center',
      padding: '6px 0',
      borderRadius: 10,
      background: d === 14 ? 'var(--surface-2)' : 'transparent',
      boxShadow: d === 14 ? 'inset 0 0 0 1px var(--line)' : 'none'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--text-faint)'
    }
  }, w), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font-ui)',
      marginTop: 3
    }
  }, d), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      width: 4,
      height: 4,
      borderRadius: '50%',
      background: d === 13 || d === 15 ? 'var(--gold)' : 'transparent',
      margin: '3px auto 0'
    }
  }))))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...card,
      padding: '15px 17px',
      display: 'flex',
      alignItems: 'center',
      gap: 14
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "40",
    height: "40",
    viewBox: "0 0 24 24",
    style: {
      fill: 'var(--text-muted)',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font-ui)'
    }
  }, "Rama\u1E0D\u0101n 1447"), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)',
      marginTop: 2
    }
  }, "expected Wed 17 Feb \xB7 provisional")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'right'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '650 30px var(--font-ui)',
      letterSpacing: '-.02em'
    }
  }, "223"), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      letterSpacing: '.08em',
      color: 'var(--text-faint)'
    }
  }, "DAYS")))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 16,
      justifyContent: 'center',
      padding: '10px 0 16px',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 46,
      height: 46,
      borderRadius: 13,
      background: 'var(--surface-2)',
      border: '1px solid var(--line)',
      display: 'grid',
      placeItems: 'center',
      color: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    style: {
      fill: 'currentColor'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  }))), [0, 1, 2].map(i => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      width: 46,
      height: 46,
      borderRadius: 13,
      background: 'rgba(255,255,255,.05)',
      border: '1px solid rgba(255,255,255,.05)'
    }
  }))));
}

/* ---- Stage: presentation switcher + phone frame ---- */
function Stage() {
  const [mode, setMode] = useRtState('app');
  const modes = [['app', 'In the app'], ['lock', 'Lock screen'], ['widgets', 'Widgets']];
  return /*#__PURE__*/React.createElement("div", {
    className: "stage"
  }, /*#__PURE__*/React.createElement("div", {
    className: "modepills"
  }, modes.map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    className: 'modepill' + (mode === k ? ' on' : ''),
    onClick: () => setMode(k)
  }, l))), /*#__PURE__*/React.createElement("div", {
    className: "phone"
  }, /*#__PURE__*/React.createElement("div", {
    className: "screen"
  }, mode === 'app' && /*#__PURE__*/React.createElement(MApp, null), mode === 'lock' && /*#__PURE__*/React.createElement(LockScreen, null), mode === 'widgets' && /*#__PURE__*/React.createElement(WidgetsHome, null))));
}
ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(Stage));
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/mobile/MobileRoot.jsx", error: String((e && e.message) || e) }); }

// daftar/mobile/Screens.jsx
try { (() => {
/* Prayer, Journal, Tasks, Settings screens + onboarding — Daftar mobile kit. */
const {
  useState: useScState,
  useEffect: useScEffect
} = React;
function MTgl({
  on,
  set
}) {
  return /*#__PURE__*/React.createElement("button", {
    onClick: () => set(!on),
    "aria-pressed": on,
    style: {
      width: 34,
      height: 19,
      borderRadius: 999,
      border: '1px solid ' + (on ? 'var(--green)' : 'var(--line)'),
      background: on ? 'color-mix(in srgb,var(--green) 40%,transparent)' : 'var(--zebra)',
      position: 'relative',
      cursor: 'pointer',
      padding: 0,
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: on ? 16 : 2,
      width: 13,
      height: 13,
      borderRadius: '50%',
      background: on ? 'var(--green)' : 'var(--text-faint)',
      transition: 'left 140ms var(--ease-settle)'
    }
  }));
}

/* Prayer screen — countdown is the hero, the authority line sits with it, and the day bar is
   computed from the fixture's own minutes instead of the hard-coded 50% arc V1 shipped (F10). */
const PNOW = 581; /* 9:41, the one clock the kit uses */
const PROWS = [['Fajr', 'الفجر', 312], ['Shurūq', 'الشروق', 400], ['Zuhr', 'الظهر', 736], ['ʿAsr', 'العصر', 945], ['Maghrib', 'المغرب', 1132], ['ʿIshāʾ', 'العشاء', 1220]];
const p12 = m => {
  let h = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + mm + ' ' + ap;
};
function PrayerScreen() {
  const [bells, setBells] = useScState({
    Fajr: true,
    Shurūq: false,
    Zuhr: true,
    'ʿAsr': true,
    Maghrib: true,
    'ʿIshāʾ': false
  });
  const [st, setSt] = useScState('ok');
  const next = PROWS.find(r => r[2] > PNOW) || PROWS[0];
  const left = next[2] - PNOW;
  const span = PROWS[5][2] - PROWS[0][2];
  const pct = m => Math.max(0, Math.min(100, (m - PROWS[0][2]) / span * 100));
  const stale = st === 'locating';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '2px 18px 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.1em',
      color: 'var(--text-muted)',
      margin: '4px 0 3px'
    }
  }, "NEXT PRAYER"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '650 28px var(--font-ui)',
      letterSpacing: '-.02em',
      opacity: stale ? 0.35 : 1
    }
  }, Math.floor(left / 60), " h ", left % 60, " m"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 15px var(--font-ui)',
      color: 'var(--text-muted)',
      opacity: stale ? 0.35 : 1
    }
  }, next[0]), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 13,
      color: 'var(--text-faint)',
      opacity: stale ? 0.35 : 1
    }
  }, p12(next[2]))), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      lineHeight: 1.5,
      color: 'var(--text-faint)',
      marginTop: 5
    }
  }, st === 'denied' ? 'Jeddah · your last saved city · Umm al-Qura' : 'Jeddah, Saudi Arabia · Umm al-Qura · computed on your device'), st === 'locating' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 12,
      padding: '11px 13px',
      borderRadius: 'var(--r-lg)',
      background: 'var(--elev)',
      border: '1px solid var(--elev-border)'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 15,
      height: 15,
      borderRadius: '50%',
      border: '2px solid var(--line)',
      borderTopColor: 'var(--accent)',
      animation: 'mspin 800ms linear infinite',
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11.5px/1.5 var(--font-ui)',
      color: 'var(--text-muted)'
    }
  }, "Finding where you are \u2014 showing yesterday\u2019s times until it lands.")), st === 'denied' && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      padding: '12px 13px',
      borderRadius: 'var(--r-lg)',
      background: 'color-mix(in srgb,var(--gold) 10%,transparent)',
      border: '1px solid color-mix(in srgb,var(--gold) 45%,transparent)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 9,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'var(--gold-ink)',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      flex: 'none',
      marginTop: 1
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 8v5M12 16.5v.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11.5px/1.5 var(--font-ui)',
      color: 'var(--ink)'
    }
  }, "Location is off, so these are the times for the last city you saved. Prayer alerts stay accurate for Jeddah only.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      marginTop: 11
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "mbtn",
    style: {
      minHeight: 44,
      fontSize: 13
    }
  }, "Turn on location"), /*#__PURE__*/React.createElement("button", {
    className: "mghost",
    style: {
      minHeight: 44,
      fontSize: 13
    }
  }, "Choose a city"))), st === 'offline' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 12,
      padding: '11px 13px',
      borderRadius: 'var(--r-lg)',
      background: 'var(--elev)',
      border: '1px solid var(--elev-border)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'var(--green)',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 3l7 6v11H5V9zM9.5 20v-4.5a2.5 2.5 0 0 1 5 0V20"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11.5px/1.5 var(--font-ui)',
      color: 'var(--text-muted)'
    }
  }, "No connection \u2014 and none needed. Times are computed on your device.")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      height: 30,
      margin: '20px 2px 20px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 13,
      left: 0,
      right: 0,
      height: 2,
      borderRadius: 2,
      background: 'var(--line)'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 13,
      left: 0,
      width: pct(PNOW) + '%',
      height: 2,
      borderRadius: 2,
      background: 'var(--ink)'
    }
  }), PROWS.map(([n,, m]) => {
    const done = m < PNOW,
      isNext = n === next[0];
    return /*#__PURE__*/React.createElement("span", {
      key: n,
      style: {
        position: 'absolute',
        top: 0,
        left: `calc(${pct(m)}% )`,
        transform: 'translateX(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: isNext ? 9 : 7,
        height: isNext ? 9 : 7,
        marginTop: isNext ? 9 : 10,
        borderRadius: '50%',
        boxSizing: 'border-box',
        background: done ? 'var(--gold)' : 'var(--bg)',
        border: done ? 'none' : '1.5px solid ' + (isNext ? 'var(--gold)' : 'var(--line)')
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "mc",
      style: {
        marginTop: 4,
        fontSize: 10,
        fontWeight: 700,
        color: 'var(--gold-ink)',
        whiteSpace: 'nowrap',
        opacity: isNext ? 1 : 0
      }
    }, n));
  })), /*#__PURE__*/React.createElement("div", null, PROWS.map(([n, ar, m]) => {
    const done = m < PNOW,
      isNext = n === next[0];
    return /*#__PURE__*/React.createElement("div", {
      key: n,
      className: "mrow"
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 8,
        width: 120
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: (isNext ? '700' : '500') + ' 15px var(--font-ui)',
        color: done ? 'var(--text-faint)' : 'var(--ink)'
      }
    }, n), isNext && /*#__PURE__*/React.createElement("span", {
      className: "mc",
      style: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '.1em',
        color: 'var(--gold-ink)'
      }
    }, "NEXT")), n === 'Maghrib' && /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        color: 'var(--text-muted)'
      }
    }, /*#__PURE__*/React.createElement("svg", {
      width: "10",
      height: "10",
      viewBox: "0 0 24 24",
      style: {
        fill: 'currentColor'
      }
    }, /*#__PURE__*/React.createElement("path", {
      d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
    })), "Hijri day begins"), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }), /*#__PURE__*/React.createElement("span", {
      className: "mc",
      style: {
        fontSize: 13,
        color: done ? 'var(--text-faint)' : 'var(--ink)'
      }
    }, p12(m)), /*#__PURE__*/React.createElement("button", {
      onClick: () => setBells(s => ({
        ...s,
        [n]: !s[n]
      })),
      style: {
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 0 4px 12px'
      },
      "aria-label": 'Bell ' + n
    }, /*#__PURE__*/React.createElement("svg", {
      width: "15",
      height: "15",
      viewBox: "0 0 24 24",
      style: {
        fill: 'none',
        stroke: bells[n] ? 'var(--text-muted)' : 'var(--text-faint)',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
      }
    }, /*#__PURE__*/React.createElement("path", {
      d: "M6.4 9.6a5.6 5.6 0 0 1 11.2 0c0 4.3 1.8 5.4 1.8 5.4H4.6s1.8-1.1 1.8-5.4z"
    }), /*#__PURE__*/React.createElement("path", {
      d: "M10.2 19.6a2 2 0 0 0 3.6 0"
    }), !bells[n] && /*#__PURE__*/React.createElement("path", {
      d: "M4 4l16 16"
    }))));
  })), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)',
      margin: '12px 0 4px'
    }
  }, "Thursday 14 Mu\u1E25arram 1447 \xB7 Maghrib opens the night of 15"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      margin: '10px 0 14px',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '.1em',
      color: 'var(--text-faint)'
    }
  }, "KIT STATES"), [['ok', 'Normal'], ['locating', 'Locating'], ['denied', 'Denied'], ['offline', 'Offline']].map(([k, l]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setSt(k),
    style: {
      font: '600 11px var(--font-ui)',
      padding: '5px 10px',
      borderRadius: 999,
      cursor: 'pointer',
      border: '1px solid ' + (st === k ? 'var(--line)' : 'transparent'),
      background: st === k ? 'var(--zebra)' : 'transparent',
      color: st === k ? 'var(--ink)' : 'var(--text-faint)'
    }
  }, l))), [['Moon sighting', 'Next crescent expected Fri evening', 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z', 1], ['Date converter', 'Hijri ↔ Gregorian', 'M8 3v3M16 3v3M4 8h16M4 8v11h16V8', 0], ['Share prayer times', 'A clean card for your community', 'M12 3v13M8 7l4-4 4 4M5 14v5h14v-5', 0]].map(([t, s, d, fill]) => /*#__PURE__*/React.createElement("div", {
    key: t,
    className: "mrow"
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    style: {
      fill: fill ? 'var(--text-muted)' : 'none',
      stroke: fill ? 'none' : 'var(--text-muted)',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: d
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 13px var(--font-ui)'
    }
  }, t), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, s), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-faint)',
      marginLeft: 8
    }
  }, "\u203A"))));
}
const MPAGES = {
  14: ['stood long in qiyām; heart present', 'the phone won the morning', 'guard the hour after Fajr'],
  13: ['a good duʿāʾ at Maghrib', 'short temper at ʿaṣr, named it', 'earlier to bed'],
  11: ['read with the kids after ʿishāʾ', 'a slow afternoon', 'wird before inbox'],
  10: ['the fast of ʿĀshūrāʾ — light', 'rushed the adhkār', 'keep the fast unhurried'],
  8: ['the fast held through a hard day', 'work ate the afternoon wird', 'wird before inbox']
};
const MNOPAGE = [4, 9, 12];
const mHasPage = i => i <= 14 && !MNOPAGE.includes(i);
const mFard = i => 3 + i * 2 % 3;
const mSleepBand = i => {
  const bed = 1380 + i % 3 * 14,
    wake = 250 + i % 4 * 10;
  return [Math.max(0, (bed - 1080) / 840 * 100), (wake + 1440 - bed) / 840 * 100];
};
function JournalScreen() {
  const [page, setPage] = useScState(null);
  const nights = [];
  for (let i = 14; i >= 1; i--) nights.push(i);
  const pagesWritten = nights.filter(mHasPage).length;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '4px 4px 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--elev)',
      border: '1px solid var(--elev-border)',
      borderRadius: 'var(--r-lg)',
      padding: '14px 15px',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    style: {
      fill: 'var(--text-muted)'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
  })), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.08em',
      color: 'var(--text-muted)'
    }
  }, "TONIGHT \xB7 THE NIGHT OF 15")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px/1.5 var(--font-ui)',
      marginTop: 8,
      color: 'var(--text-muted)'
    }
  }, "Close the day \u2014 three lines, after \u02BFIsh\u0101\u02BE. What you were grateful for, where you slipped, tomorrow\u2019s intention."), /*#__PURE__*/React.createElement("button", {
    className: "mbtn",
    style: {
      marginTop: 11
    },
    onClick: () => setPage(15)
  }, "Write tonight\u2019s page")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      padding: '0 2px 12px'
    }
  }, [[pagesWritten + ' / 14', 'PAGES WRITTEN'], ['12 / 14', 'ʿAHD · FAJR HELD'], ['6.4 h', 'AVG SLEEP']].map(([v, l]) => /*#__PURE__*/React.createElement("div", {
    key: l,
    style: {
      flex: 1,
      background: 'var(--elev)',
      border: '1px solid var(--elev-border)',
      borderRadius: 'var(--r-lg)',
      padding: '9px 10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '700 16px var(--font-ui)',
      letterSpacing: '-.01em'
    }
  }, v), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.08em',
      color: 'var(--text-faint)',
      marginTop: 2
    }
  }, l)))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8,
      padding: '2px 4px 4px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.18em',
      color: 'var(--text-muted)'
    }
  }, "THIS MONTH"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontFamily: 'var(--font-arabic)',
      fontSize: 13,
      color: 'var(--text-faint)'
    }
  }, "\u0645\u062D\u0627\u0633\u0628\u0629"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, "Maghrib \u2192 Maghrib")), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      display: 'flex',
      gap: 10,
      padding: '0 4px 8px',
      fontSize: 11,
      color: 'var(--text-faint)',
      flexWrap: 'wrap'
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u25AE sleep"), /*#__PURE__*/React.createElement("span", null, "\u25CF far\u1E0D kept"), /*#__PURE__*/React.createElement("span", null, "\xB6 page"), /*#__PURE__*/React.createElement("span", null, "\u2726 \u02BF\u0100sh\u016Br\u0101\u02BE"), /*#__PURE__*/React.createElement("span", null, "\u25D0 white day")), nights.map(i => {
    const has = mHasPage(i),
      today = i === 14,
      ashura = i === 10,
      white = i >= 13 && i <= 15;
    const [bL, bW] = mSleepBand(i),
      kept = mFard(i);
    return /*#__PURE__*/React.createElement("div", {
      key: i,
      onClick: () => setPage(i),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 4px',
        borderBottom: '1px solid var(--zebra)',
        cursor: 'pointer',
        borderLeft: '2px solid ' + (today ? 'var(--gold)' : 'transparent'),
        paddingLeft: today ? 8 : 4
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 40,
        flex: 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'baseline',
        gap: 3
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: '800 15px var(--font-ui)',
        color: today ? 'var(--gold-ink)' : 'var(--ink)'
      }
    }, i), ashura && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: 'var(--gold-ink)'
      }
    }, "\u2726"), white && !ashura && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        color: 'var(--gold-ink)'
      }
    }, "\u25D0")), /*#__PURE__*/React.createElement("span", {
      className: "mc",
      style: {
        fontSize: 11,
        color: 'var(--text-faint)'
      }
    }, mGreg(i).slice(4))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 5
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        font: 'italic 400 12px var(--font-quote)',
        color: has ? 'var(--text-muted)' : 'var(--text-faint)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, has ? MPAGES[i] ? MPAGES[i][0] : MJOT[i] || 'a page was written' : 'no page — the night passed quietly'), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'relative',
        height: 5,
        background: 'var(--zebra)',
        borderRadius: 3,
        overflow: 'hidden'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: bL + '%',
        width: bW + '%',
        background: 'var(--accent)',
        opacity: 0.55
      }
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 2.5,
        flex: 'none'
      }
    }, [0, 1, 2, 3, 4].map(x => /*#__PURE__*/React.createElement("span", {
      key: x,
      style: {
        width: 5,
        height: 5,
        borderRadius: '50%',
        boxSizing: 'border-box',
        background: x < kept ? 'var(--green)' : 'transparent',
        border: x < kept ? 'none' : '1px solid var(--line)'
      }
    }))), /*#__PURE__*/React.createElement("span", {
      style: {
        font: '800 12px var(--font-ui)',
        color: has ? 'var(--accent)' : 'transparent',
        width: 10,
        flex: 'none',
        textAlign: 'center'
      }
    }, "\xB6"));
  }), page !== null && /*#__PURE__*/React.createElement(Sheet, {
    onClose: () => setPage(null)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 17px var(--font-ui)'
    }
  }, page, " Mu\u1E25arram"), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, mGreg(page)), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), page > 14 && /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '.1em',
      padding: '3px 9px',
      border: '1.5px solid var(--gold)',
      color: 'var(--text-muted)',
      borderRadius: 4,
      transform: 'rotate(-3deg)'
    }
  }, "TONIGHT"), page <= 14 && /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '.1em',
      padding: '3px 9px',
      border: '1.5px solid var(--green)',
      color: 'var(--green)',
      borderRadius: 4,
      transform: 'rotate(-3deg)'
    }
  }, "CONFIRMED")), /*#__PURE__*/React.createElement(JournalPage, {
    page: page,
    written: mHasPage(page)
  }))));
}
const JPLACE = ['a small mercy you noticed today…', 'where the day got away from you…', 'one thing to hold onto tomorrow…'];
function JournalPage({
  page,
  written
}) {
  const seed = written ? MPAGES[page] || ['a small mercy, noted', 'a slow afternoon', 'earlier to bed'] : ['', '', ''];
  const [vals, setVals] = useScState(seed);
  useScEffect(() => {
    setVals(written ? MPAGES[page] || ['a small mercy, noted', 'a slow afternoon', 'earlier to bed'] : ['', '', '']);
  }, [page, written]);
  const rows = [['GRATEFUL', 'var(--green)'], ['SLIPPED', 'var(--text-muted)'], ['INTENTION', 'var(--accent)']];
  const anyText = vals.some(v => v.trim());
  const future = page > 14;
  const record = future ? 'The night begins at Maghrib 18:52 · fast tomorrow ~14 h 40 m' : mFard(page) + ' of 5 in jamāʿah · slept ' + (6 + page % 4 * 0.2).toFixed(1) + ' h · fast held';
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2
    }
  }, rows.map(([l, c], j) => /*#__PURE__*/React.createElement("label", {
    key: l,
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 10,
      borderBottom: '1px solid var(--zebra)',
      padding: '9px 2px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 800,
      letterSpacing: '.08em',
      color: c,
      width: 64,
      flex: 'none'
    }
  }, l), /*#__PURE__*/React.createElement("input", {
    value: vals[j],
    onChange: e => setVals(v => v.map((x, k) => k === j ? e.target.value : x)),
    placeholder: JPLACE[j],
    style: {
      flex: 1,
      background: 'none',
      border: 'none',
      outline: 'none',
      font: '400 14.5px var(--font-quote)',
      color: 'var(--ink)',
      padding: 0
    }
  })))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.08em',
      color: 'var(--text-muted)'
    }
  }, "THE NIGHT\u2019S RECORD"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 11.5px/1.55 var(--font-ui)',
      color: 'var(--text-muted)',
      marginTop: 4
    }
  }, record)), !future && /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'color-mix(in srgb,var(--accent) 12%,transparent)',
      borderRadius: 'var(--r-lg)',
      padding: '11px 13px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.08em',
      color: 'var(--accent)'
    }
  }, "CARRIED FORWARD"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/1.55 var(--font-quote)',
      marginTop: 4
    }
  }, "\u201CThe hour after Fajr\u201D \u2014 named on 6 pages this month. It carries into tonight\u2019s intention until a clean week clears it.")), /*#__PURE__*/React.createElement("div", {
    style: {
      font: 'italic 400 12px var(--font-quote)',
      color: 'var(--text-muted)',
      borderTop: '1px solid var(--line)',
      paddingTop: 10,
      marginTop: 2
    }
  }, "\u201CWhere was my heart during prayer?\u201D"), /*#__PURE__*/React.createElement("button", {
    className: anyText ? 'mbtn' : 'mghost',
    style: {
      marginTop: 4,
      alignSelf: 'flex-start',
      opacity: anyText ? 1 : 0.6
    }
  }, written ? 'Save changes' : anyText ? 'Seal tonight’s page' : 'Nothing written yet'));
}
function TasksScreen({
  toast
}) {
  const [filter, setFilter] = useScState('All');
  const [tasks, setTasks] = useScState([{
    id: 1,
    done: 0,
    group: 'OVERDUE',
    title: 'Return library book',
    sub: 'was due 12 Muḥarram',
    late: 1
  }, {
    id: 2,
    done: 0,
    group: 'TODAY · 14 MUḤARRAM',
    title: 'Pay zakat',
    sub: 'today · before Maghrib'
  }, {
    id: 3,
    done: 0,
    group: 'UPCOMING',
    title: 'Read Surah al-Kahf',
    sub: 'Fri 15 Muḥarram'
  }, {
    id: 4,
    done: 0,
    group: 'UPCOMING',
    title: 'Book Madinah hotel',
    sub: '22 Muḥarram'
  }, {
    id: 5,
    done: 0,
    group: 'UPCOMING',
    title: 'Renew passport',
    sub: ''
  }, {
    id: 6,
    done: 1,
    group: 'COMPLETED',
    title: 'Order dates for iftar',
    sub: ''
  }]);
  const toggle = id => setTasks(ts => ts.map(t => {
    if (t.id === id) {
      if (!t.done) toast('Done — ' + t.title);
      return {
        ...t,
        done: t.done ? 0 : 1
      };
    }
    return t;
  }));
  const groups = ['OVERDUE', 'TODAY · 14 MUḤARRAM', 'UPCOMING', 'COMPLETED'];
  const visible = t => filter === 'All' ? true : filter === 'Today' ? t.group.startsWith('TODAY') : t.group === 'UPCOMING';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '2px 18px 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      margin: '4px 0 14px'
    }
  }, ['All', 'Today', 'Scheduled'].map(f => /*#__PURE__*/React.createElement("button", {
    key: f,
    onClick: () => setFilter(f),
    style: {
      fontSize: 12,
      fontWeight: 600,
      padding: '7px 15px',
      borderRadius: 999,
      border: '1px solid ' + (filter === f ? 'var(--line)' : 'transparent'),
      background: filter === f ? 'var(--zebra)' : 'transparent',
      color: filter === f ? 'var(--ink)' : 'var(--text-faint)',
      cursor: 'pointer'
    }
  }, f))), groups.map(g => {
    const items = tasks.filter(t => t.group === g && visible(t));
    if (!items.length) return null;
    const over = g === 'OVERDUE';
    return /*#__PURE__*/React.createElement("div", {
      key: g,
      style: {
        marginBottom: 18
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "mc",
      style: {
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '.08em',
        color: over ? 'var(--alert)' : 'var(--text-muted)',
        marginBottom: 9
      }
    }, g), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 9
      }
    }, items.map(t => /*#__PURE__*/React.createElement("div", {
      key: t.id,
      onClick: () => toggle(t.id),
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        padding: '13px 14px',
        background: 'var(--elev)',
        border: '1px solid ' + (over ? 'color-mix(in srgb,var(--alert) 30%,var(--elev-border))' : 'var(--elev-border)'),
        borderRadius: 'var(--r-lg)',
        cursor: 'pointer'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 19,
        height: 19,
        borderRadius: '50%',
        border: '1.6px solid ' + (t.done ? 'var(--green)' : over ? 'var(--alert)' : 'var(--text-faint)'),
        background: t.done ? 'var(--green)' : 'transparent',
        boxSizing: 'border-box',
        flex: 'none',
        display: 'grid',
        placeItems: 'center'
      }
    }, t.done ? /*#__PURE__*/React.createElement("svg", {
      width: "11",
      height: "11",
      viewBox: "0 0 24 24",
      style: {
        fill: 'none',
        stroke: 'var(--bg)',
        strokeWidth: 3,
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
      }
    }, /*#__PURE__*/React.createElement("path", {
      d: "M20 6L9 17l-5-5"
    })) : null), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0,
        flex: 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        font: '600 14px var(--font-ui)',
        color: t.done ? 'var(--text-faint)' : 'var(--ink)',
        textDecoration: t.done ? 'line-through' : 'none'
      }
    }, t.title), t.sub && /*#__PURE__*/React.createElement("div", {
      className: "mc",
      style: {
        fontSize: 11,
        color: over ? 'var(--alert)' : 'var(--text-faint)',
        marginTop: 2
      }
    }, t.sub))))));
  }), !tasks.some(visible) && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '46px 10px',
      textAlign: 'center'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font-ui)',
      color: 'var(--text-muted)'
    }
  }, filter === 'Today' ? 'Nothing due today' : 'Nothing scheduled'), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/1.6 var(--font-ui)',
      color: 'var(--text-faint)',
      marginTop: 5,
      maxWidth: 240,
      marginLeft: 'auto',
      marginRight: 'auto'
    }
  }, filter === 'Today' ? 'The day is yours. Add something with ＋, or anchor it to a prayer.' : 'Tasks you give a day — or a prayer — appear here.')), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)',
      marginTop: 2
    }
  }, "Tasks can anchor to a prayer instead of a clock time \u2014 they move with the day\u2019s light."));
}
const MTHEMES = [['Night', null, '#141414'], ['Graphite', 'graphite', '#161616'], ['Ash', 'ash', '#232327'], ['Parchment', 'parchment', '#f2efe6'], ['Paper', 'paper', '#f4f3f0']];
const MACCENTS = [['Sea glass', null, '#8fbcb0'], ['Lavender', 'lavender', '#a493d6'], ['Gold', 'gold', '#c9a45e'], ['Slate', 'slate', '#93a7c4']];
function SettingsScreen({
  toast,
  onWidgets,
  onReplay
}) {
  const [theme, setTheme] = useScState(document.documentElement.getAttribute('data-theme'));
  const [accent, setAccent] = useScState(document.documentElement.getAttribute('data-accent'));
  const [openAppr, setOpenAppr] = useScState(false);
  const applyT = t => {
    setTheme(t);
    t ? document.documentElement.setAttribute('data-theme', t) : document.documentElement.removeAttribute('data-theme');
  };
  const applyA = a => {
    setAccent(a);
    a ? document.documentElement.setAttribute('data-accent', a) : document.documentElement.removeAttribute('data-accent');
  };
  const cap = {
    font: '700 11px var(--font-mono)',
    letterSpacing: '.08em',
    color: 'var(--text-muted)'
  };
  const Ic = ({
    d,
    fill
  }) => /*#__PURE__*/React.createElement("svg", {
    width: "17",
    height: "17",
    viewBox: "0 0 24 24",
    style: {
      fill: fill ? 'var(--text-muted)' : 'none',
      stroke: fill ? 'none' : 'var(--text-muted)',
      strokeWidth: 1.7,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: d
  }));
  const Row = ({
    icon,
    fill,
    title,
    val,
    onClick,
    children
  }) => /*#__PURE__*/React.createElement("button", {
    onClick: onClick,
    style: {
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 13,
      padding: '14px 15px',
      background: 'var(--elev)',
      border: 'none',
      borderBottom: '1px solid var(--zebra)',
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement(Ic, {
    d: icon,
    fill: fill
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 13.5px var(--font-ui)',
      color: 'var(--ink)',
      flex: 'none'
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), children || /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)',
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: 140
    }
  }, val), /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-faint)',
      flex: 'none'
    }
  }, "\u203A"));
  const grp = {
    borderRadius: 'var(--r-lg)',
    overflow: 'hidden',
    border: '1px solid var(--elev-border)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '2px 18px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...grp,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement(Row, {
    icon: "M4 6h16M4 12h16M4 18h10",
    title: "General",
    val: "View, language, time format",
    onClick: () => toast('General settings')
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement(Row, {
    icon: "M12 3a6.5 6.5 0 0 0 8.5 8.5A9 9 0 1 1 12 3z",
    fill: true,
    title: "Appearance",
    val: (MTHEMES.find(t => t[1] === theme) || MTHEMES[0])[0] + ' · ' + (MACCENTS.find(a => a[1] === accent) || MACCENTS[0])[0],
    onClick: () => setOpenAppr(o => !o)
  }), openAppr && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: '12px 15px 16px',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--zebra)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: cap
  }, "THEME"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'grid',
      gridTemplateColumns: 'repeat(5,1fr)',
      gap: 6,
      margin: '8px 0 14px'
    }
  }, MTHEMES.map(([name, attr, bg]) => /*#__PURE__*/React.createElement("button", {
    key: name,
    onClick: () => applyT(attr),
    style: {
      cursor: 'pointer',
      background: bg,
      border: '1.5px solid ' + (theme === attr ? 'var(--accent)' : 'var(--line)'),
      borderRadius: 'var(--r-sm)',
      padding: '16px 3px 7px',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 11px var(--font-ui)',
      color: bg < '#8' ? '#e7e5e1' : '#26231d'
    }
  }, name)))), /*#__PURE__*/React.createElement("div", {
    style: cap
  }, "ACCENT"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 6,
      margin: '8px 0 0',
      flexWrap: 'wrap'
    }
  }, MACCENTS.map(([name, attr, c]) => /*#__PURE__*/React.createElement("button", {
    key: name,
    onClick: () => applyA(attr),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      cursor: 'pointer',
      background: accent === attr ? 'var(--zebra)' : 'none',
      border: '1px solid ' + (accent === attr ? 'var(--line)' : 'transparent'),
      borderRadius: 999,
      padding: '5px 10px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: '50%',
      background: c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11px var(--font-ui)',
      color: 'var(--text-muted)'
    }
  }, name)))))), /*#__PURE__*/React.createElement(Row, {
    icon: "M12 3l7 6v11H5V9zM9.5 20v-4.5a2.5 2.5 0 0 1 5 0V20",
    title: "Location & prayer times",
    val: "Jeddah \xB7 Umm al-Qura",
    onClick: () => toast('Location & method')
  }), /*#__PURE__*/React.createElement(Row, {
    icon: "M12 3a6.5 6.5 0 0 0 8.5 8.5A9 9 0 1 1 12 3z",
    fill: true,
    title: "Calendar authority",
    val: "Umm al-Qura",
    onClick: () => toast('Umm al-Qura · Diyanet · local committee · calculated')
  }), /*#__PURE__*/React.createElement(Row, {
    icon: "M4 5h16v15H4zM4 9h16M8 3v4M16 3v4",
    title: "My calendars",
    val: "Personal, Work, Family",
    onClick: () => toast('Personal · Work · Family · Deen')
  }), /*#__PURE__*/React.createElement(Row, {
    icon: "M4 6h16M4 12h16M4 18h16",
    title: "View options",
    val: "Week numbers, Maghrib flip",
    onClick: () => toast('View options')
  }), /*#__PURE__*/React.createElement(Row, {
    icon: "M6.4 9.6a5.6 5.6 0 0 1 11.2 0c0 4.3 1.8 5.4 1.8 5.4H4.6s1.8-1.1 1.8-5.4zM10.2 19.6a2 2 0 0 0 3.6 0",
    title: "Notifications",
    onClick: () => toast('Prayer alerts, sighting nights, reminders')
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: 'var(--green)'
    }
  }, "ON"))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...cap,
      marginBottom: 8
    }
  }, "DATA"), /*#__PURE__*/React.createElement("div", {
    style: grp
  }, /*#__PURE__*/React.createElement(Row, {
    icon: "M4 4v6h6M20 20v-6h-6M20 9a8 8 0 0 0-14-3M4 15a8 8 0 0 0 14 3",
    title: "Account & sync",
    val: "This device only",
    onClick: () => toast('Local-first — nothing leaves your device by default')
  }), /*#__PURE__*/React.createElement(Row, {
    icon: "M12 3v13M8 7l4-4 4 4M5 20h14",
    title: "Import & export",
    onClick: onWidgets
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, "Google connected")), /*#__PURE__*/React.createElement(Row, {
    icon: "M4 4v6h6M20 9a8 8 0 0 0-14-3",
    title: "Replay first run",
    val: "location \xB7 calendar \xB7 sync",
    onClick: onReplay
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: 'center',
      font: '400 11px var(--font-ui)',
      color: 'var(--text-faint)',
      marginTop: 22
    }
  }, "Hijri First \xB7 free, private, no ads"));
}

/* ===== First run — rebuilt 2026-07-28 =====
   V1 asserted Jeddah + Umm al-Qura without ever asking, so first launch could not be truthful
   (F11). Four steps, warm rather than procedural: welcome · make it yours (the two answers that set
   every date and time) · today, revealed, with a sighting adjustment and the Hijri-birthday moment
   · sync, which is genuinely skippable. Structure follows the flow the owner pointed at; the type,
   colour, chrome and copy are Daftar's. */
const OB_AUTH = [['Umm al-Qura', 'Calculated · Saudi Arabia and most apps'], ['Local sighting committee', 'Follows your community’s announcement'], ['Diyanet', 'Türkiye’s calendar']];
const OBCrescent = ({
  size = 64,
  o = 1
}) => /*#__PURE__*/React.createElement("svg", {
  viewBox: "0 0 100 100",
  width: size,
  height: size,
  style: {
    display: 'block',
    opacity: o
  },
  "aria-hidden": "true"
}, /*#__PURE__*/React.createElement("defs", null, /*#__PURE__*/React.createElement("mask", {
  id: 'obm' + size
}, /*#__PURE__*/React.createElement("rect", {
  width: "100",
  height: "100",
  fill: "#fff"
}), /*#__PURE__*/React.createElement("circle", {
  cx: "64",
  cy: "40",
  r: "34",
  fill: "#000"
}))), /*#__PURE__*/React.createElement("circle", {
  cx: "50",
  cy: "50",
  r: "40",
  fill: "var(--gold)",
  mask: `url(#obm${size})`
}));
function MOnboarding({
  onClose
}) {
  const [step, setStep] = useScState(0);
  const [city, setCity] = useScState(null);
  const [auth, setAuth] = useScState(0);
  const [adjust, setAdjust] = useScState(false);
  const [picked, setPicked] = useScState(null);
  const [bday, setBday] = useScState(false);
  const [dob, setDob] = useScState('');
  const [signin, setSignin] = useScState(null);
  const finish = () => {
    try {
      localStorage.setItem('daftar_m_onboarded_v1', '1');
    } catch (e) {}
    onClose();
  };
  const h1 = {
    font: '650 25px var(--font-ui)',
    letterSpacing: '-.02em',
    color: 'var(--ink)',
    lineHeight: 1.2,
    margin: 0
  };
  const lead = {
    font: '400 13px/1.65 var(--font-ui)',
    color: 'var(--text-muted)',
    margin: 0
  };
  const cap = {
    font: '700 11px var(--font-mono)',
    letterSpacing: '.1em',
    color: 'var(--text-faint)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 60,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column',
      padding: '58px 24px 20px',
      boxSizing: 'border-box',
      overflow: 'hidden'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: -110,
      right: -100,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement(OBCrescent, {
    size: 320,
    o: 0.05
  })), /*#__PURE__*/React.createElement("div", {
    key: step,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      animation: 'rise 320ms var(--ease-settle)'
    }
  }, step === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: 17
    }
  }, /*#__PURE__*/React.createElement(OBCrescent, {
    size: 74
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '650 29px var(--font-ui)',
      letterSpacing: '-.02em',
      lineHeight: 1.25,
      color: 'var(--ink)'
    }
  }, "Your calendar,", /*#__PURE__*/React.createElement("br", null), "Hijri first."), /*#__PURE__*/React.createElement("p", {
    style: {
      ...lead,
      maxWidth: 286
    }
  }, "Plan by Mu\u1E25arram and Rama\u1E0D\u0101n \u2014 the civil date stays quietly alongside. Your prayers, your pages, and your word to yourself in one place."), /*#__PURE__*/React.createElement("button", {
    className: "mbtn",
    style: {
      minWidth: 210,
      marginTop: 4
    },
    onClick: () => setStep(1)
  }, "Get started"), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, "about 30 seconds \xB7 free, no ads")), step === 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0
    }
  }, /*#__PURE__*/React.createElement("h2", {
    style: h1
  }, "Make it yours"), /*#__PURE__*/React.createElement("p", {
    style: {
      ...lead,
      margin: '7px 0 20px'
    }
  }, "Two answers set every date and prayer time. Both stay on this device."), /*#__PURE__*/React.createElement("div", {
    style: cap
  }, "YOUR LOCATION"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setCity(c => c ? null : 'Jeddah, Saudi Arabia'),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 11,
      minHeight: 50,
      padding: '0 14px',
      margin: '8px 0 20px',
      borderRadius: 'var(--r-lg)',
      cursor: 'pointer',
      border: '1px solid ' + (city ? 'var(--accent)' : 'var(--elev-border)'),
      background: city ? 'var(--accent-soft)' : 'var(--elev)',
      font: '600 13.5px var(--font-ui)',
      color: 'var(--ink)',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 9,
      height: 9,
      borderRadius: '50% 50% 50% 0',
      border: '2px solid ' + (city ? 'var(--accent)' : 'var(--text-faint)'),
      transform: 'rotate(-45deg)',
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, city || 'Use my location'), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)',
      flex: 'none'
    }
  }, city ? 'Maghrib 6:52 PM' : 'asks once')), /*#__PURE__*/React.createElement("div", {
    style: cap
  }, "WHOSE CALENDAR"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      marginTop: 8
    }
  }, OB_AUTH.map(([name, desc], i) => {
    const on = auth === i;
    return /*#__PURE__*/React.createElement("button", {
      key: i,
      onClick: () => setAuth(i),
      style: {
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        textAlign: 'left',
        padding: '12px 13px',
        minHeight: 48,
        borderRadius: 'var(--r-lg)',
        cursor: 'pointer',
        border: '1px solid ' + (on ? 'var(--accent)' : 'var(--elev-border)'),
        background: on ? 'var(--accent-soft)' : 'var(--elev)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 17,
        height: 17,
        borderRadius: '50%',
        flex: 'none',
        boxSizing: 'border-box',
        border: '2px solid ' + (on ? 'var(--accent)' : 'var(--text-faint)'),
        display: 'grid',
        placeItems: 'center'
      }
    }, on && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: 'var(--accent)'
      }
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        font: '600 13.5px var(--font-ui)',
        color: 'var(--ink)'
      }
    }, name, i === 0 && city && /*#__PURE__*/React.createElement("span", {
      className: "mc",
      style: {
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '.07em',
        color: 'var(--gold-ink)',
        border: '1px solid var(--gold)',
        borderRadius: 999,
        padding: '2px 7px',
        marginLeft: 8
      }
    }, "SUGGESTED")), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'block',
        font: '400 11.5px var(--font-ui)',
        color: 'var(--text-faint)',
        marginTop: 2
      }
    }, desc)));
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '400 11px/1.5 var(--font-ui)',
      color: 'var(--text-faint)',
      marginTop: 12
    }
  }, "Change either of these any time in Settings. Dates near month ends stay marked provisional until the crescent is called."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      marginTop: 'auto',
      paddingTop: 16
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "mghost",
    style: {
      border: 'none'
    },
    onClick: () => setStep(2)
  }, "Skip"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "mbtn",
    onClick: () => setStep(2)
  }, "Continue"))), step === 2 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: 13
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.12em',
      color: 'var(--text-faint)'
    }
  }, "TODAY IS"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '650 34px var(--font-ui)',
      letterSpacing: '-.02em',
      lineHeight: 1.15,
      color: 'var(--ink)'
    }
  }, picked || '14 Muḥarram', /*#__PURE__*/React.createElement("br", null), "1447 AH"), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11.5,
      color: 'var(--text-muted)'
    }
  }, "Thursday 9 July 2026 \xB7 following ", OB_AUTH[auth][0]), !adjust && !picked && /*#__PURE__*/React.createElement("button", {
    onClick: () => setAdjust(true),
    style: {
      background: 'none',
      border: 'none',
      font: '500 11.5px var(--font-ui)',
      color: 'var(--accent)',
      cursor: 'pointer',
      padding: 6
    }
  }, "My community observes a different day \u203A"), adjust && !picked && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      width: '100%',
      maxWidth: 300
    }
  }, [['A DAY BEHIND', '13 Muḥarram'], ['A DAY AHEAD', '15 Muḥarram']].map(([c, d]) => /*#__PURE__*/React.createElement("button", {
    key: c,
    onClick: () => {
      setPicked(d);
      setAdjust(false);
    },
    style: {
      flex: 1,
      padding: '10px 12px',
      minHeight: 48,
      borderRadius: 'var(--r-lg)',
      border: '1px solid var(--elev-border)',
      background: 'var(--elev)',
      cursor: 'pointer',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '.08em',
      color: 'var(--text-faint)'
    }
  }, c), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 14px var(--font-ui)',
      color: 'var(--ink)',
      marginTop: 3
    }
  }, d)))), picked && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 11.5px var(--font-ui)',
      color: 'var(--gold-ink)'
    }
  }, "Adjusted \u2014 today is ", picked, " for you. ", /*#__PURE__*/React.createElement("button", {
    onClick: () => setPicked(null),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--text-faint)',
      cursor: 'pointer',
      font: 'inherit',
      textDecoration: 'underline',
      padding: 0
    }
  }, "undo")), !bday ? /*#__PURE__*/React.createElement("button", {
    onClick: () => setBday(true),
    style: {
      background: 'none',
      border: 'none',
      font: '600 12.5px var(--font-ui)',
      color: 'var(--accent)',
      cursor: 'pointer',
      padding: 8
    }
  }, "Curious? Find your Hijri birthday \u203A") : /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      maxWidth: 300,
      padding: '13px 14px',
      borderRadius: 'var(--r-lg)',
      background: 'var(--elev)',
      border: '1px solid var(--elev-border)',
      textAlign: 'left'
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "date",
    value: dob,
    onChange: e => setDob(e.target.value),
    className: "minput",
    style: {
      width: '100%',
      colorScheme: 'dark'
    }
  }), dob.length === 10 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '650 18px var(--font-ui)',
      color: 'var(--ink)'
    }
  }, "17 Rama\u1E0D\u0101n 1415"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11.5px/1.5 var(--font-ui)',
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, "Thirty-two Hijri years \u2014 we can keep it in your calendar, every Hijri year."))), /*#__PURE__*/React.createElement("button", {
    className: "mbtn",
    style: {
      minWidth: 216,
      marginTop: 6
    },
    onClick: () => setStep(3)
  }, "Continue")), step === 3 && /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      gap: 15
    }
  }, /*#__PURE__*/React.createElement(OBCrescent, {
    size: 52
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '650 24px var(--font-ui)',
      letterSpacing: '-.02em',
      lineHeight: 1.25,
      color: 'var(--ink)'
    }
  }, "One calendar,", /*#__PURE__*/React.createElement("br", null), "everywhere you are"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      textAlign: 'left',
      maxWidth: 292,
      width: '100%'
    }
  }, [['Nothing lost', 'Events are kept the moment you add them'], ['Every device', 'Phone, laptop, tablet — the same calendar'], ['Private by design', 'Encrypted before it leaves this device — we cannot read your pages']].map(([h, d]) => /*#__PURE__*/React.createElement("div", {
    key: h,
    style: {
      display: 'flex',
      gap: 11,
      alignItems: 'flex-start'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "15",
    height: "15",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'var(--green)',
      strokeWidth: 2.6,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      flex: 'none',
      marginTop: 2
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6L9 17l-5-5"
  })), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: '600 13px var(--font-ui)',
      color: 'var(--ink)'
    }
  }, h), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'block',
      font: '400 11.5px/1.45 var(--font-ui)',
      color: 'var(--text-faint)'
    }
  }, d))))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      width: '100%',
      maxWidth: 300,
      marginTop: 2
    }
  }, ['Continue with Google', 'Continue with Apple'].map(l => /*#__PURE__*/React.createElement("button", {
    key: l,
    onClick: () => {
      setSignin('ing');
      setTimeout(() => setSignin('done'), 1100);
    },
    className: "mghost",
    style: {
      width: '100%'
    }
  }, l))), /*#__PURE__*/React.createElement("button", {
    onClick: finish,
    style: {
      background: 'none',
      border: 'none',
      font: '500 12.5px var(--font-ui)',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      padding: 8
    }
  }, "Not now \u2014 keep everything on this device"))), signin && /*#__PURE__*/React.createElement(MSignin, {
    state: signin,
    onDone: finish,
    onBack: () => setSignin(null)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      justifyContent: 'center',
      paddingTop: 14,
      flex: 'none'
    }
  }, [0, 1, 2, 3].map(i => /*#__PURE__*/React.createElement("button", {
    key: i,
    onClick: () => setStep(i),
    "aria-label": 'Step ' + (i + 1),
    style: {
      width: i === step ? 20 : 6,
      height: 6,
      padding: 0,
      borderRadius: 999,
      border: 'none',
      cursor: 'pointer',
      background: i === step ? 'var(--ink)' : 'var(--line)',
      transition: 'width 160ms var(--ease-settle)'
    }
  }))));
}
function MSignin({
  state,
  onDone,
  onBack
}) {
  const done = state === 'done';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 70,
      display: 'grid',
      placeItems: 'center',
      background: 'rgba(0,0,0,.6)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 288,
      borderRadius: 'var(--r-lg)',
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      padding: '28px 22px 22px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      textAlign: 'center',
      gap: 12,
      animation: 'rise 260ms var(--ease-settle)'
    }
  }, !done ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 50,
      height: 50,
      borderRadius: '50%',
      border: '2.5px solid var(--line)',
      borderTopColor: 'var(--accent)',
      animation: 'mspin 800ms linear infinite'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 15px var(--font-ui)'
    }
  }, "Connecting\u2026"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11.5px/1.5 var(--font-ui)',
      color: 'var(--text-muted)'
    }
  }, "Your events are encrypted before they leave this device.")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 50,
      height: 50,
      borderRadius: '50%',
      background: 'color-mix(in srgb,var(--green) 18%,transparent)',
      display: 'grid',
      placeItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "24",
    height: "24",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'var(--green)',
      strokeWidth: 2.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6L9 17l-5-5"
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '650 18px var(--font-ui)'
    }
  }, "You\u2019re in"), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 12px/1.55 var(--font-ui)',
      color: 'var(--text-muted)'
    }
  }, "Signed in as ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: 'var(--ink)'
    }
  }, "amina.k@gmail.com"), " \u2014 your calendar follows you across devices."), /*#__PURE__*/React.createElement("button", {
    className: "mbtn",
    style: {
      minWidth: 200,
      marginTop: 2
    },
    onClick: onDone
  }, "Open my calendar"), /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      background: 'none',
      border: 'none',
      font: '500 11.5px var(--font-ui)',
      color: 'var(--text-faint)',
      cursor: 'pointer'
    }
  }, "Back"))));
}
function WidgetsScreen({
  onClose
}) {
  const cap = {
    font: '700 11px var(--font-mono)',
    letterSpacing: '.08em',
    color: 'var(--text-muted)'
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'absolute',
      inset: 0,
      zIndex: 55,
      background: 'var(--bg)',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '16px 18px 10px',
      flex: 'none'
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "mghost",
    style: {
      padding: '5px 11px'
    },
    onClick: onClose
  }, "\u2039 Back"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 16px var(--font-ui)'
    }
  }, "Widgets")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: '4px 18px 24px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: cap
  }, "LOCK SCREEN"), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '8px 0 18px',
      borderRadius: 22,
      border: '1px solid var(--line)',
      background: 'linear-gradient(180deg, #101014, #17171c)',
      padding: '26px 18px 22px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'rgba(231,229,225,.55)'
    }
  }, "Monday 2 March \xB7 13 Mu\u1E25arram"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '200 54px/1 var(--font-ui)',
      color: '#e7e5e1',
      letterSpacing: '-.02em'
    }
  }, "13:55"), /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginTop: 8,
      background: 'rgba(0,0,0,.45)',
      border: '1px solid rgba(255,255,255,.08)',
      borderRadius: 999,
      padding: '6px 13px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 11,
      color: 'var(--gold-ink)'
    }
  }, "\u263E"), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: '#e7e5e1'
    }
  }, "\u02BFAsr 15:07 \xB7 in 1 h 12 m")), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'rgba(231,229,225,.4)',
      marginTop: 3
    }
  }, "fast ends at Maghrib 17:45")), /*#__PURE__*/React.createElement("div", {
    style: cap
  }, "SMALL \xB7 TODAY"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 12,
      margin: '8px 0 18px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 148,
      height: 148,
      borderRadius: 24,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      padding: 14,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.08em',
      color: 'var(--text-muted)'
    }
  }, "RAMA\u1E0C\u0100N"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '800 44px/1.1 var(--font-ui)'
    }
  }, "13"), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, "Mon 2 Mar"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-muted)'
    }
  }, "\u02BFAsr 15:07 \xB7 1 h 12 m")), /*#__PURE__*/React.createElement("div", {
    style: {
      width: 148,
      height: 148,
      borderRadius: 24,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      padding: 14,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      gap: 5
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.08em',
      color: 'var(--text-muted)'
    }
  }, "TONIGHT"), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 12.5px/1.45 var(--font-ui)'
    }
  }, "Maghrib ", /*#__PURE__*/React.createElement("b", {
    className: "mc",
    style: {
      fontSize: 11.5
    }
  }, "17:45"), " opens the night of 14"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: 'italic 400 10.5px/1.4 var(--font-quote)',
      color: 'var(--journal-trace)'
    }
  }, "three lines is enough"))), /*#__PURE__*/React.createElement("div", {
    style: cap
  }, "MEDIUM \xB7 PRAYER TIMES"), /*#__PURE__*/React.createElement("div", {
    style: {
      margin: '8px 0 18px',
      borderRadius: 24,
      background: 'var(--surface)',
      border: '1px solid var(--line)',
      padding: '13px 14px',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 7
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '.08em',
      color: 'var(--text-muted)'
    }
  }, "13 RAMA\u1E0C\u0100N \xB7 LONDON"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, "MCW")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      marginTop: 10
    }
  }, [['Fajr', '05:01', 1], ['Dhuhr', '12:17', 1], ['ʿAsr', '15:07', 0], ['Maghrib', '17:45', 0], ['ʿIshāʾ', '19:13', 0]].map(([n, t, done], i) => /*#__PURE__*/React.createElement("span", {
    key: n,
    style: {
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 3,
      padding: '7px 0',
      borderRadius: 10,
      background: i === 2 ? 'var(--accent-soft)' : 'transparent'
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      fontWeight: 700,
      color: done ? 'var(--green)' : i === 2 ? 'var(--accent)' : 'var(--text-faint)'
    }
  }, n.toUpperCase()), /*#__PURE__*/React.createElement("span", {
    className: "mc",
    style: {
      fontSize: 11,
      color: done ? 'var(--text-faint)' : 'var(--ink)'
    }
  }, t))))), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, "Widgets follow the app theme \xB7 lock-screen pill updates at each adhan.")));
}
/* JournalOverlay removed — the journal is a calendar view now, not a side door. */
Object.assign(window, {
  PrayerScreen,
  JournalScreen,
  TasksScreen,
  SettingsScreen,
  MOnboarding,
  MSignin,
  MTgl,
  WidgetsScreen
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/mobile/Screens.jsx", error: String((e && e.message) || e) }); }

// daftar/mobile/Sheets.jsx
try { (() => {
/* Bottom sheets: wrapper, composer, event detail — Daftar mobile kit. */
const {
  useState: useShState,
  useEffect: useShEffect
} = React;
const MCALS = [['p', 'Personal', 'var(--cal-personal)'], ['d', 'Deen', 'var(--cal-deen)'], ['f', 'Family', 'var(--cal-family)'], ['w', 'Work', 'var(--cal-work)']];
const mGreg = d => {
  const g = new Date(2026, 5, 25 + d);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][g.getDay()] + ' ' + g.getDate() + ' ' + g.toLocaleString('en', {
    month: 'short'
  });
};
const mPray = [['Fajr', 312], ['Zuhr', 736], ['ʿAsr', 945], ['Maghrib', 1132], ['ʿIshāʾ', 1220]];
const m12 = min => {
  let h = Math.floor(min / 60),
    mm = String(min % 60).padStart(2, '0');
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return h + ':' + mm + ' ' + ap;
};
const clashOf = (s, e) => {
  for (const [n, m] of mPray) {
    if (n === 'Shurūq') continue;
    if (s < m + 25 && e > m) return [n, m];
  }
  return null;
};
function Sheet({
  onClose,
  title,
  children
}) {
  return /*#__PURE__*/React.createElement("div", {
    className: "msheet-scrim",
    onMouseDown: onClose
  }, /*#__PURE__*/React.createElement("div", {
    className: "msheet",
    onMouseDown: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 36,
      height: 4,
      borderRadius: 2,
      background: 'var(--line)',
      margin: '0 auto 12px'
    },
    onClick: onClose
  }), title && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      font: '700 16px var(--font-ui)'
    }
  }, title), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      width: 30,
      height: 30,
      borderRadius: '50%',
      border: 'none',
      background: 'var(--zebra)',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      display: 'grid',
      placeItems: 'center',
      fontSize: 14
    }
  }, "\u2715")), children));
}
function MSeg({
  options,
  value,
  onChange
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      background: 'var(--zebra)',
      borderRadius: 'var(--r-sm)',
      padding: 3,
      gap: 2,
      width: 'fit-content'
    }
  }, options.map(o => /*#__PURE__*/React.createElement("button", {
    key: o,
    onClick: () => onChange(o),
    style: {
      border: 'none',
      cursor: 'pointer',
      font: '600 12px var(--font-mono)',
      padding: '6px 14px',
      borderRadius: 'var(--r-sm)',
      background: value === o ? 'var(--surface-2)' : 'transparent',
      color: value === o ? 'var(--ink)' : 'var(--text-faint)'
    }
  }, o)));
}
function MComposer({
  day: day0,
  start0,
  edit,
  mName = 'Muḥarram',
  mMax = 30,
  greg = mGreg,
  onSave,
  onClose
}) {
  const [kind, setKind] = useShState(edit && edit.kind === 'Task' ? 'Task' : 'Event');
  const [title, setTitle] = useShState(edit ? edit.title : '');
  const [day, setDay] = useShState(day0 || 14);
  const [allDay, setAllDay] = useShState(edit ? edit.time === 'all-day' : false);
  const [start, setStart] = useShState(edit && /^\d{1,2}:\d{2}$/.test(edit.time) ? edit.time : start0 || '10:00');
  const [pin, setPin] = useShState('hijri');
  const [cal, setCal] = useShState(edit ? edit.k : 'p');
  const [rem, setRem] = useShState('30 min');
  const lbl = {
    font: '700 11px var(--font-mono)',
    letterSpacing: '.08em',
    color: 'var(--text-muted)'
  };
  const sm = /^(\d{1,2}):(\d{2})$/.exec(start);
  const sMin = sm ? +sm[1] * 60 + +sm[2] : null;
  const clash = kind === 'Event' && !allDay && sMin != null ? clashOf(sMin, sMin + 60) : null;
  const canSave = title.trim().length > 0;
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose,
    title: edit ? kind === 'Task' ? 'Edit task' : 'Edit event' : kind === 'Task' ? 'New task' : 'New event'
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 15
    }
  }, !edit && /*#__PURE__*/React.createElement(MSeg, {
    options: ['Event', 'Task'],
    value: kind,
    onChange: setKind
  }), /*#__PURE__*/React.createElement("input", {
    autoFocus: true,
    value: title,
    onChange: e => setTitle(e.target.value),
    placeholder: kind === 'Task' ? 'Add task' : 'Add title',
    style: {
      background: 'none',
      border: 'none',
      borderBottom: '1px solid var(--line)',
      padding: '4px 1px 10px',
      font: '600 17px var(--font-ui)',
      color: 'var(--ink)',
      outline: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 9
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "mghost",
    style: {
      padding: '6px 11px'
    },
    onClick: () => setDay(d => Math.max(1, d - 1)),
    "aria-label": "Previous day"
  }, "\u2039"), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 13.5px var(--font-ui)',
      whiteSpace: 'nowrap'
    }
  }, day, " ", mName, " 1447"), /*#__PURE__*/React.createElement("div", {
    className: "mc",
    style: {
      fontSize: 11,
      color: 'var(--text-faint)'
    }
  }, greg(day))), /*#__PURE__*/React.createElement("button", {
    className: "mghost",
    style: {
      padding: '6px 11px'
    },
    onClick: () => setDay(d => Math.min(mMax, d + 1)),
    "aria-label": "Next day"
  }, "\u203A")), kind === 'Event' && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12
    }
  }, !allDay && /*#__PURE__*/React.createElement("input", {
    type: "time",
    className: "minput mc",
    style: {
      width: 118,
      fontSize: 13
    },
    value: start,
    onChange: e => setStart(e.target.value)
  }), /*#__PURE__*/React.createElement("label", {
    onClick: () => setAllDay(a => !a),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 7,
      font: '500 13px var(--font-ui)',
      color: 'var(--text-muted)',
      cursor: 'pointer',
      minHeight: 44
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 17,
      height: 17,
      borderRadius: 4,
      border: '1.5px solid ' + (allDay ? 'var(--green)' : 'var(--text-faint)'),
      background: allDay ? 'var(--green)' : 'transparent',
      boxSizing: 'border-box',
      display: 'grid',
      placeItems: 'center',
      flex: 'none'
    }
  }, allDay && /*#__PURE__*/React.createElement("svg", {
    width: "10",
    height: "10",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'var(--bg)',
      strokeWidth: 3.5,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M20 6L9 17l-5-5"
  }))), "All-day")), clash && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      background: 'color-mix(in srgb,var(--alert) 12%,transparent)',
      border: '1px solid color-mix(in srgb,var(--alert) 35%,transparent)',
      borderRadius: 'var(--r-sm)',
      padding: '9px 11px'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'var(--alert)',
      strokeWidth: 1.9,
      strokeLinecap: 'round'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 8v5M12 16.5v.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
  })), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '500 11.5px var(--font-ui)',
      color: 'var(--alert)'
    }
  }, "Overlaps ", clash[0], " (", m12(clash[1]), ") \u2014 ", /*#__PURE__*/React.createElement("button", {
    onClick: () => setStart(String(Math.floor((clash[1] + 30) / 60)).padStart(2, '0') + ':' + String((clash[1] + 30) % 60).padStart(2, '0')),
    style: {
      background: 'none',
      border: 'none',
      color: 'var(--alert)',
      textDecoration: 'underline',
      cursor: 'pointer',
      font: 'inherit',
      padding: 0
    }
  }, "move after"))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: lbl
  }, "PIN TO"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      marginTop: 7
    }
  }, [['hijri', 'Hijri', 'moves with the crescent'], ['greg', 'Gregorian', 'fixed to the solar date']].map(([v, t, s]) => /*#__PURE__*/React.createElement("button", {
    key: v,
    onClick: () => setPin(v),
    style: {
      flex: 1,
      textAlign: 'left',
      cursor: 'pointer',
      background: pin === v ? 'var(--accent-soft)' : 'var(--elev)',
      border: '1px solid ' + (pin === v ? 'var(--accent)' : 'var(--elev-border)'),
      borderRadius: 'var(--r-sm)',
      padding: '7px 10px'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '600 12.5px var(--font-ui)',
      color: 'var(--ink)'
    }
  }, t), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '400 11px/1.3 var(--font-ui)',
      color: 'var(--text-faint)',
      marginTop: 1
    }
  }, s))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: lbl
  }, "CALENDAR"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 7,
      marginTop: 8,
      flexWrap: 'wrap'
    }
  }, MCALS.map(([k, name, c]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setCal(k),
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      cursor: 'pointer',
      background: cal === k ? 'var(--zebra)' : 'none',
      border: '1px solid ' + (cal === k ? 'var(--line)' : 'transparent'),
      borderRadius: 999,
      padding: '6px 11px'
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 10,
      height: 10,
      borderRadius: 3,
      background: c
    }
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      font: '600 11.5px var(--font-ui)',
      color: cal === k ? 'var(--ink)' : 'var(--text-faint)'
    }
  }, name))))), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: lbl
  }, "REMIND"), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement(MSeg, {
    options: ['At time', '30 min', '1 hr', 'At Maghrib'],
    value: rem,
    onChange: setRem
  }))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      borderTop: '1px solid var(--line)',
      paddingTop: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "mghost",
    style: {
      flex: 'none'
    },
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement("button", {
    className: "mbtn",
    style: {
      flex: 1,
      opacity: canSave ? 1 : 0.5,
      cursor: canSave ? 'pointer' : 'not-allowed'
    },
    disabled: !canSave,
    onClick: () => canSave && onSave(day, [cal, allDay || kind === 'Task' && allDay ? 'all-day' : kind === 'Task' && !start ? '—' : start, title.trim()], pin, kind)
  }, edit ? 'Save changes' : 'Create ' + kind.toLowerCase()))));
}
function MDetail({
  day,
  ix,
  ev,
  mName = 'Muḥarram',
  greg = mGreg,
  onEdit,
  onDelete,
  onClose
}) {
  const [k, time, title] = ev;
  const cal = MCALS.find(c => c[0] === k) || MCALS[0];
  const m = /^(\d{1,2}):(\d{2})$/.exec(time);
  const t = m ? +m[1] * 60 + +m[2] : null;
  const MG = 1132;
  const ctx = t === null ? null : t + 60 <= MG ? `Ends ${Math.round((MG - (t + 60)) / 60)} h before Maghrib (${m12(MG)})` : t < MG ? `Runs into Maghrib (${m12(MG)})` : 'After Maghrib — belongs to the next Hijri day';
  const clash = t === null ? null : clashOf(t, t + 60);
  return /*#__PURE__*/React.createElement(Sheet, {
    onClose: onClose,
    title: "Event"
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 13
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 13,
      height: 13,
      borderRadius: 4,
      background: cal[2],
      marginTop: 5,
      flex: 'none'
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      font: '650 18px var(--font-ui)'
    }
  }, title), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 12px var(--font-ui)',
      color: 'var(--text-muted)',
      marginTop: 3
    }
  }, day, " ", mName, " 1447 \xB7 ", greg(day), time && time !== 'all-day' && time !== '—' ? ` · ${m12(t)}` : time === 'all-day' ? ' · all day' : ''))), clash && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      font: '500 11.5px var(--font-ui)',
      color: 'var(--alert)'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 1.8,
      strokeLinecap: 'round'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M12 8v5M12 16.5v.01M10.3 3.9 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"
  })), "Overlaps ", clash[0], " (", m12(clash[1]), ")"), ctx && /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 11.5px var(--font-ui)',
      color: 'var(--text-muted)',
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'var(--text-faint)',
      strokeWidth: 1.8,
      strokeLinecap: 'round'
    }
  }, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7.5V12l3 2"
  })), ctx), /*#__PURE__*/React.createElement("div", {
    style: {
      font: '500 11.5px var(--font-ui)',
      color: 'var(--text-muted)',
      display: 'flex',
      gap: 8,
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "14",
    height: "14",
    viewBox: "0 0 24 24",
    style: {
      fill: 'none',
      stroke: 'var(--text-faint)',
      strokeWidth: 1.8,
      strokeLinecap: 'round',
      strokeLinejoin: 'round'
    }
  }, /*#__PURE__*/React.createElement("path", {
    d: "M6.4 9.6a5.6 5.6 0 0 1 11.2 0c0 4.3 1.8 5.4 1.8 5.4H4.6s1.8-1.1 1.8-5.4z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10.2 19.6a2 2 0 0 0 3.6 0"
  })), "You \xB7 ", cal[1], " \xB7 reminder 30 min before"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      borderTop: '1px solid var(--line)',
      paddingTop: 13
    }
  }, /*#__PURE__*/React.createElement("button", {
    className: "mghost",
    onClick: onEdit
  }, "Edit"), /*#__PURE__*/React.createElement("button", {
    className: "mghost",
    style: {
      color: 'var(--alert)',
      borderColor: 'color-mix(in srgb,var(--alert) 40%,transparent)'
    },
    onClick: onDelete
  }, "Delete"), /*#__PURE__*/React.createElement("span", {
    style: {
      flex: 1
    }
  }), /*#__PURE__*/React.createElement("button", {
    className: "mbtn",
    onClick: onClose
  }, "Done"))));
}
Object.assign(window, {
  Sheet,
  MSeg,
  MComposer,
  MDetail,
  MCALS,
  mGreg
});
})(); } catch (e) { __ds_ns.__errors.push({ path: "daftar/mobile/Sheets.jsx", error: String((e && e.message) || e) }); }

__ds_ns.DayCell = __ds_scope.DayCell;

__ds_ns.MiniMonth = __ds_scope.MiniMonth;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.ConfidenceChip = __ds_scope.ConfidenceChip;

__ds_ns.EventChip = __ds_scope.EventChip;

__ds_ns.HijriMark = __ds_scope.HijriMark;

__ds_ns.ViewSwitcher = __ds_scope.ViewSwitcher;

__ds_ns.AhdTracker = __ds_scope.AhdTracker;

__ds_ns.AnchoredTasks = __ds_scope.AnchoredTasks;

__ds_ns.SalahTimes = __ds_scope.SalahTimes;

})();
