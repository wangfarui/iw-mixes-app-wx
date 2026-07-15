const {
  getMyGroup,
  getMemberList,
  quitGroup,
  removeMember,
  assignMemberRole,
  updateMyDefaultShared,
  updateMyQueryScope
} = require('../../api/family')
const familyStore = require('../../stores/family')
const sharedScopeStore = require('../../stores/family-shared-scope')

const ROLE = {
  OWNER: 1,
  PARENT: 2,
  MEMBER: 3,
  CHILD: 4
}

function sameId(left, right) {
  if (left === undefined || left === null || right === undefined || right === null) return false
  return String(left) === String(right)
}

function getRoleText(role) {
  const roleMap = {
    [ROLE.OWNER]: '群主',
    [ROLE.PARENT]: '家长',
    [ROLE.MEMBER]: '成员',
    [ROLE.CHILD]: '儿童'
  }
  return roleMap[Number(role)] || '未知角色'
}

function getRoleOptions(member, currentRole) {
  const memberRole = Number(member.role)

  if (currentRole === ROLE.OWNER) {
    return [
      { label: '设为家长', role: ROLE.PARENT },
      { label: '设为成员', role: ROLE.MEMBER },
      { label: '设为儿童', role: ROLE.CHILD }
    ].filter((option) => option.role !== memberRole)
  }

  if (currentRole === ROLE.PARENT) {
    return [
      { label: '设为成员', role: ROLE.MEMBER },
      { label: '设为儿童', role: ROLE.CHILD }
    ].filter((option) => option.role !== memberRole)
  }

  return []
}

function canShowRoleAction(member, currentUserId, currentRole) {
  if (sameId(member.userId, currentUserId)) return false
  if (Number(member.role) === ROLE.OWNER) return false
  if (currentRole === ROLE.OWNER) return true
  if (currentRole === ROLE.PARENT) {
    return Number(member.role) === ROLE.MEMBER || Number(member.role) === ROLE.CHILD
  }
  return false
}

