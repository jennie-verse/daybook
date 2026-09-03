import { actionLabel, coveGroups, coveNoteRecords, folioGroups, folioNoteRecords, petalGroups, safeText } from './day-model.js';

/* ── inline Markdown helpers ─────────────────────────────────────────────
   mdText only escapes characters that can actually change Markdown structure
   (backslash, backtick, emphasis markers, brackets, angle brackets, tilde).
   It intentionally leaves `- . # + ! |` alone: those only mean anything at
   the start of a line, and every place mdText is used inserts text into the
   middle of an already-built line, so escaping them just adds a visible
   backslash for no structural reason (e.g. "civics-1" becoming "civics\-1"). */
const mdText = (value) => safeText(value).replace(/([\\`*_[\]{}<>~])/g, '\\$1');

const quote = (value) => safeText(value).split('\n').map((line) => `> ${line}`).join('\n');
// Same as quote(), but indented two spaces so it nests inside a `- ` list
// item instead of becoming its own top-level block (Tide, per the plan's fixture).
const indentQuote = (value) => safeText(value).split('\n').map((line) => `  > ${line}`).join('\n');

const codeSpan = (value) => {
  const body = safeText(value);
  const longestRun = Math.max(0, ...(body.match(/`+/g) || []).map((match) => match.length));
  const fence = '`'.repeat(longestRun + 1);
  return `${fence}${body}${fence}`;
};

