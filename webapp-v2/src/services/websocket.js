const WS_URL = import.meta.env.DEV
  ? `ws://${window.location.hostname}:8081`
  : `wss://${window.location.host}/bridge`;

export class MafiaWebSocket {
  constructor(roomId, onMessage) {
    this.roomId = roomId;
    this.onMessage = onMessage;
    this.socket = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.pingInterval = null;
    this.panelId = 'panel_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    this._sendFullStateTimer = null;
    this._pendingState = null;
  }

  connect() {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) return;

    this.socket = new WebSocket(WS_URL);

    this.socket.onopen = () => {
      console.log('WS Connected to room:', this.roomId);
      this.reconnectAttempts = 0;
      this.socket.send(JSON.stringify({
        joinRoom: this.roomId,
        panelId: this.panelId,
      }));

      if (this._pendingState) {
        this.sendState(this._pendingState);
        this._pendingState = null;
      }

      this.pingInterval = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          this.socket.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    this.socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'pong') return;
        this.onMessage(data);
      } catch (e) {
        console.error('WS parse error:', e);
      }
    };

    this.socket.onclose = () => {
      console.log('WS Closed');
      this._clearPing();
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        const delay = Math.min(3000 * this.reconnectAttempts, 15000);
        setTimeout(() => this.connect(), delay);
      }
    };

    this.socket.onerror = (err) => {
      console.error('WS Error:', err);
    };
  }

  _clearPing() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  send(data) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(data));
    }
  }

  sendState(state) {
    this.send({ type: 'state', ...state });
  }

  sendFullStateDebounced(state) {
    if (this._sendFullStateTimer) clearTimeout(this._sendFullStateTimer);
    this._sendFullStateTimer = setTimeout(() => {
      this.sendState(state);
    }, 100);
  }

  sendRoleChange(roleKey, role) {
    this.send({ type: 'roleChange', roleKey, role });
  }

  sendActionChange(roleKey, action) {
    this.send({ type: 'actionChange', roleKey, action });
  }

  sendFoulChange(roleKey, fouls) {
    this.send({ type: 'foulChange', roleKey, fouls });
  }

  sendTechFoulChange(roleKey, techFouls) {
    this.send({ type: 'techFoulChange', roleKey, techFouls });
  }

  sendHighlight(roleKey) {
    this.send({ type: 'highlight', roleKey });
  }

  sendPanelStateChange(state) {
    this.send({ type: 'panelStateChange', ...state });
  }

  sendBestMoveChange(bestMove) {
    this.send({ type: 'bestMoveChange', bestMove });
  }

  sendBestMoveConfirm(bestMove) {
    this.send({ type: 'bestMoveConfirm', bestMove });
  }

  sendWinnerTeam(team) {
    this.send({ type: 'winnerTeam', team });
  }

  sendVotingStart(candidates) {
    this.send({ type: 'votingStart', candidates });
  }

  sendVotingSelection(candidate, voters) {
    this.send({ type: 'votingSelection', candidate, voters });
  }

  sendVotingFinish(winners) {
    this.send({ type: 'votingFinish', winners });
  }

  sendVotingClose() {
    this.send({ type: 'votingClose' });
  }

  activatePanel() {
    this.send({ type: 'activatePanel', panelId: this.panelId });
  }

  close() {
    this._clearPing();
    if (this._sendFullStateTimer) clearTimeout(this._sendFullStateTimer);
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
  }
}
