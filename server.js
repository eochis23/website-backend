const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer'); // Import the email library
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure the Email Transporter
// We use "process.env" to keep your password secret (See Step 4)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER, // Your email address
        pass: process.env.EMAIL_PASS  // Your App Password
    }
});

app.get('/', (req, res) => {
    res.send('Backend is running!');
});

app.post('/api/contact', async (req, res) => {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
        return res.status(400).json({ error: "All fields are required." });
    }

    // Email Layout
    const mailOptions = {
        from: process.env.EMAIL_USER,      // Sender (You)
        to: process.env.EMAIL_USER,        // Receiver (Also You)
        subject: `New Portfolio Message from ${name}`,
        text: `
        You have a new message from your portfolio website:
        
        Name: ${name}
        Email: ${email}
        
        Message:
        ${message}
        `
    };

    try {
        // Send the email
        await transporter.sendMail(mailOptions);
        console.log("Email sent successfully!");
        res.json({ status: "success", message: "Email sent!" });
    } catch (error) {
        console.error("Error sending email:", error);
        res.status(500).json({ error: "Failed to send email" });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
