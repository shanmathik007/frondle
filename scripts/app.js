/**
 * FRöNDLé - Main Application
 * GitHub-synced version
 */

const App = {
  user: null,
  selectedFriend: null,
  pollInterval: null,

  // ===== Initialization =====
  async init() {
    console.log('🎮 FRöNDLé starting...');
    
    // Initialize UI components
    UI.initTabs();
    UI.initModals();
    UI.initTaskOptions();
    
    // Initialize storage (checks for existing GitHub connection)
    Storage.init();
    
    // Try to load existing user
    this.user = await Storage.getUser();
    
    // Check for invite code in URL
    const inviteCode = this.getUrlParam('invite');
    
    if (this.user) {
      await this.startApp();
      
      if (inviteCode) {
        document.getElementById('friend-code-input').value = inviteCode;
        UI.showModal('add-friend-modal');
      }
    } else {
      UI.showScreen('landing');
      this.updateLandingForGitHub();
      
      if (inviteCode) {
        UI.toast('Connected via invite! Create your profile to continue.', 'info');
      }
    }

    this.bindEvents();
  },

  updateLandingForGitHub() {
    // If already connected to GitHub, skip to profile creation
    if (Storage.isConnected()) {
      document.getElementById('github-connect-section').style.display = 'none';
      document.getElementById('profile-create-section').style.display = 'block';
      document.getElementById('github-status').textContent = `✓ Connected as @${Storage.username}`;
    }
  },

  async startApp() {
    UI.showScreen('dashboard');
    UI.updateProfile(this.user);
    UI.updateStats(this.user);
    await this.renderFriends();
    await this.renderAllTasks();
    this.updateGitHubStatus();
    this.startPolling();
  },

  updateGitHubStatus() {
    const icon = document.getElementById('sync-status-icon');
    const text = document.getElementById('sync-status-text');
    const syncBtn = document.getElementById('sync-now-btn');
    const connectInline = document.getElementById('github-connect-inline');
    const exportBtn = document.getElementById('export-data-btn');
    const backupHint = document.getElementById('backup-hint');

    if (Storage.isConnected()) {
      icon.textContent = '✓';
      text.textContent = `GitHub: @${Storage.username}`;
      text.style.color = 'var(--success)';
      syncBtn.style.display = 'inline-block';
      connectInline.style.display = 'none';
      
      // Hide export (not needed), show backup hint
      if (exportBtn) exportBtn.style.display = 'none';
      if (backupHint) backupHint.style.display = 'block';
    } else {
      icon.textContent = '⚠️';
      text.textContent = 'GitHub: Not connected (local only)';
      text.style.color = 'var(--warning)';
      syncBtn.style.display = 'none';
      connectInline.style.display = 'block';
      
      // Show export (critical for local mode)
      if (exportBtn) exportBtn.style.display = 'block';
      if (backupHint) backupHint.style.display = 'none';
    }
  },

  // ===== Event Bindings =====
  bindEvents() {
    // Landing - GitHub connection
    document.getElementById('connect-github-btn')?.addEventListener('click', () => this.connectGitHub());
    document.getElementById('skip-github-btn')?.addEventListener('click', () => this.skipGitHub());
    document.getElementById('github-token-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.connectGitHub();
    });

    // Landing - Create profile
    document.getElementById('start-btn')?.addEventListener('click', () => this.createProfile());
    document.getElementById('username-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') document.getElementById('display-name-input').focus();
    });
    document.getElementById('display-name-input')?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') this.createProfile();
    });

    // Profile tab - GitHub inline connect
    document.getElementById('inline-connect-btn')?.addEventListener('click', () => this.connectGitHubInline());
    document.getElementById('sync-now-btn')?.addEventListener('click', () => this.syncFromGitHub());

    // Friends tab
    document.getElementById('add-friend-btn')?.addEventListener('click', () => UI.showModal('add-friend-modal'));
    document.getElementById('copy-code-btn')?.addEventListener('click', () => this.copyInviteCode());
    document.getElementById('connect-friend-btn')?.addEventListener('click', () => this.connectFriend());

    // Friend card click -> propose task
    document.getElementById('friends-list')?.addEventListener('click', (e) => {
      const card = e.target.closest('.friend-card');
      if (card) this.openProposeModal(card.dataset.friendId);
    });

    // Task proposal
    document.getElementById('send-proposal-btn')?.addEventListener('click', () => this.sendProposal());
    document.getElementById('spin-wheel-btn')?.addEventListener('click', () => this.spinRandomChallenge());

    // Task actions
    document.getElementById('pending-tasks')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.task-btn');
      if (btn) this.handleTaskAction(btn.dataset.action, btn.dataset.taskId);
    });

    // Profile tab
    document.getElementById('export-data-btn')?.addEventListener('click', () => this.exportData());
    document.getElementById('reset-btn')?.addEventListener('click', () => this.resetAll());
  },

  // ===== GitHub Connection =====
  async connectGitHub() {
    const token = document.getElementById('github-token-input').value.trim();
    
    if (!token) {
      UI.toast('Please enter your GitHub token', 'error');
      return;
    }

    UI.toast('Connecting to GitHub...', 'info');
    
    const result = await Storage.connect(token);
    
    if (result.success) {
      UI.toast(`Connected as @${result.username}! 🎉`, 'success');
      document.getElementById('github-connect-section').style.display = 'none';
      document.getElementById('profile-create-section').style.display = 'block';
      document.getElementById('github-status').textContent = `✓ Connected as @${result.username}`;
    } else {
      UI.toast('Invalid token. Please check and try again.', 'error');
    }
  },

  skipGitHub() {
    UI.toast('Continuing without GitHub. Data will only be saved locally.', 'info');
    document.getElementById('github-connect-section').style.display = 'none';
    document.getElementById('profile-create-section').style.display = 'block';
    document.getElementById('github-status').textContent = '⚠️ Local mode (no sync)';
    document.getElementById('github-status').style.color = 'var(--warning)';
  },

  async connectGitHubInline() {
    const token = document.getElementById('inline-token-input').value.trim();
    
    if (!token) {
      UI.toast('Please enter your GitHub token', 'error');
      return;
    }

    const result = await Storage.connect(token);
    
    if (result.success) {
      UI.toast(`Connected as @${result.username}! Syncing...`, 'success');
      
      // Sync existing local data to GitHub
      if (this.user) {
        this.user.githubUsername = result.username;
        await Storage.saveUser(this.user);
        
        const friends = await Storage.getFriends();
        if (friends.length) await Storage.saveFriends(friends);
        
        const tasks = await Storage.getTasks();
        if (tasks.length) await Storage.saveTasks(tasks);
      }
      
      this.updateGitHubStatus();
    } else {
      UI.toast('Invalid token. Please try again.', 'error');
    }
  },

  async syncFromGitHub() {
    UI.toast('Syncing from GitHub...', 'info');
    
    const data = await Storage.syncFromGitHub();
    
    if (data?.profile) {
      this.user = data.profile;
      UI.updateProfile(this.user);
      UI.updateStats(this.user);
    }
    
    await this.renderFriends();
    await this.renderAllTasks();
    
    UI.toast('Synced! ✓', 'success');
  },

  // ===== Profile Creation =====
  async createProfile() {
    const username = document.getElementById('username-input').value.trim();
    const displayName = document.getElementById('display-name-input').value.trim();

    if (!username || username.length < 3) {
      UI.toast('Username must be at least 3 characters', 'error');
      return;
    }

    if (!displayName) {
      UI.toast('Please enter a display name', 'error');
      return;
    }

    // Create user
    this.user = Storage.createUser(username, displayName);
    await Storage.saveUser(this.user);
    
    UI.toast(`Welcome, ${displayName}! 🎉`, 'success');
    await this.startApp();
  },

  // ===== Friend Management =====
  async connectFriend() {
    const code = document.getElementById('friend-code-input').value.trim().toUpperCase();
    
    if (!code || code.length !== 6) {
      UI.toast('Please enter a valid 6-character code', 'error');
      return;
    }

    if (code === this.user.inviteCode) {
      UI.toast("That's your own code! 😅", 'error');
      return;
    }

    const friendId = 'friend_' + code;
    
    const friend = {
      id: friendId,
      inviteCode: code,
      displayName: `Friend (${code})`,
      avatar: Storage.randomEmoji(),
      isPending: true
    };

    const added = await Storage.addFriend(friend);
    
    if (added) {
      // Create shared gist for this friendship
      const gistId = await Storage.createSharedGist(this.user.id, friendId);
      
      UI.toast('Friend added! Share your code with them.', 'success');
      UI.hideModal();
      document.getElementById('friend-code-input').value = '';
      await this.renderFriends();
    } else {
      UI.toast('Already connected with this code!', 'error');
    }
  },

  async renderFriends() {
    const friends = await Storage.getFriends();
    UI.renderFriends(friends);
    UI.updateStats(this.user);
  },

  copyInviteCode() {
    const code = this.user.inviteCode;
    const baseUrl = window.location.origin + window.location.pathname;
    const url = `${baseUrl}?invite=${code}`;
    
    if (navigator.share) {
      navigator.share({
        title: 'Join me on FRöNDLé!',
        text: `Use my invite code: ${code}`,
        url: url
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => {
        UI.toast('Invite link copied! 📋', 'success');
      });
    }
  },

  // ===== Task Proposals =====
  async openProposeModal(friendId) {
    const friends = await Storage.getFriends();
    const friend = friends.find(f => f.id === friendId);
    
    if (!friend) return;
    
    this.selectedFriend = friend;
    document.getElementById('propose-to-name').textContent = friend.displayName;
    UI.clearTaskSelection();
    UI.showModal('propose-task-modal');
  },

  async sendProposal() {
    const task = UI.getSelectedTask();
    
    if (!task) {
      UI.toast('Please select or type a task', 'error');
      return;
    }

    const gistId = await Storage.getGistId(this.selectedFriend.id);
    
    if (!gistId) {
      // Create one if missing
      await Storage.createSharedGist(this.user.id, this.selectedFriend.id);
    }

    const proposal = {
      type: task.type,
      description: task.description,
      proposerId: this.user.id,
      proposerName: this.user.displayName,
      receiverId: this.selectedFriend.id,
      receiverName: this.selectedFriend.displayName,
      friendName: this.selectedFriend.displayName,
      gistId: gistId,
      status: 'pending'
    };

    // Save to local tasks and sync
    await Storage.addTask(proposal);
    
    // Also update shared gist
    if (gistId) {
      const shared = await Storage.getSharedData(gistId);
      shared.proposals = shared.proposals || [];
      shared.proposals.push({
        ...proposal,
        id: Storage.generateId(),
        createdAt: Date.now()
      });
      await Storage.updateSharedData(gistId, shared);
    }

    UI.toast(`Challenge sent to ${this.selectedFriend.displayName}! 🎯`, 'success');
    UI.hideModal();
    await this.renderAllTasks();
  },

  spinRandomChallenge() {
    const challenges = [
      '💪 Do 20 jumping jacks together',
      '🚶 Take a 10-minute walk',
      '📞 Have a 5-minute voice call',
      '📚 Read one article and share',
      '🍳 Cook the same recipe',
      '🧠 Learn 5 words in a new language',
      '🎲 Send each other a funny meme',
      '🎲 Share your current view/scenery'
    ];

    const random = challenges[Math.floor(Math.random() * challenges.length)];
    document.getElementById('custom-task-input').value = random;
    document.querySelectorAll('.task-option').forEach(o => o.classList.remove('selected'));
    
    UI.toast('Random challenge selected! 🎲', 'info');
  },

  // ===== Task Actions =====
  async handleTaskAction(action, taskId) {
    const tasks = await Storage.getTasks();
    const task = tasks.find(t => t.id === taskId);
    
    if (!task) return;

    const gistId = task.gistId || await Storage.getGistId(
      task.proposerId === this.user.id ? task.receiverId : task.proposerId
    );

    switch(action) {
      case 'accept':
        await Storage.updateTask(taskId, { status: 'accepted' });
        if (gistId) {
          const shared = await Storage.getSharedData(gistId);
          const idx = shared.proposals?.findIndex(p => p.id === taskId);
          if (idx !== -1) {
            shared.proposals[idx].status = 'accepted';
            await Storage.updateSharedData(gistId, shared);
          }
        }
        UI.toast('Challenge accepted! 💪', 'success');
        break;
        
      case 'decline':
        await Storage.updateTask(taskId, { status: 'declined' });
        UI.toast('Challenge declined', 'info');
        break;
        
      case 'complete':
        const amProposer = task.proposerId === this.user.id;
        const updates = amProposer ? { proposerDone: true } : { receiverDone: true };
        
        const updatedTask = await Storage.updateTask(taskId, updates);
        
        // Update shared gist
        if (gistId) {
          const shared = await Storage.getSharedData(gistId);
          const idx = shared.proposals?.findIndex(p => p.id === taskId);
          if (idx !== -1) {
            Object.assign(shared.proposals[idx], updates);
            await Storage.updateSharedData(gistId, shared);
          }
        }
        
        // Check if both done
        const bothDone = (amProposer && task.receiverDone) || (!amProposer && task.proposerDone);
        
        if (bothDone || (updatedTask.proposerDone && updatedTask.receiverDone)) {
          await this.celebrateCompletion(task);
        } else {
          UI.toast('Marked done! Waiting for friend... ⏳', 'success');
        }
        break;
    }

    await this.renderAllTasks();
  },

  async celebrateCompletion(task) {
    // Update stats
    this.user.stats.points += 100;
    this.user.stats.tasksCompleted += 1;
    this.user.stats.streak += 1;
    await Storage.saveUser(this.user);
    
    // Update friend stats
    const friendId = task.proposerId === this.user.id ? task.receiverId : task.proposerId;
    const friends = await Storage.getFriends();
    const friend = friends.find(f => f.id === friendId);
    
    if (friend) {
      await Storage.updateFriend(friendId, {
        tasksCompleted: (friend.tasksCompleted || 0) + 1,
        heat: Math.min(100, (friend.heat || 50) + 10)
      });
    }

    // Mark as completed
    await Storage.updateTask(task.id, { status: 'completed' });
    
    // Show celebration
    document.getElementById('earned-points').textContent = '100';
    UI.showModal('success-modal');
    UI.updateStats(this.user);
    
    setTimeout(() => UI.hideModal(), 3000);
  },

  // ===== Task Rendering =====
  async renderAllTasks() {
    const tasks = await Storage.getTasks();
    
    // Also check shared gists for incoming proposals
    const friends = await Storage.getFriends();
    
    for (const friend of friends) {
      const gistId = await Storage.getGistId(friend.id);
      if (gistId) {
        try {
          const shared = await Storage.getSharedData(gistId);
          for (const proposal of (shared.proposals || [])) {
            // Add if we don't have it locally
            if (!tasks.find(t => t.id === proposal.id)) {
              tasks.push(proposal);
              await Storage.addTask(proposal);
            } else {
              // Update local with remote changes
              const idx = tasks.findIndex(t => t.id === proposal.id);
              if (idx !== -1) {
                Object.assign(tasks[idx], proposal);
                await Storage.updateTask(proposal.id, proposal);
              }
            }
          }
        } catch (e) {
          console.warn('Failed to fetch shared data:', e);
        }
      }
    }

    UI.renderTasks(tasks, this.user.id);
  },

  // ===== Polling for Updates =====
  startPolling() {
    this.pollInterval = setInterval(() => {
      this.renderAllTasks();
    }, 30000);
  },

  stopPolling() {
    if (this.pollInterval) clearInterval(this.pollInterval);
  },

  // ===== Export & Reset =====
  async exportData() {
    const data = await Storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `frondle-backup-${Date.now()}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    UI.toast('Data exported! 📥', 'success');
  },

  async resetAll() {
    const includeGitHub = Storage.isConnected() && 
      confirm('Also reset data on GitHub? (Cancel = local only)');
    
    if (confirm('Are you sure? This will delete all your data!')) {
      await Storage.resetAll(includeGitHub);
      location.reload();
    }
  },

  // ===== Utilities =====
  getUrlParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }
};

// Start when DOM ready
document.addEventListener('DOMContentLoaded', () => App.init());

window.App = App;
