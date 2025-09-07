class DraggableBehaviorTagger {
    constructor() {
      // Configuration
      this.config = {
        scanInterval: 5000, // Increased to reduce CPU usage
        maxLogEntries: 8,
        debounceDelay: 500,
        snapTolerance: 20 // Pixels for edge snapping
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
  
      // Keyword mapping for detection only (no auto-clicking)
      this.keywordMap = new Map([
        ['tailgating', ['f1']],
        ['following', ['f1']],
        ['cutoff', ['f2']],
        ['lane change', ['f3']],
        ['stop sign', ['f4']],
        ['red light', ['f5']],
        ['collision', ['f7', 'f12']],
        ['near miss', ['f7']],
        ['distraction', ['d1']],
        ['phone', ['d2']],
        ['cellphone', ['d2']],
        ['drowsy', ['d3']],
        ['tired', ['d3']],
        ['seatbelt', ['d4']],
        ['smoking', ['d5']]
      ]);
  
      // State management
      this.state = {
        selectedTags: new Set(),
        currentSpeed: 1.0,
        autoDetectionEnabled: true,
        isProcessing: false,
        detectedWords: new Set(),
        foundSubmitButtons: [],
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
              Word Detection
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
  
      // Enhanced CSS with draggable functionality
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
        
        .submit-buttons-section,
        .log-section {
          margin-bottom: 8px;
        }
        
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
        if (e.target.tagName === 'BUTTON') return; // Don't drag when clicking buttons
        
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
  
        // Screen boundaries
        const maxX = window.innerWidth - panel.offsetWidth;
        const maxY = window.innerHeight - panel.offsetHeight;
        
        newX = Math.max(0, Math.min(newX, maxX));
        newY = Math.max(0, Math.min(newY, maxY));
  
        // Edge snapping
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
      // Periodic scanning for keywords and submit buttons
      setInterval(() => {
        if (this.state.autoDetectionEnabled && !this.state.isProcessing) {
          this.debouncedScan();
        }
      }, this.config.scanInterval);
  
      // Page change detection
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
        // Detect keywords (but don't click anything)
        this.detectKeywords();
        
        // Find submit buttons
        this.findSubmitButtons();
        
        this.updateDetectedWordsUI();
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
  
      // Detect keywords and highlight corresponding tags
      for (const [keyword, tagKeys] of this.keywordMap) {
        if (pageText.includes(keyword)) {
          this.state.detectedWords.add(keyword);
          
          // Highlight tags that match detected keywords
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
  
    findSubmitButtons() {
      // Find submit buttons by various methods
      const submitButtons = [];
      
      // Method 1: Input type submit
      document.querySelectorAll('input[type="submit"]').forEach((btn, index) => {
        submitButtons.push({
          element: btn,
          text: btn.value || 'Submit',
          type: 'input[submit]',
          id: `submit-input-${index}`
        });
      });
  
      // Method 2: Button elements with submit type
      document.querySelectorAll('button[type="submit"]').forEach((btn, index) => {
        submitButtons.push({
          element: btn,
          text: btn.textContent.trim() || 'Submit',
          type: 'button[submit]',
          id: `submit-button-${index}`
        });
      });
  
      // Method 3: Buttons with submit-related text
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
          this.logActivity(`Clicked keyword: ${keyword}`, 'info');
          // Show which tags this keyword relates to
          const relatedTags = this.keywordMap.get(keyword) || [];
          if (relatedTags.length > 0) {
            this.showNotification(`Keyword "${keyword}" relates to: ${relatedTags.join(', ')}`);
          }
        });
        container.appendChild(keywordElement);
      });
    }
  
    updateSubmitButtonsUI() {
      const container = document.getElementById('submit-buttons-list');
      container.innerHTML = '';
  
      if (this.state.foundSubmitButtons.length === 0) {
        container.innerHTML = '<div style="color: #999; font-size: 9px;">No submit buttons found</div>';
        return;
      }
  
      this.state.foundSubmitButtons.slice(0, 5).forEach(btnInfo => { // Show max 5
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
  
    attachEventListeners() {
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
      // Clear all selected tags and mark as "No Tag"
      this.clearAllTags();
      this.logActivity('Selected: No Tag', 'info');
      this.showNotification('No Tag selected');
      
      // You could add a special "no-tag" state here if needed
      this.state.selectedTags.add('no-tag');
    }
  
    toggleTag(tagKey) {
      const tagElement = document.querySelector(`[data-key="${tagKey}"]`);
      if (!tagElement) return;
  
      // Remove detected highlighting when manually selected
      tagElement.classList.remove('detected');
  
      if (this.state.selectedTags.has(tagKey)) {
        this.state.selectedTags.delete(tagKey);
        tagElement.classList.remove('selected');
      } else {
        // Remove no-tag if present
        this.state.selectedTags.delete('no-tag');
        
        this.state.selectedTags.add(tagKey);
        tagElement.classList.add('selected');
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
        submitButtonsFound: this.state.foundSubmitButtons.length
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
  