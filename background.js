chrome.commands.onCommand.addListener((command) => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs[0]) {
        switch(command) {
          case 'toggle-fullscreen':
            chrome.tabs.sendMessage(tabs[0].id, {action: 'toggle-fullscreen'});
            break;
          case 'increase-speed':
            chrome.tabs.sendMessage(tabs[0].id, {action: 'increase-speed'});
            break;
          case 'decrease-speed':
            chrome.tabs.sendMessage(tabs[0].id, {action: 'decrease-speed'});
            break;
          case 'submit-tags':
            chrome.tabs.sendMessage(tabs[0].id, {action: 'submit-tags'});
            break;
        }
      }
    });
  });
  
  chrome.runtime.onInstalled.addListener(() => {
    console.log('Drive Behavior Tagger extension installed');
  });
  