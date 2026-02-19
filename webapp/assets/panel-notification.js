// Вспомогательный модуль для уведомлений
window.showPanelNotification = function(message, timeout = 3000) {
    let notif = document.getElementById('panel-notification');
    if (!notif) {
        notif = document.createElement('div');
        notif.id = 'panel-notification';
        notif.style.position = 'fixed';
        notif.style.left = '5px';
        notif.style.right = '5px';
        notif.style.width = 'auto';
        notif.style.maxWidth = 'calc(100vw - 10px)';
        notif.style.bottom = '5px';
        notif.style.transform = 'none';
        notif.style.background = 'rgba(40,40,60,0.97)';
        notif.style.color = '#fff';
        notif.style.padding = '12px 24px';
        notif.style.borderRadius = '12px';
        notif.style.fontSize = '1.08em';
        notif.style.fontWeight = '600';
        notif.style.boxShadow = '0 2px 16px 0 #0006';
        notif.style.zIndex = '99999';
        notif.style.transition = 'opacity 0.3s';
        notif.style.opacity = '0';
        document.body.appendChild(notif);
    }
    notif.textContent = message;
    notif.style.opacity = '1';
    notif.style.pointerEvents = 'auto';
    clearTimeout(window._panelNotifTimeout);
    window._panelNotifTimeout = setTimeout(() => {
        notif.style.opacity = '0';
        notif.style.pointerEvents = 'none';
    }, timeout);
};
