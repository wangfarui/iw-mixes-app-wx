// Isolated state/request regression; no backend, database or native rendering.
const assert = require('node:assert/strict')
const storage = new Map([['userInfo', { id: 7 }], ['iwtoken', 'test-session-a']])
global.wx = { getStorageSync: k => storage.get(k), setStorageSync: (k,v) => storage.set(k,v), removeStorageSync: k => storage.delete(k), showToast() {}, navigateTo() {} }
const api = require('../api/bookkeeping-dictionaries')
const bookkeeping = require('../api/bookkeeping')
const family = require('../stores/family')
const types = require('../stores/membership-types')
const management = require('../pagesBookkeeping/bookkeeping/dictionary-management')
let subscriptionDefinition
global.Page = d => { subscriptionDefinition = d }
require('../pagesBookkeeping/bookkeeping/bookkeeping-membership-subscription')
function page(def) {
  return { ...def, data: structuredClone(def.data), setData(patch, callback) {
    for (const [key,value] of Object.entries(patch)) {
      const parts = key.split('.'); let target = this.data
      for (const part of parts.slice(0,-1)) target = target[part]
      target[parts.at(-1)] = value
    }
    if (callback) callback()
  } }
}
const deferred = () => { let resolve, reject; const promise=new Promise((a,b)=>{resolve=a;reject=b}); return {promise,resolve,reject} }
const flush = async () => { for(let i=0;i<15;i++) await Promise.resolve() }
const option = { id: 40, name: '新视频', sort: 1 }
const original = { id: 5, membershipType: 2, membershipTypeId: 10, membershipTypeName: '旧视频', membershipTypeSnapshotStatus: 1, membershipName:'测试订阅', startDate:'2026-10-21', billingCycle:1, amount:10 }
async function run() {
  family.fetchMyGroup = family.ensureMyGroupLoaded = async () => { throw Error('personal path must not fetch family') }
  api.list = async (type,scope) => { assert.equal(type,'MEMBERSHIP_TYPE'); assert.equal(scope,'PERSONAL'); return {data:{canManage:true,items:[],scopeVersion:'v'}} }
  const mgr=page(management('MEMBERSHIP_TYPE'))
  await mgr.load(true)
  assert.equal(mgr.data.personalOnly,true);assert.equal(mgr.data.hasFamily,false);assert.equal(mgr.data.canManage,true)
  mgr.changeScope({currentTarget:{dataset:{scope:'FAMILY'}}});assert.equal(mgr.data.scope,'PERSONAL')
  mgr.openAdd();mgr.inputName({detail:{value:'🍚'.repeat(32)}});assert.equal(mgr.data.canSaveName,true)
  mgr.inputName({detail:{value:'🍚'.repeat(33)}});assert.equal(mgr.data.canSaveName,false)
  mgr.inputName({detail:{value:'  视频  '}});api.add=async()=>{throw Error('save failed')};await mgr.saveName()
  assert.equal(mgr.data.draftName,'  视频  ');assert.equal(mgr.data.activeSheet,'editor');assert.equal(mgr.data.writeError,'save failed')
  let requests=0;const pending=deferred();api.options=()=>{requests++;return pending.promise}
  const a=types.ensureLoaded(),b=types.ensureLoaded();assert.equal(a,b);assert.equal(requests,1)
  storage.set('iwtoken','test-session-b');pending.resolve({data:[option]});assert.equal(await a,false);assert.deepEqual(types.get(),[])
  api.options=async()=>({data:[option]});await types.ensureLoaded();assert.equal(types.get()[0].id,40)
  types.invalidate();assert.deepEqual(types.get(),[])
  let late=deferred();api.options=()=>late.promise;const c=types.ensureLoaded();types.invalidate();late.resolve({data:[option]});assert.equal(await c,false)
  api.options=async()=>({data:[]})
  const sub=page(subscriptionDefinition);await sub.refreshOptions();assert.deepEqual(sub.data.membershipTypeOptions,[]);assert.equal(sub.data.typeError,'')
  api.options=async()=>{throw Error('network')};await sub.refreshOptions();assert.ok(sub.data.typeError);assert.deepEqual(sub.data.membershipTypeOptions,[])
  api.options=async()=>({data:[option]});await sub.refreshOptions();sub.setData(sub.buildEditFormState(original))
  assert.equal(sub.data.membershipTypeName,'旧视频');assert.equal(sub.data.membershipTypeIndex,-1);assert.equal(sub.data.originalType,true)
  let saved;bookkeeping.updateMembership=async data=>{saved=data};sub.fetchList=sub.refreshFilterOptions=()=>{}
  await sub.saveMembership();assert.equal(saved.membershipTypeChange,undefined);assert.equal(saved.membershipType,undefined);assert.equal(saved.membershipTypeId,undefined)
  sub.setData(sub.buildEditFormState(original));sub.onMembershipTypeChange({detail:{value:0}});await sub.saveMembership()
  assert.deepEqual(saved.membershipTypeChange,{sourceId:40});assert.equal(saved.membershipType,undefined)
  sub.openForm();sub.onMembershipTypeChange({detail:{value:0}});sub.setData({'formData.membershipName':'新订阅','formData.billingCycle':1})
  let writes=0;late=deferred();bookkeeping.addMembership=async data=>{saved=data;writes++;return late.promise}
  const writing=sub.saveMembership();await sub.saveMembership();assert.equal(writes,1);assert.equal(saved.membershipTypeId,40);assert.equal(saved.membershipType,undefined)
  late.reject(Error('retry me'));await writing;assert.equal(sub.data.showForm,true);assert.equal(sub.data.formData.membershipName,'新订阅');assert.equal(sub.data.formError,'retry me')
  // A prior session response must not leak into the next account, even when a save was pending.
  storage.set('iwtoken','test-session-c');sub._identity='prior-session';sub.setData({saving:true});sub.onShow();await flush();assert.equal(sub.data.showForm,false);assert.equal(sub.data.saving,false)
  const filters=page(subscriptionDefinition)
  bookkeeping.getMembershipFilterOptions=async()=>({data:[{name:'类型待核对',state:null},{name:null,state:'PENDING'}]})
  await filters.refreshFilterOptions();filters.fetchList=()=>{}
  filters.onMembershipTypeFilterChange({detail:{value:1}});assert.equal(filters.data.membershipTypeFilter.name,'类型待核对');assert.equal(filters.data.membershipTypeFilter.state,null)
  filters.onMembershipTypeFilterChange({detail:{value:2}});assert.equal(filters.data.membershipTypeFilter.state,'PENDING')
  const pendingRow=filters.buildEditFormState({...original,membershipTypeSnapshotStatus:0,membershipTypeName:null,membershipTypeId:null})
  assert.equal(pendingRow.membershipTypeName,'类型待核对');assert.equal(pendingRow.formData.membershipTypeId,'')
  const details=page(subscriptionDefinition);details.setData({currentItem:original});late=deferred();bookkeeping.getMembershipDetail=()=>late.promise
  const editing=details.editMembership();details.handleInput({currentTarget:{dataset:{field:'membershipName'}},detail:{value:'保留我的输入'}})
  late.resolve({data:{...original,membershipName:'迟到的详情'}});await editing;assert.equal(details.data.formData.membershipName,'保留我的输入')
  console.log('test-membership-types: all assertions passed (isolated state/request tests)')
}
run().catch(e=>{console.error(e);process.exitCode=1})
