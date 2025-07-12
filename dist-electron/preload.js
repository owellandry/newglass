"use strict";
const electron = require("electron");
const api = {
  // App info
  getAppVersion: () => electron.ipcRenderer.invoke("get-app-version"),
  // Store operations
  store: {
    get: (key) => electron.ipcRenderer.invoke("get-store-value", key),
    set: (key, value) => electron.ipcRenderer.invoke("set-store-value", key, value),
    delete: (key) => electron.ipcRenderer.invoke("delete-store-value", key)
  },
  // Window operations
  window: {
    showSettings: () => electron.ipcRenderer.invoke("show-settings"),
    close: () => electron.ipcRenderer.invoke("close-app"),
    minimize: () => electron.ipcRenderer.invoke("minimize-window"),
    toggleAlwaysOnTop: () => electron.ipcRenderer.invoke("toggle-always-on-top"),
    setSize: (width, height) => electron.ipcRenderer.invoke("set-window-size", width, height),
    setPosition: (x, y) => electron.ipcRenderer.invoke("set-window-position", x, y),
    getBounds: () => electron.ipcRenderer.invoke("get-window-bounds")
  },
  // Dialog operations
  dialog: {
    showError: (title, content) => electron.ipcRenderer.invoke("show-error-dialog", title, content),
    showMessage: (options) => electron.ipcRenderer.invoke("show-message-dialog", options)
  },
  // OpenRouter API
  openrouter: {
    request: (options) => electron.ipcRenderer.invoke("openrouter-request", options)
  },
  // Audio operations
  audio: {
    startCapture: () => electron.ipcRenderer.invoke("start-audio-capture"),
    stopCapture: () => electron.ipcRenderer.invoke("stop-audio-capture")
  },
  // Screen operations
  screen: {
    capture: () => electron.ipcRenderer.invoke("capture-screen")
  },
  // Event listeners
  on: (channel, callback) => {
    const validChannels = [
      "audio-data",
      "transcription-result",
      "ai-response",
      "settings-updated",
      "window-moved",
      "window-resized"
    ];
    if (validChannels.includes(channel)) {
      electron.ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  // Remove event listeners
  removeAllListeners: (channel) => {
    electron.ipcRenderer.removeAllListeners(channel);
  },
  // Send events
  send: (channel, ...args) => {
    const validChannels = [
      "start-listening",
      "stop-listening",
      "send-message",
      "update-settings"
    ];
    if (validChannels.includes(channel)) {
      electron.ipcRenderer.send(channel, ...args);
    }
  }
};
electron.contextBridge.exposeInMainWorld("electronAPI", api);
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlbG9hZC5qcyIsInNvdXJjZXMiOlsiLi4vZWxlY3Ryb24vcHJlbG9hZC50cyJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjb250ZXh0QnJpZGdlLCBpcGNSZW5kZXJlciB9IGZyb20gJ2VsZWN0cm9uJ1xuXG4vLyBDdXN0b20gQVBJcyBmb3IgcmVuZGVyZXJcbmNvbnN0IGFwaSA9IHtcbiAgLy8gQXBwIGluZm9cbiAgZ2V0QXBwVmVyc2lvbjogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdnZXQtYXBwLXZlcnNpb24nKSxcblxuICAvLyBTdG9yZSBvcGVyYXRpb25zXG4gIHN0b3JlOiB7XG4gICAgZ2V0OiAoa2V5OiBzdHJpbmcpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnZ2V0LXN0b3JlLXZhbHVlJywga2V5KSxcbiAgICBzZXQ6IChrZXk6IHN0cmluZywgdmFsdWU6IGFueSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdzZXQtc3RvcmUtdmFsdWUnLCBrZXksIHZhbHVlKSxcbiAgICBkZWxldGU6IChrZXk6IHN0cmluZykgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdkZWxldGUtc3RvcmUtdmFsdWUnLCBrZXkpLFxuICB9LFxuXG4gIC8vIFdpbmRvdyBvcGVyYXRpb25zXG4gIHdpbmRvdzoge1xuICAgIHNob3dTZXR0aW5nczogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdzaG93LXNldHRpbmdzJyksXG4gICAgY2xvc2U6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnY2xvc2UtYXBwJyksXG4gICAgbWluaW1pemU6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnbWluaW1pemUtd2luZG93JyksXG4gICAgdG9nZ2xlQWx3YXlzT25Ub3A6ICgpID0+IGlwY1JlbmRlcmVyLmludm9rZSgndG9nZ2xlLWFsd2F5cy1vbi10b3AnKSxcbiAgICBzZXRTaXplOiAod2lkdGg6IG51bWJlciwgaGVpZ2h0OiBudW1iZXIpID0+IGlwY1JlbmRlcmVyLmludm9rZSgnc2V0LXdpbmRvdy1zaXplJywgd2lkdGgsIGhlaWdodCksXG4gICAgc2V0UG9zaXRpb246ICh4OiBudW1iZXIsIHk6IG51bWJlcikgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdzZXQtd2luZG93LXBvc2l0aW9uJywgeCwgeSksXG4gICAgZ2V0Qm91bmRzOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2dldC13aW5kb3ctYm91bmRzJyksXG4gIH0sXG5cbiAgLy8gRGlhbG9nIG9wZXJhdGlvbnNcbiAgZGlhbG9nOiB7XG4gICAgc2hvd0Vycm9yOiAodGl0bGU6IHN0cmluZywgY29udGVudDogc3RyaW5nKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3Nob3ctZXJyb3ItZGlhbG9nJywgdGl0bGUsIGNvbnRlbnQpLFxuICAgIHNob3dNZXNzYWdlOiAob3B0aW9uczogYW55KSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3Nob3ctbWVzc2FnZS1kaWFsb2cnLCBvcHRpb25zKSxcbiAgfSxcblxuICAvLyBPcGVuUm91dGVyIEFQSVxuICBvcGVucm91dGVyOiB7XG4gICAgcmVxdWVzdDogKG9wdGlvbnM6IHtcbiAgICAgIGVuZHBvaW50OiBzdHJpbmdcbiAgICAgIG1ldGhvZDogc3RyaW5nXG4gICAgICBoZWFkZXJzOiBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+XG4gICAgICBib2R5Pzogc3RyaW5nXG4gICAgfSkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdvcGVucm91dGVyLXJlcXVlc3QnLCBvcHRpb25zKSxcbiAgfSxcblxuICAvLyBBdWRpbyBvcGVyYXRpb25zXG4gIGF1ZGlvOiB7XG4gICAgc3RhcnRDYXB0dXJlOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ3N0YXJ0LWF1ZGlvLWNhcHR1cmUnKSxcbiAgICBzdG9wQ2FwdHVyZTogKCkgPT4gaXBjUmVuZGVyZXIuaW52b2tlKCdzdG9wLWF1ZGlvLWNhcHR1cmUnKSxcbiAgfSxcblxuICAvLyBTY3JlZW4gb3BlcmF0aW9uc1xuICBzY3JlZW46IHtcbiAgICBjYXB0dXJlOiAoKSA9PiBpcGNSZW5kZXJlci5pbnZva2UoJ2NhcHR1cmUtc2NyZWVuJyksXG4gIH0sXG5cbiAgLy8gRXZlbnQgbGlzdGVuZXJzXG4gIG9uOiAoY2hhbm5lbDogc3RyaW5nLCBjYWxsYmFjazogRnVuY3Rpb24pID0+IHtcbiAgICBjb25zdCB2YWxpZENoYW5uZWxzID0gW1xuICAgICAgJ2F1ZGlvLWRhdGEnLFxuICAgICAgJ3RyYW5zY3JpcHRpb24tcmVzdWx0JyxcbiAgICAgICdhaS1yZXNwb25zZScsXG4gICAgICAnc2V0dGluZ3MtdXBkYXRlZCcsXG4gICAgICAnd2luZG93LW1vdmVkJyxcbiAgICAgICd3aW5kb3ctcmVzaXplZCdcbiAgICBdXG4gICAgXG4gICAgaWYgKHZhbGlkQ2hhbm5lbHMuaW5jbHVkZXMoY2hhbm5lbCkpIHtcbiAgICAgIGlwY1JlbmRlcmVyLm9uKGNoYW5uZWwsIChldmVudCwgLi4uYXJncykgPT4gY2FsbGJhY2soLi4uYXJncykpXG4gICAgfVxuICB9LFxuXG4gIC8vIFJlbW92ZSBldmVudCBsaXN0ZW5lcnNcbiAgcmVtb3ZlQWxsTGlzdGVuZXJzOiAoY2hhbm5lbDogc3RyaW5nKSA9PiB7XG4gICAgaXBjUmVuZGVyZXIucmVtb3ZlQWxsTGlzdGVuZXJzKGNoYW5uZWwpXG4gIH0sXG5cbiAgLy8gU2VuZCBldmVudHNcbiAgc2VuZDogKGNoYW5uZWw6IHN0cmluZywgLi4uYXJnczogYW55W10pID0+IHtcbiAgICBjb25zdCB2YWxpZENoYW5uZWxzID0gW1xuICAgICAgJ3N0YXJ0LWxpc3RlbmluZycsXG4gICAgICAnc3RvcC1saXN0ZW5pbmcnLFxuICAgICAgJ3NlbmQtbWVzc2FnZScsXG4gICAgICAndXBkYXRlLXNldHRpbmdzJ1xuICAgIF1cbiAgICBcbiAgICBpZiAodmFsaWRDaGFubmVscy5pbmNsdWRlcyhjaGFubmVsKSkge1xuICAgICAgaXBjUmVuZGVyZXIuc2VuZChjaGFubmVsLCAuLi5hcmdzKVxuICAgIH1cbiAgfSxcbn1cblxuLy8gRXhwb3NlIHRoZSBBUEkgdG8gdGhlIHJlbmRlcmVyIHByb2Nlc3NcbmNvbnRleHRCcmlkZ2UuZXhwb3NlSW5NYWluV29ybGQoJ2VsZWN0cm9uQVBJJywgYXBpKVxuXG4vLyBUeXBlIGRlZmluaXRpb25zIGZvciBUeXBlU2NyaXB0XG5leHBvcnQgdHlwZSBFbGVjdHJvbkFQSSA9IHR5cGVvZiBhcGlcblxuLy8gRGVjbGFyZSBnbG9iYWwgaW50ZXJmYWNlIGZvciBUeXBlU2NyaXB0XG5kZWNsYXJlIGdsb2JhbCB7XG4gIGludGVyZmFjZSBXaW5kb3cge1xuICAgIGVsZWN0cm9uQVBJOiBFbGVjdHJvbkFQSVxuICB9XG59Il0sIm5hbWVzIjpbImlwY1JlbmRlcmVyIiwiY29udGV4dEJyaWRnZSJdLCJtYXBwaW5ncyI6Ijs7QUFHQSxNQUFNLE1BQU07QUFBQTtBQUFBLEVBRVYsZUFBZSxNQUFNQSxTQUFBQSxZQUFZLE9BQU8saUJBQWlCO0FBQUE7QUFBQSxFQUd6RCxPQUFPO0FBQUEsSUFDTCxLQUFLLENBQUMsUUFBZ0JBLFNBQUFBLFlBQVksT0FBTyxtQkFBbUIsR0FBRztBQUFBLElBQy9ELEtBQUssQ0FBQyxLQUFhLFVBQWVBLFNBQUFBLFlBQVksT0FBTyxtQkFBbUIsS0FBSyxLQUFLO0FBQUEsSUFDbEYsUUFBUSxDQUFDLFFBQWdCQSxTQUFBQSxZQUFZLE9BQU8sc0JBQXNCLEdBQUc7QUFBQSxFQUFBO0FBQUE7QUFBQSxFQUl2RSxRQUFRO0FBQUEsSUFDTixjQUFjLE1BQU1BLFNBQUFBLFlBQVksT0FBTyxlQUFlO0FBQUEsSUFDdEQsT0FBTyxNQUFNQSxTQUFBQSxZQUFZLE9BQU8sV0FBVztBQUFBLElBQzNDLFVBQVUsTUFBTUEsU0FBQUEsWUFBWSxPQUFPLGlCQUFpQjtBQUFBLElBQ3BELG1CQUFtQixNQUFNQSxTQUFBQSxZQUFZLE9BQU8sc0JBQXNCO0FBQUEsSUFDbEUsU0FBUyxDQUFDLE9BQWUsV0FBbUJBLFNBQUFBLFlBQVksT0FBTyxtQkFBbUIsT0FBTyxNQUFNO0FBQUEsSUFDL0YsYUFBYSxDQUFDLEdBQVcsTUFBY0EsU0FBQUEsWUFBWSxPQUFPLHVCQUF1QixHQUFHLENBQUM7QUFBQSxJQUNyRixXQUFXLE1BQU1BLHFCQUFZLE9BQU8sbUJBQW1CO0FBQUEsRUFBQTtBQUFBO0FBQUEsRUFJekQsUUFBUTtBQUFBLElBQ04sV0FBVyxDQUFDLE9BQWUsWUFBb0JBLFNBQUFBLFlBQVksT0FBTyxxQkFBcUIsT0FBTyxPQUFPO0FBQUEsSUFDckcsYUFBYSxDQUFDLFlBQWlCQSxTQUFBQSxZQUFZLE9BQU8sdUJBQXVCLE9BQU87QUFBQSxFQUFBO0FBQUE7QUFBQSxFQUlsRixZQUFZO0FBQUEsSUFDVixTQUFTLENBQUMsWUFLSkEsU0FBQUEsWUFBWSxPQUFPLHNCQUFzQixPQUFPO0FBQUEsRUFBQTtBQUFBO0FBQUEsRUFJeEQsT0FBTztBQUFBLElBQ0wsY0FBYyxNQUFNQSxTQUFBQSxZQUFZLE9BQU8scUJBQXFCO0FBQUEsSUFDNUQsYUFBYSxNQUFNQSxxQkFBWSxPQUFPLG9CQUFvQjtBQUFBLEVBQUE7QUFBQTtBQUFBLEVBSTVELFFBQVE7QUFBQSxJQUNOLFNBQVMsTUFBTUEscUJBQVksT0FBTyxnQkFBZ0I7QUFBQSxFQUFBO0FBQUE7QUFBQSxFQUlwRCxJQUFJLENBQUMsU0FBaUIsYUFBdUI7QUFDM0MsVUFBTSxnQkFBZ0I7QUFBQSxNQUNwQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFBQTtBQUdGLFFBQUksY0FBYyxTQUFTLE9BQU8sR0FBRztBQUNuQ0EsMkJBQVksR0FBRyxTQUFTLENBQUMsVUFBVSxTQUFTLFNBQVMsR0FBRyxJQUFJLENBQUM7QUFBQSxJQUMvRDtBQUFBLEVBQ0Y7QUFBQTtBQUFBLEVBR0Esb0JBQW9CLENBQUMsWUFBb0I7QUFDdkNBLGFBQUFBLFlBQVksbUJBQW1CLE9BQU87QUFBQSxFQUN4QztBQUFBO0FBQUEsRUFHQSxNQUFNLENBQUMsWUFBb0IsU0FBZ0I7QUFDekMsVUFBTSxnQkFBZ0I7QUFBQSxNQUNwQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQUE7QUFHRixRQUFJLGNBQWMsU0FBUyxPQUFPLEdBQUc7QUFDbkNBLGVBQUFBLFlBQVksS0FBSyxTQUFTLEdBQUcsSUFBSTtBQUFBLElBQ25DO0FBQUEsRUFDRjtBQUNGO0FBR0FDLFNBQUFBLGNBQWMsa0JBQWtCLGVBQWUsR0FBRzsifQ==
