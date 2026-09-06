import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceSummary, recordMeta, recordBody } from '../src/day-model.js';

test('today task summary counts tasks and done, without a backlog count', () => {
  const records = [
    { app: 'today', kind: 'task', id: 't1', data: { done: false, subtaskCount: 2, subtaskDoneCount: 1 } },
    { app: 'today', kind: 'task', id: 't2', data: { done: true } },
    { app: 'today', kind: 'task-activity', id: 't2:2026-08-26', data: { actions: ['completed'] } },
  ];
  assert.equal(sourceSummary('today', records), '2 tasks · 1 done');
});

test('today task and task-activity meta and body render subtasks only when included', () => {
  const task = { app: 'today', kind: 'task', title: '원고 교정 2절', data: { done: false, subtaskCount: 2, subtaskDoneCount: 1, subtasks: [{ id: 's1', title: '1절 반영', done: true }, { id: 's2', title: '각주 정리', done: false }] } };
  assert.equal(recordMeta(task), 'Today · 1/2 subtasks');
  assert.equal(recordBody(task), '☑ 1절 반영\n☐ 각주 정리');

  const activity = { app: 'today', kind: 'task-activity', title: '세탁', data: { actions: ['promoted', 'completed'] } };
  assert.equal(recordMeta(activity), 'Moved to Today, Completed');
  assert.equal(recordBody(activity), '');

  const contentOff = { app: 'today', kind: 'task', title: 'Today task', data: { done: true, contentIncluded: false } };
  assert.equal(recordMeta(contentOff), 'Done');
  assert.equal(recordBody(contentOff), '');
});
