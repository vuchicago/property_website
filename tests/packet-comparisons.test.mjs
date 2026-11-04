import test from 'node:test';
import assert from 'node:assert/strict';
import { lowerValuationComparables, selectedAppealComparables, impliedMarketValue, impliedMarketValuePerSqft } from '../packet-comparisons.js';
import { requirements } from '../packet-requirements.js';
import { transitionPacket } from '../functions/api/_packet_workflow.js';

const comp=(pin,taxableValue)=>({pin,address:`${pin} Test Ave`,taxableValue});
const snapshot=()=>({details:{taxableValue:30000},comparables:[comp('lower',20000),comp('equal',30000),comp('higher',40000),comp('missing',null)]});

test('appeal comparisons exclude equal, higher, missing and invalid assessed values',()=>{
    const s=snapshot();s.comparables.push(...[undefined,'',0,-1,NaN,Infinity,true,'invalid'].map((v,i)=>comp(`invalid${i}`,v)),comp('numeric-string','25000'));
    assert.deepEqual(lowerValuationComparables(s).map(c=>c.pin),['lower','numeric-string']);
    assert.deepEqual(s.comparables.slice(0,4).map(c=>c.pin),['lower','equal','higher','missing']);
});

test('missing subject valuation never produces unverified lower-value suggestions',()=>{
    for(const value of [undefined,null,'',0,-1,'unknown',NaN,Infinity,true]) {
        const s=snapshot();s.details.taxableValue=value;
        assert.deepEqual(lowerValuationComparables(s),[]);
    }
    assert.deepEqual(lowerValuationComparables(),[]);
});

test('older selections only count eligible comparisons toward the evidence requirement',()=>{
    const s={propertySnapshot:snapshot(),intake:{reason:'uniformity',ownResidence:true,selectedComparables:['lower','equal','higher','missing']}};
    assert.deepEqual(selectedAppealComparables(s).map(c=>c.pin),['lower']);
    assert.equal(requirements(s).find(row=>row.id==='comparisons').done,false);
    s.propertySnapshot.comparables.push(comp('lower2',21000),comp('lower3',22000));
    s.intake.selectedComparables.push('lower2','lower3');
    assert.equal(requirements(s).find(row=>row.id==='comparisons').done,true);
});

test('server rejects disallowed comparisons in both draft answers and completed intake',()=>{
    const state={status:'intake',version:0,documents:[],propertySnapshot:snapshot()};
    const actor={isOwner:true,uid:'owner'};
    const intake={action:'intake',agency:'assessor',taxYear:2026,ownerName:'Test Owner',mailingAddress:'123 Owner St',reason:'uniformity',explanation:'Comparable homes are assessed lower.',individualOwner:true,noExistingAppeal:true,requestedMarketValue:200000,singleFamilyScope:true,ownResidence:true,recordsConfirmed:true,pins:'00000000000001'};
    const draft={action:'questionnaire',step:'comparisons'};
    for(const pin of ['equal','higher','missing','foreign']) {
        assert.throws(()=>transitionPacket(state,{...draft,answers:{selectedComparables:[pin]}},actor),/lower-valued comparisons/);
        assert.throws(()=>transitionPacket(state,{...intake,selectedComparables:[pin]},actor),/lower assessed value/);
    }
    assert.deepEqual(transitionPacket(state,{...draft,answers:{selectedComparables:['lower']}},actor).questionnaire.answers.selectedComparables,['lower']);
    assert.deepEqual(transitionPacket(state,{...intake,selectedComparables:['lower']},actor).intake.selectedComparables,['lower']);
});

test('residential implied market value divides assessment by 0.10 without substituting missing values',()=>{
    assert.equal(impliedMarketValue(30000),300000);
    assert.equal(impliedMarketValue('20001'),200010);
    assert.equal(impliedMarketValuePerSqft({taxableValue:30000,homeSize:1500}),200);
    for(const value of [undefined,null,'',0,-1,'invalid',true])assert.equal(impliedMarketValue(value),null);
    assert.equal(impliedMarketValuePerSqft({taxableValue:30000,homeSize:0}),null);
});

test('top five output filters disallowed valuations before limiting and preserves similarity order',()=>{
    const s={propertySnapshot:{details:{taxableValue:30000},comparables:[comp('higher',40000),comp('equal',30000),comp('missing',null),...Array.from({length:7},(_,n)=>comp(`lower${n}`,25000-n*1000))]},intake:{selectedComparables:['higher','equal','missing',...Array.from({length:7},(_,n)=>`lower${n}`)]}};
    assert.deepEqual(selectedAppealComparables(s).map(c=>c.pin),['lower0','lower1','lower2','lower3','lower4']);
});

test('both intake and draft updates reject more than five comparisons',()=>{
    const comparisons=Array.from({length:6},(_,n)=>comp(String(n),20000+n));
    const state={status:'intake',version:0,documents:[],propertySnapshot:{details:{taxableValue:30000},comparables:comparisons}};
    const actor={isOwner:true,uid:'owner'},selectedComparables=comparisons.map(c=>c.pin);
    assert.throws(()=>transitionPacket(state,{action:'questionnaire',step:'comparisons',answers:{selectedComparables}},actor),/up to five/);
    const intake={action:'intake',agency:'assessor',taxYear:2026,ownerName:'Test Owner',mailingAddress:'123 Owner St',reason:'uniformity',explanation:'Comparable homes are assessed lower.',individualOwner:true,noExistingAppeal:true,requestedMarketValue:200000,singleFamilyScope:true,ownResidence:true,recordsConfirmed:true,pins:'00000000000001',selectedComparables};
    assert.throws(()=>transitionPacket(state,intake,actor),/up to five/);
});
