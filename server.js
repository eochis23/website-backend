const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Configure the Email Transporter
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", 
    port: 465,               
    secure: true,            
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Verify connection configuration
transporter.verify(function (error, success) {
    if (error) {
        console.log("Error connecting to Gmail:", error);
    } else {
        console.log("Server is ready to take our messages");
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

    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: process.env.EMAIL_USER, // Sends to yourself
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