const parts = (iso) => {
  const match = safeText(iso).match(/T(\d{2}):(\d{2})/);
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
};
const clockParts = ({ hour, minute }) => `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;

export const formatClock = (iso) => {
  const value = parts(iso);
  return value ? clockParts(value) : '--:--';
};
// Builds the front matter `time` value from a Date the same way formatClock
// builds it from an ISO string, so the whole document uses one plain space
// before AM/PM. toLocaleTimeString() must not be used here: Safari 16.4+
// inserts U+202F (narrow no-break space) instead of a normal space.
export const formatClockFromDate = (date) => clockParts({ hour: date.getHours(), minute: date.getMinutes() });

export const formatTimeRange = (startIso, endIso) => {
  const start = parts(startIso);
  const end = parts(endIso);
  if (!start || !end) return '--:--';
  const startPeriod = start.hour < 12 ? 'AM' : 'PM';
  const endPeriod = end.hour < 12 ? 'AM' : 'PM';
  const startClock = `${start.hour % 12 || 12}:${String(start.minute).padStart(2, '0')}`;
  const endClock = `${end.hour % 12 || 12}:${String(end.minute).padStart(2, '0')} ${endPeriod}`;
  return startPeriod === endPeriod ? `${startClock}–${endClock}` : `${startClock} ${startPeriod}–${endClock}`;
};

export const formatDuration = (seconds) => {
  const value = Math.max(0, Number(seconds) || 0);
  if (value <= 0) return '';
  if (value < 60) return '<1m';
  const minutes = Math.round(value / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return hours ? `${hours}h${rest ? ` ${rest}m` : ''}` : `${minutes}m`;
};

const sessionLine = (record, target, suffix = '') => {
  const data = record.data || {};
  const value = formatDuration(data.activeSeconds ?? data.elapsedSeconds);
  return `- ${formatTimeRange(data.startedAt, data.endedAt)}${value ? ` · (${value})` : ''} · ${target}${suffix}`;
};

const isoFromMinutes = (value) => {
  const clamped = ((Math.round(Number(value) || 0) % 1440) + 1440) % 1440;
  const hour = Math.floor(clamped / 60);
  const minute = clamped % 60;
  return `2000-01-01T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00+00:00`;
};
const rangeFromMinutes = (start, duration) => {
  const a = Number(start || 0);
  const b = a + Number(duration || 0);
  return formatTimeRange(isoFromMinutes(a), isoFromMinutes(b));
};

/* ── §2.4 in-section ordering ─────────────────────────────────────────────
   Sort each section's records by the clock actually shown on the line —
   a session's data.startedAt, a scheduled block's data.start (minutes), a
   single-instant record's record.at — ascending by hour:minute, tie-broken
   by the underlying instant and then the stable record ID. This keeps the
   visible order correct even when source records arrive out of order or mix
   timezone offsets, without needing to touch the underlying data. */
const SESSION_KINDS = ['reading-session', 'usage-session', 'session'];
function displayInstant(record) {
  const data = record.data || {};
  if (SESSION_KINDS.includes(record.kind) && data.startedAt) return data.startedAt;
  if (record.kind === 'file-activity' && data.lastAt) return data.lastAt;
  if (record.kind === 'block-activity' && data.lastAt) return data.lastAt;
  if (record.kind === 'block' && Number.isFinite(Number(data.start))) return isoFromMinutes(data.start);
  return record.at;
}
function sortedRecords(records) {
  return [...records].sort((a, b) => {
    const instantA = displayInstant(a);
    const instantB = displayInstant(b);
    const clockA = parts(instantA);
    const clockB = parts(instantB);
    const minutesA = clockA ? clockA.hour * 60 + clockA.minute : Infinity;
    const minutesB = clockB ? clockB.hour * 60 + clockB.minute : Infinity;
    if (minutesA !== minutesB) return minutesA - minutesB;
    const timeA = Date.parse(instantA) || 0;
    const timeB = Date.parse(instantB) || 0;
    if (timeA !== timeB) return timeA - timeB;
    return String(a.id).localeCompare(String(b.id));
  });
}

/* ── sections, in the order the plan's fixture defines (§2.4 / §3) ─────── */

function focus(records) {
  // Focus records both a focus session and its break as kind: 'session'.
  // Only the focus half belongs in Daybook (B-2); legacy records with no
  // `mode` at all predate the focus/break split and are still shown.
  const sessions = records.filter((record) => record.kind === 'session');
  const focusOnly = sessions.filter((record) => record.data?.mode == null || record.data.mode === 'focus');
  const rows = sortedRecords(focusOnly).map((record) => {
    const data = record.data || {};
    const target = data.subject || data.task || 'Focus';
    return sessionLine({ ...record, data: { ...data, activeSeconds: data.elapsedSeconds } }, mdText(target));
  });
  return rows.length ? ['## Focus', '', ...rows].join('\n') : '';
}

// A record's own `done`/`finalStatus` is authoritative whenever present —
// even `done: false`. Only a record with neither field (a genuinely old
// record from before those fields existed) falls back to the `actions`
// history / task projection heuristic. Without this, a task that was
// completed and later reopened stays marked done forever, because
// `actions` never forgets that `completed` happened once.
function todayDone(data, actions, task) {
  if (typeof data.done === 'boolean') return data.done;
  if (data.finalStatus) return data.finalStatus === 'done';
  return actions.includes('completed') || task?.data?.done === true;
}

// A record's own data.type (task/note/event) decides the marker used in
// Daybook: — for a Note, HH:MM for an Event's scheduled time, ☐/☑ for a
// plain Task. Records from before `type` existed have no data.type at all
// and fall back to the original checkbox rendering (B-… today rename plan
// §7 — additive, must not change how already-written records render).
function todayEntryType(type) {
  return type === 'note' || type === 'event' ? type : 'task';
}

function today(records) {
  const tasks = new Map(records.filter((record) => record.kind === 'task').map((record) => [record.id, record]));
  const entries = new Map();
  records.filter((record) => record.kind === 'task-activity').forEach((record) => {
    const data = record.data || {};
    const actions = data.actions || [];
    const taskId = record.id.replace(/:\d{4}-\d{2}-\d{2}$/, '');
    const task = tasks.get(taskId);
    const destination = data.destination
      || (actions.includes('deferred') ? 'someday' : actions.includes('promoted') ? 'today' : task ? 'today' : '');
    if (!destination || actions.includes('deleted')) return;
    entries.set(taskId, {
      title: record.title || task?.title || 'Today task',
      destination,
      done: todayDone(data, actions, task),
      at: data.lastAt || record.updatedAt || record.at,
      type: todayEntryType(task?.data?.type),
      scheduledAt: task?.at,
    });
  });
  tasks.forEach((task, id) => {
    if (!entries.has(id)) entries.set(id, {
      title: task.title,
      destination: 'today',
      done: task.data?.done === true,
      at: task.at,
      type: todayEntryType(task.data?.type),
      scheduledAt: task.at,
    });
  });
  const out = ['## Today'];
  for (const [destination, heading] of [['today', 'Added to Today'], ['someday', 'Added to Someday']]) {
    const rows = [...entries.values()]
      .filter((entry) => entry.destination === destination)
      .sort((a, b) => String(a.at).localeCompare(String(b.at)));
    if (!rows.length) continue;
    out.push('', `### ${heading}`, '');
    rows.forEach((entry) => {
      if (entry.type === 'note') { out.push(`- — ${mdText(entry.title)}`); return; }
      if (entry.type === 'event') { out.push(`- ${formatClock(entry.scheduledAt || entry.at)} ${mdText(entry.title)}`); return; }
      out.push(entry.done ? `- [x] ${mdText(entry.title)}` : `- [ ] ~~${mdText(entry.title)}~~`);
    });
  }
  return out.length > 1 ? out.join('\n') : '';
}

