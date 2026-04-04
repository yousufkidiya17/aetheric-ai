/**
 * AETHERIC — Complete Production Server (Single Process)
 * 
 * Integrated with MongoDB Atlas.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const { Conversation, WorkerProfile, Booking, ActiveOrder, ActiveRide } = require('./models');

const app = express();
const server = http.createServer(app);

// ─── Middleware ──────────────────────────────────────────────────────────────────

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Config ─────────────────────────────────────────────────────────────────────

const CONFIG = {
  MISTRAL_API_KEY: process.env.MISTRAL_API_KEY,
  MISTRAL_API_URL: 'https://api.mistral.ai/v1/chat/completions',
  MISTRAL_MODEL: 'mistral-small-latest',
};

// ═══════════════════════════════════════════════════════════════════════════════
// WEBSOCKET SERVER
// ═══════════════════════════════════════════════════════════════════════════════

const { WebSocketServer } = require('ws');

class AethericWebSocket {
  constructor(httpServer) {
    this.wss = new WebSocketServer({ server: httpServer, path: '/ws' });
    this.clients = { users: new Map(), workers: new Map() };
    this.pendingNotifications = new Map();
    this.init();
    console.log('⚡ WebSocket server initialized on /ws');
  }

  init() {
    this.wss.on('connection', (ws) => {
      const clientId = uuidv4().slice(0, 8);
      ws.clientId = clientId;
      ws.isAlive = true;
      ws.role = null;

      this.send(ws, {
        type: 'connected', clientId,
        message: 'Connected to Aetheric real-time service',
        timestamp: new Date().toISOString()
      });

      ws.on('message', (raw) => {
        try {
          const message = JSON.parse(raw.toString());
          this.handleMessage(ws, message);
        } catch { this.send(ws, { type: 'error', message: 'Invalid message format.' }); }
      });

      ws.on('close', () => this.removeClient(ws));
      ws.on('pong', () => { ws.isAlive = true; });
    });

    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (!ws.isAlive) { this.removeClient(ws); return ws.terminate(); }
        ws.isAlive = false;
        ws.ping();
      });
    }, 30000);
  }

  handleMessage(ws, message) {
    const { type, payload } = message;
    switch (type) {
      case 'register': this.handleRegister(ws, payload); break;
      case 'worker_response': this.handleWorkerResponse(ws, payload); break;
      case 'worker_status_update': this.handleWorkerStatusUpdate(ws, payload); break;
      case 'ping': this.send(ws, { type: 'pong', timestamp: new Date().toISOString() }); break;
      default: this.send(ws, { type: 'error', message: `Unknown type: ${type}` });
    }
  }

  handleRegister(ws, payload) {
    const { role, id, name, skills } = payload || {};
    if (!role || !['user', 'worker'].includes(role)) {
      return this.send(ws, { type: 'error', message: 'Invalid role.' });
    }
    ws.role = role;
    ws.userId = id || ws.clientId;
    ws.userName = name || 'Anonymous';

    if (role === 'user') {
      this.clients.users.set(ws.userId, ws);
    } else {
      ws.skills = skills || [];
      this.clients.workers.set(ws.userId, ws);
      const pending = this.pendingNotifications.get(ws.userId);
      if (pending && pending.length > 0) {
        pending.forEach(n => this.send(ws, n));
        this.pendingNotifications.delete(ws.userId);
      }
    }

    this.send(ws, {
      type: 'registered', role, id: ws.userId,
      message: `Registered as ${role}`,
      onlineWorkers: this.clients.workers.size,
      onlineUsers: this.clients.users.size
    });
  }

  async handleWorkerResponse(ws, payload) {
    const { bookingId, action, estimatedArrival } = payload || {};
    if (!bookingId || !action) return;

    const notification = {
      type: 'booking_update', bookingId, action,
      worker: { id: ws.userId, name: ws.userName },
      estimatedArrival: estimatedArrival || '15-20 min',
      timestamp: new Date().toISOString(),
      message: action === 'accept'
        ? `✅ ${ws.userName} accepted your booking! ETA: ${estimatedArrival || '15-20 min'}`
        : `❌ ${ws.userName} declined. Finding another worker...`
    };

    this.clients.users.forEach((userWs) => this.send(userWs, notification));
    this.send(ws, {
      type: 'response_confirmed', bookingId, action,
      message: action === 'accept' ? 'Booking accepted!' : 'Booking declined.'
    });
  }

  handleWorkerStatusUpdate(ws, payload) {
    const { status, bookingId } = payload || {};
    const msgs = {
      'en_route': `${ws.userName} is on the way`,
      'arrived': `${ws.userName} has arrived`,
      'in_progress': `${ws.userName} has started working`,
      'completed': `${ws.userName} has completed the job`,
    };
    this.clients.users.forEach((userWs) => {
      this.send(userWs, {
        type: 'booking_status_update', bookingId, status,
        worker: ws.userName, message: msgs[status] || `Status: ${status}`,
        timestamp: new Date().toISOString()
      });
    });
  }

  broadcastToWorkersBySkill(skills, bookingData) {
    // skills can be array or string
    const targetSkillSet = new Set(Array.isArray(skills) ? skills.map(s => s.toLowerCase()) : [skills.toLowerCase()]);
    
    const notification = {
      type: 'new_booking', booking: bookingData,
      timestamp: new Date().toISOString(),
      message: `🔔 New ${[...targetSkillSet].join(', ')} request nearby!`
    };
    let sent = 0;
    this.clients.workers.forEach((ws) => {
      if (ws.skills.some(s => targetSkillSet.has(s.toLowerCase()))) {
        this.send(ws, notification); sent++;
      }
    });
    return sent;
  }

  sendChatResponse(userId, responseData) {
    const userWs = this.clients.users.get(userId);
    if (userWs) this.send(userWs, { type: 'chat_response', ...responseData, timestamp: new Date().toISOString() });
  }

  send(ws, data) { if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(data)); }
  removeClient(ws) {
    if (ws.role === 'user') this.clients.users.delete(ws.userId);
    else if (ws.role === 'worker') this.clients.workers.delete(ws.userId);
  }
  getStats() {
    return {
      onlineUsers: this.clients.users.size,
      onlineWorkers: this.clients.workers.size,
      totalConnections: this.wss.clients.size
    };
  }
}

const wsServer = new AethericWebSocket(server);

// ═══════════════════════════════════════════════════════════════════════════════
// FOOD MCP (Inline — Mock Zomato/Swiggy)
// ═══════════════════════════════════════════════════════════════════════════════

const restaurants = [
  {
    id: 'rest_001', name: 'Tandoori Nights', cuisine: 'North Indian', rating: 4.6,
    deliveryTime: '30-40 min', priceRange: '₹₹', distance: '1.2 km', isOpen: true,
    menu: [
      { id: 'item_001', name: 'Butter Chicken', price: 320, category: 'Main Course', veg: false, popular: true },
      { id: 'item_002', name: 'Paneer Tikka Masala', price: 280, category: 'Main Course', veg: true, popular: true },
      { id: 'item_003', name: 'Garlic Naan', price: 60, category: 'Bread', veg: true, popular: true },
      { id: 'item_004', name: 'Dal Makhani', price: 220, category: 'Main Course', veg: true, popular: false },
      { id: 'item_005', name: 'Chicken Biryani', price: 350, category: 'Rice', veg: false, popular: true },
    ]
  },
  {
    id: 'rest_002', name: 'Pizza Paradise', cuisine: 'Italian', rating: 4.3,
    deliveryTime: '25-35 min', priceRange: '₹₹₹', distance: '2.5 km', isOpen: true,
    menu: [
      { id: 'item_010', name: 'Margherita Pizza', price: 299, category: 'Pizza', veg: true, popular: true },
      { id: 'item_011', name: 'Pepperoni Pizza', price: 449, category: 'Pizza', veg: false, popular: true },
      { id: 'item_013', name: 'Pasta Alfredo', price: 329, category: 'Pasta', veg: true, popular: true },
    ]
  },
];

async function foodHandler(tool, params) {
  switch (tool) {
    case 'search_restaurants': {
      let results = [...restaurants].filter(r => r.isOpen);
      if (params.cuisine) results = results.filter(r => r.cuisine.toLowerCase().includes(params.cuisine.toLowerCase()));
      if (params.query) {
        const q = params.query.toLowerCase();
        results = results.filter(r => r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q));
      }
      return { success: true, count: results.length, restaurants: results.map(({ menu, ...r }) => ({ ...r, popularItems: menu.filter(i => i.popular).map(i => i.name).slice(0, 3) })) };
    }
    case 'get_menu': {
      const rest = restaurants.find(r => r.id === params.restaurantId);
      if (!rest) return { success: false, error: 'Restaurant not found' };
      const grouped = {};
      rest.menu.forEach(item => { if (!grouped[item.category]) grouped[item.category] = []; grouped[item.category].push(item); });
      return { success: true, restaurant: rest.name, cuisine: rest.cuisine, menuByCategory: grouped };
    }
    case 'place_order': {
      const rest = restaurants.find(r => r.id === params.restaurantId);
      if (!rest) return { success: false, error: 'Restaurant not found' };
      const items = (params.items || []).map(oi => {
        const mi = rest.menu.find(m => m.id === oi.itemId || m.name.toLowerCase() === oi.name?.toLowerCase());
        return mi ? { ...mi, quantity: oi.quantity || 1, subtotal: mi.price * (oi.quantity || 1) } : null;
      }).filter(Boolean);
      if (!items.length) return { success: false, error: 'No valid items' };
      const orderId = `ORD_${uuidv4().slice(0, 8).toUpperCase()}`;
      const total = items.reduce((s, i) => s + i.subtotal, 0);
      const order = { orderId, restaurant: rest.name, items, grandTotal: total + 40 + Math.round(total * 0.05), estimatedDelivery: rest.deliveryTime, status: 'confirmed' };
      
      // Save to MongoDB
      await ActiveOrder.create(order);

      return { success: true, order: { orderId, restaurant: rest.name, items: items.map(i => `${i.quantity}x ${i.name}`), grandTotal: `₹${order.grandTotal}`, estimatedDelivery: rest.deliveryTime } };
    }
    case 'get_recommendations': {
      const moodMap = { 'hungry': ['Butter Chicken', 'Margherita Pizza'], 'craving': ['Pepperoni Pizza'] };
      const key = Object.keys(moodMap).find(k => (params.mood || '').toLowerCase().includes(k)) || 'hungry';
      const recommended = [];
      restaurants.forEach(r => r.menu.forEach(item => { if (moodMap[key] && moodMap[key].includes(item.name)) recommended.push({ restaurant: r.name, item: item.name, price: `₹${item.price}`, deliveryTime: r.deliveryTime, rating: r.rating }); }));
      return { success: true, mood: params.mood || 'hungry', recommendations: recommended };
    }
    default: return { success: false, error: `Unknown food tool: ${tool}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// RIDES MCP (Inline — Mock Ola/Uber)
// ═══════════════════════════════════════════════════════════════════════════════

const rideTypes = [
  { id: 'mini', name: 'Ola Mini', icon: '🚗', basePrice: 50, perKmRate: 10, perMinRate: 1.5, capacity: 4, eta: '3-5 min' },
  { id: 'sedan', name: 'Ola Sedan', icon: '🚙', basePrice: 80, perKmRate: 14, perMinRate: 2, capacity: 4, eta: '5-7 min' },
  { id: 'auto', name: 'Ola Auto', icon: '🛺', basePrice: 30, perKmRate: 8, perMinRate: 1, capacity: 3, eta: '2-4 min' },
];
const drivers = [{ id: 'drv_001', name: 'Rajesh', rating: 4.8, vehicle: 'Swift (DL01)', photo: '👨‍✈️' }];

async function ridesHandler(tool, params) {
  const calcDist = () => 10 + Math.random() * 5;
  const calcFare = (dist, typeId) => {
    const t = rideTypes.find(r => r.id === typeId) || rideTypes[0];
    const mins = (dist / 25) * 60;
    return { finalFare: Math.round(t.basePrice + dist * t.perKmRate + mins * t.perMinRate), estimatedTime: `${Math.round(mins)} min`, distance: `${dist.toFixed(1)} km` };
  };

  switch (tool) {
    case 'estimate_ride': {
      const dist = calcDist();
      const estimates = rideTypes.map(t => {
        const f = calcFare(dist, t.id);
        return { rideType: t.name, icon: t.icon, fare: `₹${f.finalFare}`, eta: t.eta, distance: f.distance };
      });
      return { success: true, pickup: params.pickup, destination: params.destination, estimates };
    }
    case 'book_ride': {
      const type = rideTypes.find(r => r.name.toLowerCase().includes((params.rideType || 'mini').toLowerCase())) || rideTypes[0];
      const driver = drivers[0];
      const dist = calcDist();
      const fare = calcFare(dist, type.id);
      const rideId = `RIDE_${uuidv4().slice(0, 8).toUpperCase()}`;
      
      // Save to MongoDB
      await ActiveRide.create({ rideId, status: 'driver_assigned', driver });

      return {
        success: true, message: `🚕 Ride booked! ${driver.name} is heading to your pickup.`,
        ride: { rideId, driver: driver.name, vehicle: driver.vehicle, otp: 1234, rideType: type.name, fare: `₹${fare.finalFare}`, eta: type.eta, pickup: params.pickup, destination: params.destination }
      };
    }
    case 'get_ride_types': return { success: true, rideTypes };
    default: return { success: false, error: `Unknown rides tool: ${tool}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKERS MCP (MongoDB Dynamic Data)
// ═══════════════════════════════════════════════════════════════════════════════

async function workersHandler(tool, params) {
  switch (tool) {
    case 'search_workers': {
      let query = { availability: true };
      if (params.skill) query.skills = { $regex: params.skill, $options: 'i' };
      if (params.verifiedOnly) query.verified = true;
      
      let workers = await WorkerProfile.find(query).sort({ rating: -1 }).lean();
      
      if (params.query) { 
        const q = params.query.toLowerCase(); 
        workers = workers.filter(w => w.name.toLowerCase().includes(q) || (w.services && w.services.some(s => s.toLowerCase().includes(q)))); 
      }
      return { success: true, count: workers.length, workers: workers.map(w => ({ id: w.id, name: w.name, skill: (w.skills && w.skills[0]) || 'General', photo: w.photo, rating: `⭐ ${w.rating}`, experience: w.experience, hourlyRate: `₹${w.hourlyRate}/hr`, verified: w.verified ? '✅ Verified' : 'Unverified' })) };
    }
    case 'book_worker': {
      const worker = await WorkerProfile.findOne({ id: params.workerId }).lean();
      if (!worker) return { success: false, error: 'Worker not found' };
      
      const bookingId = `BKG_${uuidv4().slice(0, 8).toUpperCase()}`;
      const serviceRequested = params.service || (worker.services && worker.services[0]) || 'General';
      
      const bookingDoc = new Booking({
        bookingId,
        worker: { id: worker.id, name: worker.name, skill: (worker.skills && worker.skills[0]), photo: worker.photo },
        service: serviceRequested,
        description: params.description || 'General service',
        address: params.address || '123 Main Street',
        urgency: params.urgency || 'normal',
        status: 'pending',
        estimatedRate: `₹${worker.hourlyRate}/hr`
      });
      await bookingDoc.save();

      return { success: true, message: `📋 Booking sent to ${worker.name}!`, booking: { bookingId, worker: worker.name, skill: (worker.skills && worker.skills[0]), service: bookingDoc.service, rate: bookingDoc.estimatedRate, status: 'pending', urgency: bookingDoc.urgency === 'urgent' ? '🔴 Urgent' : '🟢 Normal' } };
    }
    case 'get_skills_list': {
      const workers = await WorkerProfile.find().lean();
      const skillsCounter = {};
      workers.forEach(w => {
        if(w.skills) w.skills.forEach(s => {
          skillsCounter[s] = (skillsCounter[s] || 0) + (w.availability ? 1 : 0);
        });
      });
      const skillArr = Object.keys(skillsCounter).map(s => ({ skill: s, availableWorkers: skillsCounter[s] }));
      return { success: true, skills: skillArr };
    }
    default: return { success: false, error: `Unknown workers tool: ${tool}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MCP ROUTER
// ═══════════════════════════════════════════════════════════════════════════════

async function callMCPInline(intent, tool, params) {
  switch (intent) {
    case 'food': return await foodHandler(tool, params);
    case 'rides': return await ridesHandler(tool, params);
    case 'workers': return await workersHandler(tool, params);
    default: return { success: false, error: `Unknown service: ${intent}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MISTRAL AI INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

async function getConversation(sessionId) {
  let conv = await Conversation.findOne({ sessionId });
  if (!conv) {
    conv = new Conversation({ sessionId, messages: [] });
    await conv.save();
  }
  return conv;
}

const SYSTEM_PROMPT = `You are Aetheric, a premium AI assistant for a service marketplace. You help users:
1. **Order Food** — Search restaurants, browse menus, place orders
2. **Book Rides** — Estimate fares, book cabs/autos/bikes
3. **Hire Workers** — Find electricians, plumbers, tutors, carpenters

IMPORTANT RULES:
- Analyze the user's message and determine which service they need
- Return a structured JSON response with the detected intent and action
- Be conversational and helpful
- Use Indian Rupees (₹) for all currency

RESPONSE FORMAT (always return valid JSON):
{
  "reply": "Your conversational response",
  "intent": "food" | "rides" | "workers" | "general" | "clarify",
  "action": { "tool": "the MCP tool to call", "params": { "key": "value" } },
  "suggestions": ["suggestion 1", "suggestion 2"]
}

TOOL MAPPING:
- Food: search_restaurants, get_menu, place_order, get_recommendations
- Rides: estimate_ride, book_ride, get_ride_types
- Workers: search_workers, book_worker, get_skills_list
`;

async function callMistral(messages) {
  try {
    const formattedMessages = messages.map(m => ({ role: m.role, content: m.content }));
    const response = await fetch(CONFIG.MISTRAL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.MISTRAL_API_KEY}` },
      body: JSON.stringify({ model: CONFIG.MISTRAL_MODEL, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...formattedMessages], temperature: 0.7, max_tokens: 1024, response_format: { type: 'json_object' } })
    });
    if (!response.ok) throw new Error(`Mistral API error: ${response.status}`);
    const data = await response.json();
    try { return JSON.parse(data.choices[0]?.message?.content); }
    catch { return { reply: data.choices[0]?.message?.content, intent: 'general', action: null, suggestions: [] }; }
  } catch (error) {
    console.error('[Mistral] Call failed:', error.message);
    throw error;
  }
}

function getFallbackResponse(message) {
  const msg = message.toLowerCase();
  if (msg.includes('food') || msg.includes('hungry')) return { reply: "I'd love to help you with food! 🍕 What cuisine?", intent: 'food', suggestions: ['Show nearby restaurants'] };
  if (msg.includes('ride') || msg.includes('cab')) return { reply: "Let me help you get a ride! 🚕 Where to?", intent: 'rides', suggestions: ['Book a ride to airport'] };
  if (msg.includes('plumber') || msg.includes('worker') || msg.includes('electrician')) return { reply: "I'll find the right professional! 🔧 What service?", intent: 'workers', suggestions: ['Find a plumber'] };
  return { reply: "Hello! I'm Aetheric, your AI assistant. I can help order food, book rides, or hire workers.", intent: 'general', suggestions: ["I'm hungry", 'Book a ride', 'Need a plumber'] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

app.post('/api/chat', async (req, res) => {
  const { message, sessionId: reqSessionId, userId } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const sessionId = reqSessionId || uuidv4();
  const conversation = await getConversation(sessionId);
  conversation.messages.push({ role: 'user', content: message });
  
  const recentMessages = conversation.messages.slice(-20);

  try {
    console.log(`\n[Chat] User: "${message}"`);
    const aiResponse = await callMistral(recentMessages);
    console.log(`[Chat] Intent: ${aiResponse.intent}, Tool: ${aiResponse.action?.tool || 'none'}`);

    let mcpResult = null;
    let finalReply = aiResponse.reply;

    if (aiResponse.action && aiResponse.action.tool && aiResponse.intent !== 'general' && aiResponse.intent !== 'clarify') {
      try {
        mcpResult = await callMCPInline(aiResponse.intent, aiResponse.action.tool, aiResponse.action.params || {});
        console.log(`[Chat] MCP Result:`, JSON.stringify(mcpResult).slice(0, 200));

        const followUp = [...recentMessages, { role: 'assistant', content: JSON.stringify(aiResponse) }, { role: 'user', content: `Results: ${JSON.stringify(mcpResult)}. Friendly reply:` }];
        const enriched = await callMistral(followUp);
        finalReply = enriched.reply || finalReply;

        if (aiResponse.action.tool === 'book_worker' && mcpResult.success) {
           wsServer.broadcastToWorkersBySkill(aiResponse.action.params.skill || 'General', mcpResult.booking);
        }
      } catch (e) {
        console.error('[Chat] MCP call failed:', e.message);
        finalReply += `\n\n_(Note: ${aiResponse.intent} service unavailable right now.)_`;
      }
    }

    conversation.messages.push({ role: 'assistant', content: finalReply });
    await conversation.save();

    const response = { sessionId, reply: finalReply, intent: aiResponse.intent, mcpData: mcpResult, suggestions: aiResponse.suggestions || [], timestamp: new Date().toISOString() };
    if (userId) wsServer.sendChatResponse(userId, response);
    res.json(response);

  } catch (error) {
    console.error('[Chat] Error:', error.message);
    const fallback = getFallbackResponse(message);
    conversation.messages.push({ role: 'assistant', content: fallback.reply });
    await conversation.save();
    res.json({ sessionId, ...fallback, timestamp: new Date().toISOString() });
  }
});

// Worker Registration (MongoDB saving)
app.post('/api/worker/register', async (req, res) => {
  const { name, skills, experience, hourlyRate, bio, phone, location } = req.body;
  if (!name || !skills || skills.length === 0) return res.status(400).json({ error: 'Name and skills required' });

  const workerId = `wrk_custom_${uuidv4().slice(0, 8)}`;
  const workerProfile = new WorkerProfile({ id: workerId, name, skills, experience: experience || 'Not specified', hourlyRate: hourlyRate || 0, bio: bio || '', phone: phone || '', location: location || 'Not specified', rating: 0, reviews: 0, completedJobs: 0, verified: false, availability: true });
  
  await workerProfile.save();
  res.json({ success: true, message: `Welcome to Aetheric, ${name}!`, worker: workerProfile });
});

// Worker Response
app.post('/api/worker/respond', async (req, res) => {
  const { bookingId, action, workerId } = req.body;
  
  const booking = await Booking.findOne({ bookingId });
  if (booking) {
    booking.status = action; // 'accept' or 'decline'
    await booking.save();
  }

  wsServer.clients.users.forEach((userWs) => {
    wsServer.send(userWs, {
      type: 'booking_update', bookingId, action, workerId,
      message: action === 'accept' ? '✅ A worker has accepted your booking!' : '❌ Worker declined. Finding alternatives...',
      timestamp: new Date().toISOString()
    });
  });

  res.json({ success: true, bookingId, action, message: action === 'accept' ? 'Accepted!' : 'Declined.' });
});

// Worker Profile
app.get('/api/worker/:workerId/profile', async (req, res) => {
  const profile = await WorkerProfile.findOne({ id: req.params.workerId }).lean();
  if (!profile) return res.status(404).json({ error: 'Worker not found' });
  res.json({ success: true, worker: profile });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chat.html')));
app.get('/worker', (req, res) => res.sendFile(path.join(__dirname, 'public', 'worker-dashboard.html')));
app.get('/worker/onboarding', (req, res) => res.sendFile(path.join(__dirname, 'public', 'worker-onboarding.html')));

app.get('/api/health', (req, res) => {
  res.json({ status: 'healthy', database: 'connected', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🌟 AETHERIC — AI Service Marketplace (Production DB)`);
  console.log(`${'═'.repeat(56)}`);
  console.log(`  📡 Server:         http://localhost:${PORT}`);
  console.log(`  🔌 WebSocket:      ws://localhost:${PORT}/ws`);
  console.log(`  📦 Database:       MongoDB Atlas Connected`);
  console.log(`${'─'.repeat(56)}`);
});
