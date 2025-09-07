class DriveBehaviorTagger {
    constructor() {
      this.roadFacingTags = {
        'f1': 'Close Following/Tailgating',
        'f2': 'Lane Cutoff',
        'f3': 'Unsafe Lane Change',
        'f4': 'Stop Sign Violation',
        'f5': 'Running a Red light',
        'f6': 'Forward Collision Warning',
        'f7': 'Near Collision',
        'f8': 'Unsafe Parking',
        'f9': 'Alert driving',
        'f10': 'Safe distancing',
        'f11': 'Possible collision',
        'f12': 'Collision'
      };
  
      this.driverFacingTags = {
        'd1': 'Distraction',
        'd2': 'Cellphone',
        'd3': 'Drowsiness',
        'd4': 'Seat Belt Violation',
        'd5': 'Smoking'
      };
  
      this.selectedTags = new Set();
      this.currentSpeed = 1.0;
      this.waitingForDriverTag = false;
      this.init();
    }
  
    init() {
      this.createUI();
      this.attachEventListeners();
      this.loadSettings();
      this.detectWordsOnPage();
    }
  
    createUI() {
      // Create floating UI panel
      const panel = document.createElement('div');
      panel.id = 'behavior-tagger-panel';
      panel.innerHTML = `
        <div class="tagger-header">
          <h3>Behavior Tagger</h3>
          <button id="toggle-panel">−</button>
        </div>
        <div class="tagger-content">
          <div class="tag-section">
            <h4>Road Facing (F1-F12)</h4>
            <div id="road-tags"></div>
          </div>
          <div class="tag-section">
            <h4>Driver Facing (D1-D5)</h4>
            <div id="driver-tags"></div>
          </div>
          <div class="controls">
            <div>Speed: <span id="speed-display">1.0x</span></div>
            <div class="shortcuts-info">
              <small>F1-F12: Road tags | D+1-5: Driver tags<br>
              Ctrl+↑↓: Speed | Ctrl+Space: Submit | Alt+F: Fullscreen</small>
            </div>
            <button id="submit-tags">Submit (Ctrl+Space)</button>
            <button id="clear-tags">Clear All</button>
          </div>
          <div class="detected-words">
            <h4>Detected Words</h4>
            <div id="word-list"></div>
          </div>
        </div>
      `;
  
      // Add styles
      const style = document.createElement('style');
      style.textContent = `
        #behavior-tagger-panel {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 320px;
          background: #fff;
          border: 2px solid #333;
          border-radius: 8px;
          font-family: Arial, sans-serif;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          max-height: 80vh;
          overflow: hidden;
        }
        .tagger-header {
          background: #333;
          color: white;
          padding: 10px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .tagger-header h3 {
          margin: 0;
          font-size: 16px;
        }
        #toggle-panel {
          background: none;
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          padding: 0;
          width: 20px;
          height: 20px;
        }
        .tagger-content {
          padding: 15px;
          max-height: 500px;
          overflow-y: auto;
        }
        .tag-section {
          margin-bottom: 15px;
        }
        .tag-section h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #333;
        }
        .tag-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px 8px;
          margin: 2px 0;
          background: #f0f0f0;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          transition: all 0.2s;
        }
        .tag-item:hover {
          background: #e0e0e0;
        }
        .tag-item.selected {
          background: #4CAF50;
          color: white;
        }
        .tag-item .tag-name {
          flex: 1;
          text-align: left;
        }
        .tag-item .tag-key {
          background: rgba(0,0,0,0.1);
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: bold;
        }
        .tag-item.selected .tag-key {
          background: rgba(255,255,255,0.2);
        }
        .controls {
          border-top: 1px solid #ddd;
          padding-top: 10px;
          text-align: center;
        }
        .shortcuts-info {
          margin: 8px 0;
          color: #666;
          font-size: 10px;
          line-height: 1.2;
        }
        #speed-display {
          font-weight: bold;
          color: #2196F3;
        }
        #submit-tags, #clear-tags {
          background: #2196F3;
          color: white;
          border: none;
          padding: 8px 12px;
          border-radius: 4px;
          cursor: pointer;
          margin: 5px;
          font-size: 12px;
        }
        #clear-tags {
          background: #f44336;
        }
        #submit-tags:hover {
          background: #1976D2;
        }
        #clear-tags:hover {
          background: #d32f2f;
        }
        .detected-words {
          border-top: 1px solid #ddd;
          padding-top: 10px;
          margin-top: 10px;
        }
        .detected-words h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #333;
        }
        .detected-word {
          display: inline-block;
          background: #FFF3E0;
          color: #E65100;
          padding: 3px 6px;
          margin: 2px;
          border-radius: 3px;
          font-size: 11px;
          cursor: pointer;
          border: 1px solid #FFB74D;
        }
        .detected-word:hover {
          background: #FFE0B2;
        }
        .detected-word.matched {
          background: #4CAF50;
          color: white;
          border-color: #4CAF50;
        }
        .notification {
          position: fixed;
          top: 50px;
          left: 50%;
          transform: translateX(-50%);
          background: #4CAF50;
          color: white;
          padding: 10px 20px;
          border-radius: 4px;
          z-index: 10001;
          animation: fadeInOut 3s forwards;
        }
        @keyframes fadeInOut {
          0%, 100% { opacity: 0; }
          20%, 80% { opacity: 1; }
        }
      `;
  
      document.head.appendChild(style);
      document.body.appendChild(panel);
  
      this.renderTags();
    }
  
    renderTags() {
      const roadContainer = document.getElementById('road-tags');
      const driverContainer = document.getElementById('driver-tags');
  
      // Clear existing content
      roadContainer.innerHTML = '';
      driverContainer.innerHTML = '';
  
      // Render road facing tags
      Object.entries(this.roadFacingTags).forEach(([key, value]) => {
        const tagElement = document.createElement('div');
        tagElement.className = 'tag-item';
        tagElement.dataset.key = key;
        tagElement.innerHTML = `
          <span class="tag-name">${value}</span>
          <span class="tag-key">${key.toUpperCase()}</span>
        `;
        tagElement.addEventListener('click', () => this.toggleTag(key));
        roadContainer.appendChild(tagElement);
      });
  
      // Render driver facing tags
      Object.entries(this.driverFacingTags).forEach(([key, value]) => {
        const tagElement = document.createElement('div');
        tagElement.className = 'tag-item';
        tagElement.dataset.key = key;
        tagElement.innerHTML = `
          <span class="tag-name">${value}</span>
          <span class="tag-key">${key.toUpperCase()}</span>
        `;
        tagElement.addEventListener('click', () => this.toggleTag(key));
        driverContainer.appendChild(tagElement);
      });
    }
  
    detectWordsOnPage() {
      const allTags = {...this.roadFacingTags, ...this.driverFacingTags};
      const tagValues = Object.values(allTags).map(tag => tag.toLowerCase());
      const pageText = document.body.innerText.toLowerCase();
      const detectedWords = new Set();
  
      // Check for tag words on the page
      tagValues.forEach(tag => {
        const words = tag.split(/\s+/);
        words.forEach(word => {
          if (word.length > 3 && pageText.includes(word)) {
            detectedWords.add(word);
          }
        });
      });
  
      // Also check for common driving-related words
      const drivingWords = ['collision', 'tailgating', 'distraction', 'cellphone', 'drowsiness', 
                           'speeding', 'violation', 'unsafe', 'following', 'cutoff'];
      drivingWords.forEach(word => {
        if (pageText.includes(word)) {
          detectedWords.add(word);
        }
      });
  
      this.displayDetectedWords(Array.from(detectedWords));
    }
  
    displayDetectedWords(words) {
      const wordList = document.getElementById('word-list');
      wordList.innerHTML = '';
  
      if (words.length === 0) {
        wordList.innerHTML = '<small>No driving-related terms detected</small>';
        return;
      }
  
      words.forEach(word => {
        const wordElement = document.createElement('span');
        wordElement.className = 'detected-word';
        wordElement.textContent = word;
        wordElement.addEventListener('click', () => this.highlightMatchingTags(word));
        wordList.appendChild(wordElement);
      });
    }
  
    highlightMatchingTags(word) {
      const allTags = {...this.roadFacingTags, ...this.driverFacingTags};
      let matchFound = false;
  
      Object.entries(allTags).forEach(([key, value]) => {
        if (value.toLowerCase().includes(word.toLowerCase())) {
          this.toggleTag(key);
          matchFound = true;
        }
      });
  
      if (matchFound) {
        this.showNotification(`Auto-selected tags containing "${word}"`);
        // Mark the word as matched
        event.target.classList.add('matched');
      }
    }
  
    attachEventListeners() {
      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        // Handle Ctrl combinations
        if (e.ctrlKey || e.metaKey) {
          switch(e.key) {
            case 'ArrowUp':
              e.preventDefault();
              this.increaseSpeed();
              break;
            case 'ArrowDown':
              e.preventDefault();
              this.decreaseSpeed();
              break;
            case ' ': // Space key
              e.preventDefault();
              this.submitTags();
              break;
          }
          return;
        }
  
        // Alt combinations
        if (e.altKey && !e.ctrlKey) {
          switch(e.key.toLowerCase()) {
            case 'f':
              e.preventDefault();
              this.toggleFullscreen();
              break;
          }
          return;
        }
  
        // Function keys for road facing tags (F1-F12)
        if (e.key.startsWith('F') && !e.ctrlKey && !e.altKey && !e.shiftKey) {
          e.preventDefault();
          const keyNum = e.key.substring(1);
          const tagKey = `f${keyNum}`;
          if (this.roadFacingTags[tagKey]) {
            this.toggleTag(tagKey);
          }
          return;
        }
  
        // D key for driver facing tags
        if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
          e.preventDefault();
          this.waitingForDriverTag = true;
          this.showNotification('Press 1-5 for driver tag');
          setTimeout(() => {
            this.waitingForDriverTag = false;
          }, 2000);
          return;
        }
  
        // Number keys when waiting for driver tag
        if (this.waitingForDriverTag && /^[1-5]$/.test(e.key)) {
          e.preventDefault();
          const tagKey = `d${e.key}`;
          this.toggleTag(tagKey);
          this.waitingForDriverTag = false;
          return;
        }
      });
  
      // Submit button
      document.getElementById('submit-tags').addEventListener('click', () => {
        this.submitTags();
      });
  
      // Clear button
      document.getElementById('clear-tags').addEventListener('click', () => {
        this.clearAllTags();
      });
  
      // Panel toggle
      document.getElementById('toggle-panel').addEventListener('click', (e) => {
        const content = document.querySelector('.tagger-content');
        const button = e.target;
        if (content.style.display === 'none') {
          content.style.display = 'block';
          button.textContent = '−';
        } else {
          content.style.display = 'none';
          button.textContent = '+';
        }
      });
  
      // Listen for messages from background script
      chrome.runtime.onMessage.addListener((message) => {
        switch(message.action) {
          case 'toggle-fullscreen':
            this.toggleFullscreen();
            break;
          case 'increase-speed':
            this.increaseSpeed();
            break;
          case 'decrease-speed':
            this.decreaseSpeed();
            break;
          case 'submit-tags':
            this.submitTags();
            break;
        }
      });
    }
  
    toggleTag(tagKey) {
      const tagElement = document.querySelector(`[data-key="${tagKey}"]`);
      
      if (this.selectedTags.has(tagKey)) {
        this.selectedTags.delete(tagKey);
        tagElement.classList.remove('selected');
      } else {
        this.selectedTags.add(tagKey);
        tagElement.classList.add('selected');
      }
  
      this.saveSettings();
      
      // Show which tag was toggled
      const tagName = this.roadFacingTags[tagKey] || this.driverFacingTags[tagKey];
      const action = this.selectedTags.has(tagKey) ? 'Selected' : 'Deselected';
      this.showNotification(`${action}: ${tagName}`);
    }
  
    clearAllTags() {
      this.selectedTags.clear();
      document.querySelectorAll('.tag-item.selected').forEach(el => {
        el.classList.remove('selected');
      });
      this.saveSettings();
      this.showNotification('All tags cleared');
    }
  
    increaseSpeed() {
      this.currentSpeed = Math.min(3.0, this.currentSpeed + 0.25);
      this.updateSpeed();
    }
  
    decreaseSpeed() {
      this.currentSpeed = Math.max(0.25, this.currentSpeed - 0.25);
      this.updateSpeed();
    }
  
    updateSpeed() {
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        video.playbackRate = this.currentSpeed;
      });
      
      document.getElementById('speed-display').textContent = `${this.currentSpeed}x`;
      this.saveSettings();
      this.showNotification(`Speed: ${this.currentSpeed}x`);
    }
  
    toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          console.log('Fullscreen request failed:', err);
        });
        this.showNotification('Entering fullscreen');
      } else {
        document.exitFullscreen();
        this.showNotification('Exiting fullscreen');
      }
    }
  
    submitTags() {
      if (this.selectedTags.size === 0) {
        this.showNotification('No tags selected to submit');
        return;
      }
  
      const selectedTagNames = Array.from(this.selectedTags).map(key => {
        return this.roadFacingTags[key] || this.driverFacingTags[key];
      });
  
      // Create submission data
      const submissionData = {
        timestamp: new Date().toISOString(),
        tags: selectedTagNames,
        speed: this.currentSpeed,
        url: window.location.href,
        tagKeys: Array.from(this.selectedTags)
      };
  
      // Log to console (replace with actual API call to your backend)
      console.log('Submitting tags:', submissionData);
      
      // Store in localStorage as backup
      const existingData = JSON.parse(localStorage.getItem('submittedTags') || '[]');
      existingData.push(submissionData);
      localStorage.setItem('submittedTags', JSON.stringify(existingData));
  
      // Show confirmation
      this.showNotification(`Submitted ${selectedTagNames.length} tags successfully!`);
  
      // Clear selected tags after submission
      setTimeout(() => {
        this.clearAllTags();
      }, 1000);
    }
  
    showNotification(message) {
      // Remove existing notification
      const existing = document.querySelector('.notification');
      if (existing) existing.remove();
  
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.textContent = message;
  
      document.body.appendChild(notification);
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 3000);
    }
  
    saveSettings() {
      const settings = {
        selectedTags: Array.from(this.selectedTags),
        currentSpeed: this.currentSpeed
      };
      localStorage.setItem('behaviorTaggerSettings', JSON.stringify(settings));
    }
  
    loadSettings() {
      const saved = localStorage.getItem('behaviorTaggerSettings');
      if (saved) {
        try {
          const settings = JSON.parse(saved);
          this.selectedTags = new Set(settings.selectedTags || []);
          this.currentSpeed = settings.currentSpeed || 1.0;
          
          // Update UI
          this.selectedTags.forEach(key => {
            const element = document.querySelector(`[data-key="${key}"]`);
            if (element) element.classList.add('selected');
          });
          
          const speedDisplay = document.getElementById('speed-display');
          if (speedDisplay) {
            speedDisplay.textContent = `${this.currentSpeed}x`;
          }
        } catch (e) {
          console.log('Error loading settings:', e);
        }
      }
    }
  }
  
  // Initialize when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new DriveBehaviorTagger());
  } else {
    new DriveBehaviorTagger();
  }
  