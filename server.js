/**
 * AETHERIC — Complete Production Server (Single Process)
 * 
 * Everything runs in ONE process:
 * - Express HTTP server (serves frontend + API)
 * - WebSocket server (real-time notifications)
 * - Food MCP (inline mock Zomato/Swiggy)
 * - Rides MCP (inline mock Ola/Uber)  
 * - Workers MCP (inline local services)
 * - Mistral AI integration
 * 
 * Deploy anywhere: Render.com, Railway, AWS, etc.
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const http = require('http');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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

  handleWorkerResponse(ws, payload) {
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

  broadcastToWorkersBySkill(skill, bookingData) {
    const notification = {
      type: 'new_booking', booking: bookingData,
      timestamp: new Date().toISOString(),
      message: `🔔 New ${skill} request nearby!`
    };
    let sent = 0;
    this.clients.workers.forEach((ws) => {
      if (ws.skills.some(s => s.toLowerCase() === skill.toLowerCase())) {
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
      pendingNotifications: this.pendingNotifications.size,
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
      { id: 'item_006', name: 'Gulab Jamun (2pc)', price: 120, category: 'Dessert', veg: true, popular: false },
    ]
  },
  {
    id: 'rest_002', name: 'Pizza Paradise', cuisine: 'Italian', rating: 4.3,
    deliveryTime: '25-35 min', priceRange: '₹₹₹', distance: '2.5 km', isOpen: true,
    menu: [
      { id: 'item_010', name: 'Margherita Pizza', price: 299, category: 'Pizza', veg: true, popular: true },
      { id: 'item_011', name: 'Pepperoni Pizza', price: 449, category: 'Pizza', veg: false, popular: true },
      { id: 'item_012', name: 'Garlic Breadsticks', price: 159, category: 'Sides', veg: true, popular: false },
      { id: 'item_013', name: 'Pasta Alfredo', price: 329, category: 'Pasta', veg: true, popular: true },
      { id: 'item_014', name: 'Tiramisu', price: 249, category: 'Dessert', veg: true, popular: false },
    ]
  },
  {
    id: 'rest_003', name: 'Dragon Wok', cuisine: 'Chinese', rating: 4.1,
    deliveryTime: '35-45 min', priceRange: '₹₹', distance: '3.0 km', isOpen: true,
    menu: [
      { id: 'item_020', name: 'Hakka Noodles', price: 220, category: 'Noodles', veg: true, popular: true },
      { id: 'item_021', name: 'Chicken Manchurian', price: 280, category: 'Starters', veg: false, popular: true },
      { id: 'item_022', name: 'Veg Fried Rice', price: 200, category: 'Rice', veg: true, popular: false },
      { id: 'item_023', name: 'Spring Rolls (6pc)', price: 180, category: 'Starters', veg: true, popular: true },
    ]
  },
  {
    id: 'rest_004', name: 'South Spice', cuisine: 'South Indian', rating: 4.5,
    deliveryTime: '20-30 min', priceRange: '₹', distance: '0.8 km', isOpen: true,
    menu: [
      { id: 'item_030', name: 'Masala Dosa', price: 120, category: 'Dosa', veg: true, popular: true },
      { id: 'item_031', name: 'Idli Sambar (4pc)', price: 90, category: 'Breakfast', veg: true, popular: true },
      { id: 'item_032', name: 'Filter Coffee', price: 50, category: 'Beverages', veg: true, popular: true },
      { id: 'item_034', name: 'Chettinad Chicken', price: 310, category: 'Main Course', veg: false, popular: true },
    ]
  },
  {
    id: 'rest_005', name: 'Burger Barn', cuisine: 'Fast Food', rating: 4.0,
    deliveryTime: '15-25 min', priceRange: '₹₹', distance: '1.5 km', isOpen: true,
    menu: [
      { id: 'item_040', name: 'Classic Cheese Burger', price: 199, category: 'Burgers', veg: false, popular: true },
      { id: 'item_041', name: 'Crispy Veg Burger', price: 169, category: 'Burgers', veg: true, popular: true },
      { id: 'item_042', name: 'French Fries (Large)', price: 129, category: 'Sides', veg: true, popular: true },
      { id: 'item_043', name: 'Chocolate Shake', price: 149, category: 'Beverages', veg: true, popular: false },
    ]
  }
];

const activeOrders = new Map();

function foodHandler(tool, params) {
  switch (tool) {
    case 'search_restaurants': {
      let results = [...restaurants].filter(r => r.isOpen);
      if (params.cuisine) results = results.filter(r => r.cuisine.toLowerCase().includes(params.cuisine.toLowerCase()));
      if (params.query) {
        const q = params.query.toLowerCase();
        results = results.filter(r => r.name.toLowerCase().includes(q) || r.cuisine.toLowerCase().includes(q) || r.menu.some(i => i.name.toLowerCase().includes(q)));
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
      activeOrders.set(orderId, order);
      return { success: true, order: { orderId, restaurant: rest.name, items: items.map(i => `${i.quantity}x ${i.name}`), grandTotal: `₹${order.grandTotal}`, estimatedDelivery: rest.deliveryTime } };
    }
    case 'get_recommendations': {
      const moodMap = { 'hungry': ['Butter Chicken', 'Chicken Biryani', 'Classic Cheese Burger'], 'light': ['Masala Dosa', 'Idli Sambar (4pc)', 'Spring Rolls (6pc)'], 'craving': ['Pepperoni Pizza', 'Hakka Noodles', 'Paneer Tikka Masala'], 'sweet': ['Gulab Jamun (2pc)', 'Tiramisu', 'Chocolate Shake'], 'quick': ['Classic Cheese Burger', 'French Fries (Large)', 'Filter Coffee'] };
      const key = Object.keys(moodMap).find(k => (params.mood || '').toLowerCase().includes(k)) || 'hungry';
      const recommended = [];
      restaurants.forEach(r => r.menu.forEach(item => { if (moodMap[key].includes(item.name)) recommended.push({ restaurant: r.name, item: item.name, price: `₹${item.price}`, deliveryTime: r.deliveryTime, rating: r.rating, veg: item.veg ? '🟢 Veg' : '🔴 Non-Veg' }); }));
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
  { id: 'suv', name: 'Ola SUV', icon: '🚐', basePrice: 120, perKmRate: 18, perMinRate: 2.5, capacity: 6, eta: '7-10 min' },
  { id: 'auto', name: 'Ola Auto', icon: '🛺', basePrice: 30, perKmRate: 8, perMinRate: 1, capacity: 3, eta: '2-4 min' },
  { id: 'bike', name: 'Ola Bike', icon: '🏍️', basePrice: 20, perKmRate: 6, perMinRate: 0.8, capacity: 1, eta: '2-3 min' },
];

const drivers = [
  { id: 'drv_001', name: 'Rajesh Kumar', rating: 4.8, vehicle: 'Swift Dzire (DL 01 AB 1234)', photo: '👨‍✈️' },
  { id: 'drv_002', name: 'Amit Singh', rating: 4.6, vehicle: 'Hyundai i20 (DL 02 CD 5678)', photo: '👨' },
  { id: 'drv_003', name: 'Priya Sharma', rating: 4.9, vehicle: 'Honda City (DL 03 EF 9012)', photo: '👩' },
  { id: 'drv_004', name: 'Vikram Patel', rating: 4.7, vehicle: 'Maruti Ertiga (DL 04 GH 3456)', photo: '👨‍🦱' },
  { id: 'drv_005', name: 'Sunita Devi', rating: 4.5, vehicle: 'Bajaj Auto (DL 05 IJ 7890)', photo: '👩‍🦰' },
];

const activeRides = new Map();

function ridesHandler(tool, params) {
  const calcDist = (p, d) => {
    if ((p || '').toLowerCase().includes('airport') || (d || '').toLowerCase().includes('airport')) return 30 + Math.random() * 10;
    if ((p || '').toLowerCase().includes('station') || (d || '').toLowerCase().includes('station')) return 15 + Math.random() * 5;
    return 5 + Math.random() * 10;
  };
  const calcFare = (dist, typeId) => {
    const t = rideTypes.find(r => r.id === typeId) || rideTypes[0];
    const mins = (dist / 25) * 60;
    return { finalFare: Math.round(t.basePrice + dist * t.perKmRate + mins * t.perMinRate), estimatedTime: `${Math.round(mins)} min`, distance: `${dist.toFixed(1)} km` };
  };

  switch (tool) {
    case 'estimate_ride': {
      const dist = calcDist(params.pickup, params.destination);
      const estimates = rideTypes.map(t => {
        const f = calcFare(dist, t.id);
        return { rideType: t.name, icon: t.icon, fare: `₹${f.finalFare}`, eta: t.eta, distance: f.distance, estimatedTime: f.estimatedTime, capacity: `${t.capacity} seats` };
      });
      return { success: true, pickup: params.pickup, destination: params.destination, estimates };
    }
    case 'book_ride': {
      const type = rideTypes.find(r => r.name.toLowerCase().includes((params.rideType || 'mini').toLowerCase())) || rideTypes[0];
      const driver = drivers[Math.floor(Math.random() * drivers.length)];
      const dist = calcDist(params.pickup, params.destination);
      const fare = calcFare(dist, type.id);
      const rideId = `RIDE_${uuidv4().slice(0, 8).toUpperCase()}`;
      activeRides.set(rideId, { rideId, status: 'driver_assigned', driver });
      return {
        success: true, message: `🚕 Ride booked! ${driver.name} is heading to your pickup.`,
        ride: { rideId, driver: driver.name, vehicle: driver.vehicle, otp: Math.floor(1000 + Math.random() * 9000), rideType: type.name, fare: `₹${fare.finalFare}`, eta: type.eta, pickup: params.pickup || 'Current Location', destination: params.destination || 'Destination' }
      };
    }
    case 'get_ride_types': {
      return { success: true, rideTypes: rideTypes.map(r => ({ id: r.id, name: r.name, icon: r.icon, basePrice: `₹${r.basePrice}`, perKm: `₹${r.perKmRate}/km`, capacity: `${r.capacity} passengers`, eta: r.eta })) };
    }
    default: return { success: false, error: `Unknown rides tool: ${tool}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// WORKERS MCP (Inline — Local Services)
// ═══════════════════════════════════════════════════════════════════════════════

const workersList = [
  { id: 'wrk_001', name: 'Ramesh Electricals', skill: 'Electrician', rating: 4.8, reviews: 342, experience: '12 years', hourlyRate: 500, availability: true, distance: '1.5 km', responseTime: '15 min', services: ['Wiring', 'AC Repair', 'Fan Installation'], verified: true, photo: '⚡', completedJobs: 1240 },
  { id: 'wrk_002', name: 'PowerFix Solutions', skill: 'Electrician', rating: 4.5, reviews: 189, experience: '8 years', hourlyRate: 400, availability: true, distance: '2.3 km', responseTime: '20 min', services: ['Wiring', 'Light Installation', 'Switch Repair'], verified: true, photo: '🔌', completedJobs: 780 },
  { id: 'wrk_003', name: 'FlowState Plumbing', skill: 'Plumber', rating: 4.9, reviews: 567, experience: '15 years', hourlyRate: 600, availability: true, distance: '1.2 km', responseTime: '10 min', services: ['Pipe Repair', 'Leak Fix', 'Drain Cleaning'], verified: true, photo: '🔧', completedJobs: 2100 },
  { id: 'wrk_004', name: 'Arun Plumbing Works', skill: 'Plumber', rating: 4.3, reviews: 98, experience: '5 years', hourlyRate: 350, availability: true, distance: '3.0 km', responseTime: '25 min', services: ['Pipe Repair', 'Tap Installation', 'Toilet Fix'], verified: false, photo: '🚰', completedJobs: 420 },
  { id: 'wrk_005', name: 'Dr. Meera Kapoor', skill: 'Tutor', rating: 4.9, reviews: 234, experience: '10 years', hourlyRate: 800, availability: true, distance: '4.0 km', responseTime: '30 min', services: ['Mathematics', 'Physics', 'IIT-JEE Prep'], verified: true, photo: '👩‍🏫', completedJobs: 890 },
  { id: 'wrk_006', name: 'Learn With Arjun', skill: 'Tutor', rating: 4.6, reviews: 156, experience: '6 years', hourlyRate: 500, availability: true, distance: '2.0 km', responseTime: '15 min', services: ['English', 'Science', 'Coding'], verified: true, photo: '👨‍💻', completedJobs: 560 },
  { id: 'wrk_007', name: 'Woodcraft Masters', skill: 'Carpenter', rating: 4.7, reviews: 278, experience: '18 years', hourlyRate: 550, availability: true, distance: '3.5 km', responseTime: '20 min', services: ['Furniture Repair', 'Custom Cabinets', 'Door/Window'], verified: true, photo: '🪚', completedJobs: 1560 },
  { id: 'wrk_008', name: 'GreenThumb Gardens', skill: 'Gardener', rating: 4.4, reviews: 89, experience: '7 years', hourlyRate: 300, availability: true, distance: '5.0 km', responseTime: '45 min', services: ['Lawn Care', 'Plant Care', 'Garden Design'], verified: false, photo: '🌿', completedJobs: 340 },
];

const activeBookings = new Map();

function workersHandler(tool, params) {
  switch (tool) {
    case 'search_workers': {
      let results = [...workersList].filter(w => w.availability);
      if (params.skill) results = results.filter(w => w.skill.toLowerCase() === params.skill.toLowerCase());
      if (params.query) { const q = params.query.toLowerCase(); results = results.filter(w => w.name.toLowerCase().includes(q) || w.skill.toLowerCase().includes(q) || w.services.some(s => s.toLowerCase().includes(q))); }
      if (params.verifiedOnly) results = results.filter(w => w.verified);
      results.sort((a, b) => b.rating - a.rating);
      return { success: true, count: results.length, workers: results.map(w => ({ id: w.id, name: w.name, skill: w.skill, photo: w.photo, rating: `⭐ ${w.rating}`, reviews: `${w.reviews} reviews`, experience: w.experience, hourlyRate: `₹${w.hourlyRate}/hr`, distance: w.distance, responseTime: w.responseTime, verified: w.verified ? '✅ Verified' : 'Unverified', topServices: w.services.slice(0, 3) })) };
    }
    case 'book_worker': {
      const worker = workersList.find(w => w.id === params.workerId);
      if (!worker) return { success: false, error: 'Worker not found' };
      const bookingId = `BKG_${uuidv4().slice(0, 8).toUpperCase()}`;
      const booking = { bookingId, worker: { id: worker.id, name: worker.name, skill: worker.skill, photo: worker.photo }, service: params.service || worker.services[0], description: params.description || 'General service', address: params.address || '123 Main Street', urgency: params.urgency || 'normal', status: 'pending', estimatedRate: `₹${worker.hourlyRate}/hr`, bookedAt: new Date().toISOString() };
      activeBookings.set(bookingId, booking);
      return { success: true, message: `📋 Booking sent to ${worker.name}!`, booking: { bookingId, worker: worker.name, skill: worker.skill, service: booking.service, rate: booking.estimatedRate, status: 'pending', urgency: booking.urgency === 'urgent' ? '🔴 Urgent' : '🟢 Normal' } };
    }
    case 'get_skills_list': {
      const skills = [...new Set(workersList.map(w => w.skill))];
      return { success: true, skills: skills.map(s => ({ skill: s, availableWorkers: workersList.filter(w => w.skill === s && w.availability).length })) };
    }
    default: return { success: false, error: `Unknown workers tool: ${tool}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MCP ROUTER — Routes tools to correct handler
// ═══════════════════════════════════════════════════════════════════════════════

function callMCPInline(intent, tool, params) {
  switch (intent) {
    case 'food': return foodHandler(tool, params);
    case 'rides': return ridesHandler(tool, params);
    case 'workers': return workersHandler(tool, params);
    default: return { success: false, error: `Unknown service: ${intent}` };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MISTRAL AI INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════

const conversations = new Map();

function getConversation(sessionId) {
  if (!conversations.has(sessionId)) {
    conversations.set(sessionId, { id: sessionId, messages: [], createdAt: new Date().toISOString() });
  }
  return conversations.get(sessionId);
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
  "reply": "Your conversational response to the user",
  "intent": "food" | "rides" | "workers" | "general" | "clarify",
  "action": { "tool": "the MCP tool to call", "params": { "key": "value" } },
  "suggestions": ["suggestion 1", "suggestion 2"]
}

TOOL MAPPING:
- Food: search_restaurants, get_menu, place_order, get_recommendations
- Rides: estimate_ride, book_ride, get_ride_types
- Workers: search_workers, book_worker, get_skills_list

EXAMPLES:
- "I'm hungry" → intent: food, action: { tool: "get_recommendations", params: { mood: "hungry" } }
- "Book an Ola to airport" → intent: rides, action: { tool: "book_ride", params: { destination: "airport", rideType: "sedan" } }
- "Need a plumber urgently" → intent: workers, action: { tool: "search_workers", params: { skill: "Plumber" } }
`;

async function callMistral(messages) {
  try {
    const response = await fetch(CONFIG.MISTRAL_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CONFIG.MISTRAL_API_KEY}` },
      body: JSON.stringify({ model: CONFIG.MISTRAL_MODEL, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages], temperature: 0.7, max_tokens: 1024, response_format: { type: 'json_object' } })
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

// ─── Fallback Response ──────────────────────────────────────────────────────────

function getFallbackResponse(message) {
  const msg = message.toLowerCase();
  if (msg.includes('food') || msg.includes('hungry') || msg.includes('eat') || msg.includes('restaurant') || msg.includes('order') || msg.includes('dinner') || msg.includes('lunch') || msg.includes('breakfast'))
    return { reply: "I'd love to help you with food! 🍕 What cuisine are you in the mood for?", intent: 'food', suggestions: ['Show me nearby restaurants', 'I want North Indian food', 'Order a pizza'] };
  if (msg.includes('ride') || msg.includes('cab') || msg.includes('taxi') || msg.includes('ola') || msg.includes('uber') || msg.includes('auto') || msg.includes('airport'))
    return { reply: "Let me help you get a ride! 🚕 Where would you like to go?", intent: 'rides', suggestions: ['Book a ride to airport', 'Show ride types', 'Estimate fare'] };
  if (msg.includes('plumber') || msg.includes('electrician') || msg.includes('tutor') || msg.includes('carpenter') || msg.includes('repair') || msg.includes('fix') || msg.includes('worker'))
    return { reply: "I'll find the right professional for you! 🔧 What service do you need?", intent: 'workers', suggestions: ['Find a plumber', 'Need an electrician', 'Math tutor'] };
  return { reply: "Hello! I'm Aetheric, your AI assistant. I can help you:\n\n🍕 **Order Food** — Browse restaurants & place orders\n🚕 **Book Rides** — Cabs, autos, bikes\n🔧 **Hire Workers** — Plumbers, electricians, tutors\n\nWhat would you like to do?", intent: 'general', suggestions: ["I'm hungry", 'Book a ride', 'Need a plumber'] };
}

// ═══════════════════════════════════════════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// Main Chat Endpoint
app.post('/api/chat', async (req, res) => {
  const { message, sessionId: reqSessionId, userId } = req.body;
  if (!message) return res.status(400).json({ error: 'Message is required' });

  const sessionId = reqSessionId || uuidv4();
  const conversation = getConversation(sessionId);
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
        mcpResult = callMCPInline(aiResponse.intent, aiResponse.action.tool, aiResponse.action.params || {});
        console.log(`[Chat] MCP Result:`, JSON.stringify(mcpResult).slice(0, 200));

        const followUp = [...recentMessages, { role: 'assistant', content: JSON.stringify(aiResponse) }, { role: 'user', content: `Here are the results from the ${aiResponse.intent} service. Create a friendly reply: ${JSON.stringify(mcpResult)}` }];
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

    const response = { sessionId, reply: finalReply, intent: aiResponse.intent, mcpData: mcpResult, suggestions: aiResponse.suggestions || [], timestamp: new Date().toISOString() };
    if (userId) wsServer.sendChatResponse(userId, response);
    res.json(response);

  } catch (error) {
    console.error('[Chat] Error:', error.message);
    const fallback = getFallbackResponse(message);
    conversation.messages.push({ role: 'assistant', content: fallback.reply });
    res.json({ sessionId, ...fallback, timestamp: new Date().toISOString() });
  }
});

// Worker Registration
const workerProfiles = new Map();

app.post('/api/worker/register', (req, res) => {
  const { name, skills, experience, hourlyRate, bio, phone, location } = req.body;
  if (!name || !skills || skills.length === 0) return res.status(400).json({ error: 'Name and skills required' });

  const workerId = `wrk_custom_${uuidv4().slice(0, 8)}`;
  const profile = { id: workerId, name, skills, experience: experience || 'Not specified', hourlyRate: hourlyRate || 0, bio: bio || '', phone: phone || '', location: location || 'Not specified', rating: 0, reviews: 0, completedJobs: 0, verified: false, availability: true, registeredAt: new Date().toISOString() };
  workerProfiles.set(workerId, profile);
  res.json({ success: true, message: `Welcome to Aetheric, ${name}!`, worker: profile });
});

// Worker Response
app.post('/api/worker/respond', (req, res) => {
  const { bookingId, action, workerId } = req.body;
  const booking = activeBookings.get(bookingId);

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
app.get('/api/worker/:workerId/profile', (req, res) => {
  const profile = workerProfiles.get(req.params.workerId);
  if (!profile) return res.status(404).json({ error: 'Worker not found' });
  res.json({ success: true, worker: profile });
});

// Serve Frontend Routes
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/chat', (req, res) => res.sendFile(path.join(__dirname, 'public', 'chat.html')));
app.get('/worker', (req, res) => res.sendFile(path.join(__dirname, 'public', 'worker-dashboard.html')));
app.get('/worker/onboarding', (req, res) => res.sendFile(path.join(__dirname, 'public', 'worker-onboarding.html')));

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy', server: 'aetheric-production',
    uptime: process.uptime(),
    websocket: wsServer.getStats(),
    mcpServers: { food: 'inline-healthy', rides: 'inline-healthy', workers: 'inline-healthy' },
    conversations: conversations.size,
    registeredWorkers: workerProfiles.size,
    timestamp: new Date().toISOString()
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// START SERVER
// ═══════════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`\n${'═'.repeat(56)}`);
  console.log(`  🌟 AETHERIC — AI Service Marketplace (Production)`);
  console.log(`${'═'.repeat(56)}`);
  console.log(`  📡 Server:         http://localhost:${PORT}`);
  console.log(`  🔌 WebSocket:      ws://localhost:${PORT}/ws`);
  console.log(`  🍕 Food MCP:       Inline ✅`);
  console.log(`  🚕 Rides MCP:      Inline ✅`);
  console.log(`  🔧 Workers MCP:    Inline ✅`);
  console.log(`${'─'.repeat(56)}`);
  console.log(`  📱 User Home:      http://localhost:${PORT}/`);
  console.log(`  💬 Chat:           http://localhost:${PORT}/chat`);
  console.log(`  👷 Worker Dash:    http://localhost:${PORT}/worker`);
  console.log(`  📋 Onboarding:     http://localhost:${PORT}/worker/onboarding`);
  console.log(`  ❤️  Health:         http://localhost:${PORT}/api/health`);
  console.log(`${'═'.repeat(56)}\n`);
});

module.exports = { app, server, wsServer };