function folio(records, full) {
  const sessions = sortedRecords(records.filter((record) => record.kind === 'reading-session'));
  const notes = folioNoteRecords(records);
  if (!sessions.length && !(full && notes.length)) return '';
  const out = ['## Folio'];
  if (sessions.length) {
    out.push('');
    sessions.forEach((record) => out.push(sessionLine(record, codeSpan(record.title))));
  }
  if (full && notes.length) {
    out.push('', '### Notes');
    folioGroups(notes).forEach((group) => {
      out.push('', `#### ${mdText(group.title)}`, '');
      group.records.forEach((record) => {
        const data = record.data || {};
        out.push(`- ${formatClock(record.at)}${data.locationLabel ? ` · ${mdText(data.locationLabel)}` : ''}`);
        if (data.quote) { out.push(''); out.push(quote(data.quote)); out.push(''); }
        if (data.note) out.push(`  Note: ${mdText(data.note)}`);
      });
    });
  }
  return out.join('\n').trimEnd();
}

// Only shown when both progression values are real numbers (B-3) — a
// session with no progression recorded gets no "0% → 0%" suffix at all.
function progressSuffix(data) {
  const start = Number(data.startProgression);
  const end = Number(data.endProgression);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return '';
  return ` · ${Math.round(start * 100)}% → ${Math.round(end * 100)}%`;
}

function petal(records, full) {
  const rows = [];
  petalGroups(records).forEach((book) => {
    const sessions = sortedRecords(book.records.filter((record) => record.kind === 'reading-session'));
    sessions.forEach((record) => {
      rows.push(sessionLine(record, `*${mdText(book.title)}*`, progressSuffix(record.data || {})));
    });
    if (full) {
      const others = book.records.filter((record) => record.kind !== 'reading-session');
      others.forEach((record) => {
        const data = record.data || {};
        rows.push(`- ${formatClock(record.at)} · ${mdText(book.title)} · ${mdText(record.kind.replaceAll('-', ' '))}`);
        if (data.quote) { rows.push(''); rows.push(quote(data.quote)); }
        if (data.note) rows.push(`  Note: ${mdText(data.note)}`);
      });
    }
  });
  // Same spacing as Focus/Folio: one blank line after the heading, then rows
  // packed directly together — not a blank line between every item.
  return rows.length ? ['## Petal', '', ...rows].join('\n') : '';
}

// Cove's in-app Reader sessions are exact; sessions opened via "Open in
// Safari" are historyAccuracy: "approximate" and get a `~` on the duration
// (B-1). A record with no endedAt (the >60-minute case) shows only its
// start time, with no duration segment at all — never a guessed one.
function coveLine(record) {
  const data = record.data || {};
  const approximate = data.historyAccuracy === 'approximate';
  const time = data.endedAt ? formatTimeRange(data.startedAt, data.endedAt) : formatClock(data.startedAt);
  const durationValue = formatDuration(data.activeSeconds);
  const durationPart = durationValue ? ` · (${approximate ? '~' : ''}${durationValue})` : '';
  return `- ${time}${durationPart} · ${mdText(record.title)}`;
}
function cove(records, full) {
  const sessions = sortedRecords(records.filter((record) => record.kind === 'reading-session'));
  const notes = coveNoteRecords(records);
  if (!sessions.length && !(full && notes.length)) return '';
  const out = ['## Cove'];
  if (sessions.length) {
    out.push('', ...sessions.map(coveLine));
  }
  if (full && notes.length) {
    out.push('', '### Notes');
    coveGroups(notes).forEach((group) => {
      out.push('', `#### ${mdText(group.title)}`, '');
      sortedRecords(group.records).forEach((record) => {
        const data = record.data || {};
        out.push(`- ${formatClock(record.at)}`);
        if (data.quote) { out.push(''); out.push(quote(data.quote)); out.push(''); }
        if (data.note) out.push(`  Note: ${mdText(data.note)}`);
      });
    });
  }
  return out.join('\n').trimEnd();
}

