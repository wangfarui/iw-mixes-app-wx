const wardrobeApi = require('../../api/wardrobe')
const fileStore = require('../../stores/file')
const helper = require('./wardrobe-helper')

function defaultForm() {
  return {
    id: '',
    itemName: '',
    itemImage: '',
    originalImage: '',
    optimizedImage: '',
    category: 1,
    itemStyle: 0,
    colorName: '',
    colorHex: '',
    seasonTags: '',
    sceneTags: '',
    styleTags: '',
    brand: '',
    size: '',
    material: '',
    purchaseChannel: '',
    storageLocation: '',
    purchaseDate: '',
    price: '',
    customTags: '',
    status: 1,
    remark: ''
  }
}

function draftText(draft, current, field) {
  const value = draft[field]
  if (value === undefined || value === null || value === '') return current[field] || ''
  return String(value)
}

function draftNumber(draft, current, field, fallback) {
  const value = Number(draft[field])
  if (Number.isFinite(value) && value > 0) return value
  return Number(current[field] || fallback)
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

Page({
  data: {
    formData: defaultForm(),
    categoryOptions: helper.getCategoryOptions(),
    categoryIndex: 0,
    itemStyleOptions: [{ value: 0, text: '未设置' }].concat(helper.getItemStyleOptions(1)),
    itemStyleIndex: 0,
    colorOptions: helper.getColorOptions(),
    colorIndex: 0,
    statusOptions: helper.STATUS_OPTIONS,
    statusIndex: 0,
    seasonOptions: helper.enhanceTagOptions(helper.SEASON_OPTIONS, ''),
    sceneOptions: helper.enhanceTagOptions(helper.getSceneOptions(), ''),
    styleOptions: helper.enhanceTagOptions(helper.getStyleOptions(), ''),
    continueAdd: false,
    aiDraftLoading: false,
    aiDraftLoadingText: '',
    aiDraftPrompt: '',
    aiDraftSummary: '',
    imageOptimizeLoading: false,
    imageOptimizeSummary: '',
    imageOptimizeTaskId: '',
    imageOptimizeStatus: '',
    imageOptimizeRetryable: false,
    imageOptimizeButtonText: '一键优化',
    imageOptimizeButtonDisabled: false,
    imageOptimizeSourceLocked: false,
    optimizedImageDeleting: false
  },

  onLoad(options = {}) {
    this.pageActive = true
    this.optimizePollToken = 0
    this.latestOptimizeQueryToken = 0
    if (options.id) this.loadDetail(options.id)
  },

  onShow() {
    this.pageActive = true
    this.setData(this.formOptionData(this.data.formData))
    if (this.data.formData.id) {
      this.recoverImageOptimizeTask(this.data.formData.id)
    }
  },

  onHide() {
    this.stopImageOptimizePolling()
  },

  onUnload() {
    this.stopImageOptimizePolling()
  },

  async loadDetail(id) {
    const res = await wardrobeApi.getItemDetail(id)
    const detail = res.data || {}
    const formData = {
      ...defaultForm(),
      ...detail,
      originalImage: detail.originalImage || detail.itemImage || '',
      optimizedImage: detail.optimizedImage || '',
      status: helper.normalizeStatus(detail.status),
      price: detail.price == null ? '' : String(detail.price),
      purchaseDate: detail.purchaseDate || ''
    }
    this.setData({
      formData,
      ...this.formOptionData(formData),
      ...this.imageOptimizeIdleState('', Boolean(formData.optimizedImage))
    })
    this.recoverImageOptimizeTask(formData.id)
  },

  formOptionData(formData) {
    const categoryOptions = helper.getCategoryOptions()
    const itemStyleOptions = this.itemStyleOptions(formData.category)
    const colorOptions = helper.getColorOptions()
    const sceneOptions = helper.getSceneOptions()
    const styleOptions = helper.getStyleOptions()
    return {
      categoryOptions,
      itemStyleOptions,
      colorOptions,
      categoryIndex: helper.optionIndex(categoryOptions, formData.category),
      itemStyleIndex: helper.optionIndex(itemStyleOptions, formData.itemStyle),
      colorIndex: helper.optionIndex(colorOptions, formData.colorName),
      statusIndex: helper.optionIndex(this.data.statusOptions, helper.normalizeStatus(formData.status)),
      seasonOptions: helper.enhanceTagOptions(helper.SEASON_OPTIONS, formData.seasonTags),
      sceneOptions: helper.enhanceTagOptions(sceneOptions, formData.sceneTags),
      styleOptions: helper.enhanceTagOptions(styleOptions, formData.styleTags)
    }
  },

  itemStyleOptions(category) {
    return [{ value: 0, text: '未设置' }].concat(helper.getItemStyleOptions(category))
  },

  handleInput(event) {
    const field = event.currentTarget.dataset.field
    this.setData({ [`formData.${field}`]: event.detail.value })
  },

  onCategoryChange(event) {
    const categoryIndex = Number(event.detail.value)
    const option = this.data.categoryOptions[categoryIndex]
    const itemStyleOptions = this.itemStyleOptions(option.value)
    const currentItemStyleIndex = helper.optionIndex(itemStyleOptions, this.data.formData.itemStyle)
    const itemStyleIndex = currentItemStyleIndex > 0 ? currentItemStyleIndex : 0
    this.setData({
      categoryIndex,
      itemStyleOptions,
      itemStyleIndex,
      'formData.category': option.value,
      'formData.itemStyle': itemStyleOptions[itemStyleIndex].value
    })
  },

  onItemStyleChange(event) {
    const itemStyleIndex = Number(event.detail.value)
    const option = this.data.itemStyleOptions[itemStyleIndex]
    this.setData({
      itemStyleIndex,
      'formData.itemStyle': option.value
    })
  },

  onColorChange(event) {
    const colorIndex = Number(event.detail.value)
    const option = this.data.colorOptions[colorIndex]
    this.setData({
      colorIndex,
      'formData.colorName': option.value,
      'formData.colorHex': option.hex
    })
  },

  onStatusChange(event) {
    const statusIndex = Number(event.detail.value)
    const option = this.data.statusOptions[statusIndex]
    this.setData({
      statusIndex,
      'formData.status': option.value
    })
  },

  onPurchaseDateChange(event) {
    this.setData({ 'formData.purchaseDate': event.detail.value })
  },

  toggleContinueAdd() {
    this.setData({ continueAdd: !this.data.continueAdd })
  },

  onAiPromptInput(event) {
    this.setData({ aiDraftPrompt: event.detail.value })
  },

  showAiDraftLoading(title) {
    const loadingText = title || '正在处理'
    this.setData({
      aiDraftLoading: true,
      aiDraftLoadingText: loadingText,
      aiDraftSummary: loadingText
    })
    wx.showLoading({
      title: loadingText,
      mask: true
    })
  },

  hideAiDraftLoading() {
    wx.hideLoading()
    this.setData({
      aiDraftLoading: false,
      aiDraftLoadingText: ''
    })
  },

  showImageOptimizeLoading() {
    this.setData({
      imageOptimizeLoading: true,
      imageOptimizeSummary: '自动优化中'
    })
  },

  hideImageOptimizeLoading() {
    wx.hideLoading()
    this.setData({
      imageOptimizeLoading: false,
      imageOptimizeTaskId: ''
    })
  },

  stopImageOptimizePolling() {
    this.pageActive = false
    this.latestOptimizeQueryToken = (this.latestOptimizeQueryToken || 0) + 1
    this.optimizePollToken = (this.optimizePollToken || 0) + 1
    wx.hideLoading()
    if (this.data.imageOptimizeLoading) {
      this.setData({
        imageOptimizeLoading: false
      })
    }
  },

  isCurrentImageOptimizeTask(taskId, token) {
    return Boolean(
      this.pageActive
      && this.optimizePollToken === token
      && this.data.imageOptimizeTaskId === taskId
    )
  },

  toggleTag(event) {
    const group = event.currentTarget.dataset.group
    const value = event.currentTarget.dataset.value
    const next = helper.toggleTag(this.data.formData[group], value)
    const data = {
      [`formData.${group}`]: next
    }
    if (group === 'seasonTags') data.seasonOptions = helper.enhanceTagOptions(helper.SEASON_OPTIONS, next)
    if (group === 'sceneTags') data.sceneOptions = helper.enhanceTagOptions(helper.getSceneOptions(), next)
    if (group === 'styleTags') data.styleOptions = helper.enhanceTagOptions(helper.getStyleOptions(), next)
    this.setData(data)
  },

  chooseFile() {
    if (this.data.aiDraftLoading || this.data.imageOptimizeSourceLocked || this.data.optimizedImageDeleting) return
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      success: async (res) => {
        const filePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (!filePath) return
        try {
          const fileRes = await fileStore.uploadFile(filePath)
          const originalImage = fileRes.fileUrl || fileRes
          this.setData({
            'formData.originalImage': originalImage,
            'formData.itemImage': this.data.formData.optimizedImage || originalImage,
            imageOptimizeSummary: this.data.formData.optimizedImage ? '原图已更换，优化图已保留' : ''
          })
        } catch (error) {
          wx.showToast({ title: '上传失败', icon: 'none' })
        }
      }
    })
  },

  previewImage(event) {
    const current = event.currentTarget.dataset.url || this.data.formData.originalImage
    if (!current) return
    const urls = [this.data.formData.originalImage, this.data.formData.optimizedImage].filter(Boolean)
    wx.previewImage({
      current,
      urls
    })
  },

  chooseAiImage(event) {
    if (this.data.aiDraftLoading || this.data.imageOptimizeLoading || this.data.optimizedImageDeleting) return
    const source = event.currentTarget.dataset.source || 'album'
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: [source],
      success: async (res) => {
        const filePath = res.tempFiles && res.tempFiles[0] && res.tempFiles[0].tempFilePath
        if (!filePath) return
        await this.uploadAndRecognize(filePath)
      }
    })
  },

  async uploadAndRecognize(filePath) {
    this.showAiDraftLoading('正在上传图片')
    try {
      const fileRes = await fileStore.uploadFile(filePath)
      const imageUrl = fileRes.fileUrl || fileRes
      this.setData({
        'formData.originalImage': imageUrl,
        'formData.itemImage': this.data.formData.optimizedImage || imageUrl,
        imageOptimizeSummary: ''
      })
      await this.recognizeImageDraft(imageUrl)
    } catch (error) {
      this.hideAiDraftLoading()
      this.setData({ aiDraftSummary: '' })
      wx.showToast({ title: '图片上传失败', icon: 'none' })
    }
  },

  async recognizeCurrentImage() {
    if (this.data.aiDraftLoading || this.data.imageOptimizeLoading) return
    const imageUrl = this.data.formData.originalImage
    if (!imageUrl) {
      wx.showToast({ title: '请先上传图片', icon: 'none' })
      return
    }
    await this.recognizeImageDraft(imageUrl)
  },

  buildImageOptimizePayload() {
    const form = this.data.formData
    return {
      itemId: Number(form.id || 0),
      prompt: this.data.aiDraftPrompt || ''
    }
  },

  async optimizeItemImage() {
    if (this.data.aiDraftLoading || this.data.imageOptimizeButtonDisabled || this.data.optimizedImageDeleting) return
    if (!this.data.formData.id) {
      wx.showToast({ title: '请先保存衣物', icon: 'none' })
      return
    }
    if (!this.data.formData.originalImage) {
      wx.showToast({ title: '请先上传图片', icon: 'none' })
      return
    }

    const retrying = this.data.imageOptimizeRetryable && Boolean(this.data.imageOptimizeTaskId)
    const token = (this.optimizePollToken || 0) + 1
    this.optimizePollToken = token
    this.setData({
      imageOptimizeLoading: true,
      imageOptimizeSummary: retrying ? '正在重新排队' : '正在排队',
      imageOptimizeStatus: 'queued',
      imageOptimizeButtonText: '优化中…',
      imageOptimizeButtonDisabled: true,
      imageOptimizeSourceLocked: true
    })
    try {
      const startRes = retrying
        ? await wardrobeApi.retryOptimizeItemImage(this.data.imageOptimizeTaskId)
        : await wardrobeApi.startOptimizeItemImage(this.buildImageOptimizePayload())
      if (!this.pageActive || this.optimizePollToken !== token) return
      const startData = startRes.data || {}
      if (!startData.taskId) throw new Error('图片优化任务启动失败')
      if (this.handleImageOptimizeTaskResult(startData, { showToast: true })) {
        return
      }
      this.pollImageOptimizeTask(startData.taskId, token, { showToast: true })
    } catch (error) {
      if (!this.pageActive || this.optimizePollToken !== token) return
      if (retrying) {
        this.setData({
          imageOptimizeLoading: false,
          imageOptimizeStatus: 'failed',
          imageOptimizeRetryable: true,
          imageOptimizeButtonText: '重新优化',
          imageOptimizeButtonDisabled: false,
          imageOptimizeSourceLocked: false
        })
        wx.showToast({ title: '重试失败', icon: 'none' })
      } else {
        this.setData(this.imageOptimizeIdleState((error && error.message) || '启动优化失败', false))
        wx.showToast({ title: '启动失败', icon: 'none' })
      }
    }
  },

  async recoverImageOptimizeTask(itemId) {
    if (!itemId) return
    const queryToken = (this.latestOptimizeQueryToken || 0) + 1
    this.latestOptimizeQueryToken = queryToken
    try {
      const res = await wardrobeApi.getLatestOptimizeItemImageTask(itemId)
      if (!this.pageActive || this.latestOptimizeQueryToken !== queryToken) return
      const data = res.data || {}
      if (!data.taskId) {
        this.setData(this.imageOptimizeIdleState())
        return
      }
      if (!['queued', 'running'].includes(data.status)) {
        this.handleImageOptimizeTaskResult(data)
        return
      }
      if (this.data.imageOptimizeLoading && this.data.imageOptimizeTaskId === data.taskId) return
      const token = (this.optimizePollToken || 0) + 1
      this.optimizePollToken = token
      this.setData(this.imageOptimizeActiveState(data))
      this.pollImageOptimizeTask(data.taskId, token, { showToast: true })
    } catch (error) {
      // 进入编辑页时恢复异步任务失败不打断表单编辑。
    }
  },

  async pollImageOptimizeTask(taskId, token, options = {}) {
    for (let index = 0; index < 300; index += 1) {
      await delay(3000)
      if (!this.isCurrentImageOptimizeTask(taskId, token)) return null
      try {
        const res = await wardrobeApi.getOptimizeItemImageStatus(taskId)
        if (!this.isCurrentImageOptimizeTask(taskId, token)) return null
        const data = res.data || {}
        if (this.handleImageOptimizeTaskResult(data, options)) {
          return data
        }
        this.setData(this.imageOptimizeActiveState(data))
      } catch (error) {
        if (this.isCurrentImageOptimizeTask(taskId, token)) {
          this.finishImageOptimizeFailure(error, options)
        }
        return null
      }
    }
    if (this.isCurrentImageOptimizeTask(taskId, token)) {
      this.setData({
        imageOptimizeLoading: false,
        imageOptimizeSummary: '任务仍在后台处理，重新进入页面可继续查看'
      })
    }
    return null
  },

  handleImageOptimizeTaskResult(data, options = {}) {
    const status = data.status || ''
    if (status === 'queued' || status === 'running') {
      this.setData(this.imageOptimizeActiveState(data))
      return false
    }
    if (status === 'succeeded' && data.itemImage) {
      this.setData({
        'formData.optimizedImage': data.itemImage,
        'formData.itemImage': data.itemImage,
        imageOptimizeLoading: false,
        imageOptimizeSummary: '图片已自动优化',
        imageOptimizeTaskId: data.taskId || '',
        imageOptimizeStatus: 'succeeded',
        imageOptimizeRetryable: false,
        imageOptimizeButtonText: '已优化',
        imageOptimizeButtonDisabled: true,
        imageOptimizeSourceLocked: false
      })
      if (options.showToast && this.pageActive) {
        wx.showToast({ title: '优化完成', icon: 'success' })
      }
      return true
    }
    if (status === 'failed') {
      this.setData({
        imageOptimizeLoading: false,
        imageOptimizeSummary: data.errorMessage || '图片优化失败',
        imageOptimizeTaskId: data.taskId || this.data.imageOptimizeTaskId,
        imageOptimizeStatus: 'failed',
        imageOptimizeRetryable: Boolean(data.retryable),
        imageOptimizeButtonText: data.retryable ? '重新优化' : '优化失败',
        imageOptimizeButtonDisabled: !data.retryable,
        imageOptimizeSourceLocked: false
      })
      if (options.showToast && this.pageActive) {
        wx.showToast({ title: '优化失败', icon: 'none' })
      }
      return true
    }
    if (status === 'succeeded' && !data.itemImage) {
      this.setData(this.imageOptimizeIdleState('优化图已删除，可重新优化'))
      return true
    }
    if (status === 'cancelled') {
      this.setData({
        imageOptimizeLoading: false,
        imageOptimizeSummary: data.errorMessage || '任务已取消',
        imageOptimizeTaskId: data.taskId || '',
        imageOptimizeStatus: 'cancelled',
        imageOptimizeRetryable: false,
        imageOptimizeButtonText: '任务已取消',
        imageOptimizeButtonDisabled: true,
        imageOptimizeSourceLocked: false
      })
      return true
    }
    return false
  },

  imageOptimizeActiveState(data = {}) {
    const status = data.status === 'queued' ? 'queued' : 'running'
    return {
      imageOptimizeLoading: true,
      imageOptimizeSummary: status === 'queued' ? '已排队，等待优化' : '自动优化中',
      imageOptimizeTaskId: data.taskId || this.data.imageOptimizeTaskId,
      imageOptimizeStatus: status,
      imageOptimizeRetryable: false,
      imageOptimizeButtonText: '优化中…',
      imageOptimizeButtonDisabled: true,
      imageOptimizeSourceLocked: true
    }
  },

  imageOptimizeIdleState(summary = '', optimizedImageExists) {
    const hasOptimizedImage = optimizedImageExists === undefined
      ? Boolean(this.data.formData.optimizedImage)
      : Boolean(optimizedImageExists)
    return {
      imageOptimizeLoading: false,
      imageOptimizeSummary: summary,
      imageOptimizeTaskId: '',
      imageOptimizeStatus: hasOptimizedImage ? 'succeeded' : '',
      imageOptimizeRetryable: false,
      imageOptimizeButtonText: hasOptimizedImage ? '已优化' : '一键优化',
      imageOptimizeButtonDisabled: hasOptimizedImage,
      imageOptimizeSourceLocked: false
    }
  },

  deleteOptimizedImage() {
    if (!this.data.formData.id || !this.data.formData.optimizedImage) return
    if (this.data.imageOptimizeLoading || this.data.optimizedImageDeleting) return
    wx.showModal({
      title: '删除优化图',
      content: '删除后将使用原图作为封面。',
      confirmText: '删除',
      confirmColor: '#d93026',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ optimizedImageDeleting: true })
        try {
          await wardrobeApi.deleteOptimizedItemImage(this.data.formData.id)
          this.setData({
            'formData.optimizedImage': '',
            'formData.itemImage': this.data.formData.originalImage || '',
            optimizedImageDeleting: false,
            ...this.imageOptimizeIdleState('优化图已删除', false)
          })
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch (error) {
          this.setData({ optimizedImageDeleting: false })
        }
      }
    })
  },

  finishImageOptimizeFailure(error, options = {}) {
    this.setData({
      imageOptimizeLoading: false,
      imageOptimizeSummary: (error && error.message) || '任务状态查询失败',
      imageOptimizeButtonDisabled: ['queued', 'running'].includes(this.data.imageOptimizeStatus),
      imageOptimizeSourceLocked: ['queued', 'running'].includes(this.data.imageOptimizeStatus)
    })
    if (options.showToast && this.pageActive) {
      const errorMessage = error && error.message === '图片过大，优化失败'
        ? error.message
        : '优化失败'
      wx.showToast({ title: errorMessage, icon: 'none' })
    }
  },

  async recognizeImageDraft(imageUrl) {
    this.showAiDraftLoading('AI识别中')
    try {
      const res = await wardrobeApi.recognizeItemDraft({
        imageUrl,
        prompt: this.data.aiDraftPrompt,
        useAi: true
      })
      this.applyAiDraft(res.data || {})
      this.hideAiDraftLoading()
      wx.showToast({ title: '草稿已生成', icon: 'success' })
    } catch (error) {
      this.hideAiDraftLoading()
      this.setData({ aiDraftSummary: '' })
      wx.showToast({ title: '草稿生成失败', icon: 'none' })
    }
  },

  applyAiDraft(draft) {
    const current = this.data.formData
    const originalImage = draftText(draft, { itemImage: current.originalImage }, 'itemImage')
    const formData = {
      ...current,
      itemName: draftText(draft, current, 'itemName'),
      originalImage,
      itemImage: current.optimizedImage || originalImage,
      category: draftNumber(draft, current, 'category', 1),
      itemStyle: draftNumber(draft, current, 'itemStyle', 0),
      colorName: draftText(draft, current, 'colorName'),
      colorHex: draftText(draft, current, 'colorHex'),
      seasonTags: draftText(draft, current, 'seasonTags'),
      sceneTags: draftText(draft, current, 'sceneTags'),
      styleTags: draftText(draft, current, 'styleTags'),
      brand: draftText(draft, current, 'brand'),
      size: draftText(draft, current, 'size'),
      material: draftText(draft, current, 'material'),
      purchaseChannel: draftText(draft, current, 'purchaseChannel'),
      storageLocation: draftText(draft, current, 'storageLocation'),
      purchaseDate: draftText(draft, current, 'purchaseDate'),
      price: draft.price === undefined || draft.price === null ? current.price : String(draft.price),
      customTags: draftText(draft, current, 'customTags'),
      status: helper.normalizeStatus(draftNumber(draft, current, 'status', 1)),
      remark: draftText(draft, current, 'remark')
    }
    const colorOption = helper.getColorOptions().find((option) => option.value === formData.colorName)
    if (!formData.colorHex && colorOption) formData.colorHex = colorOption.hex
    this.setData({
      formData,
      ...this.formOptionData(formData),
      aiDraftSummary: draft.source === 'ai' ? 'AI草稿已生成，可编辑后保存' : '图片已上传，可编辑后保存'
    })
  },

  async submitForm() {
    const form = this.data.formData
    if (!String(form.itemName || '').trim()) {
      wx.showToast({ title: '请输入衣物名称', icon: 'none' })
      return
    }
    const payload = {
      itemName: String(form.itemName || '').trim(),
      itemImage: form.originalImage || '',
      category: Number(form.category || 0),
      itemStyle: Number(form.itemStyle || 0),
      colorName: form.colorName || '',
      colorHex: form.colorHex || '',
      seasonTags: form.seasonTags || '',
      sceneTags: form.sceneTags || '',
      styleTags: form.styleTags || '',
      brand: form.brand || '',
      size: form.size || '',
      material: form.material || '',
      purchaseChannel: form.purchaseChannel || '',
      storageLocation: form.storageLocation || '',
      purchaseDate: form.purchaseDate || null,
      price: Number(form.price || 0),
      customTags: form.customTags || '',
      status: helper.normalizeStatus(form.status),
      remark: form.remark || ''
    }
    try {
      if (form.id) {
        payload.id = form.id
        await wardrobeApi.updateItem(payload)
      } else {
        await wardrobeApi.addItem(payload)
      }
    } catch (error) {
      wx.showToast({ title: (error && error.message) || '保存失败', icon: 'none' })
      return
    }
    wx.showToast({ title: '已保存', icon: 'success' })
    if (!form.id && this.data.continueAdd) {
      const nextFormData = {
        ...defaultForm(),
        category: form.category,
        itemStyle: form.itemStyle,
        colorName: form.colorName,
        colorHex: form.colorHex,
        seasonTags: form.seasonTags,
        sceneTags: form.sceneTags,
        styleTags: form.styleTags,
        status: helper.normalizeStatus(form.status),
        storageLocation: form.storageLocation,
        customTags: form.customTags
      }
      this.setData({
        formData: nextFormData,
        ...this.formOptionData(nextFormData),
        aiDraftSummary: '',
        ...this.imageOptimizeIdleState('', false)
      })
      return
    }
    if (form.id) {
      this.getOpenerEventChannel().emit('itemSaved', {
        ...payload,
        itemImage: form.optimizedImage || form.itemImage || payload.itemImage
      })
    }
    setTimeout(() => wx.navigateBack(), 400)
  }
})
