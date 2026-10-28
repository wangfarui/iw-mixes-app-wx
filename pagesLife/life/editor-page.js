const { api, session, configs, categories, dateTypes, reminders, requestId } = require('./common')
function blank(kind) {
  const now = new Date(), date = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0')
  const common = { title: '', remark: '' }
  if (kind === 'wish') return { ...common, estimatedAmount: '', targetDate: '', priority: 'NORMAL', referenceUrl: '' }
  if (kind === 'bookmark') return { ...common, url: '', category: 'OTHER' }
  return { ...common, dateType: 'BIRTHDAY', calendarType: 'SOLAR', solarDate: date, eventYear: now.getFullYear(), eventMonth: now.getMonth() + 1, eventDay: now.getDate(), leapMonth: false, repeatType: 'YEARLY', remindDays: 0 }
}
module.exports = function editorPage(kind) {
  const config = configs[kind]
  return {
    data: { kind, label: config.label, isEdit: false, form: blank(kind), loading: false, busy: false, error: '', saveError: '', uncertain: false,
      categories: categories.slice(1), categoryIndex: 3, dateTypes, typeIndex: 0, reminders, remindIndex: 1, priorityIndex: 0, repeatIndex: 1,
      years: Array.from({ length: 199 }, (_, i) => 1901 + i), yearIndex: new Date().getFullYear() - 1901, lunarMonths: [], lunarDays: [], lunarMonthIndex: 0, lunarDayIndex: 0, lunarMonthText: '请选择', lunarDayText: '请选择', calendarLoading: false, calendarError: '' },
    onLoad(options = {}) {
      this._alive = true; this._token = session.getToken(); this._id = options.id; this._requestId = requestId()
      this.setData({ isEdit: Boolean(options.id), form: blank(kind) })
      wx.setNavigationBarTitle({ title: (options.id ? '编辑' : '添加') + config.label })
      this.load()
    },
    onShow() {
      if (this._token !== session.getToken()) { this._alive = false; this.setData({ form: blank(kind), error: '会话已变化，请重新进入页面', busy: false }); this.clearAlert() }
    },
    onUnload() { this._alive = false; this._calendarSeq = (this._calendarSeq || 0) + 1 },
    valid() { return this._alive && this._token === session.getToken() },
    dirty() { if (!this._dirty) { this._dirty = true; if (wx.enableAlertBeforeUnload) wx.enableAlertBeforeUnload({ message: '内容尚未保存，确定放弃修改吗？' }) } this.setData({ saveError: '' }) },
    clearAlert() { this._dirty = false; if (wx.disableAlertBeforeUnload) wx.disableAlertBeforeUnload() },
    async load() {
      this.setData({ loading: true, error: '' })
      try {
        if (this._id) {
          const res = await api.detail(kind, this._id); if (!this.valid()) return
          const row = res.data
          const form = { ...blank(kind), ...row, estimatedAmount: row.estimatedAmount == null ? '' : String(row.estimatedAmount), targetDate: row.targetDate || '' }
          if (kind === 'date' && row.calendarType === 'SOLAR') form.solarDate = [row.eventYear, String(row.eventMonth).padStart(2, '0'), String(row.eventDay).padStart(2, '0')].join('-')
          this.setData({ form }); this.syncIndices()
        }
        if (kind === 'date' && this.data.form.calendarType === 'LUNAR') await this.loadCalendar()
      } catch (e) { if (this.valid()) this.setData({ error: '记录加载失败，点击重试' }) }
      finally { if (this.valid()) this.setData({ loading: false }) }
    },
    syncIndices() {
      const f = this.data.form
      this.setData({ categoryIndex: Math.max(0, categories.slice(1).findIndex(c => c.value === f.category)), typeIndex: Math.max(0, dateTypes.findIndex(t => t.value === f.dateType)), remindIndex: Math.max(0, reminders.findIndex(r => r.value === f.remindDays)), priorityIndex: f.priority === 'HIGH' ? 1 : 0, repeatIndex: f.repeatType === 'YEARLY' ? 1 : 0, yearIndex: Number(f.eventYear || new Date().getFullYear()) - 1901 })
    },
    input(e) { if (this.data.busy || this.data.uncertain) return; this.dirty(); this.setData({ ['form.' + e.currentTarget.dataset.field]: e.detail.value }) },
    select(e) {
      if (this.data.busy || this.data.uncertain) return
      const field = e.currentTarget.dataset.field, index = Number(e.detail.value)
      const choices = { priority: ['NORMAL', 'HIGH'], category: categories.slice(1).map(c => c.value), dateType: dateTypes.map(c => c.value), repeatType: ['NONE', 'YEARLY'], remindDays: reminders.map(c => c.value) }
      if (!choices[field]) return
      this.dirty(); this.setData({ ['form.' + field]: choices[field][index] })
      if (field === 'dateType') this.setData({ 'form.repeatType': index < 2 ? 'YEARLY' : 'NONE' })
      this.syncIndices()
    },
    setDate(e) { if (this.data.busy || this.data.uncertain) return; this.dirty(); this.setData({ ['form.' + e.currentTarget.dataset.field]: e.detail.value }) },
    clearTarget() { if (this.data.busy || this.data.uncertain) return; this.dirty(); this.setData({ 'form.targetDate': '' }) },
    async changeCalendar(e) {
      const type = e.currentTarget.dataset.value
      if (type === this.data.form.calendarType || this.data.busy || this.data.uncertain) return
      this.dirty(); this.setData({ 'form.calendarType': type, calendarError: '' })
      this._calendarSeq = (this._calendarSeq || 0) + 1
      if (type === 'LUNAR') { this.setData({ 'form.eventYear': new Date().getFullYear(), 'form.eventMonth': null, 'form.eventDay': null, 'form.leapMonth': false }); await this.loadCalendar() }
      wx.showToast({ title: '请重新核对并选择日期', icon: 'none' })
    },
    async loadCalendar() {
      const seq = this._calendarSeq = (this._calendarSeq || 0) + 1, year = Number(this.data.form.eventYear)
      this.setData({ calendarLoading: true, calendarError: '', lunarMonthText: '请选择', lunarDayText: '请选择' })
      try {
        const res = await api.calendar(year)
        if (!this.valid() || seq !== this._calendarSeq || this.data.form.calendarType !== 'LUNAR') return
        const months = res.data || [], f = this.data.form
        const monthIndex = months.findIndex(m => m.month === f.eventMonth && m.leap === Boolean(f.leapMonth))
        this.setData({ lunarMonths: months, lunarMonthIndex: Math.max(monthIndex, 0), yearIndex: year - 1901 })
        this.syncLunarDays(monthIndex)
      } catch (e) { if (this.valid() && seq === this._calendarSeq) this.setData({ calendarError: '农历选项加载失败，点击重试' }) }
      finally { if (this.valid() && seq === this._calendarSeq) this.setData({ calendarLoading: false }) }
    },
    syncLunarDays(index) {
      const month = this.data.lunarMonths[index], day = Number(this.data.form.eventDay)
      const days = month ? Array.from({ length: month.days }, (_, i) => i + 1) : []
      const validDay = month && day > 0 && day <= month.days
      this.setData({ lunarDays: days, lunarMonthText: month ? month.label : '请选择', lunarDayText: validDay ? day + '日' : '请选择', lunarDayIndex: validDay ? day - 1 : 0 })
      if (!month) this.setData({ 'form.eventMonth': null, 'form.eventDay': null, 'form.leapMonth': false })
      else if (!validDay) this.setData({ 'form.eventDay': null })
    },
    chooseYear(e) { if (this.data.busy || this.data.uncertain) return; this.dirty(); this.setData({ 'form.eventYear': this.data.years[Number(e.detail.value)] }); this.loadCalendar() },
    chooseMonth(e) {
      if (this.data.calendarLoading || this.data.busy || this.data.uncertain) return
      const index = Number(e.detail.value), month = this.data.lunarMonths[index]; if (!month) return
      this.dirty(); this.setData({ lunarMonthIndex: index, 'form.eventMonth': month.month, 'form.leapMonth': month.leap }); this.syncLunarDays(index)
    },
    chooseDay(e) { if (this.data.busy || this.data.uncertain) return; this.dirty(); this.setData({ 'form.eventDay': this.data.lunarDays[Number(e.detail.value)], lunarDayText: this.data.lunarDays[Number(e.detail.value)] + '日', lunarDayIndex: Number(e.detail.value) }) },
    paste() { if (this.data.busy || this.data.uncertain) return; wx.getClipboardData({ success: res => { if (this.valid()) { this.dirty(); this.setData({ 'form.url': res.data || '' }) } }, fail: () => wx.showToast({ title: '读取失败，可手动粘贴', icon: 'none' }) }) },
    payload() {
      const f = this.data.form, data = { title: f.title.trim(), remark: f.remark || '' }
      if (!data.title || Array.from(data.title).length > 80) throw Error('名称需为1–80个字符')
      if (Array.from(data.remark).length > 1000) throw Error('备注不能超过1000个字符')
      function link(value, required) { const text = (value || '').trim(); if (required && !text) throw Error('请填写链接'); if (text && (!/^https?:\/\/[^\s/?#]+(?:[/?#][^\s]*)?$/i.test(text) || text.length > 2048)) throw Error('请输入有效的HTTP或HTTPS链接'); return text || null }
      if (kind === 'wish') {
        const amount = String(f.estimatedAmount).trim()
        if (amount && (!/^\d{1,8}(\.\d{1,2})?$/.test(amount) || Number(amount) > 99999999.99)) throw Error('预计金额需为非负数，最多两位小数')
        Object.assign(data, { estimatedAmount: amount ? Number(amount) : null, targetDate: f.targetDate || null, priority: f.priority, referenceUrl: link(f.referenceUrl, false) })
      } else if (kind === 'bookmark') Object.assign(data, { url: link(f.url, false), category: f.category })
      else {
        if (f.calendarType === 'LUNAR' && (this.data.calendarLoading || this.data.calendarError || !f.eventMonth || !f.eventDay)) throw Error('请完整选择有效农历日期')
        const parts = (f.solarDate || '').split('-').map(Number)
        if (f.calendarType === 'SOLAR' && (parts.length !== 3 || parts[0] < 1901 || parts[0] > 2099)) throw Error('请选择1901–2099年的有效日期')
        Object.assign(data, { dateType: f.dateType, calendarType: f.calendarType, eventYear: f.calendarType === 'SOLAR' ? parts[0] : Number(f.eventYear), eventMonth: f.calendarType === 'SOLAR' ? parts[1] : f.eventMonth, eventDay: f.calendarType === 'SOLAR' ? parts[2] : f.eventDay, leapMonth: f.calendarType === 'LUNAR' && Boolean(f.leapMonth), repeatType: f.repeatType, remindDays: f.remindDays })
      }
      if (this._id) Object.assign(data, { id: Number(this._id), revision: f.revision })
      else data.clientRequestId = this._requestId
      return data
    },
    async save() {
      if (this.data.busy || this.data.loading || this.data.error || !this.valid() || this._saved) return
      let payload
      try { payload = this._retryPayload || this.payload() } catch (e) { this.setData({ saveError: e.message }); return }
      this.setData({ busy: true, saveError: '' })
      try {
        await (this._id ? api.update(kind, payload) : api.add(kind, payload)); if (!this.valid()) return
        this._saved = true; this.clearAlert(); wx.showToast({ title: '保存成功' }); this.backToList()
      } catch (e) {
        if (!this.valid()) return
        if (e.errMsg) { this._retryPayload = payload; this.setData({ uncertain: true, saveError: '保存结果尚未确认，点「核对并重试」；原输入已保留' }) }
        else this.setData({ saveError: e.message || '保存失败，请重试' })
      } finally { if (this.valid()) this.setData({ busy: false }) }
    },
    reloadConflict() { if (this.data.busy) return; wx.showModal({ title: '重新加载', content: '将放弃当前未保存修改，读取最新记录。', success: r => { if (r.confirm && this.valid()) { this._retryPayload = null; this.setData({ uncertain: false, saveError: '' }); this.clearAlert(); this.load() } } }) },
    remove() {
      if (this.data.busy || !this.valid() || this.data.uncertain) return
      wx.showModal({ title: '删除' + config.label, content: '确认删除这条记录吗？', confirmText: '删除', confirmColor: '#c34d46', success: async r => {
        if (!r.confirm || !this.valid() || this.data.busy) return
        this.setData({ busy: true })
        try { await api.remove(kind, Number(this._id), this.data.form.revision); if (this.valid()) { this._saved = true; this.clearAlert(); this.backToList() } }
        catch (e) { if (this.valid()) this.setData({ saveError: e.message || '删除失败，请重试' }) }
        finally { if (this.valid()) this.setData({ busy: false }) }
      } })
    },
    backToList() {
      const redirect = () => wx.redirectTo({ url: '/pagesLife/life/' + kind + '-list' })
      if (typeof getCurrentPages === 'function' && getCurrentPages().length <= 1) redirect()
      else wx.navigateBack({ fail: redirect })
    }
  }
}
