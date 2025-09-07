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
  });
  