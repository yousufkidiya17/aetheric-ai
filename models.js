const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('📦 Connected to MongoDB Atlas'))
  .catch(e => console.error('❌ MongoDB Connection Error:', e));

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

// Since restaurants and rides are currently mock data and don't need permanence immediately 
// (unless requested by user to be editable), we will keep their orders/rides models simple.
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

// Initial Data Seeding for Workers if empty
async function seedData() {
  const count = await WorkerProfile.countDocuments();
  if (count === 0) {
    const initialWorkers = [
      { id: 'wrk_001', name: 'Ramesh Electricals', skills: ['Electrician'], rating: 4.8, reviews: 342, experience: '12 years', hourlyRate: 500, availability: true, distance: '1.5 km', responseTime: '15 min', services: ['Wiring', 'AC Repair', 'Fan Installation'], verified: true, photo: '⚡', completedJobs: 1240 },
      { id: 'wrk_002', name: 'PowerFix Solutions', skills: ['Electrician'], rating: 4.5, reviews: 189, experience: '8 years', hourlyRate: 400, availability: true, distance: '2.3 km', responseTime: '20 min', services: ['Wiring', 'Light Installation', 'Switch Repair'], verified: true, photo: '🔌', completedJobs: 780 },
      { id: 'wrk_003', name: 'FlowState Plumbing', skills: ['Plumber'], rating: 4.9, reviews: 567, experience: '15 years', hourlyRate: 600, availability: true, distance: '1.2 km', responseTime: '10 min', services: ['Pipe Repair', 'Leak Fix', 'Drain Cleaning'], verified: true, photo: '🔧', completedJobs: 2100 },
      { id: 'wrk_004', name: 'Arun Plumbing Works', skills: ['Plumber'], rating: 4.3, reviews: 98, experience: '5 years', hourlyRate: 350, availability: true, distance: '3.0 km', responseTime: '25 min', services: ['Pipe Repair', 'Tap Installation', 'Toilet Fix'], verified: false, photo: '🚰', completedJobs: 420 },
      { id: 'wrk_005', name: 'Dr. Meera Kapoor', skills: ['Tutor'], rating: 4.9, reviews: 234, experience: '10 years', hourlyRate: 800, availability: true, distance: '4.0 km', responseTime: '30 min', services: ['Mathematics', 'Physics', 'IIT-JEE Prep'], verified: true, photo: '👩‍🏫', completedJobs: 890 },
      { id: 'wrk_006', name: 'Learn With Arjun', skills: ['Tutor'], rating: 4.6, reviews: 156, experience: '6 years', hourlyRate: 500, availability: true, distance: '2.0 km', responseTime: '15 min', services: ['English', 'Science', 'Coding'], verified: true, photo: '👨‍💻', completedJobs: 560 },
      { id: 'wrk_007', name: 'Woodcraft Masters', skills: ['Carpenter'], rating: 4.7, reviews: 278, experience: '18 years', hourlyRate: 550, availability: true, distance: '3.5 km', responseTime: '20 min', services: ['Furniture Repair', 'Custom Cabinets', 'Door/Window'], verified: true, photo: '🪚', completedJobs: 1560 },
      { id: 'wrk_008', name: 'GreenThumb Gardens', skills: ['Gardener'], rating: 4.4, reviews: 89, experience: '7 years', hourlyRate: 300, availability: true, distance: '5.0 km', responseTime: '45 min', services: ['Lawn Care', 'Plant Care', 'Garden Design'], verified: false, photo: '🌿', completedJobs: 340 },
    ];
    await WorkerProfile.insertMany(initialWorkers);
    console.log('🌱 Seeded initial dummy workers to DB.');
  }
}
seedData();

module.exports = { Conversation, WorkerProfile, Booking, ActiveOrder, ActiveRide };