// Clip (formerly Tide): creation time and body only, always (Compact only
// shortens Folio's and Petal's long annotations — Clip is already "little
// time + little content", so Compact must not empty it out; B-4).
// The 'dump' kind is kept in this filter only for old cached day snapshots
// from before Dump was removed from the app (plan §6) — journal has none
// left to write, so this branch is effectively dead going forward.
function clip(records) {
  const rows = [];
  const items = sortedRecords(records.filter((record) => record.kind === 'clip' || record.kind === 'dump'));
  items.forEach((record) => {
    rows.push(`- ${formatClock(record.at)}`);
    const text = record.data?.text;
    if (text) { rows.push(''); rows.push(indentQuote(text)); rows.push(''); }
  });
  return rows.length ? ['## Clip', '', ...rows].join('\n').trimEnd() : '';
}

function usage(app, records) {
  const rows = sortedRecords(records.filter((record) => record.kind === 'usage-session')).map((record) => sessionLine(record, codeSpan(record.title)));
  return rows.length ? [`## ${app}`, '', ...rows].join('\n') : '';
}

// Loom: restores the block-activity/subtitle/detail lines that a previous
// pass had dropped (B-7) — only the time format changed to AM/PM, nothing
// in scope was removed.
function loom(records, full) {
  const blocks = sortedRecords(records.filter((record) => record.kind === 'block'));
  const changes = sortedRecords(records.filter((record) => record.kind === 'block-activity'));
  if (!blocks.length && !changes.length) return '';
  const out = ['## Loom'];
  if (blocks.length) {
    out.push('');
    blocks.forEach((record) => {
      const data = record.data || {};
      out.push(`- [${data.done ? 'x' : ' '}] ${rangeFromMinutes(data.start, data.duration)} · ${mdText(record.title)}`);
      if (full && data.subtitle) out.push(`  - Subtitle: ${mdText(data.subtitle)}`);
      if (full && data.note) out.push(`  - Note: ${mdText(data.note)}`);
      if (full && data.detail) out.push(`  - Detail: ${mdText(data.detail)}`);
    });
  }
  if (changes.length) {
    out.push('', '### Changes made this day', '');
    changes.forEach((record) => {
      const data = record.data || {};
      const scheduled = data.sourceDate ? ` · scheduled ${data.sourceDate}` : '';
      out.push(`- ${formatClock(data.lastAt || record.at)} · ${(data.actions || []).map(actionLabel).join(', ')}${scheduled}`);
    });
  }
  return out.join('\n');
}

function quill(records) {
  const rows = sortedRecords(records.filter((record) => record.kind === 'file-activity')).map((record) => `- ${formatClock(record.data?.lastAt || record.at)} · ${codeSpan(record.title)}`);
  return rows.length ? ['## Quill', '', ...rows].join('\n') : '';
}

export function serializeMarkdown({ day, date, note = '', detail = 'full', snapshotAt = new Date() }) {
  const status = day.cached ? 'cached' : day.failures?.length ? 'partial' : 'complete';
  const parsedDate = new Date(`${date}T12:00:00`);
  const title = Number.isNaN(parsedDate.getTime()) ? date : parsedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const snapshot = snapshotAt instanceof Date ? snapshotAt : new Date(snapshotAt);
  const snapshotTime = Number.isNaN(snapshot.getTime()) ? '--:--' : formatClockFromDate(snapshot);
  const full = detail === 'full';
  // Section order per the plan's §2.4 fixture: Focus, Today, Folio, Petal,
  // Cove, Tide, Slate, Grove — then Loom/Quill (kept, just moved after the
  // reviewed apps rather than interleaved with them), then Daily note.
  const sections = [
    focus(day.apps?.focus || []),
    today(day.apps?.today || []),
    folio(day.apps?.folio || [], full),
    petal(day.apps?.petal || [], full),
    cove(day.apps?.cove || [], full),
    clip(day.apps?.clip || []),
    usage('Slate', day.apps?.slate || []),
    usage('Grove', day.apps?.grove || []),
    loom(day.apps?.loom || [], full),
    quill(day.apps?.quill || []),
    `## Daily note\n\n${safeText(note)}`.trimEnd(),
  ].filter(Boolean);
  return `---\ndate: ${date}\ntime: "${snapshotTime}"\nstatus: ${status}\n---\n\n# ${title}\n\n${sections.join('\n\n')}\n`;
}
