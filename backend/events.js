// Server-Sent Events manager for real-time updates
class EventManager {
  constructor() {
    this.clients = new Set();
  }

  addClient(res) {
    this.clients.add(res);
  }

  removeClient(res) {
    this.clients.delete(res);
  }

  broadcast(eventType, data) {
    const message = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`;
    
    // Send to all connected clients, removing dead connections
    const deadClients = [];
    for (const client of this.clients) {
      try {
        client.write(message);
      } catch (error) {
        // Client connection is dead, mark for removal
        deadClients.push(client);
      }
    }
    
    // Remove dead clients
    deadClients.forEach(client => this.removeClient(client));
  }
}

module.exports = new EventManager();




