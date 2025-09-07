class OptimizedDriveBehaviorTagger {
    constructor() {
      // Configuration
      this.config = {
        scanInterval: 3000, // Increased from 2s to 3s for better performance
        maxLogEntries: 10,  // Reduced from 20 to 10
        debounceDelay: 300, // Debounce DOM queries
        batchSize: 50       // Process checkboxes in batches
      };
  
      // Tag definitions
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
  
      // Optimized keyword matching using Map for O(1) lookup
      this.keywordMap = new Map([
        ['tailgating', ['f1']],
        ['following', ['f1']],
        ['cutoff', ['f2']],
        ['cut off', ['f2']],
        ['lane change', ['f3']],
        ['unsafe lane', ['f3']],
        ['stop sign', ['f4']],
        ['red light', ['f5']],
        ['collision', ['f7', 'f11', 'f12']],
        ['crash', ['f7', 'f12']],
        ['near miss', ['f7']],
        ['distraction', ['d1']],
        ['distracted', ['d1']],
        ['phone', ['d2']],
        ['cellphone', ['d2']],
        ['mobile', ['d2']],
        ['texting', ['d2']],
        ['drowsy', ['d3']],
        ['sleepy', ['d3']],
        ['tired', ['d3']],
        ['fatigue', ['d3']],
        ['seat belt', ['d4']],
        ['seatbelt', ['d4']],
        ['belt', ['d4']],
        ['smoking', ['d5']],
        ['smoke', ['d5']],
        ['cigarette', ['d5']]
      ]);
  
      // State management
      this.state = {
        selectedTags: new Set(),
        currentSpeed: 1.0,
        autoDetectionEnabled: true,
        isProcessing: false,
        cachedCheckboxes: new WeakMap(),
        observedElements: new Set()
      };
  
      // Performance tracking
      this.performance = {
        scanCount: 0,
        clickCount: 0,
        lastScanTime: 0
      };
  
      // Debounced functions
      this.debouncedScan = this.debounce(this.performScan.bind(this), this.config.debounceDelay);
      this.debouncedUpdate = this.debounce(this.updateUI.bind(this), 100);
  
      this.init();
    }
  
    // Utility: Debounce function for performance optimization
    debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
  
    // Utility: Throttle function for limiting execution frequency
    throttle(func, limit) {
      let inThrottle;
      return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
          func.apply(context, args);
          inThrottle = true;
          setTimeout(() => inThrottle = false, limit);
        }
      };
    }
  
    async init() {
      try {
        await this.loadSettings();
        this.createOptimizedUI();
        this.attachOptimizedEventListeners();
        this.startOptimizedDetection();
      } catch (error) {
        console.error('Extension initialization failed:', error);
      }
    }
  
    createOptimizedUI() {
      // Use DocumentFragment for batch DOM operations
      const fragment = document.createDocumentFragment();
      
      const panel = document.createElement('div');
      panel.id = 'behavior-tagger-panel';
      panel.innerHTML = `
        <div class="tagger-header">
          <h3>Auto Tagger Pro</h3>
          <button id="toggle-panel">−</button>
        </div>
        <div class="tagger-content">
          <div class="status-bar">
            <span id="performance-stats">Scans: 0 | Clicks: 0</span>
            <label class="auto-toggle">
              <input type="checkbox" id="auto-detection-toggle" ${this.state.autoDetectionEnabled ? 'checked' : ''}>
              Auto-detect
            </label>
          </div>
          <div class="tag-grid" id="tag-grid"></div>
          <div class="controls">
            <div class="speed-control">
              Speed: <span id="speed-display">${this.state.currentSpeed}x</span>
              <button id="speed-down">−</button>
              <button id="speed-up">+</button>
            </div>
            <button id="submit-tags" class="btn-primary">Submit</button>
            <button id="clear-tags" class="btn-secondary">Clear</button>
          </div>
          <div class="log-container">
            <div class="log-header">Activity Log</div>
            <div id="detection-log" class="log-content"></div>
          </div>
        </div>
      `;
  
      // Add optimized CSS with hardware acceleration
      const style = document.createElement('style');
      style.textContent = `
        #behavior-tagger-panel {
          position: fixed;
          top: 20px;
          right: 20px;
          width: 300px;
          background: #fff;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 12px;
          z-index: 2147483647;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          max-height: 70vh;
          overflow: hidden;
          transform: translateZ(0); /* Hardware acceleration */
          will-change: transform;
        }
        .tagger-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .tagger-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }
        #toggle-panel {
          background: none;
          border: none;
          color: white;
          font-size: 16px;
          cursor: pointer;
          padding: 2px;
          border-radius: 2px;
          transition: background 0.2s;
        }
        #toggle-panel:hover {
          background: rgba(255,255,255,0.2);
        }
        .tagger-content {
          padding: 12px;
          max-height: calc(70vh - 40px);
          overflow-y: auto;
        }
        .status-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 6px;
          background: #f8f9fa;
          border-radius: 4px;
          margin-bottom: 8px;
          font-size: 10px;
        }
        .auto-toggle {
          font-size: 10px;
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .tag-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2px;
          margin-bottom: 8px;
        }
        .tag-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 6px;
          background: #f5f5f5;
          border-radius: 3px;
          cursor: pointer;
          font-size: 10px;
          transition: all 0.15s ease;
          border: 1px solid transparent;
        }
        .tag-item:hover {
          background: #e9ecef;
          transform: translateX(2px);
        }
        .tag-item.selected {
          background: #28a745;
          color: white;
          border-color: #1e7e34;
          transform: translateX(0);
        }
        .tag-item.auto-selected {
          background: #fd7e14;
          color: white;
          border-color: #e55a00;
        }
        .tag-key {
          background: rgba(0,0,0,0.1);
          padding: 1px 4px;
          border-radius: 2px;
          font-size: 9px;
          font-weight: bold;
        }
        .selected .tag-key, .auto-selected .tag-key {
          background: rgba(255,255,255,0.3);
        }
        .controls {
          display: flex;
          gap: 4px;
          align-items: center;
          margin-bottom: 8px;
          flex-wrap: wrap;
        }
        .speed-control {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
        }
        #speed-display {
          font-weight: bold;
          color: #007bff;
          min-width: 30px;
          text-align: center;
        }
        #speed-up, #speed-down {
          width: 20px;
          height: 20px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          border-radius: 2px;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .btn-primary, .btn-secondary {
          padding: 4px 8px;
          border: none;
          border-radius: 3px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 500;
          transition: all 0.2s;
        }
        .btn-primary {
          background: #007bff;
          color: white;
        }
        .btn-primary:hover {
          background: #0056b3;
        }
        .btn-secondary {
          background: #6c757d;
          color: white;
        }
        .btn-secondary:hover {
          background: #545b62;
        }
        .log-container {
          border-top: 1px solid #eee;
          padding-top: 8px;
        }
        .log-header {
          font-size: 10px;
          font-weight: 600;
          margin-bottom: 4px;
          color: #666;
        }
        .log-content {
          max-height: 80px;
          overflow-y: auto;
          font-size: 9px;
          background: #f8f9fa;
          padding: 4px;
          border-radius: 3px;
        }
        .log-entry {
          margin: 1px 0;
          color: #666;
          opacity: 0;
          animation: fadeIn 0.3s forwards;
        }
        .log-entry.success {
          color: #28a745;
        }
        .log-entry.error {
          color: #dc3545;
        }
        @keyframes fadeIn {
          to { opacity: 1; }
        }
        .notification {
          position: fixed;
          top: 50px;
          left: 50%;
          transform: translateX(-50%);
          background: #28a745;
          color: white;
          padding: 8px 16px;
          border-radius: 4px;
          z-index: 2147483647;
          font-size: 12px;
          animation: slideIn 0.3s ease, slideOut 0.3s ease 2.7s forwards;
        }
        @keyframes slideIn {
          from { transform: translate(-50%, -100%); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes slideOut {
          to { transform: translate(-50%, -100%); opacity: 0; }
        }
      `;
  
      fragment.appendChild(style);
      fragment.appendChild(panel);
      document.body.appendChild(fragment);
  
      this.renderTags();
      this.updateUI();
    }
  
    renderTags() {
      const container = document.getElementById('tag-grid');
      const fragment = document.createDocumentFragment();
  
      // Combine all tags for efficient rendering
      const allTags = [
        ...Object.entries(this.roadFacingTags),
        ...Object.entries(this.driverFacingTags)
      ];
  
      allTags.forEach(([key, value]) => {
        const tagElement = document.createElement('div');
        tagElement.className = 'tag-item';
        tagElement.dataset.key = key;
        
        // Use template literals for better performance
        tagElement.innerHTML = `
          <span class="tag-name">${value}</span>
          <span class="tag-key">${key.toUpperCase()}</span>
        `;
  
        // Use event delegation instead of individual listeners
        tagElement.addEventListener('click', () => this.toggleTag(key), { passive: true });
        fragment.appendChild(tagElement);
      });
  
      container.appendChild(fragment);
    }
  
    startOptimizedDetection() {
      // Use more efficient MutationObserver configuration
      const observer = new MutationObserver(
        this.throttle((mutations) => {
          if (!this.state.autoDetectionEnabled || this.state.isProcessing) return;
          
          // Only process if there are actual node changes
          const hasRelevantChanges = mutations.some(mutation => 
            mutation.type === 'childList' && mutation.addedNodes.length > 0
          );
          
          if (hasRelevantChanges) {
            this.debouncedScan();
          }
        }, 500) // Throttle to max 2 calls per second
      );
  
      // Optimized observer configuration
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,    // Disabled for better performance
        characterData: false  // Disabled for better performance
      });
  
      // Reduced interval scanning as backup
      setInterval(() => {
        if (this.state.autoDetectionEnabled && !this.state.isProcessing) {
          this.debouncedScan();
        }
      }, this.config.scanInterval);
    }
  
    async performScan() {
      if (this.state.isProcessing) return;
      
      this.state.isProcessing = true;
      const scanStartTime = performance.now();
  
      try {
        // Cache page text for efficient keyword matching
        const pageText = this.getPageTextOptimized();
        
        // Find checkboxes efficiently
        const checkboxes = this.getCheckboxesOptimized();
        
        // Process in batches to avoid blocking the main thread
        await this.processCheckboxesBatched(checkboxes, pageText);
        
        this.performance.scanCount++;
        this.performance.lastScanTime = performance.now() - scanStartTime;
        
      } catch (error) {
        this.logOptimized(`Error during scan: ${error.message}`, 'error');
      } finally {
        this.state.isProcessing = false;
        this.debouncedUpdate();
      }
    }
  
    getPageTextOptimized() {
      // Use textContent instead of innerText for better performance
      return document.body.textContent.toLowerCase();
    }
  
    getCheckboxesOptimized() {
      // Use more specific selector and convert NodeList to Array once
      return Array.from(document.querySelectorAll('input[type="checkbox"]:not([data-processed])'));
    }
  
    async processCheckboxesBatched(checkboxes, pageText) {
      // Process checkboxes in batches to avoid blocking UI
      for (let i = 0; i < checkboxes.length; i += this.config.batchSize) {
        const batch = checkboxes.slice(i, i + this.config.batchSize);
        
        await new Promise(resolve => {
          setTimeout(() => {
            this.processBatch(batch, pageText);
            resolve();
          }, 0);
        });
      }
    }
  
    processBatch(checkboxes, pageText) {
      checkboxes.forEach(checkbox => {
        if (this.state.cachedCheckboxes.has(checkbox)) return;
        
        checkbox.dataset.processed = 'true'; // Mark as processed
        this.state.cachedCheckboxes.set(checkbox, true);
        
        const labelText = this.getCheckboxLabelOptimized(checkbox);
        const combinedText = `${pageText} ${labelText.toLowerCase()}`;
        
        // Use Map for O(1) keyword lookup
        for (const [keyword, tagKeys] of this.keywordMap) {
          if (combinedText.includes(keyword)) {
            this.attemptAutoClick(checkbox, keyword, tagKeys);
            break; // Only match first keyword for efficiency
          }
        }
      });
    }
  
    getCheckboxLabelOptimized(checkbox) {
      // Use cached result if available
      if (checkbox.dataset.labelText) {
        return checkbox.dataset.labelText;
      }
  
      let labelText = '';
      
      // Optimized label detection
      if (checkbox.id) {
        const label = document.querySelector(`label[for="${checkbox.id}"]`);
        if (label) labelText = label.textContent;
      }
      
      if (!labelText) {
        const parentLabel = checkbox.closest('label');
        if (parentLabel) labelText = parentLabel.textContent;
      }
      
      if (!labelText) {
        const container = checkbox.closest('tr, div, li, span');
        if (container) labelText = container.textContent;
      }
      
      // Cache the result
      checkbox.dataset.labelText = labelText;
      return labelText;
    }
  
    attemptAutoClick(checkbox, keyword, tagKeys) {
      if (checkbox.checked) return;
      
      try {
        // Simulate natural click events
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        
        checkbox.dispatchEvent(clickEvent);
        
        // Ensure change event is fired
        const changeEvent = new Event('change', { bubbles: true });
        checkbox.dispatchEvent(changeEvent);
        
        this.performance.clickCount++;
        this.logOptimized(`✅ Clicked: ${keyword}`, 'success');
        
        // Auto-select corresponding tags
        tagKeys.forEach(tagKey => this.autoSelectTag(tagKey));
        
      } catch (error) {
        this.logOptimized(`❌ Click failed: ${keyword}`, 'error');
      }
    }
  
    autoSelectTag(tagKey) {
      if (this.state.selectedTags.has(tagKey)) return;
      
      this.state.selectedTags.add(tagKey);
      const tagElement = document.querySelector(`[data-key="${tagKey}"]`);
      if (tagElement) {
        tagElement.classList.add('auto-selected');
      }
    }
  
    attachOptimizedEventListeners() {
      // Use passive listeners where possible for better performance
      const passiveOptions = { passive: true };
      
      // Auto-detection toggle
      document.getElementById('auto-detection-toggle')?.addEventListener('change', (e) => {
        this.state.autoDetectionEnabled = e.target.checked;
        this.saveSettings();
      }, passiveOptions);
  
      // Speed controls
      document.getElementById('speed-up')?.addEventListener('click', () => {
        this.adjustSpeed(0.25);
      }, passiveOptions);
  
      document.getElementById('speed-down')?.addEventListener('click', () => {
        this.adjustSpeed(-0.25);
      }, passiveOptions);
  
      // Action buttons
      document.getElementById('submit-tags')?.addEventListener('click', () => {
        this.submitTags();
      }, passiveOptions);
  
      document.getElementById('clear-tags')?.addEventListener('click', () => {
        this.clearAllTags();
      }, passiveOptions);
  
      // Panel toggle
      document.getElementById('toggle-panel')?.addEventListener('click', (e) => {
        const content = document.querySelector('.tagger-content');
        const button = e.target;
        if (content.style.display === 'none') {
          content.style.display = 'block';
          button.textContent = '−';
        } else {
          content.style.display = 'none';
          button.textContent = '+';
        }
      }, passiveOptions);
  
      // Optimized keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.repeat) return; // Ignore repeated keydown events
        
        this.handleKeyboardShortcut(e);
      });
  
      // Listen for messages from background script
      chrome.runtime?.onMessage.addListener((message) => {
        this.handleBackgroundMessage(message);
      });
    }
  
    handleKeyboardShortcut(e) {
      // Use object lookup for better performance
      const shortcuts = {
        'ArrowUp': () => e.ctrlKey && this.adjustSpeed(0.25),
        'ArrowDown': () => e.ctrlKey && this.adjustSpeed(-0.25),
        ' ': () => e.ctrlKey && this.submitTags(),
        'f': () => e.altKey && this.toggleFullscreen()
      };
  
      const handler = shortcuts[e.key];
      if (handler && handler()) {
        e.preventDefault();
        return;
      }
  
      // Function keys for tags
      if (e.key.startsWith('F') && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        const keyNum = e.key.substring(1);
        const tagKey = `f${keyNum}`;
        if (this.roadFacingTags[tagKey]) {
          this.toggleTag(tagKey);
        }
      }
  
      // Driver tags (D + number)
      if (e.key.toLowerCase() === 'd' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        this.showNotification('Press 1-5 for driver tag');
        this.waitForDriverTag();
      }
    }
  
    waitForDriverTag() {
      const handler = (e) => {
        if (/^[1-5]$/.test(e.key)) {
          e.preventDefault();
          const tagKey = `d${e.key}`;
          this.toggleTag(tagKey);
          document.removeEventListener('keydown', handler);
        }
      };
  
      document.addEventListener('keydown', handler, { once: true });
      setTimeout(() => {
        document.removeEventListener('keydown', handler);
      }, 2000);
    }
  
    toggleTag(tagKey) {
      const tagElement = document.querySelector(`[data-key="${tagKey}"]`);
      if (!tagElement) return;
      
      if (this.state.selectedTags.has(tagKey)) {
        this.state.selectedTags.delete(tagKey);
        tagElement.classList.remove('selected', 'auto-selected');
      } else {
        this.state.selectedTags.add(tagKey);
        tagElement.classList.add('selected');
        tagElement.classList.remove('auto-selected');
      }
  
      this.saveSettings();
      
      const tagName = this.roadFacingTags[tagKey] || this.driverFacingTags[tagKey];
      const action = this.state.selectedTags.has(tagKey) ? 'Selected' : 'Deselected';
      this.showNotification(`${action}: ${tagName}`);
    }
  
    adjustSpeed(delta) {
      this.state.currentSpeed = Math.max(0.25, Math.min(3.0, this.state.currentSpeed + delta));
      
      // Batch video speed updates
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        video.playbackRate = this.state.currentSpeed;
      });
      
      this.updateUI();
      this.saveSettings();
      this.showNotification(`Speed: ${this.state.currentSpeed}x`);
    }
  
    clearAllTags() {
      this.state.selectedTags.clear();
      document.querySelectorAll('.tag-item.selected, .tag-item.auto-selected').forEach(el => {
        el.classList.remove('selected', 'auto-selected');
      });
      this.saveSettings();
      this.showNotification('All tags cleared');
    }
  
    toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          this.logOptimized('Fullscreen failed', 'error');
        });
      } else {
        document.exitFullscreen();
      }
    }
  
    async submitTags() {
      if (this.state.selectedTags.size === 0) {
        this.showNotification('No tags to submit');
        return;
      }
  
      const selectedTagNames = Array.from(this.state.selectedTags).map(key => {
        return this.roadFacingTags[key] || this.driverFacingTags[key];
      });
  
      const submissionData = {
        timestamp: Date.now(),
        tags: selectedTagNames,
        speed: this.state.currentSpeed,
        url: window.location.href,
        performance: this.performance,
        tagKeys: Array.from(this.state.selectedTags)
      };
  
      // Async storage to avoid blocking
      setTimeout(() => {
        try {
          const existingData = JSON.parse(localStorage.getItem('submittedTags') || '[]');
          existingData.push(submissionData);
          localStorage.setItem('submittedTags', JSON.stringify(existingData));
        } catch (error) {
          console.error('Storage failed:', error);
        }
      }, 0);
  
      this.logOptimized(`📤 Submitted ${selectedTagNames.length} tags`, 'success');
      this.showNotification(`Submitted ${selectedTagNames.length} tags!`);
  
      // Auto-clear after delay
      setTimeout(() => this.clearAllTags(), 1000);
    }
  
    updateUI() {
      // Batch UI updates
      const updates = [
        () => {
          const speedDisplay = document.getElementById('speed-display');
          if (speedDisplay) speedDisplay.textContent = `${this.state.currentSpeed}x`;
        },
        () => {
          const statsDisplay = document.getElementById('performance-stats');
          if (statsDisplay) {
            statsDisplay.textContent = `Scans: ${this.performance.scanCount} | Clicks: ${this.performance.clickCount}`;
          }
        }
      ];
  
      // Use requestAnimationFrame for smooth updates
      requestAnimationFrame(() => {
        updates.forEach(update => update());
      });
    }
  
    logOptimized(message, type = 'info') {
      const logContainer = document.getElementById('detection-log');
      if (!logContainer) return;
  
      const logEntry = document.createElement('div');
      logEntry.className = `log-entry ${type}`;
      logEntry.textContent = `${new Date().toLocaleTimeString('en-GB', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })}: ${message}`;
      
      // Use DocumentFragment for efficient DOM manipulation
      const fragment = document.createDocumentFragment();
      fragment.appendChild(logEntry);
      logContainer.appendChild(fragment);
      
      // Auto-scroll with smooth behavior
      logContainer.scrollTop = logContainer.scrollHeight;
      
      // Limit log entries for memory efficiency
      while (logContainer.children.length > this.config.maxLogEntries) {
        logContainer.removeChild(logContainer.firstChild);
      }
    }
  
    showNotification(message) {
      // Remove existing notification
      const existing = document.querySelector('.notification');
      if (existing) existing.remove();
  
      const notification = document.createElement('div');
      notification.className = 'notification';
      notification.textContent = message;
  
      document.body.appendChild(notification);
      
      // Auto-remove with proper cleanup
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 3000);
    }
  
    handleBackgroundMessage(message) {
      const actions = {
        'toggle-fullscreen': () => this.toggleFullscreen(),
        'increase-speed': () => this.adjustSpeed(0.25),
        'decrease-speed': () => this.adjustSpeed(-0.25),
        'submit-tags': () => this.submitTags()
      };
  
      const action = actions[message.action];
      if (action) action();
    }
  
    async saveSettings() {
      const settings = {
        selectedTags: Array.from(this.state.selectedTags),
        currentSpeed: this.state.currentSpeed,
        autoDetectionEnabled: this.state.autoDetectionEnabled,
        timestamp: Date.now()
      };
  
      try {
        localStorage.setItem('behaviorTaggerSettings', JSON.stringify(settings));
      } catch (error) {
        console.error('Settings save failed:', error);
      }
    }
  
    async loadSettings() {
      try {
        const saved = localStorage.getItem('behaviorTaggerSettings');
        if (!saved) return;
  
        const settings = JSON.parse(saved);
        this.state.selectedTags = new Set(settings.selectedTags || []);
        this.state.currentSpeed = settings.currentSpeed || 1.0;
        this.state.autoDetectionEnabled = settings.autoDetectionEnabled !== false;
        
      } catch (error) {
        console.error('Settings load failed:', error);
        // Reset to defaults on error
        this.state.selectedTags = new Set();
        this.state.currentSpeed = 1.0;
        this.state.autoDetectionEnabled = true;
      }
    }
  }
  
  // Initialize with proper error handling and cleanup
  (() => {
    let taggerInstance = null;
    
    const initialize = () => {
      try {
        if (taggerInstance) return; // Prevent multiple instances
        taggerInstance = new OptimizedDriveBehaviorTagger();
      } catch (error) {
        console.error('Tagger initialization failed:', error);
      }
    };
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
      initialize();
    }
  
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
      if (taggerInstance) {
        taggerInstance.saveSettings();
        taggerInstance = null;
      }
    }, { once: true });
  })();
  