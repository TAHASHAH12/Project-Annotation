// Background script for handling extension commands and messages

chrome.commands.onCommand.addListener((command) => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      if (tabs) {
        switch(command) {
          case 'toggle-fullscreen':
            chrome.tabs.sendMessage(tabs.id, {action: 'toggle-fullscreen'});
            break;
          case 'increase-speed':
            chrome.tabs.sendMessage(tabs.id, {action: 'increase-speed'});
            break;
          case 'decrease-speed':
            chrome.tabs.sendMessage(tabs.id, {action: 'decrease-speed'});
            break;
          case 'submit-tags':
            chrome.tabs.sendMessage(tabs.id, {action: 'submit-tags'});
            break;
        }
      }
    });
  });
  
  // Handle extension installation
  chrome.runtime.onInstalled.addListener(() => {
    console.log('Drive Behavior Tagger extension installed');
  });
  
  // Handle messages from content script (if needed for future features)
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch(message.action) {
      case 'logSubmission':
        console.log('Tags submitted:', message.data);
        sendResponse({success: true});
        break;
      default:
        sendResponse({error: 'Unknown action'});
    }
  });
  