// Background script for handling extension commands and messages

chrome.commands?.onCommand.addListener(async (command) => {
    try {
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });
  
      if (activeTab?.id) {
        await chrome.tabs.sendMessage(activeTab.id, {
          action: command,
          timestamp: Date.now()
        });
      }
    } catch (error) {
      console.error(`Command execution failed: ${command}`, error);
    }
  });
  
  chrome.runtime?.onInstalled.addListener((details) => {
    console.log('Drive Behavior Tagger Pro installed/updated', details);
    
    if (details.reason === 'install') {
      chrome.storage.local?.set({
        version: chrome.runtime.getManifest().version,
        installDate: Date.now()
      });
    }
  });
  
  chrome.runtime?.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.action) {
      case 'logSubmission':
        console.log('Tags submitted:', message.data);
        sendResponse({ success: true });
        break;
      default:
        sendResponse({ error: 'Unknown action' });
    }
    return true;
  });
  