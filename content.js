class DraggableBehaviorTagger {
    constructor() {
      // Configuration
      this.config = {
        scanInterval: 5000,
        maxLogEntries: 8,
        debounceDelay: 500,
        snapTolerance: 20
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
  
      // Enhanced keyword to checkbox mapping with more specific terms
      this.tagToCheckboxMapping = new Map([
        // Road Facing Tags - more specific matching
        ['f1', ['tailgating', 'close following', 'following too closely', 'tailgate']],
        ['f2', ['lane cutoff', 'cut off', 'lane cut-off', 'cutoff']],
        ['f3', ['unsafe lane change', 'lane change', 'improper lane', 'lane changing']],
        ['f4', ['stop sign violation', 'stop sign', 'stop-sign', 'rolling stop']],
        ['f5', ['red light violation', 'running red light', 'red light', 'light violation']],
        ['f6', ['forward collision warning', 'collision warning', 'fcw', 'collision-warning']],
        ['f7', ['near collision', 'near miss', 'near-collision', 'almost collision']],
        ['f8', ['unsafe parking', 'parking violation', 'unsafe-parking', 'improper parking']],
        ['f9', ['alert driving', 'alert-driving', 'defensive driving', 'attentive']],
        ['f10', ['safe distancing', 'safe distance', 'proper following', 'safe-distancing']],
        ['f11', ['possible collision', 'potential collision', 'possible-collision', 'collision risk']],
        ['f12', ['collision', 'crash', 'accident', 'impact']],
        
        // Driver Facing Tags - more specific matching
        ['d1', ['driver distraction', 'distracted driving', 'distraction', 'inattentive']],
        ['d2', ['cellphone usage', 'phone use', 'cellphone', 'mobile phone', 'texting']],
        ['d3', ['drowsiness', 'fatigue', 'sleepy driving', 'tired', 'microsleep']],
        ['d4', ['seatbelt violation', 'seat belt', 'unbuckled', 'belt violation', 'no seatbelt']],
        ['d5', ['smoking while driving', 'smoking', 'cigarette', 'tobacco use', 'vaping']]
      ]);
  
      // Reverse mapping for keyword detection
      this.keywordMap = new Map();
      this.tagToCheckboxMapping.forEach((keywords, tagKey) => {
        keywords.forEach(keyword => {
          if (!this.keywordMap.has(keyword)) {
            this.keywordMap.set(keyword, []);
          }
          this.keywordMap.get(keyword).push(tagKey);
        });
      });
  
      // State management
      this.state = {
        selectedTags: new Set(),
        currentSpeed: 1.0,
        autoDetectionEnabled: true,
        isProcessing: false,
        detectedWords: new Set(),
        foundSubmitButtons: [],
        foundCheckboxes: new Map(), // Map tagKey to checkbox elements
        panelPosition: { top: 20, left: 20 },
        panelSize: { width: 320, height: 'auto' },
        isDragging: false,
        isResizing: false,
        dragOffset: { x: 0, y: 0 }
      };
  
      this.debouncedScan = this.debounce(this.performScan.bind(this), this.config.debounceDelay);
      this.debouncedSave = this.debounce(this.saveSettings.bind(this), 1000);
  
      this.init();
    }
  
    debounce(func, wait) {
      let timeout;
      return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
      };
    }
  
    async init() {
      try {
        await this.loadSettings();
        this.createDraggableUI();
        this.attachEventListeners();
        this.startDetection();
        this.restorePosition();
      } catch (error) {
        console.error('Extension initialization failed:', error);
      }
    }
  
    createDraggableUI() {
      const panel = document.createElement('div');
      panel.id = 'behavior-tagger-panel';
      panel.innerHTML = `
        <div class="tagger-header" id="drag-handle">
          <h3>🏷️ Behavior Tagger</h3>
          <div class="header-controls">
            <button id="minimize-panel" title="Minimize">−</button>
            <button id="close-panel" title="Close">×</button>
          </div>
        </div>
        <div class="tagger-content">
          <div class="detection-status">
            <label class="toggle-switch">
              <input type="checkbox" id="auto-detection-toggle" ${this.state.autoDetectionEnabled ? 'checked' : ''}>
              <span class="toggle-slider"></span>
              Word Detection & Auto-Check
            </label>
            <div class="detected-counter">
              Found: <span id="detected-count">0</span> keywords
            </div>
          </div>
          
          <div class="detected-words-section">
            <div class="section-header">🔍 Detected Keywords</div>
            <div id="detected-words-list" class="keywords-container"></div>
          </div>
  
          <div class="tag-sections">
            <div class="tag-section">
              <div class="section-header">🚗 Road Facing (F1-F12)</div>
              <div id="road-tags" class="tags-grid"></div>
            </div>
            
            <div class="tag-section">
              <div class="section-header">👤 Driver Facing (D1-D5)</div>
              <div id="driver-tags" class="tags-grid"></div>
            </div>
          </div>
  
          <div class="controls-section">
            <div class="speed-control">
              <span>Speed:</span>
              <button id="speed-down" class="speed-btn">−</button>
              <span id="speed-display">${this.state.currentSpeed}x</span>
              <button id="speed-up" class="speed-btn">+</button>
            </div>
            
            <div class="action-buttons">
              <button id="no-tag-btn" class="btn btn-secondary">No Tag</button>
              <button id="submit-tags-btn" class="btn btn-primary">Submit</button>
              <button id="clear-all-btn" class="btn btn-danger">Clear</button>
            </div>
          </div>
  
          <div class="checkbox-status-section">
            <div class="section-header">☑️ Checkbox Status</div>
            <div id="checkbox-status-list"></div>
          </div>
  
          <div class="submit-buttons-section">
            <div class="section-header">📝 Found Submit Buttons</div>
            <div id="submit-buttons-list"></div>
          </div>
  
          <div class="log-section">
            <div class="section-header">📊 Activity Log</div>
            <div id="activity-log"></div>
          </div>
        </div>
        <div class="resize-handle" id="resize-handle"></div>
      `;
  
      // Enhanced CSS with checkbox status styling
      const style = document.createElement('style');
      style.textContent = `
        #behavior-tagger-panel {
          position: fixed;
          top: ${this.state.panelPosition.top}px;
          left: ${this.state.panelPosition.left}px;
          width: ${this.state.panelSize.width}px;
          min-width: 300px;
          max-width: 500px;
          background: #ffffff;
          border: 2px solid #2196F3;
          border-radius: 12px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          font-size: 12px;
          z-index: 2147483647;
          box-shadow: 0 8px 32px rgba(33, 150, 243, 0.3);
          max-height: 80vh;
          overflow: hidden;
          transform: translateZ(0);
          backdrop-filter: blur(10px);
          transition: all 0.2s ease;
        }
        
        #behavior-tagger-panel:hover {
          box-shadow: 0 12px 40px rgba(33, 150, 243, 0.4);
        }
        
        .tagger-header {
          background: linear-gradient(135deg, #2196F3 0%, #1976D2 100%);
          color: white;
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          cursor: move;
          user-select: none;
          border-radius: 10px 10px 0 0;
        }
        
        .tagger-header:active {
          cursor: grabbing;
        }
        
        .tagger-header h3 {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
        }
        
        .header-controls {
          display: flex;
          gap: 4px;
        }
        
        .header-controls button {
          background: rgba(255, 255, 255, 0.2);
          border: none;
          color: white;
          width: 20px;
          height: 20px;
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.2s;
        }
        
        .header-controls button:hover {
          background: rgba(255, 255, 255, 0.3);
        }
        
        .tagger-content {
          padding: 12px;
          max-height: 60vh;
          overflow-y: auto;
          overflow-x: hidden;
        }
        
        .detection-status {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding: 8px;
          background: #f8f9fa;
          border-radius: 6px;
          border-left: 3px solid #2196F3;
        }
        
        .toggle-switch {
          position: relative;
          display: inline-block;
          font-size: 11px;
          font-weight: 500;
        }
        
        .toggle-switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }
        
        .toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: #ccc;
          transition: 0.3s;
          border-radius: 20px;
          width: 40px;
          height: 20px;
          margin-right: 8px;
        }
        
        .toggle-slider:before {
          position: absolute;
          content: "";
          height: 16px;
          width: 16px;
          left: 2px;
          bottom: 2px;
          background-color: white;
          transition: 0.3s;
          border-radius: 50%;
        }
        
        input:checked + .toggle-slider {
          background-color: #2196F3;
        }
        
        input:checked + .toggle-slider:before {
          transform: translateX(20px);
        }
        
        .detected-counter {
          font-size: 10px;
          color: #666;
          font-weight: 500;
        }
        
        .section-header {
          font-size: 11px;
          font-weight: 600;
          color: #333;
          margin-bottom: 6px;
          padding-bottom: 2px;
          border-bottom: 1px solid #eee;
        }
        
        .keywords-container {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
          margin-bottom: 12px;
          min-height: 20px;
        }
        
        .detected-keyword {
          background: #FFF3E0;
          color: #E65100;
          padding: 2px 6px;
          border-radius: 12px;
          font-size: 10px;
          cursor: pointer;
          border: 1px solid #FFB74D;
          transition: all 0.2s;
        }
        
        .detected-keyword:hover {
          background: #FFE0B2;
          transform: scale(1.05);
        }
        
        .detected-keyword.clicked {
          background: #4CAF50;
          color: white;
          border-color: #4CAF50;
        }
        
        .tag-sections {
          margin-bottom: 12px;
        }
        
        .tag-section {
          margin-bottom: 8px;
        }
        
        .tags-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 2px;
        }
        
        .tag-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 4px 8px;
          background: #f5f5f5;
          border-radius: 4px;
          cursor: pointer;
          font-size: 10px;
          transition: all 0.15s ease;
          border: 1px solid transparent;
        }
        
        .tag-item:hover {
          background: #e3f2fd;
          transform: translateX(2px);
        }
        
        .tag-item.selected {
          background: #4CAF50;
          color: white;
          border-color: #388E3C;
        }
        
        .tag-item.detected {
          background: #FF9800;
          color: white;
          border-color: #F57C00;
          animation: pulse 2s infinite;
        }
        
        .tag-item.checkbox-found {
          border-left: 4px solid #2196F3;
          background: #e3f2fd;
        }
        
        .tag-item.checkbox-checked {
          border-left: 4px solid #4CAF50;
          background: #e8f5e8;
        }
        
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        .tag-key {
          background: rgba(0,0,0,0.1);
          padding: 1px 4px;
          border-radius: 2px;
          font-size: 9px;
          font-weight: bold;
        }
        
        .tag-item.selected .tag-key,
        .tag-item.detected .tag-key {
          background: rgba(255,255,255,0.3);
        }
        
        .controls-section {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding: 8px;
          background: #f8f9fa;
          border-radius: 6px;
        }
        
        .speed-control {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
        }
        
        .speed-btn {
          width: 20px;
          height: 20px;
          border: 1px solid #ddd;
          background: white;
          cursor: pointer;
          border-radius: 3px;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        
        .speed-btn:hover {
          background: #f0f0f0;
        }
        
        #speed-display {
          font-weight: bold;
          color: #2196F3;
          min-width: 25px;
          text-align: center;
        }
        
        .action-buttons {
          display: flex;
          gap: 4px;
        }
        
        .btn {
          padding: 4px 8px;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 10px;
          font-weight: 500;
          transition: all 0.2s;
        }
        
        .btn-primary {
          background: #2196F3;
          color: white;
        }
        
        .btn-primary:hover {
          background: #1976D2;
        }
        
        .btn-secondary {
          background: #6c757d;
          color: white;
        }
        
        .btn-secondary:hover {
          background: #545b62;
        }
        
        .btn-danger {
          background: #f44336;
          color: white;
        }
        
        .btn-danger:hover {
          background: #d32f2f;
        }
        
        .checkbox-status-section,
        .submit-buttons-section,
        .log-section {
          margin-bottom: 8px;
        }
        
        #checkbox-status-list,
        #submit-buttons-list,
        #activity-log {
          max-height: 80px;
          overflow-y: auto;
          font-size: 9px;
          background: #f8f9fa;
          padding: 4px;
          border-radius: 4px;
          border: 1px solid #eee;
        }
        
        .checkbox-status-item {
          padding: 2px 4px;
          margin: 1px 0;
          background: white;
          border-radius: 2px;
          border-left: 3px solid #ddd;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .checkbox-status-item.found {
          border-left-color: #2196F3;
        }
        
        .checkbox-status-item.checked {
          border-left-color: #4CAF50;
          background: #f1f8e9;
        }
        
        .checkbox-click-btn {
          background: #2196F3;
          color: white;
          border: none;
          padding: 1px 4px;
          border-radius: 2px;
          font-size: 8px;
          cursor: pointer;
        }
        
        .checkbox-click-btn:hover {
          background: #1976D2;
        }
        
        .checkbox-click-btn:disabled {
          background: #ccc;
          cursor: not-allowed;
        }
        
        .submit-btn-item {
          padding: 2px 4px;
          margin: 1px 0;
          background: #e7f3ff;
          border-radius: 2px;
          cursor: pointer;
          border-left: 3px solid #2196F3;
        }
        
        .submit-btn-item:hover {
          background: #d0edff;
        }
        
        .log-entry {
          margin: 1px 0;
          padding: 1px 2px;
          border-radius: 2px;
          opacity: 0;
          animation: fadeIn 0.3s forwards;
        }
        
        .log-entry.success {
          color: #4CAF50;
          background: #f1f8e9;
        }
        
        .log-entry.error {
          color: #f44336;
          background: #ffebee;
        }
        
        .log-entry.info {
          color: #2196F3;
          background: #e3f2fd;
        }
        
        @keyframes fadeIn {
          to { opacity: 1; }
        }
        
        .resize-handle {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 15px;
          height: 15px;
          background: linear-gradient(-45deg, transparent 30%, #2196F3 30%, #2196F3 40%, transparent 40%, transparent 50%, #2196F3 50%, #2196F3 60%, transparent 60%);
          cursor: se-resize;
          border-radius: 0 0 10px 0;
        }
        
        .panel-minimized .tagger-content {
          display: none;
        }
        
        .panel-minimized .resize-handle {
          display: none;
        }
        
        .notification {
          position: fixed;
          top: 50px;
          left: 50%;
          transform: translateX(-50%);
          background: #4CAF50;
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          z-index: 2147483647;
          font-size: 12px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.3);
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
  
      document.head.appendChild(style);
      document.body.appendChild(panel);
  
      this.renderTags();
      this.setupDragAndResize();
    }
  
    renderTags() {
      const roadContainer = document.getElementById('road-tags');
      const driverContainer = document.getElementById('driver-tags');
  
      // Road facing tags
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
  
      // Driver facing tags
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
  
    setupDragAndResize() {
      const panel = document.getElementById('behavior-tagger-panel');
      const header = document.getElementById('drag-handle');
      const resizeHandle = document.getElementById('resize-handle');
  
      // Dragging functionality
      let isDragging = false;
      let dragStart = { x: 0, y: 0 };
      let panelStart = { x: 0, y: 0 };
  
      header.addEventListener('mousedown', (e) => {
        if (e.target.tagName === 'BUTTON') return;
        
        isDragging = true;
        dragStart = { x: e.clientX, y: e.clientY };
        panelStart = { 
          x: parseInt(window.getComputedStyle(panel).left), 
          y: parseInt(window.getComputedStyle(panel).top) 
        };
        
        panel.style.transition = 'none';
        document.addEventListener('mousemove', handleDrag);
        document.addEventListener('mouseup', stopDrag);
      });
  
      const handleDrag = (e) => {
        if (!isDragging) return;
  
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;
        
        let newX = panelStart.x + deltaX;
        let newY = panelStart.y + deltaY;
  
        const maxX = window.innerWidth - panel.offsetWidth;
        const maxY = window.innerHeight - panel.offsetHeight;
        
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
  
        if (newX < this.config.snapTolerance) newX = 0;
        if (newY < this.config.snapTolerance) newY = 0;
        if (newX > maxX - this.config.snapTolerance) newX = maxX;
        if (newY > maxY - this.config.snapTolerance) newY = maxY;
  
        panel.style.left = newX + 'px';
        panel.style.top = newY + 'px';
        
        this.state.panelPosition = { top: newY, left: newX };
      };
  
      const stopDrag = () => {
        isDragging = false;
        panel.style.transition = 'all 0.2s ease';
        document.removeEventListener('mousemove', handleDrag);
        document.removeEventListener('mouseup', stopDrag);
        this.debouncedSave();
      };
  
      // Resizing functionality
      let isResizing = false;
      let resizeStart = { x: 0, y: 0 };
      let sizeStart = { width: 0, height: 0 };
  
      resizeHandle.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        resizeStart = { x: e.clientX, y: e.clientY };
        sizeStart = { 
          width: panel.offsetWidth, 
          height: panel.offsetHeight 
        };
        
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', stopResize);
      });
  
      const handleResize = (e) => {
        if (!isResizing) return;
  
        const deltaX = e.clientX - resizeStart.x;
        const deltaY = e.clientY - resizeStart.y;
        
        let newWidth = sizeStart.width + deltaX;
        let newHeight = sizeStart.height + deltaY;
        
        newWidth = Math.max(300, Math.min(newWidth, 500));
        newHeight = Math.max(200, Math.min(newHeight, window.innerHeight * 0.8));
        
        panel.style.width = newWidth + 'px';
        panel.style.height = newHeight + 'px';
        
        this.state.panelSize = { width: newWidth, height: newHeight };
      };
  
      const stopResize = () => {
        isResizing = false;
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', stopResize);
        this.debouncedSave();
      };
    }
  
    startDetection() {
      setInterval(() => {
        if (this.state.autoDetectionEnabled && !this.state.isProcessing) {
          this.debouncedScan();
        }
      }, this.config.scanInterval);
  
      const observer = new MutationObserver((mutations) => {
        const hasRelevantChanges = mutations.some(mutation => 
          mutation.type === 'childList' && mutation.addedNodes.length > 0
        );
        
        if (hasRelevantChanges && this.state.autoDetectionEnabled) {
          this.debouncedScan();
        }
      });
  
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false
      });
    }
  
    async performScan() {
      if (this.state.isProcessing) return;
      
      this.state.isProcessing = true;
  
      try {
        this.detectKeywords();
        this.findCheckboxes();
        this.findSubmitButtons();
        
        this.updateDetectedWordsUI();
        this.updateCheckboxStatusUI();
        this.updateSubmitButtonsUI();
        
      } catch (error) {
        this.logActivity('Scan error: ' + error.message, 'error');
      } finally {
        this.state.isProcessing = false;
      }
    }
  
    detectKeywords() {
      const pageText = document.body.textContent.toLowerCase();
      this.state.detectedWords.clear();
  
      for (const [keyword, tagKeys] of this.keywordMap) {
        if (pageText.includes(keyword)) {
          this.state.detectedWords.add(keyword);
          
          tagKeys.forEach(tagKey => {
            const tagElement = document.querySelector(`[data-key="${tagKey}"]`);
            if (tagElement && !this.state.selectedTags.has(tagKey)) {
              tagElement.classList.add('detected');
            }
          });
        }
      }
  
      document.getElementById('detected-count').textContent = this.state.detectedWords.size;
    }
  
    // New method to calculate match score
    calculateMatchScore(labelText, keyword) {
      const keywordLower = keyword.toLowerCase();
      
      // Exact match gets highest score
      if (labelText.includes(keywordLower)) {
        // Check if it's a word boundary match (not just a substring)
        const regex = new RegExp(`\\b${keywordLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`);
        if (regex.test(labelText)) {
          return 1.0; // Perfect match
        }
        return 0.8; // Good match but not word boundary
      }
      
      // Check for partial word matches
      const keywordWords = keywordLower.split(/[\s-_]+/);
      const labelWords = labelText.split(/[\s-_]+/);
      
      let matchedWords = 0;
      for (const keywordWord of keywordWords) {
        if (keywordWord.length > 2) { // Skip very short words
          for (const labelWord of labelWords) {
            if (labelWord.includes(keywordWord) || keywordWord.includes(labelWord)) {
              matchedWords++;
              break;
            }
          }
        }
      }
      
      // Return score based on percentage of matched words
      return keywordWords.length > 0 ? matchedWords / keywordWords.length : 0;
    }
  
    findCheckboxes() {
      // Clear previous mappings
      this.state.foundCheckboxes.clear();
  
      const checkboxes = document.querySelectorAll('input[type="checkbox"]');
      
      checkboxes.forEach(checkbox => {
        const labelText = this.getCheckboxLabelText(checkbox).toLowerCase();
        
        // Skip if no meaningful label text
        if (!labelText || labelText.trim().length < 3) return;
        
        let bestMatch = null;
        let bestScore = 0;
        
        // Try to find the best matching tag based on keywords
        for (const [tagKey, keywords] of this.tagToCheckboxMapping) {
          for (const keyword of keywords) {
            // Calculate match score based on how well the keyword matches
            const score = this.calculateMatchScore(labelText, keyword);
            
            if (score > bestScore && score > 0.7) { // Only accept strong matches
              bestMatch = tagKey;
              bestScore = score;
            }
          }
        }
        
        // Only assign checkbox to the best matching tag
        if (bestMatch) {
          if (!this.state.foundCheckboxes.has(bestMatch)) {
            this.state.foundCheckboxes.set(bestMatch, []);
          }
          this.state.foundCheckboxes.get(bestMatch).push(checkbox);
          
          // Update tag visual state
          const tagElement = document.querySelector(`[data-key="${bestMatch}"]`);
          if (tagElement) {
            if (checkbox.checked) {
              tagElement.classList.add('checkbox-checked');
            } else {
              tagElement.classList.add('checkbox-found');
            }
          }
        }
      });
    }
  
    getCheckboxLabelText(checkbox) {
      let labelText = '';
      
      // Method 1: Label with 'for' attribute
      if (checkbox.id) {
        const label = document.querySelector(`label[for="${checkbox.id}"]`);
        if (label) labelText += label.textContent;
      }
      
      // Method 2: Checkbox inside label
      const parentLabel = checkbox.closest('label');
      if (parentLabel) labelText += ' ' + parentLabel.textContent;
      
      // Method 3: Nearby text
      const parent = checkbox.parentElement;
      if (parent) {
        labelText += ' ' + parent.textContent;
      }
      
      // Method 4: Container text
      const container = checkbox.closest('tr, div, span, p, li');
      if (container) {
        labelText += ' ' + container.textContent;
      }
  
      return labelText.trim();
    }
  
    findSubmitButtons() {
      const submitButtons = [];
      
      // Input type submit
      document.querySelectorAll('input[type="submit"]').forEach((btn, index) => {
        submitButtons.push({
          element: btn,
          text: btn.value || 'Submit',
          type: 'input[submit]',
          id: `submit-input-${index}`
        });
      });
  
      // Button elements with submit type
      document.querySelectorAll('button[type="submit"]').forEach((btn, index) => {
        submitButtons.push({
          element: btn,
          text: btn.textContent.trim() || 'Submit',
          type: 'button[submit]',
          id: `submit-button-${index}`
        });
      });
  
      // Buttons with submit-related text
      document.querySelectorAll('button').forEach((btn, index) => {
        const text = btn.textContent.toLowerCase();
        if (text.includes('submit') || text.includes('send') || text.includes('save') || 
            text.includes('confirm') || text.includes('apply')) {
          submitButtons.push({
            element: btn,
            text: btn.textContent.trim(),
            type: 'button[text]',
            id: `submit-text-${index}`
          });
        }
      });
  
      this.state.foundSubmitButtons = submitButtons;
    }
  
    updateDetectedWordsUI() {
      const container = document.getElementById('detected-words-list');
      container.innerHTML = '';
  
      if (this.state.detectedWords.size === 0) {
        container.innerHTML = '<div style="color: #999; font-size: 9px;">No keywords detected</div>';
        return;
      }
  
      this.state.detectedWords.forEach(keyword => {
        const keywordElement = document.createElement('div');
        keywordElement.className = 'detected-keyword';
        keywordElement.textContent = keyword;
        keywordElement.addEventListener('click', () => {
          this.handleKeywordClick(keyword, keywordElement);
        });
        container.appendChild(keywordElement);
      });
    }
  
    updateCheckboxStatusUI() {
      const container = document.getElementById('checkbox-status-list');
      container.innerHTML = '';
  
      if (this.state.foundCheckboxes.size === 0) {
        container.innerHTML = '<div style="color: #999; font-size: 9px;">No matching checkboxes found</div>';
        return;
      }
  
      this.state.foundCheckboxes.forEach((checkboxes, tagKey) => {
        const tagName = this.roadFacingTags[tagKey] || this.driverFacingTags[tagKey];
        
        checkboxes.forEach((checkbox, index) => {
          const statusElement = document.createElement('div');
          statusElement.className = `checkbox-status-item ${checkbox.checked ? 'checked' : 'found'}`;
          
          const status = checkbox.checked ? '✅' : '☐';
          const buttonText = checkbox.checked ? 'Uncheck' : 'Check';
          
          statusElement.innerHTML = `
            <span>${status} ${tagName} #${index + 1}</span>
            <button class="checkbox-click-btn" onclick="window.behaviorTagger.clickCheckbox('${tagKey}', ${index})">
              ${buttonText}
            </button>
          `;
          
          container.appendChild(statusElement);
        });
      });
    }
  
    updateSubmitButtonsUI() {
      const container = document.getElementById('submit-buttons-list');
      container.innerHTML = '';
  
      if (this.state.foundSubmitButtons.length === 0) {
        container.innerHTML = '<div style="color: #999; font-size: 9px;">No submit buttons found</div>';
        return;
      }
  
      this.state.foundSubmitButtons.slice(0, 5).forEach(btnInfo => {
        const btnElement = document.createElement('div');
        btnElement.className = 'submit-btn-item';
        btnElement.textContent = `${btnInfo.text} (${btnInfo.type})`;
        btnElement.addEventListener('click', () => {
          try {
            btnInfo.element.click();
            this.logActivity(`Clicked submit button: ${btnInfo.text}`, 'success');
          } catch (error) {
            this.logActivity(`Failed to click button: ${error.message}`, 'error');
          }
        });
        container.appendChild(btnElement);
      });
    }
  
    handleKeywordClick(keyword, keywordElement) {
      const relatedTags = this.keywordMap.get(keyword) || [];
      
      relatedTags.forEach(tagKey => {
        // Auto-select the tag
        this.toggleTag(tagKey, true);
        
        // Also try to click corresponding checkbox
        if (this.state.foundCheckboxes.has(tagKey)) {
          const checkboxes = this.state.foundCheckboxes.get(tagKey);
          checkboxes.forEach(checkbox => {
            if (!checkbox.checked) {
              this.clickCheckboxElement(checkbox, tagKey);
            }
          });
        }
      });
      
      // Mark keyword as clicked
      keywordElement.classList.add('clicked');
      this.logActivity(`Clicked keyword: ${keyword} → Selected related tags`, 'success');
    }
  
    clickCheckbox(tagKey, checkboxIndex) {
      if (this.state.foundCheckboxes.has(tagKey)) {
        const checkboxes = this.state.foundCheckboxes.get(tagKey);
        if (checkboxes[checkboxIndex]) {
          this.clickCheckboxElement(checkboxes[checkboxIndex], tagKey);
        }
      }
    }
  
    clickCheckboxElement(checkbox, tagKey) {
      try {
        // Simulate natural checkbox interaction
        const clickEvent = new MouseEvent('click', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        
        checkbox.dispatchEvent(clickEvent);
        
        // Also fire change event
        const changeEvent = new Event('change', { bubbles: true });
        checkbox.dispatchEvent(changeEvent);
        
        const tagName = this.roadFacingTags[tagKey] || this.driverFacingTags[tagKey];
        const action = checkbox.checked ? 'Checked' : 'Unchecked';
        this.logActivity(`${action} checkbox for: ${tagName}`, 'success');
        
        // Update UI
        setTimeout(() => {
          this.updateCheckboxStatusUI();
          this.updateTagVisualState(tagKey);
        }, 100);
        
      } catch (error) {
        this.logActivity(`Failed to click checkbox: ${error.message}`, 'error');
      }
    }
  
    updateTagVisualState(tagKey) {
      const tagElement = document.querySelector(`[data-key="${tagKey}"]`);
      if (!tagElement) return;
  
      // Remove all visual states
      tagElement.classList.remove('checkbox-found', 'checkbox-checked', 'detected');
  
      // Check if any associated checkboxes are checked
      if (this.state.foundCheckboxes.has(tagKey)) {
        const checkboxes = this.state.foundCheckboxes.get(tagKey);
        const hasChecked = checkboxes.some(cb => cb.checked);
        
        if (hasChecked) {
          tagElement.classList.add('checkbox-checked');
        } else {
          tagElement.classList.add('checkbox-found');
        }
      }
    }
  
    attachEventListeners() {
      // Make the tagger instance available globally for checkbox clicking
      window.behaviorTagger = this;
  
      // Auto-detection toggle
      document.getElementById('auto-detection-toggle').addEventListener('change', (e) => {
        this.state.autoDetectionEnabled = e.target.checked;
        this.logActivity(`Detection ${e.target.checked ? 'enabled' : 'disabled'}`, 'info');
        this.debouncedSave();
      });
  
      // Panel controls
      document.getElementById('minimize-panel').addEventListener('click', () => {
        const panel = document.getElementById('behavior-tagger-panel');
        panel.classList.toggle('panel-minimized');
      });
  
      document.getElementById('close-panel').addEventListener('click', () => {
        document.getElementById('behavior-tagger-panel').style.display = 'none';
      });
  
      // Speed controls
      document.getElementById('speed-up').addEventListener('click', () => {
        this.adjustSpeed(0.25);
      });
  
      document.getElementById('speed-down').addEventListener('click', () => {
        this.adjustSpeed(-0.25);
      });
  
      // Action buttons
      document.getElementById('no-tag-btn').addEventListener('click', () => {
        this.selectNoTag();
      });
  
      document.getElementById('submit-tags-btn').addEventListener('click', () => {
        this.submitTags();
      });
  
      document.getElementById('clear-all-btn').addEventListener('click', () => {
        this.clearAllTags();
      });
  
      // Keyboard shortcuts
      document.addEventListener('keydown', (e) => {
        if (e.repeat) return;
        this.handleKeyboardShortcut(e);
      });
    }
  
    selectNoTag() {
      this.clearAllTags();
      this.logActivity('Selected: No Tag', 'info');
      this.showNotification('No Tag selected');
      this.state.selectedTags.add('no-tag');
    }
  
    toggleTag(tagKey, forceSelect = false) {
      const tagElement = document.querySelector(`[data-key="${tagKey}"]`);
      if (!tagElement) return;
  
      // Remove detected highlighting when manually selected
      tagElement.classList.remove('detected');
  
      if (this.state.selectedTags.has(tagKey) && !forceSelect) {
        this.state.selectedTags.delete(tagKey);
        tagElement.classList.remove('selected');
      } else {
        // Remove no-tag if present
        this.state.selectedTags.delete('no-tag');
        
        this.state.selectedTags.add(tagKey);
        tagElement.classList.add('selected');
  
        // Auto-click corresponding checkboxes when tag is selected
        if (this.state.foundCheckboxes.has(tagKey)) {
          const checkboxes = this.state.foundCheckboxes.get(tagKey);
          checkboxes.forEach(checkbox => {
            if (!checkbox.checked) {
              this.clickCheckboxElement(checkbox, tagKey);
            }
          });
        }
      }
  
      const tagName = this.roadFacingTags[tagKey] || this.driverFacingTags[tagKey];
      const action = this.state.selectedTags.has(tagKey) ? 'Selected' : 'Deselected';
      this.logActivity(`${action}: ${tagName}`, 'success');
      this.debouncedSave();
    }
  
    adjustSpeed(delta) {
      this.state.currentSpeed = Math.max(0.25, Math.min(3.0, this.state.currentSpeed + delta));
      
      const videos = document.querySelectorAll('video');
      videos.forEach(video => {
        video.playbackRate = this.state.currentSpeed;
      });
      
      document.getElementById('speed-display').textContent = `${this.state.currentSpeed}x`;
      this.logActivity(`Speed: ${this.state.currentSpeed}x`, 'info');
      this.debouncedSave();
    }
  
    clearAllTags() {
      this.state.selectedTags.clear();
      document.querySelectorAll('.tag-item.selected').forEach(el => {
        el.classList.remove('selected');
      });
      this.logActivity('All tags cleared', 'info');
      this.debouncedSave();
    }
  
    submitTags() {
      if (this.state.selectedTags.size === 0) {
        this.showNotification('No tags selected to submit');
        return;
      }
  
      const selectedTagNames = Array.from(this.state.selectedTags).map(key => {
        if (key === 'no-tag') return 'No Tag';
        return this.roadFacingTags[key] || this.driverFacingTags[key];
      }).filter(Boolean);
  
      const submissionData = {
        timestamp: Date.now(),
        tags: selectedTagNames,
        speed: this.state.currentSpeed,
        url: window.location.href,
        detectedKeywords: Array.from(this.state.detectedWords),
        submitButtonsFound: this.state.foundSubmitButtons.length,
        checkboxesFound: this.state.foundCheckboxes.size
      };
  
      // Save submission
      try {
        const existingData = JSON.parse(localStorage.getItem('submittedTags') || '[]');
        existingData.push(submissionData);
        localStorage.setItem('submittedTags', JSON.stringify(existingData));
      } catch (error) {
        console.error('Storage failed:', error);
      }
  
      this.logActivity(`📤 Submitted ${selectedTagNames.length} tags`, 'success');
      this.showNotification(`Submitted: ${selectedTagNames.join(', ')}`);
  
      setTimeout(() => this.clearAllTags(), 1000);
    }
  
    handleKeyboardShortcut(e) {
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
  
      // Function keys for road tags
      if (e.key.startsWith('F') && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        e.preventDefault();
        const keyNum = e.key.substring(1);
        const tagKey = `f${keyNum}`;
        if (this.roadFacingTags[tagKey]) {
          this.toggleTag(tagKey);
        }
      }
  
      // D + number for driver tags
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
  
    toggleFullscreen() {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => {
          this.logActivity('Fullscreen failed', 'error');
        });
      } else {
        document.exitFullscreen();
      }
    }
  
    logActivity(message, type = 'info') {
      const logContainer = document.getElementById('activity-log');
      if (!logContainer) return;
  
      const logEntry = document.createElement('div');
      logEntry.className = `log-entry ${type}`;
      logEntry.textContent = `${new Date().toLocaleTimeString('en-GB', { 
        hour12: false, 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      })}: ${message}`;
      
      logContainer.appendChild(logEntry);
      logContainer.scrollTop = logContainer.scrollHeight;
      
      // Limit log entries
      while (logContainer.children.length > this.config.maxLogEntries) {
        logContainer.removeChild(logContainer.firstChild);
      }
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
  
    restorePosition() {
      const panel = document.getElementById('behavior-tagger-panel');
      panel.style.top = this.state.panelPosition.top + 'px';
      panel.style.left = this.state.panelPosition.left + 'px';
      if (this.state.panelSize.height !== 'auto') {
        panel.style.width = this.state.panelSize.width + 'px';
        panel.style.height = this.state.panelSize.height + 'px';
      }
    }
  
    async saveSettings() {
      const settings = {
        selectedTags: Array.from(this.state.selectedTags),
        currentSpeed: this.state.currentSpeed,
        autoDetectionEnabled: this.state.autoDetectionEnabled,
        panelPosition: this.state.panelPosition,
        panelSize: this.state.panelSize,
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
        
        if (settings.panelPosition) {
          this.state.panelPosition = settings.panelPosition;
        }
        if (settings.panelSize) {
          this.state.panelSize = settings.panelSize;
        }
        
      } catch (error) {
        console.error('Settings load failed:', error);
      }
    }
  }
  
  // Initialize
  (() => {
    let taggerInstance = null;
    
    const initialize = () => {
      try {
        if (taggerInstance) return;
        taggerInstance = new DraggableBehaviorTagger();
      } catch (error) {
        console.error('Tagger initialization failed:', error);
      }
    };
  
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initialize, { once: true });
    } else {
      initialize();
    }
  
    window.addEventListener('beforeunload', () => {
      if (taggerInstance) {
        taggerInstance.saveSettings();
      }
    }, { once: true });
  })();
  