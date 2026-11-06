'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {nextIndex,nextGuidePosition,formatTime,halfHourTimeline}=require('../home/home.js');

test('guide horizontal movement crosses whole programs instead of stopping inside their spans',()=>{
  const layout=[[2,1],[1,2],[3]];
  let position={row:0,slot:0};
  position=nextGuidePosition(layout,position,39);
  assert.deepEqual(position,{row:0,slot:2,index:1});
  position=nextGuidePosition(layout,position,37);
  assert.deepEqual(position,{row:0,slot:1,index:0});
  assert.deepEqual(nextGuidePosition(layout,position,37),position);
  assert.deepEqual(nextGuidePosition(layout,{row:2,slot:1},39),{row:2,slot:1,index:0});
});

test('vertical movement preserves the logical half-hour through differently spanning rows',()=>{
  const layout=[[1,1,1],[2,1],[3],[1,2]];
  let position={row:0,slot:1};
  position=nextGuidePosition(layout,position,40);
  assert.deepEqual(position,{row:1,slot:1,index:0});
  position=nextGuidePosition(layout,position,40);
  assert.deepEqual(position,{row:2,slot:1,index:0});
  position=nextGuidePosition(layout,position,40);
  assert.deepEqual(position,{row:3,slot:1,index:1});
  position=nextGuidePosition(layout,position,38);
  assert.deepEqual(position,{row:2,slot:1,index:0});
});

test('guide edges and incomplete rows never produce a missing program index',()=>{
  const layout=[[1,1,1],[2]];
  assert.deepEqual(nextGuidePosition(layout,{row:0,slot:0},38),{row:0,slot:0,index:0});
  assert.deepEqual(nextGuidePosition(layout,{row:0,slot:2},39),{row:0,slot:2,index:2});
  assert.deepEqual(nextGuidePosition(layout,{row:1,slot:1},40),{row:1,slot:1,index:0});
  assert.deepEqual(nextGuidePosition(layout,{row:0,slot:2},40),{row:1,slot:1,index:0});
  assert.deepEqual(nextGuidePosition(layout,{row:1,slot:0},39),{row:1,slot:0,index:0});
  assert.deepEqual(nextGuidePosition([],{row:0,slot:0},40),{row:-1,slot:-1,index:-1});
  assert.deepEqual(nextGuidePosition([[1]],{row:99,slot:99},40),{row:0,slot:0,index:0});
});

test('app navigation respects partial-row counts and does not wrap sideways',()=>{
  assert.equal(nextIndex(2,39,3,4),2);
  assert.equal(nextIndex(0,37,3,4),0);
  assert.equal(nextIndex(3,39,6,4),3);
  assert.equal(nextIndex(2,40,6,4),2);
  assert.equal(nextIndex(1,40,6,4),5);
  assert.equal(nextIndex(5,38,6,4),1);
  assert.equal(nextIndex(0,40,1,4),0);
});

test('half-hour headings round down and carry correctly across noon and midnight',()=>{
  assert.deepEqual(halfHourTimeline(23*60+59),{start:1410,labels:['11:30 PM','12:00 AM','12:30 AM']});
  assert.deepEqual(halfHourTimeline(11*60+45),{start:690,labels:['11:30 AM','12:00 PM','12:30 PM']});
  assert.deepEqual(halfHourTimeline(30),{start:30,labels:['12:30 AM','1:00 AM','1:30 AM']});
  assert.equal(formatTime(0),'12:00 AM');assert.equal(formatTime(12*60),'12:00 PM');
  assert.equal(formatTime(1440+15),'12:15 AM');
});
