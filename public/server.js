const express = require("express");
const path = require("path");
const fs = require("fs");
const fileUpload = require("express-fileupload");
const app = express();
const server = app.listen(3000, function () {
    console.log("Listening on port 3000");
});
const io = require("socket.io")(server, {
    allowEIO3: true,
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

// Serve the action.html as the root page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, "public", "action.html"));
});

// Serve the index.html file
app.get('/index.html', (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

let userConnections = [];

io.on("connection", (socket) => {
    console.log("Socket ID is", socket.id);

    socket.on("userconnect", (data) => {
        console.log("User connected", data.displayName, data.meetingid);
        const other_users = userConnections.filter((p) => p.meeting_id === data.meetingid);

        userConnections.push({
            connectionId: socket.id,
            user_id: data.displayName,
            meeting_id: data.meetingid,
        });

        const userCount = userConnections.length;
        console.log("Total users:", userCount);

        other_users.forEach((v) => {
            socket.to(v.connectionId).emit("inform_others_about_me", {
                other_user_id: data.displayName,
                connId: socket.id,
                userNumber: userCount,
            });
        });

        socket.emit("inform_me_about_other_user", other_users);
    });

    socket.on("SDPProcess", (data) => {
        socket.to(data.to_connid).emit("SDPProcess", {
            message: data.message,
            from_connid: socket.id,
        });
    });

    socket.on("sendMessage", (msg) => {
        console.log("Message received:", msg);
        const mUser = userConnections.find((p) => p.connectionId === socket.id);
        if (mUser) {
            const meetingid = mUser.meeting_id;
            const from = mUser.user_id;
            const list = userConnections.filter((p) => p.meeting_id === meetingid);
            list.forEach((v) => {
                socket.to(v.connectionId).emit("showChatMessage", {
                    from: from,
                    message: msg,
                });
            });
        }
    });

    socket.on("fileTransferToOther", (msg) => {
        console.log("File transfer message received:", msg);
        const mUser = userConnections.find((p) => p.connectionId === socket.id);
        if (mUser) {
            const meetingid = mUser.meeting_id;
            const from = mUser.user_id;
            const list = userConnections.filter((p) => p.meeting_id === meetingid);
            list.forEach((v) => {
                socket.to(v.connectionId).emit("showFileMessage", {
                    username: msg.username,
                    meetingid: msg.meetingid,
                    filePath: msg.filePath,
                    fileName: msg.fileName,
                });
            });
        }
    });

    socket.on("disconnect", () => {
        console.log("User disconnected");
        const disUser = userConnections.find((p) => p.connectionId === socket.id);
        if (disUser) {
            const meetingid = disUser.meeting_id;
            userConnections = userConnections.filter((p) => p.connectionId !== socket.id);
            const list = userConnections.filter((p) => p.meeting_id === meetingid);
            list.forEach((v) => {
                io.to(v.connectionId).emit("inform_other_about_disconnected_user", {
                    connId: socket.id,
                    uNumber: userConnections.length,
                });
            });
        }
    });
});

app.use(fileUpload());

app.post("/attaching", (req, res) => {
    const data = req.body;
    const imageFile = req.files.zipfile;
    console.log("Received file:", imageFile);

    const dir = path.join(__dirname, "public", "attachment", data.meeting_id);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }

    const filePath = path.join(dir, imageFile.name);
    imageFile.mv(filePath, (error) => {
        if (error) {
            console.log("File upload error:", error);
            res.status(500).send("Error uploading file");
        } else {
            console.log("File uploaded successfully");
            res.send("File uploaded");
        }
    });
});
