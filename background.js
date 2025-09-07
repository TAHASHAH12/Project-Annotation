// Optimized background script with error handling and performance tracking
class BackgroundService {
    constructor() {
      this.commandHandlers = new Map([
        ['toggle-fullscreen', 'toggle-fullscreen'],
        ['increase-speed', 'increase-speed'], 
        ['decrease-speed', 'decrease-speed'],
        ['submit-tags', 'submit-tags']
      ]);
  
      this.init();
    }
  
    init() {
      this.setupCommandListeners();
      this.setupInstallListener();
      this.setupMessageHandlers();
    }
  
    setupCommandListeners() {
      chrome.commands?.onCommand.addListener(async (command) => {
        try {
          const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true
          });
  
          if (activeTab?.id && this.commandHandlers.has(command)) {
            await chrome.tabs.sendMessage(activeTab.id, {
              action: this.commandHandlers.get(command),
              timestamp: Date.now()
            });
          }
        } catch (error) {
          console.error(`Command execution failed: ${command}`, error);
        }
      });
    }
  
    setupInstallListener() {
      chrome.runtime?.onInstalled.addListener((details) => {
        console.log('Drive Behavior Tagger Pro installed/updated', details);
        
        if (details.reason === 'install') {
          // Set default settings on first install
          chrome.storage.local?.set({
            version: chrome.runtime.getManifest().version,
            installDate: Date.now()
          });
        }
      });
    }
  
    setupMessageHandlers() {
      chrome.runtime?.onMessage.addListener((message, sender, sendResponse) => {
        // Handle async messages properly
        this.handleMessage(message, sender, sendResponse);
        return true; // Indicates async response
      });
    }
  
    async handleMessage(message, sender, sendResponse) {
      try {
        switch (message.action) {
          case 'logSubmission':
            await this.logSubmission(message.data);
            sendResponse({ success: true });
            break;
          
          case 'getStats':
            const stats = await this.getExtensionStats();
            sendResponse({ success: true, data: stats });
            break;
            
          default:
            sendResponse({ error: 'Unknown action' });
        }
      } catch (error) {
        console.error('Message handling failed:', error);
        sendResponse({ error: error.message });
      }
    }
  
    async logSubmission(data) {
      try {
        // Store submission data with error handling
        await chrome.storage.local?.set({
          [`submission_${Date.now()}`]: data
        });
      } catch (error) {
        console.error('Submission logging failed:', error);
      }
    }
  
    async getExtensionStats() {
      try {
        const result = await chrome.storage.local?.get();
        return {
          totalSubmissions: Object.keys(result || {}).filter(key => 
            key.startsWith('submission_')
          ).length,
          installDate: result?.installDate,
          version: result?.version
        };
      } catch (error) {
        console.error('Stats retrieval failed:', error);
        return {};
      }
    }
  }
  
  // Initialize background service
  new BackgroundService();
  