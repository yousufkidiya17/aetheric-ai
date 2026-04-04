const mongoose = require('mongoose');

// --- Schemas ---
const ConversationSchema = new mongoose.Schema({
  sessionId: { type: String, required: true, unique: true },
  messages: [{ role: String, content: String }],
  createdAt: { type: Date, default: Date.now },
});

const WorkerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  skills: [String],
  experience: { type: String, default: 'Not specified' },
  hourlyRate: { type: Number, default: 0 },
  bio: { type: String, default: '' },
  phone: { type: String, default: '' },
  location: { type: String, default: 'Not specified' },
  rating: { type: Number, default: 0 },
  reviews: { type: Number, default: 0 },
  completedJobs: { type: Number, default: 0 },
  verified: { type: Boolean, default: false },
  availability: { type: Boolean, default: true },
  distance: { type: String, default: 'unknown' },
  responseTime: { type: String, default: 'unknown' },
  services: [String],
  photo: { type: String, default: '👤' },
  registeredAt: { type: Date, default: Date.now },
});

const BookingSchema = new mongoose.Schema({
  bookingId: { type: String, required: true, unique: true },
  worker: { type: Object },
  service: { type: String },
  description: { type: String },
  address: { type: String },
  urgency: { type: String, default: 'normal' },
  status: { type: String, default: 'pending' },
  estimatedRate: { type: String },
  bookedAt: { type: Date, default: Date.now },
});

const ActiveOrderSchema = new mongoose.Schema({
  orderId: { type: String, required: true, unique: true },
  restaurant: String,
  items: [Object],
  grandTotal: Number,
  estimatedDelivery: String,
  status: String,
  createdAt: { type: Date, default: Date.now }
});

const ActiveRideSchema = new mongoose.Schema({
  rideId: { type: String, required: true, unique: true },
  status: String,
  driver: Object,
  createdAt: { type: Date, default: Date.now }
});

// --- Models ---
const Conversation = mongoose.model('Conversation', ConversationSchema);
const WorkerProfile = mongoose.model('WorkerProfile', WorkerSchema);
const Booking = mongoose.model('Booking', BookingSchema);
const ActiveOrder = mongoose.model('ActiveOrder', ActiveOrderSchema);
const ActiveRide = mongoose.model('ActiveRide', ActiveRideSchema);

// --- Connection Logic & Seeding ---
async function connectDB() {
  console.log('🔄 Attemping to connect to MongoDB Atlas...');
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 15000, // Wait 15s instead of default 30s
    });
    console.log(`✅ Connected: ${conn.connection.host}`);
    await seedData();
  } catch (error) {
    console.error('❌ Failed to connect to MongoDB:', error.message);
    process.exit(1); // Kill app if DB fails to connect after timeout
  }
}

async function seedData() {
  try {
    const count = await WorkerProfile.countDocuments();
    if (count === 0) {
      console.log('🌱 Starting initial data seed...');
      const initialWorkers = [
        { id: 'wrk_01', name: 'Ramesh Electricals', skills: ['Electrician'], rating: 4.8, reviews: 342, experience: '12 years', hourlyRate: 500, availability: true, distance: '1.5 km', responseTime: '15 min', services: ['Wiring', 'AC Repair', 'Fan Installation'], verified: true, photo: '⚡', completedJobs: 1240 },
        { id: 'wrk_02', name: 'FlowState Plumbing', skills: ['Plumber'], rating: 4.9, reviews: 567, experience: '15 years', hourlyRate: 600, availability: true, distance: '1.2 km', responseTime: '10 min', services: ['Pipe Repair', 'Leak Fix', 'Drain Cleaning'], verified: true, photo: '🔧', completedJobs: 2100 },
        { id: 'wrk_03', name: 'Dr. Meera Kapoor', skills: ['Tutor'], rating: 4.9, reviews: 234, experience: '10 years', hourlyRate: 800, availability: true, distance: '4.0 km', responseTime: '30 min', services: ['Mathematics', 'Physics', 'IIT-JEE Prep'], verified: true, photo: '👩‍🏫', completedJobs: 890 },
      ];
      await WorkerProfile.insertMany(initialWorkers);
      console.log('✅ Seed complete.');
    }
  } catch (e) {
    console.error('❌ Seed failed:', e.message);
  }
}

connectDB();

module.exports = { Conversation, WorkerProfile, Booking, ActiveOrder, ActiveRide };


module.exports = { Conversation, WorkerProfile, Booking, ActiveOrder, ActiveRide };
