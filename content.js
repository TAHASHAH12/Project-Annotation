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
  
      // Keywords to detect and their corresponding checkboxes
      this.keywordToCheckbox = {
        'tailgating': ['following', 'tailgate', 'close follow'],
        'lane cutoff': ['cutoff', 'cut off', 'lane cut'],
        'unsafe lane change': ['unsafe lane', 'lane change', 'improper lane'],
        'stop sign': ['stop sign', 'stop violation'],
        'red light': ['red light', 'running red', 'light violation'],
        'collision': ['collision', 'crash', 'impact'],
        'near collision': ['near miss', 'near collision', 'almost crash'],
        'distraction': ['distracted', 'distraction', 'not paying attention'],
        'cellphone': ['phone', 'cell phone', 'mobile', 'texting'],
        'drowsiness': ['drowsy', 'sleepy', 'tired', 'fatigue'],
        'seatbelt': ['seat belt', 'seatbelt', 'belt violation'],
        'smoking': ['smoke', 'smoking', 'cigarette']
      };
  
      this.selectedTags = new Set();
      this.currentSpeed = 1.0;
      this.waitingForDriverTag = false;
      this.autoDetectionEnabled = true;
      this.observedCheckboxes = new Set();
      
      this.init();
    }
  
    init() {
      this.createUI();
      this.attachEventListeners();
      this.loadSettings();
      this.startAutoDetection();
    }
  
    createUI() {
      // Create floating UI panel
      const panel = document.createElement('div');
      panel.id = 'behavior-tagger-panel';
      panel.innerHTML = `
        <div class="tagger-header">
          <h3>Auto Behavior Tagger</h3>
          <button id="toggle-panel">−</button>
        </div>
        <div class="tagger-content">
          <div class="auto-detection">
            <label>
              <input type="checkbox" id="auto-detection-toggle" ${this.autoDetectionEnabled ? 'checked' : ''}>
              Auto-detect and click checkboxes
            </label>
          </div>
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
              <small>Auto-detects words and clicks checkboxes<br>
              Ctrl+↑↓: Speed | Ctrl+Space: Submit | Alt+F: Fullscreen</small>
            </div>
            <button id="submit-tags">Submit (Ctrl+Space)</button>
            <button id="clear-tags">Clear All</button>
          </div>
          <div class="detected-actions">
            <h4>Auto-Detection Log</h4>
            <div id="detection-log"></div>
          </div>
          <div class="found-checkboxes">
            <h4>Found Checkboxes</h4>
            <div id="checkbox-list"></div>
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
          width: 350px;
          background: #fff;
          border: 2px solid #333;
          border-radius: 8px;
          font-family: Arial, sans-serif;
          z-index: 10000;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
          max-height: 85vh;
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
        .auto-detection {
          margin-bottom: 15px;
          padding: 8px;
          background: #f0f8ff;
          border-radius: 4px;
          border: 1px solid #4CAF50;
        }
        .auto-detection label {
          font-size: 12px;
          font-weight: bold;
          color: #2196F3;
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
        .tag-item.auto-selected {
          background: #FF9800;
          color: white;
          border: 2px solid #F57C00;
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
        .tag-item.selected .tag-key, .tag-item.auto-selected .tag-key {
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
        .detected-actions, .found-checkboxes {
          border-top: 1px solid #ddd;
          padding-top: 10px;
          margin-top: 10px;
        }
        .detected-actions h4, .found-checkboxes h4 {
          margin: 0 0 8px 0;
          font-size: 14px;
          color: #333;
        }
        .detection-log {
          max-height: 100px;
          overflow-y: auto;
          font-size: 11px;
          background: #f9f9f9;
          padding: 5px;
          border-radius: 3px;
        }
        .log-entry {
          margin: 2px 0;
          color: #666;
        }
        .log-entry.success {
          color: #4CAF50;
          font-weight: bold;
        }
        .log-entry.error {
          color: #f44336;
        }
        .checkbox-info {
          font-size: 11px;
          background: #fff3e0;
          padding: 3px 6px;
          margin: 2px;
          border-radius: 3px;
          border: 1px solid #ffb74d;
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
      this.updateCheckboxDisplay();
    }
  
    renderTags() {
      const roadContainer = document.getElementById('road-tags');
      const driverContainer = document.getElementById('driver-tags');
  
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
  
    startAutoDetection() {
      // Scan for checkboxes every 2 seconds
      setInterval(() => {
        if (this.autoDetectionEnabled) {
          this.scanAndClickCheckboxes();
        }
      }, 2000);
  
      // Also scan when page content changes
      const observer = new MutationObserver(() => {
        if (this.autoDetectionEnabled) {
          this.scanAndClickCheckboxes();
        }
      });
  
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
    }
  
    scanAndClickCheckboxes() {
      // Find all checkboxes on the page
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      const pageText = document.body.innerText.toLowerCase();
      
      checkboxes.forEach(checkbox => {
        // Skip if already processed
        if (this.observedCheckboxes.has(checkbox)) return;
        
        this.observedCheckboxes.add(checkbox);
        
        // Find associated label text
        const labelText = this.getCheckboxLabelText(checkbox);
        
        // Check if any keywords match
        Object.entries(this.keywordToCheckbox).forEach(([category, keywords]) => {
          keywords.forEach(keyword => {
            if (pageText.includes(keyword.toLowerCase()) || 
                labelText.toLowerCase().includes(keyword.toLowerCase())) {
              
              // Auto-click the checkbox if not already checked
              if (!checkbox.checked) {
                this.autoClickCheckbox(checkbox, keyword, category);
              }
            }
          });
        });
      });
  
      this.updateCheckboxDisplay();
    }
  
    getCheckboxLabelText(checkbox) {
      let labelText = '';
      
      // Method 1: Check for label with 'for' attribute
      if (checkbox.id) {
        const label = document.querySelector(`label[for="${checkbox.id}"]`);
        if (label) labelText += label.textContent;
      }
      
      // Method 2: Check if checkbox is inside a label
      const parentLabel = checkbox.closest('label');
      if (parentLabel) labelText += parentLabel.textContent;
      
      // Method 3: Check nearby text (next siblings, parent text)
      const parent = checkbox.parentElement;
      if (parent) {
        labelText += parent.textContent;
      }
      
      // Method 4: Check for text in the same row/container
      const container = checkbox.closest('tr, div, span, p');
      if (container) {
        labelText += container.textContent;
      }
  
      return labelText;
    }
  
    autoClickCheckbox(checkbox, keyword, category) {
      try {
        // Simulate a real click
        checkbox.click();
        
        // Also trigger change event
        checkbox.dispatchEvent(new Event('change', { bubbles: true }));
        
        // Log the action
        this.logDetection(`✅ Auto-clicked checkbox for "${keyword}" (${category})`, 'success');
        
        // Auto-select corresponding tag in our panel
        this.autoSelectTag(category);
        
        this.showNotification(`Auto-clicked: ${keyword}`);
        
      } catch (error) {
        this.logDetection(`❌ Failed to click checkbox for "${keyword}": ${error.message}`, 'error');
      }
    }
  
    autoSelectTag(category) {
      const allTags = {...this.roadFacingTags, ...this.driverFacingTags};
      
      // Find matching tag
      Object.entries(allTags).forEach(([key, value]) => {
        if (value.toLowerCase().includes(category.toLowerCase()) || 
            category.toLowerCase().includes(value.toLowerCase().split(' ')[0])) {
          
          this.selectedTags.add(key);
          const tagElement = document.querySelector(`[data-key="${key}"]`);
          if (tagElement) {
            tagElement.classList.add('auto-selected');
          }
        }
      });
    }
  
    logDetection(message, type = 'info') {
      const logContainer = document.getElementById('detection-log');
      const logEntry = document.createElement('div');
      logEntry.className = `log-entry ${type}`;
      logEntry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
      
      logContainer.appendChild(logEntry);
      logContainer.scrollTop = logContainer.scrollHeight;
      
      // Keep only last 20 entries
      while (logContainer.children.length > 20) {
        logContainer.removeChild(logContainer.firstChild);
      }
    }
  
    updateCheckboxDisplay() {
      const checkboxList = document.getElementById('checkbox-list');
      checkboxList.innerHTML = '';
      
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((checkbox, index) => {
        const labelText = this.getCheckboxLabelText(checkbox);
        const info = document.createElement('div');
        info.className = 'checkbox-info';
        info.textContent = `${index + 1}. ${checkbox.checked ? '✅' : '⬜'} ${labelText.substring(0, 50)}...`;
        checkboxList.appendChild(info);
      });
    }
  
    attachEventListeners() {
      // Auto-detection toggle
      document.getElementById('auto-detection-toggle').addEventListener('change', (e) => {
        this.autoDetectionEnabled = e.target.checked;
        this.saveSettings();
        this.logDetection(`Auto-detection ${this.autoDetectionEnabled ? 'enabled' : 'disabled'}`);
      });
  
      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
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
            case ' ':
              e.preventDefault();
              this.submitTags();
              break;
          }
          return;
        }
  
        if (e.altKey && !e.ctrlKey) {
          switch(e.key.toLowerCase()) {
            case 'f':
              e.preventDefault();
              this.toggleFullscreen();
              break;
          }
          return;
        }
  
        // Function keys for road facing tags
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
  
        if (this.waitingForDriverTag && /^[1-5]$/.test(e.key)) {
          e.preventDefault();
          const tagKey = `d${e.key}`;
          this.toggleTag(tagKey);
          this.waitingForDriverTag = false;
          return;
        }
      });
  
      // Submit and clear buttons
      document.getElementById('submit-tags').addEventListener('click', () => {
        this.submitTags();
      });
  
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
        tagElement.classList.remove('selected', 'auto-selected');
      } else {
        this.selectedTags.add(tagKey);
        tagElement.classList.add('selected');
      }
  
      this.saveSettings();
      
      const tagName = this.roadFacingTags[tagKey] || this.driverFacingTags[tagKey];
      const action = this.selectedTags.has(tagKey) ? 'Selected' : 'Deselected';
      this.showNotification(`${action}: ${tagName}`);
    }
  
    clearAllTags() {
      this.selectedTags.clear();
      document.querySelectorAll('.tag-item.selected, .tag-item.auto-selected').forEach(el => {
        el.classList.remove('selected', 'auto-selected');
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
  
      const submissionData = {
        timestamp: new Date().toISOString(),
        tags: selectedTagNames,
        speed: this.currentSpeed,
        url: window.location.href,
        tagKeys: Array.from(this.selectedTags),
        autoDetected: true
      };
  
      console.log('Submitting auto-detected tags:', submissionData);
      
      const existingData = JSON.parse(localStorage.getItem('submittedTags') || '[]');
      existingData.push(submissionData);
      localStorage.setItem('submittedTags', JSON.stringify(existingData));
  
      this.logDetection(`📤 Submitted ${selectedTagNames.length} tags`, 'success');
      this.showNotification(`Submitted ${selectedTagNames.length} tags successfully!`);
  
      setTimeout(() => {
        this.clearAllTags();
      }, 1000);
    }
  
    showNotification(message) {
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
        currentSpeed: this.currentSpeed,
        autoDetectionEnabled: this.autoDetectionEnabled
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
          this.autoDetectionEnabled = settings.autoDetectionEnabled !== false;
          
          this.selectedTags.forEach(key => {
            const element = document.querySelector(`[data-key="${key}"]`);
            if (element) element.classList.add('selected');
          });
          
          const speedDisplay = document.getElementById('speed-display');
          if (speedDisplay) {
            speedDisplay.textContent = `${this.currentSpeed}x`;
          }
  
          const autoToggle = document.getElementById('auto-detection-toggle');
          if (autoToggle) {
            autoToggle.checked = this.autoDetectionEnabled;
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
  