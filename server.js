const express = require('express');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allows your HTML site to talk to this server
app.use(express.json()); // Allows server to read JSON data

// 1. Root Route (To check if server is running)
app.get('/', (req, res) => {
    res.send('Backend is running!');
});

// 2. Contact Route (Receives the form data)
app.post('/api/contact', (req, res) => {
    const { name, email, message } = req.body;

    // VALIDATION: Check if data exists
    if (!name || !email || !message) {
        return res.status(400).json({ error: "All fields are required." });
    }

    // LOGGING: This prints the message to your Render logs (Server Console)
    console.log("--------------------------------");
    console.log("NEW CONTACT FORM SUBMISSION:");
    console.log("Name:", name);
    console.log("Email:", email);
    console.log("Message:", message);
    console.log("--------------------------------");

    // SUCCESS RESPONSE
    res.json({ status: "success", message: "Message received by server." });
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
