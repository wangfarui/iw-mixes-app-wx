const { getMemberList, transferOwner } = require('../../api/family')
const familyStore = require('../../stores/family')

Page({
  data: {
    memberList: [],
    selectedMemberId: null,
    selectedMember: null,
    isTransferring: false
  },

  onLoad() {
    this.fetchMembers()
  },

  async fetchMembers() {
    const group = familyStore.getMyGroupState() || wx.getStorageSync('myGroup')
    if (!group || !group.id) return

    try {
      const res = await getMemberList(group.id)
      const memberList = (res.data || [])
        .filter((member) => Number(member.role) !== 1)
        .map((member) => ({
          ...member,
          displayName: member.name || member.username || '-'
        }))
      this.setData({ memberList })
    } catch (error) {}
  },

  selectMember(event) {
    const member = this.data.memberList[Number(event.currentTarget.dataset.index)]
    if (!member) return

    this.setData({
      selectedMemberId: member.id,
      selectedMember: member
    })
  },

  handleTransfer() {
    const selectedMember = this.data.selectedMember
    if (!selectedMember) {
      wx.showToast({
        title: '请选择新群主',
        icon: 'none'
      })
      return
    }

    wx.showModal({
      title: '确认转让',
      content: `确定要将群主转让给"${selectedMember.displayName}"吗？此操作不可撤销。`,
      confirmText: '确定转让',
      confirmColor: '#07c160',
      success: async (res) => {
        if (res.confirm) {
          await this.doTransfer()
        }
      }
    })
  },

  async doTransfer() {
    if (this.data.isTransferring) return

    const group = familyStore.getMyGroupState() || wx.getStorageSync('myGroup')
    const selectedMember = this.data.selectedMember
    if (!group || !group.id || !selectedMember) return

    this.setData({ isTransferring: true })
    try {
      await transferOwner({
        groupId: group.id,
        newOwnerUserId: selectedMember.userId
      })
      wx.showToast({
        title: '转让成功',
        icon: 'success'
      })
      await familyStore.fetchMyGroup()
      setTimeout(() => {
        const pages = getCurrentPages()
        const delta = pages.length - 1
        if (delta > 0) {
          wx.navigateBack({ delta })
        } else {
          wx.switchTab({ url: '/pages/my/my' })
        }
      }, 1500)
    } catch (error) {
    } finally {
      this.setData({ isTransferring: false })
    }
  }
})
