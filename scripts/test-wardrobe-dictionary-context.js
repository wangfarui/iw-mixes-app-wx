const assert = require('node:assert/strict')
const memory = new Map([['iwtoken','local-test-session'],['userInfo',{id:42}]])
global.wx = {getStorageSync:key=>memory.get(key),setStorageSync:(key,value)=>memory.set(key,value),removeStorageSync:key=>memory.delete(key),showToast(){}}
const api = require('../api/wardrobe')
const family = require('../stores/family')
const session = require('../stores/session')
const context = require('../stores/wardrobe-options')
const helper = require('../pagesWardrobe/wardrobe/wardrobe-helper')
const form = require('../utils/wardrobe-form')
let group = {id:2}
family.getMyGroupState = ()=>group
function deferred() { let resolve;const promise=new Promise(done=>{resolve=done});return {promise,resolve} }
function row(owner,token,categories=[]) {return {data:{ownerUserId:owner,contextToken:token,categories,colors:[],scenes:[],styleTags:[]}}}
async function main() {
  const pending=deferred();api.getOptions=()=>pending.promise
  const old=context.load({ownerUserId:44})
  session.setLoginSession({id:42,tokenValue:'new-local-test-session'})
  pending.resolve(row(44,'old'))
  await assert.rejects(old,/所属人或家庭已变化/)
  assert.equal(context.get(44),null,'迟到的旧会话候选不得进入缓存')
  api.getOptions=async()=>row(44,'child',[
    {name:'外套',matchKind:1,preferredSourceId:100,sources:[{id:100},{id:200}],itemStyles:[{name:'风衣',sourceId:201,categorySourceId:200}]},
    {name:'外套',matchKind:2,preferredSourceId:300,sources:[{id:300}],itemStyles:[]}
  ])
  await context.load({ownerUserId:44})
  assert.equal(helper.getCategoryOptions(42).length,0,'不使用其他所属人的缓存或静态默认项')
  const categories=helper.getCategoryOptions(44)
  assert.equal(helper.optionIndex(categories,200),0,'合并候选仍识别真实家庭父来源')
  assert.equal(helper.getItemStyleOptions(100,44)[0].parentId,200)
  assert.deepEqual(categories.map(item=>item.text),['外套（上装）','外套（下装）'])
  context.invalidate();api.getOptions=async()=>row(44,'empty');await context.load({ownerUserId:44})
  assert.deepEqual(helper.getCategoryOptions(44),[],'真实空选项不恢复默认')
  group={id:2,currentUserRole:3}
  assert.equal(context.get(44),null,'角色变化不能复用旧缓存')
  const rolePending=deferred();api.getOptions=()=>rolePending.promise;const roleLoad=context.load({ownerUserId:44});group={id:2,currentUserRole:4};rolePending.resolve(row(44,'old-role'));await assert.rejects(roleLoad,/所属人或家庭已变化/)
  let pageDefinition;global.Page=definition=>{pageDefinition=definition};require('../pagesWardrobe/wardrobe/item-form')
  const first=deferred(),second=deferred();context.load=params=>params.ownerUserId===42?first.promise:second.promise
  const page={...pageDefinition,data:{formData:{ownerUserId:42,category:0}},setData(update){Object.assign(this.data,update)},formOptionData(){return {}}}
  const firstLoad=page.loadDictionaryOptions();page.data.formData={ownerUserId:44,category:0};const secondLoad=page.loadDictionaryOptions()
  second.resolve(row(44,'latest').data);await secondLoad;first.resolve(row(42,'stale').data);await firstLoad
  assert.equal(page._dictionaryContext.contextToken,'latest','切换所属人后丢弃旧请求')
  const historicPage={...pageDefinition,_dictionaryDirty:new Set(),data:{formData:{id:7,ownerUserId:44,category:0,itemStyle:0,colorId:0,categoryNameSnapshot:'旧下装',itemStyleNameSnapshot:'旧裙子',colorName:'旧灰色'},statusOptions:[]}}
  const historical=historicPage.formOptionData(historicPage.data.formData)
  assert.equal(historical.categoryOptions[historical.categoryIndex].text,'旧下装（历史）','本地模板基线没有来源ID时仍显示原名')
  assert.equal(historical.itemStyleOptions[historical.itemStyleIndex].text,'旧裙子（历史）')
  assert.equal(historical.colorOptions[historical.colorIndex].text,'旧灰色（历史）')
  const proxy={...pageDefinition,_dictionaryDirty:new Set(),data:{canManage:true,formData:{ownerUserId:44,sceneTags:'77'},sceneOptions:[{value:77,text:'孩子专属',active:true},{value:78,text:'家庭通勤',active:false}]},setData(update){for(const [key,value] of Object.entries(update)){if(key==='formData.sceneTags')this.data.formData.sceneTags=value;else this.data[key]=value}}}
  proxy.toggleTag({currentTarget:{dataset:{group:'sceneTags',value:78}}})
  assert.deepEqual(proxy.data.sceneOptions.map(row=>row.value),[77,78],'孩子标签交互不得换成操作人的候选')
  let batchDefinition;global.Page=definition=>{batchDefinition=definition};require('../pagesWardrobe/wardrobe/item-batch')
  const batch={...batchDefinition,data:{itemStyleOptions:[{value:201,parentId:200}],common:{category:100}},setData(update){Object.assign(this.data,update)}}
  batch.onItemStyleChange({detail:{value:0}})
  assert.equal(batch.data['common.category'],200,'批量录入必须使用家庭款式的真实父来源')
  const wardrobeFamily = require('../pagesWardrobe/wardrobe/wardrobe-family')
  let chooseOwner = true
  wardrobeFamily.loadOwnerState = async () => ({ ownerOptions: [{value:43,text:'群主'},{value:42,text:'我'}], canChooseOwner:chooseOwner })
  const owners = {...batchDefinition, data:{ownerOptions:[],ownerIndex:0}, setData(update){Object.assign(this.data,update)}}
  await owners.loadOwnerOptions()
  assert.equal(owners.data.ownerOptions[owners.data.ownerIndex].value,42,'家庭列表第一人不是自己时，批量仍默认本人')
  owners.data.ownerIndex=0
  await owners.loadOwnerOptions()
  assert.equal(owners.data.ownerOptions[owners.data.ownerIndex].value,43,'成人刷新成员时保留明确选择')
  chooseOwner=false
  await owners.loadOwnerOptions()
  assert.deepEqual(owners.data.ownerOptions.map(item=>item.value),[42],'无代录权限时固定本人，不沿用上次他人选择')
  const head={data:{formData:{sceneTags:'12',styleTags:'13'}},_dictionaryDirty:new Set(),_dictionaryContext:null,setData(update){Object.assign(this.data,update)}}
  const untouched=form.prepare(head,{sceneTags:'legacy',styleTags:'legacy'},true,true)
  assert.deepEqual(untouched.dictionaryChanges,{})
  assert.equal(Object.hasOwn(untouched,'sceneTags'),false)
  head._dictionaryDirty.add('sceneIds');head.data.formData.sceneTags=''
  assert.deepEqual(form.prepare(head,{},true,true).dictionaryChanges,{sceneIds:[]},'显式清空区别于未修改')
  assert.throws(()=>form.prepare(head,{},false,true),/加载/)
  form.remember(head,{itemList:[{itemId:7,detailId:90}],itemSetVersion:'v1'})
  assert.deepEqual(form.details(head,[7,8]),[{detailId:90},{itemId:8}])
  form.toggle(head,7,true)
  assert.deepEqual(form.details(head,[7]),[{itemId:7}],'移除后重加必须明确读取当前衣物快照')
  assert.equal(helper.tagNames([], [{sourceId:null,nameSnapshot:'office'}]),'office','历史字面标签按原文回显')
  console.log('Wardrobe dictionary context checks passed')
}
main().catch(error=>{console.error(error);process.exitCode=1})
