const api = require('../../api/base')
const categories = require('../../api/account-categories')
const session = require('../../stores/session')
const emptyForm = () => ({ id: '', name: '', address: '', account: '', type: null, remark: '', password: '' })
Page({
  data: { isEdit: false, formData: emptyForm(), loading: true, error: '', busy: false, typeOptions: [], typeName: '未分类',
    sheet: '', passwordVisible: false, categoryLoading: false, categoryError: '', scopeVersion: '', draftName: '', nameError: '', nameCount: 0, remarkCount: 0, keyboardHeight: 0 },
  onLoad(options = {}) {
    this._token = session.getToken(); this._alive = true
    this._id = options.id
    this.setData({ isEdit: Boolean(options.id) }); wx.setNavigationBarTitle({ title: options.id ? '编辑应用账号' : '新增应用账号' })
    this.load()
  },
  onShow() { if (this._token && this._token !== session.getToken()) { this._alive = false; this.setData({ formData: emptyForm(), sheet: '', error: '会话已变化，请重新进入页面' }) } },
  onHide() { this.setData({ passwordVisible: false }) },
  onUnload() { this._alive = false; this.setData({ 'formData.password': '', passwordVisible: false }) },
  valid() { return this._alive && this._token === session.getToken() },
  async load() {
    this.setData({ loading: true, error: '' })
    try {
      if (this._id) {
        const res = await api.getAccountDetail(this._id)
        if (!this.valid()) return
        const row = res.data || {}
        if (row.type === 0) row.type = null
        this.setData({ formData: { ...emptyForm(), ...row, password: '' }, typeName: row.typeName || '未分类', remarkCount: Array.from(row.remark || '').length })
      }
      await this.loadOptions()
    } catch (e) { if (this.valid()) this.setData({ error: '账号加载失败，请重试' }) }
    finally { if (this.valid()) this.setData({ loading: false }) }
  },
  async loadOptions() {
    this.setData({ categoryLoading: true, categoryError: '' })
    try {
      const data = await categories.list()
      if (!this.valid()) return false
      const row = data.items.find(i => i.code === this.data.formData.type)
      this.setData({ typeOptions: data.items.filter(i => i.enabled || i.code === this.data.formData.type), scopeVersion: data.scopeVersion, categoryError: '' })
      if (row) this.setData({ typeName: row.name })
      return true
    } catch (e) { if (this.valid()) this.setData({ categoryError: '分类加载失败，请重试' }); return false }
    finally { if (this.valid()) this.setData({ categoryLoading: false }) }
  },
  handleInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: e.detail.value })
    if (field === 'remark') this.setData({ remarkCount: Array.from(e.detail.value).length })
  },
  togglePassword() { this.setData({ passwordVisible: !this.data.passwordVisible }) },
  openTypes() { if (this.data.busy || this.data.loading) return; wx.hideKeyboard(); this.setData({ sheet: 'types' }); this.loadOptions() },
  chooseType(e) {
    const value = e.currentTarget.dataset.code, code = value === '' ? null : Number(value)
    const row = this.data.typeOptions.find(i => i.code === code)
    this.setData({ 'formData.type': code, typeName: row ? row.name : '未分类', sheet: '' })
  },
  openQuickAdd() { if (this.data.categoryLoading || this.data.categoryError || this.data.busy) return; this.setData({ sheet: 'quick', draftName: '', nameError: '', nameCount: 0 }); this._categoryCreated = false },
  inputName(e) { this.setData({ draftName: e.detail.value, nameCount: Array.from(e.detail.value.trim()).length, nameError: '' }) },
  keyboardChange(e) { this.setData({ keyboardHeight: e.detail.height || 0 }) },
  closeSheet() { if (this.data.busy) return; wx.hideKeyboard(); this.setData({ sheet: '', keyboardHeight: 0, nameError: '' }) },
  async saveCategory() {
    if (this.data.busy || !this.valid()) return
    const name = this.data.draftName.trim()
    if (!name || Array.from(name).length > 32) { this.setData({ nameError: '请输入1–32个字符的分类名称' }); return }
    this.setData({ busy: true, nameError: '' })
    try {
      if (!this._categoryCreated) {
        const result = await categories.create({ name, scopeVersion: this.data.scopeVersion })
        if (!this.valid()) return
        this._categoryCreated = true
        this.setData({ 'formData.type': result.item.code, typeName: result.item.name })
      }
      const refreshed = await this.loadOptions()
      if (!this.valid()) return
      if (!refreshed) { this.setData({ nameError: '分类已新增并选用，列表刷新失败；可重试刷新或关闭继续录入' }); return }
      wx.hideKeyboard(); this.setData({ sheet: '', keyboardHeight: 0 })
      wx.showToast({ title: '已新增并选用', icon: 'success' })
    } catch (e) {
      if (this.valid()) this.setData({ nameError: e.message || '新增失败，请重试' })
      if (/已变化/.test(e.message || '')) await this.loadOptions()
    } finally { if (this.valid()) this.setData({ busy: false }) }
  },
  validateForm() {
    const f = this.data.formData
    if (![f.name, f.address, f.account].some(v => String(v || '').trim())) return '应用名称、应用地址、账号至少填写一项'
    for (const [field, max, label] of [['name',32,'应用名称'],['address',255,'应用地址'],['account',64,'账号'],['password',64,'密码'],['remark',255,'备注']]) {
      if (String(f[field] || '').length > max) return `${label}不能超过${max}个字符`
    }
    return ''
  },
  async handleSave() {
    if (this.data.busy || this.data.loading || this.data.error || !this.valid()) return
    const message = this.validateForm()
    if (message) return wx.showToast({ title: message, icon: 'none' })
    const f = this.data.formData
    const payload = { ...f, name: f.name.trim(), address: f.address.trim(), account: f.account.trim(), type: f.type == null ? null : Number(f.type), updatePassword: Boolean(f.password) }
    this.setData({ busy: true })
    try {
      await (this.data.isEdit ? api.updateAccount(payload) : api.addAccount(payload))
      if (!this.valid()) return
      this._saved = true
      this.setData({ 'formData.password': '', passwordVisible: false })
      wx.showToast({ title: '保存成功' }); wx.navigateBack()
    } catch (e) { /* Request wrapper displays error; retain the draft for retry. */ }
    finally { if (this.valid() && !this._saved) this.setData({ busy: false }) }
  },
  handleDelete() {
    if (this.data.busy || !this.valid()) return
    wx.showModal({ title: '删除应用账号', content: '确认删除该账号吗？', confirmText: '删除', confirmColor: '#c34d46', success: async res => {
      if (!res.confirm || !this.valid() || this.data.busy) return
      this.setData({ busy: true })
      try { await api.deleteAccount(this.data.formData.id); if (this.valid()) { this._saved = true; wx.navigateBack() } }
      catch (e) {} finally { if (this.valid() && !this._saved) this.setData({ busy: false }) }
    } })
  },
  noop() {}
})
