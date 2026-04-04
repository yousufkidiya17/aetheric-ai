const mongoose = require('mongoose');
const uri = "mongodb+srv://aetheric:Aetheric2026@cluster0.2e0vdtm.mongodb.net/aetheric?retryWrites=true&w=majority&appName=Cluster0";
console.log("Attempting to connect to MongoDB...");
mongoose.connect(uri)
  .then(() => {
    console.log("✅ Successfully connected to MongoDB Atlas!");
    process.exit(0);
  })
  .catch(err => {
    console.error("❌ Connection failed:", err.message);
    process.exit(1);
  });
