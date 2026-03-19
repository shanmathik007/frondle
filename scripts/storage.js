/**
 * GitHub Storage Manager
 * Syncs all data to user's GitHub repo and uses Gists for shared friendship data
 * 
 * Data Structure in your repo:
 *   data/profile.json   - Your profile, points, streaks
 *   data/tasks.json     - Your task history  
 *   data/friends.json   - Friend list with gist IDs
 *   data/gists.json     - Maps friendId -> shared gistId
 * 
 * Shared Data (per friendship):
 *   GitHub Gist with shared.json - proposals, completed tasks
 */

const Storage = {
  token: null,
  username: null,
  repo: 'frondle',
  
  // ===== Initialization =====
  init() {
    this.token = localStorage.getItem('gh_token');
    this.username = localStorage.getItem('gh_username');
    this.repo = localStorage.getItem('gh_repo') || 'frondle';
    return this.isConnected();
  },

  isConnected() {
    return !!(this.token && this.username);
  },

  // ===== GitHub Connection =====
  async connect(token) {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (!response.ok) throw new Error('Invalid token');

      const user = await response.json();
      
      this.token = token;
      this.username = user.login;
      
      localStorage.setItem('gh_token', token);
      localStorage.setItem('gh_username', user.login);
      
      return { success: true, username: user.login };
    } catch (error) {
      return { success: false, error: error.message };
    }
  },

  disconnect() {
    this.token = null;
    this.username = null;
    localStorage.removeItem('gh_token');
    localStorage.removeItem('gh_username');
  },

  // ===== GitHub File Operations =====
  async getFile(path) {
    if (!this.isConnected()) return null;

    try {
      const response = await fetch(
        `https://api.github.com/repos/${this.username}/${this.repo}/contents/${path}`,
        {
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );

      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      return {
        content: JSON.parse(atob(data.content)),
        sha: data.sha
      };
    } catch (error) {
      console.error(`Get ${path}:`, error);
      return null;
    }
  },

  async saveFile(path, content, message = 'Update') {
    if (!this.isConnected()) {
      // Fallback to localStorage
      localStorage.setItem(`frondle_${path}`, JSON.stringify(content));
      return true;
    }

    try {
      const existing = await this.getFile(path);
      
      const body = {
        message: `🎮 ${message}`,
        content: btoa(unescape(encodeURIComponent(JSON.stringify(content, null, 2)))),
        branch: 'main'
      };

      if (existing?.sha) body.sha = existing.sha;

      const response = await fetch(
        `https://api.github.com/repos/${this.username}/${this.repo}/contents/${path}`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${this.token}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body)
        }
      );

      return response.ok;
    } catch (error) {
      console.error(`Save ${path}:`, error);
      // Fallback to localStorage
      localStorage.setItem(`frondle_${path}`, JSON.stringify(content));
      return false;
    }
  },

  // ===== User Profile =====
  async getUser() {
    if (this.isConnected()) {
      const file = await this.getFile('data/profile.json');
      if (file?.content) {
        localStorage.setItem('frondle_user', JSON.stringify(file.content));
        return file.content;
      }
    }
    
    const local = localStorage.getItem('frondle_user');
    return local ? JSON.parse(local) : null;
  },

  async saveUser(user) {
    const data = { ...user, lastUpdated: Date.now() };
    localStorage.setItem('frondle_user', JSON.stringify(data));
    
    if (this.isConnected()) {
      await this.saveFile('data/profile.json', data, 'Update profile');
    }
    return data;
  },

  createUser(username, displayName) {
    return {
      id: this.generateId(),
      username: username.toLowerCase().trim(),
      displayName: displayName.trim(),
      inviteCode: this.generateInviteCode(),
      githubUsername: this.username || null,
      avatar: this.randomEmoji(),
      stats: {
        points: 0,
        streak: 0,
        tasksCompleted: 0,
        longestStreak: 0
      },
      lastActive: Date.now(),
      createdAt: Date.now()
    };
  },

  // ===== Friends =====
  async getFriends() {
    if (this.isConnected()) {
      const file = await this.getFile('data/friends.json');
      if (file?.content?.friends) {
        localStorage.setItem('frondle_friends', JSON.stringify(file.content.friends));
        return file.content.friends;
      }
    }
    
    const local = localStorage.getItem('frondle_friends');
    return local ? JSON.parse(local) : [];
  },

  async saveFriends(friends) {
    localStorage.setItem('frondle_friends', JSON.stringify(friends));
    
    if (this.isConnected()) {
      await this.saveFile('data/friends.json', { friends, lastUpdated: Date.now() }, `Friends: ${friends.length}`);
    }
  },

  async addFriend(friend) {
    const friends = await this.getFriends();
    if (friends.find(f => f.inviteCode === friend.inviteCode)) return false;
    
    friends.push({
      ...friend,
      addedAt: Date.now(),
      heat: 50,
      tasksCompleted: 0,
      currentStreak: 0
    });
    
    await this.saveFriends(friends);
    return true;
  },

  async updateFriend(friendId, updates) {
    const friends = await this.getFriends();
    const index = friends.findIndex(f => f.id === friendId);
    if (index !== -1) {
      friends[index] = { ...friends[index], ...updates };
      await this.saveFriends(friends);
    }
  },

  // ===== Tasks =====
  async getTasks() {
    if (this.isConnected()) {
      const file = await this.getFile('data/tasks.json');
      if (file?.content?.tasks) {
        localStorage.setItem('frondle_tasks', JSON.stringify(file.content.tasks));
        return file.content.tasks;
      }
    }
    
    const local = localStorage.getItem('frondle_tasks');
    return local ? JSON.parse(local) : [];
  },

  async saveTasks(tasks) {
    localStorage.setItem('frondle_tasks', JSON.stringify(tasks));
    
    if (this.isConnected()) {
      await this.saveFile('data/tasks.json', { tasks, lastUpdated: Date.now() }, `Tasks: ${tasks.length}`);
    }
  },

  async addTask(task) {
    const tasks = await this.getTasks();
    const newTask = { ...task, id: this.generateId(), createdAt: Date.now() };
    tasks.push(newTask);
    await this.saveTasks(tasks);
    return newTask;
  },

  async updateTask(taskId, updates) {
    const tasks = await this.getTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    if (index !== -1) {
      tasks[index] = { ...tasks[index], ...updates };
      await this.saveTasks(tasks);
      return tasks[index];
    }
    return null;
  },

  // ===== Shared Gists (for friendship data) =====
  async getGistMappings() {
    if (this.isConnected()) {
      const file = await this.getFile('data/gists.json');
      return file?.content || {};
    }
    const local = localStorage.getItem('frondle_gists');
    return local ? JSON.parse(local) : {};
  },

  async saveGistMapping(friendId, gistId) {
    const gists = await this.getGistMappings();
    gists[friendId] = gistId;
    
    localStorage.setItem('frondle_gists', JSON.stringify(gists));
    
    if (this.isConnected()) {
      await this.saveFile('data/gists.json', gists, 'Update gist mapping');
    }
  },

  async getGistId(friendId) {
    const gists = await this.getGistMappings();
    return gists[friendId];
  },

  async createSharedGist(myUserId, friendId) {
    if (!this.isConnected()) {
      // Fallback: local-only ID
      const localId = 'local_' + this.generateId();
      await this.saveGistMapping(friendId, localId);
      return localId;
    }

    try {
      const response = await fetch('https://api.github.com/gists', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: `FRöNDLé shared tasks`,
          public: true,
          files: {
            'shared.json': {
              content: JSON.stringify({
                users: [myUserId, friendId],
                proposals: [],
                completedTasks: [],
                createdAt: Date.now()
              }, null, 2)
            }
          }
        })
      });

      if (!response.ok) throw new Error('Gist creation failed');

      const gist = await response.json();
      await this.saveGistMapping(friendId, gist.id);
      return gist.id;
    } catch (error) {
      console.error('Create gist error:', error);
      const localId = 'local_' + this.generateId();
      await this.saveGistMapping(friendId, localId);
      return localId;
    }
  },

  async getSharedData(gistId) {
    if (gistId.startsWith('local_')) {
      const local = localStorage.getItem(`gist_${gistId}`);
      return local ? JSON.parse(local) : { proposals: [], completedTasks: [] };
    }

    try {
      const response = await fetch(`https://api.github.com/gists/${gistId}`);
      if (!response.ok) throw new Error('Fetch failed');

      const gist = await response.json();
      return JSON.parse(gist.files['shared.json'].content);
    } catch (error) {
      console.error('Get gist error:', error);
      return { proposals: [], completedTasks: [] };
    }
  },

  async updateSharedData(gistId, data) {
    if (gistId.startsWith('local_')) {
      localStorage.setItem(`gist_${gistId}`, JSON.stringify(data));
      return true;
    }

    if (!this.isConnected()) return false;

    try {
      const response = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: {
            'shared.json': {
              content: JSON.stringify({ ...data, lastUpdated: Date.now() }, null, 2)
            }
          }
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Update gist error:', error);
      return false;
    }
  },

  // ===== Get Friend's Public Profile =====
  async getFriendProfile(githubUsername) {
    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/${githubUsername}/frondle/main/data/profile.json`
      );
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  },

  // ===== Reset All Data =====
  async resetAll(includeGitHub = false) {
    // Clear localStorage
    ['frondle_user', 'frondle_friends', 'frondle_tasks', 'frondle_gists'].forEach(key => {
      localStorage.removeItem(key);
    });

    // Optionally reset GitHub files
    if (includeGitHub && this.isConnected()) {
      await this.saveFile('data/profile.json', {}, 'Reset profile');
      await this.saveFile('data/tasks.json', { tasks: [] }, 'Reset tasks');
      await this.saveFile('data/friends.json', { friends: [] }, 'Reset friends');
      await this.saveFile('data/gists.json', {}, 'Reset gists');
    }
  },

  // ===== Export All Data =====
  async exportAll() {
    return {
      profile: await this.getUser(),
      friends: await this.getFriends(),
      tasks: await this.getTasks(),
      gists: await this.getGistMappings(),
      exportedAt: Date.now()
    };
  },

  // ===== Full Sync from GitHub =====
  async syncFromGitHub() {
    if (!this.isConnected()) return null;
    
    const profile = await this.getUser();
    const friends = await this.getFriends();
    const tasks = await this.getTasks();
    
    return { profile, friends, tasks };
  },

  // ===== Utilities =====
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  generateInviteCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    return code;
  },

  randomEmoji() {
    const emojis = ['😊', '😎', '🤩', '🥳', '😄', '🙂', '😁', '🤗', '😇', '🦊', '🐱', '🐶', '🦁', '🐯', '🐮'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }
};

// Initialize on load
Storage.init();

// Make globally available
window.Storage = Storage;
