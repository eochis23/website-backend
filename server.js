// REPLACE the old "transporter" section with this:
const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com", // Connect directly to Gmail's server
    port: 465,              // Use the Secure Port
    secure: true,           // Use SSL
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Add this verification step right after defining the transporter
// It will print to the logs if the connection to Google works or fails
transporter.verify(function (error, success) {
    if (error) {
        console.log("Error connecting to Gmail:", error);
    } else {
        console.log("Server is ready to take our messages");
    }
});
