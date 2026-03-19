/**
 * UI Module
 * Handles modals, toasts, tab switching, and DOM updates
 */

const UI = {
  // ===== Screen Management =====
  showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId)?.classList.add('active');
  },

  // ===== Tab Management =====
  initTabs() {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Update button states
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        
        // Show corresponding content
        const tabId = btn.dataset.tab;
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(`${tabId}-tab`)?.classList.add('active');
      });
    });
  },

  // ===== Modal Management =====
  showModal(modalId) {
    document.getElementById('modal-overlay').classList.add('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    document.getElementById(modalId)?.classList.add('active');
  },

  hideModal() {
    document.getElementById('modal-overlay').classList.remove('active');
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  },

  initModals() {
    // Close on overlay click
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') {
        this.hideModal();
      }
    });

    // Close buttons
    document.querySelectorAll('.close-btn').forEach(btn => {
      btn.addEventListener('click', () => this.hideModal());
    });

    // Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.hideModal();
    });
  },

  // ===== Toast Notifications =====
  toast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '✓',
      error: '✗',
      info: 'ℹ'
    };
    
    toast.innerHTML = `<span>${icons[type] || ''}</span> ${message}`;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.style.animation = 'slideUp 0.3s ease reverse';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  // ===== Friend List Rendering =====
  renderFriends(friends) {
    const container = document.getElementById('friends-list');
    
    if (!friends || friends.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <span class="emoji">👋</span>
          <p>No friends yet! Share your invite code to connect.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = friends.map(friend => `
      <div class="friend-card" data-friend-id="${friend.id}">
        <div class="friend-avatar">${friend.avatar || '😊'}</div>
        <div class="friend-info">
          <div class="friend-name">${friend.displayName}</div>
          <div class="friend-stats">
            ${friend.tasksCompleted || 0} tasks · ${friend.currentStreak || 0}🔥 streak
          </div>
        </div>
        <div class="friend-heat">${this.getHeatEmoji(friend.heat || 50)}</div>
      </div>
    `).join('');
  },

  getHeatEmoji(heat) {
    if (heat >= 80) return '🔥';
    if (heat >= 60) return '☀️';
    if (heat >= 40) return '🌤️';
    if (heat >= 20) return '❄️';
    return '🥶';
  },

  getHeatClass(heat) {
    if (heat >= 80) return 'heat-blazing';
    if (heat >= 60) return 'heat-hot';
    if (heat >= 40) return 'heat-warm';
    return 'heat-cold';
  },

  // ===== Task List Rendering =====
  renderTasks(tasks, userId) {
    const pendingContainer = document.getElementById('pending-tasks');
    const completedContainer = document.getElementById('completed-tasks');
    
    const pending = tasks.filter(t => t.status !== 'completed');
    const completed = tasks.filter(t => t.status === 'completed');
    
    if (pending.length === 0) {
      pendingContainer.innerHTML = `
        <div class="empty-state">
          <span class="emoji">✨</span>
          <p>No active tasks. Propose one to a friend!</p>
        </div>
      `;
    } else {
      pendingContainer.innerHTML = pending.map(task => this.renderTaskCard(task, userId)).join('');
    }

    if (completed.length === 0) {
      completedContainer.innerHTML = '<p class="hint" style="text-align:center; padding:20px;">No completed tasks yet</p>';
    } else {
      completedContainer.innerHTML = completed.slice(0, 10).map(task => `
        <div class="task-card">
          <span class="emoji">${this.getTaskEmoji(task.type)}</span>
          <div class="task-info">
            <div class="task-title">${task.description}</div>
            <div class="task-meta">with ${task.friendName} · +100 pts</div>
          </div>
          <span style="color: var(--success);">✓</span>
        </div>
      `).join('');
    }
  },

  renderTaskCard(task, userId) {
    const isProposer = task.proposerId === userId;
    const myDone = isProposer ? task.proposerDone : task.receiverDone;
    const theirDone = isProposer ? task.receiverDone : task.proposerDone;
    
    let statusClass = 'pending';
    let actions = '';
    let meta = '';

    if (task.status === 'pending') {
      if (!isProposer) {
        // I received this proposal
        actions = `
          <button class="task-btn accept" data-action="accept" data-task-id="${task.id}">Accept</button>
          <button class="task-btn decline" data-action="decline" data-task-id="${task.id}">✗</button>
        `;
        meta = `from ${task.proposerName}`;
      } else {
        meta = `waiting for ${task.receiverName} to accept`;
        statusClass = 'waiting';
      }
    } else if (task.status === 'accepted') {
      statusClass = 'accepted';
      
      if (!myDone) {
        actions = `<button class="task-btn complete" data-action="complete" data-task-id="${task.id}">Done!</button>`;
      }
      
      if (myDone && !theirDone) {
        meta = `waiting for ${isProposer ? task.receiverName : task.proposerName}`;
      } else if (!myDone && theirDone) {
        meta = `${isProposer ? task.receiverName : task.proposerName} is done! Your turn!`;
      } else {
        meta = `with ${isProposer ? task.receiverName : task.proposerName}`;
      }
    }

    return `
      <div class="task-card ${statusClass}">
        <span class="emoji">${this.getTaskEmoji(task.type)}</span>
        <div class="task-info">
          <div class="task-title">${task.description}</div>
          <div class="task-meta">${meta}</div>
        </div>
        <div class="task-actions">${actions}</div>
      </div>
    `;
  },

  getTaskEmoji(type) {
    const emojis = {
      workout: '💪',
      read: '📚',
      walk: '🚶',
      cook: '🍳',
      call: '📞',
      learn: '🧠',
      custom: '🎯',
      random: '🎲'
    };
    return emojis[type] || '🎯';
  },

  // ===== Stats Update =====
  updateStats(user) {
    // Mini stats in header
    document.getElementById('streak-count').textContent = user.stats.streak || 0;
    document.getElementById('points-count').textContent = user.stats.points || 0;
    
    // Profile tab stats
    document.getElementById('stat-points').textContent = user.stats.points || 0;
    document.getElementById('stat-streak').textContent = user.stats.streak || 0;
    document.getElementById('stat-tasks').textContent = user.stats.tasksCompleted || 0;
    document.getElementById('stat-friends').textContent = Storage.getFriends().length;
  },

  // ===== Profile Update =====
  updateProfile(user) {
    document.getElementById('user-display-name').textContent = user.displayName;
    document.getElementById('profile-name').textContent = user.displayName;
    document.getElementById('profile-username').textContent = user.username;
    document.getElementById('profile-avatar').textContent = user.avatar || '😊';
    document.getElementById('my-invite-code').textContent = user.inviteCode;
    
    // Build invite URL
    const baseUrl = window.location.origin + window.location.pathname;
    document.getElementById('my-invite-link').textContent = `${baseUrl}?invite=${user.inviteCode}`;
  },

  // ===== Task Selection =====
  initTaskOptions() {
    const options = document.querySelectorAll('.task-option');
    options.forEach(opt => {
      opt.addEventListener('click', () => {
        options.forEach(o => o.classList.remove('selected'));
        opt.classList.add('selected');
        document.getElementById('custom-task-input').value = '';
      });
    });

    document.getElementById('custom-task-input')?.addEventListener('focus', () => {
      options.forEach(o => o.classList.remove('selected'));
    });
  },

  getSelectedTask() {
    const selected = document.querySelector('.task-option.selected');
    const custom = document.getElementById('custom-task-input').value.trim();
    
    if (custom) {
      return { type: 'custom', description: custom };
    }
    
    if (selected) {
      return {
        type: selected.dataset.task,
        description: selected.textContent.trim()
      };
    }
    
    return null;
  },

  clearTaskSelection() {
    document.querySelectorAll('.task-option').forEach(o => o.classList.remove('selected'));
    document.getElementById('custom-task-input').value = '';
  }
};

// Make globally available
window.UI = UI;
