import http from "http";
import { Server } from "socket.io";

const server = http.createServer();

const io = new Server(server, {
	cors: {
		origin: "http://localhost:3000",
		methods: ["GET", "POST"],
	},
});

type Room = {
	id: string;
	name: string;
};

type Message = {
	id: string;
	room: string;
	text: string;
	user: string;
	time: number;
	status?: "sending" | "sent";
};

const rooms = new Map<string, Room>();
rooms.set("general", { id: "general", name: "General" });

io.on("connection", (socket) => {
	console.log("user connected: ", socket.id);

	socket.on("set_username", (username) => {
		socket.data.username = username;
	});

	socket.on("get_rooms", () => {
		socket.emit("rooms_list", Array.from(rooms.values()));
	});

	// Join a room
	socket.on("join_room", (room) => {
		socket.join(room);
		console.log(`User ${socket.data.username} joined room ${room}`);

		socket.to(room).emit("system_message", {
			text: "a user has joined the room.",
			room,
		});
	});

	// Leave a room
	socket.on("leave_room", (room) => {
		socket.leave(room);
		console.log(`${socket.id} left ${room}`);

		socket.to(room).emit("system_message", {
			text: "a user has left the room.",
			room,
		});
	})

	socket.on("send_message", (data: Message, callback?: (err: string | null, message?: Message) => void) => { // listen for event (run when client emits "send_message")
		const { id, room, text, user } = data;
		if (!id || !room || !text || !user) {
			callback?.("Message is missing required fields");
			return;
		}

		console.log("sent message:", text)
		const message: Message = {
			id,
			user,
			text,
			room,
			time: Date.now(),
			status: "sent",
		};

		io.to(room).emit("receive_message", message); // broadcast to all clients
		callback?.(null, message);
	});

	socket.on("create_room", (room: Room, callback?: (err: string | null, room?: Room) => void) => {
		if (!room?.id || !room?.name) {
			callback?.("Room name is required");
			return;
		}

		if (rooms.has(room.id)) {
			callback?.("Room already exists");
			return;
		}

		rooms.set(room.id, room);
		console.log(`Room ${room.name} created`);
		io.emit("room_created", room);
		callback?.(null, room);
	});

	socket.on("disconnect", () => {
		console.log("user disconnected");
	});
});

server.listen(3001, () => {
	console.log("server running on port 3001");
});