Page({
  data: {
    groupInfo: null,
    memberList: [],
    memberCountText: '',
    currentUserId: null,
    currentMemberRole: null,
    isOwner: false,
    canInvite: false,
    isChildRole: false,
    defaultShared: false,
    queryOnlyMyself: 0,
    queryScopeText: '家庭共享',
    isUpdatingDefaultShared: false,
    isLoading: false
  },

  onShow() {
    this.fetchData()
  },

  async fetchData() {
    if (this.data.isLoading) return
    this.setData({ isLoading: true })

    try {
      const groupRes = await getMyGroup()
      const groupInfo = groupRes.data
      if (!groupInfo) {
        familyStore.clearGroup()
        this.setData({
          groupInfo: null,
          memberList: [],
          memberCountText: ''
        })
        return
      }

      familyStore.updateGroup(groupInfo)

      let memberList = []
      if (groupInfo.id) {
        const memberRes = await getMemberList(groupInfo.id)
        memberList = memberRes.data || []
      }

      const derived = this.buildDerivedState(groupInfo, memberList)
      this.setData({
        groupInfo,
        ...derived
      })
    } finally {
      this.setData({ isLoading: false })
    }
  },

  buildDerivedState(groupInfo, rawMemberList) {
    const userInfo = wx.getStorageSync('userInfo') || {}
    const currentUserId = userInfo.id
    const currentMember = rawMemberList.find((member) => sameId(member.userId, currentUserId))
    const currentMemberRole = groupInfo.currentUserRole != null
      ? Number(groupInfo.currentUserRole)
      : currentMember
        ? Number(currentMember.role)
        : null
    const isOwner = sameId(groupInfo.ownerUserId, currentUserId)
    const canInvite = isOwner || currentMemberRole === ROLE.PARENT
    const isChildRole = currentMemberRole === ROLE.CHILD
    const defaultShared = isChildRole ? true : Number(groupInfo.defaultShared) === 1
    const queryOnlyMyself = isChildRole ? 1 : Number(groupInfo.queryOnlyMyself) === 1 ? 1 : 0

    const memberList = rawMemberList.map((member) => ({
      ...member,
      displayName: member.name || member.username || '-',
      roleText: getRoleText(member.role),
      canAssignRole: canShowRoleAction(member, currentUserId, currentMemberRole),
      canRemove: isOwner && Number(member.role) !== ROLE.OWNER
    }))

    return {
      memberList,
      currentUserId,
      currentMemberRole,
      isOwner,
      canInvite,
      isChildRole,
      defaultShared,
      queryOnlyMyself,
      queryScopeText: queryOnlyMyself === 1 ? '仅自己' : '家庭共享',
      memberCountText: `${memberList.length}/${groupInfo.maxMember || 0} 成员`
    }
  },

  goInvite() {
    wx.navigateTo({ url: '/pagesBase/family/invite' })
  },

  goManage() {
    wx.navigateTo({ url: '/pagesBase/family/manage' })
  },

  handleAssignRole(event) {
    const member = this.data.memberList[Number(event.currentTarget.dataset.index)]
    if (!member) return

    const roleOptions = getRoleOptions(member, this.data.currentMemberRole)
    if (roleOptions.length === 0) {
      wx.showToast({
        title: '当前角色无需调整',
        icon: 'none'
      })
      return
    }

    wx.showActionSheet({
      itemList: roleOptions.map((option) => option.label),
      success: async (res) => {
        const selectedOption = roleOptions[res.tapIndex]
        if (!selectedOption) return

        try {
          await assignMemberRole({
            groupId: this.data.groupInfo.id,
            userId: member.userId,
            role: selectedOption.role
          })
          wx.showToast({
            title: '角色调整成功',
            icon: 'success'
          })
          this.fetchData()
        } catch (error) {}
      }
    })
  },

  handleRemoveMember(event) {
    const member = this.data.memberList[Number(event.currentTarget.dataset.index)]
    if (!member) return

    wx.showModal({
      title: '提示',
      content: `确定要移除成员"${member.displayName}"吗？`,
      success: async (res) => {
        if (!res.confirm) return

        try {
          await removeMember({
            groupId: this.data.groupInfo.id,
            userId: member.userId
          })
          wx.showToast({
            title: '移除成功',
            icon: 'success'
          })
          this.fetchData()
        } catch (error) {}
      }
    })
  },

  handleQuit() {
    const groupInfo = this.data.groupInfo
    if (!groupInfo) return

    wx.showModal({
      title: '提示',
      content: `确定要退出"${groupInfo.groupName}"吗？退出后将无法查看家庭组的共享数据。`,
      success: async (res) => {
        if (!res.confirm) return

        try {
          await quitGroup(groupInfo.id)
          wx.showToast({
            title: '退出成功',
            icon: 'success'
          })
          familyStore.clearGroup()
          setTimeout(() => {
            wx.navigateBack()
          }, 1500)
        } catch (error) {}
      }
    })
  },

  async handleDefaultSharedChange(event) {
    const groupInfo = this.data.groupInfo
    if (!groupInfo || !groupInfo.id) return

    if (this.data.isChildRole) {
      this.setData({ defaultShared: true })
      wx.showToast({
        title: '儿童角色不可修改',
        icon: 'none'
      })
      return
    }

    if (this.data.isUpdatingDefaultShared) return

    const previousValue = this.data.defaultShared
    const currentValue = Boolean(event.detail.value)
    this.setData({
      defaultShared: currentValue,
      isUpdatingDefaultShared: true
    })

    try {
      await updateMyDefaultShared({
        groupId: groupInfo.id,
        defaultShared: currentValue ? 1 : 0
      })
      const nextGroup = {
        ...groupInfo,
        defaultShared: currentValue ? 1 : 0
      }
      familyStore.updateGroup(nextGroup)
      sharedScopeStore.setDefaultShared(currentValue)
      this.setData({ groupInfo: nextGroup })
      wx.showToast({
        title: '设置成功',
        icon: 'success'
      })
    } catch (error) {
      this.setData({ defaultShared: previousValue })
    } finally {
      this.setData({ isUpdatingDefaultShared: false })
    }
  },

  handleQueryScopeChange() {
    const groupInfo = this.data.groupInfo
    if (!groupInfo || !groupInfo.id) return

    if (this.data.isChildRole) {
      wx.showToast({
        title: '儿童固定为仅自己',
        icon: 'none'
      })
      return
    }

    wx.showActionSheet({
      itemList: ['家庭共享', '仅自己'],
      success: async (res) => {
        const nextValue = res.tapIndex === 1 ? 1 : 0
        if (nextValue === this.data.queryOnlyMyself) return

        const previousValue = this.data.queryOnlyMyself
        this.setData({
          queryOnlyMyself: nextValue,
          queryScopeText: nextValue === 1 ? '仅自己' : '家庭共享'
        })

        try {
          await updateMyQueryScope({
            groupId: groupInfo.id,
            queryOnlyMyself: nextValue
          })
          const nextGroup = {
            ...groupInfo,
            queryOnlyMyself: nextValue
          }
          familyStore.updateGroup(nextGroup)
          sharedScopeStore.setScope(nextValue === 1 ? 'myself' : 'shared')
          this.setData({ groupInfo: nextGroup })
          wx.showToast({
            title: '设置成功',
            icon: 'success'
          })
        } catch (error) {
          this.setData({
            queryOnlyMyself: previousValue,
            queryScopeText: previousValue === 1 ? '仅自己' : '家庭共享'
          })
        }
      }
    })
  }
})
