"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");
const CREATE_ROOM_TIMEOUT_MS = 5000;
const SEND_MESSAGE_TIMEOUT_MS = 5000;

type MessageStatus = "sending" | "sent";

export type Message = {
  id: string;
  room: string;
  text: string;
  user: string;
  time: number;
  status?: MessageStatus;
};

type Room = {
  id: string;
  name: string;
};

const DEFAULT_ROOMS: Room[] = [{ id: "general", name: "General" }];

function createMessageId() {
  return crypto.randomUUID();
}

/**
 * Prevents duplicate messages because the client first adds it locally as sending, 
 * and the server later sends back the same message as sent. upsertMessage adds if 
 * the message is new and updates in place otherwise.
 * @param messages existing messages in the room
 * @param nextMessage the new message to add or update
 * @returns 
 */
function upsertMessage(messages: Message[], nextMessage: Message) {
  const existingIndex = messages.findIndex((message) => message.id === nextMessage.id);

  if (existingIndex === -1) {
    return [...messages, nextMessage];
  }

  return messages.map((message, index) =>
    index === existingIndex ? { ...message, ...nextMessage } : message,
  );
}

type RoomSidebarProps = {
  rooms: Room[];
  activeRoom: string;
  messageCounts: Record<string, number>;
  onSelectRoom: (roomId: string) => void;
  onCreateRoom?: (name: string, cb?: (err?: string, room?: Room) => void) => void;
};

export function RoomSidebar({
  rooms,
  activeRoom,
  messageCounts,
  onSelectRoom,
  onCreateRoom,
}: RoomSidebarProps) {
	// const [newRoomName, setNewRoomName] = useState("");
	const [creating, setCreating] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function handleCreateRoom() {
		const name = window.prompt("Enter a new room name");
		if (name === null) return;
		const trimmed = name.trim();
		if (!trimmed) {
			setError("Room name cannot be empty");
			return;
		}
		setError(null);
		setCreating(true);

		onCreateRoom?.(trimmed, (err) => {
			setCreating(false);
			if (err) {
				setError(err);
				return;
			}
		});
	}
  return (
    <aside className="text-burgundy flex h-full w-full flex-col border-b border-white/10 bg-[#f9dbe7]/90 p-4 backdrop-blur lg:w-72 lg:border-b-0 lg:border-r">
      <div className="mb-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-pink-600/70">
          Chat rooms
        </p>
        <h2 className="mt-2 text-2xl font-semibold tracking-tight">Hangout</h2>
      </div>

      <nav className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
        {rooms.map((room) => {
          const isActive = activeRoom === room.id;

          return (
            <button
              key={room.id}
              type="button"
              onClick={() => onSelectRoom(room.id)}
              className={`flex min-w-36 items-center justify-between rounded-lg border px-4 py-3 text-left transition ${
                isActive
                  ? "text-black border-pink-300/70 bg-pink-200/25 shadow-[0_12px_30px_rgba(255,105,180,0.16)]"
                  : "text-black border-white/10 bg-white/[0.24] hover:border-pink-300/40 hover:bg-pink-100/70"
              }`}
            >
              <span>
                <span className="block text-sm font-semibold">{room.name}</span>
                <span className="text-black mt-0.5 block text-xs opacity-70">
                  #{room.id}
                </span>
              </span>
              <span
                className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  isActive
                    ? "bg-soft-pink text-black"
                    : "bg-white/40 text-black"
                }`}
              >
                {messageCounts[room.id] || 0}
              </span>
            </button>
          );
        })}
      </nav>

	  <button
        type="button"
        onClick={handleCreateRoom}
        disabled={creating}
        className="text-black mt-4 rounded-lg bg-soft-pink px-3 py-2 font-semibold transition disabled:opacity-60"
      >
        {creating ? "Creating..." : "New room"}
      </button>

      {error ? <p className="text-xs mt-2 text-rose-600">{error}</p> : null}

      <div className="text-black mt-auto hidden rounded-lg border border-white/10 bg-white/30 p-4 text-sm lg:block">
        <p className="font-medium">Socket chat</p>
        <p className="mt-1 leading-6">
          Switch rooms, send messages, and keep the conversation tidy.
        </p>
      </div>
    </aside>
  );
}

export function useChat(canUseRooms: boolean) {
  const [rooms, setRooms] = useState<Room[]>(DEFAULT_ROOMS);
  const [activeRoom, setActiveRoom] = useState<string>("general");
  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, Message[]>>({});
  const activeRoomRef = useRef(activeRoom);

  useEffect(() => {
	if (!canUseRooms) return;

	socket.emit("get_rooms");
	socket.on("rooms_list", (list: Room[]) => {
		setRooms([...DEFAULT_ROOMS, ...list.filter((room) => room.id !== "general")]);
	});

	socket.on("room_created", (room: Room) => 
		setRooms((r) => (r.some(x => x.id === room.id) ? r : [...r, room]))
	);

	return () => {
		socket.off("rooms_list");
		socket.off("room_created");
  };
}, [canUseRooms]);

  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  useEffect(() => {
    function onMessage(msg: Message) {
      setMessagesByRoom((prev) => {
        const room = msg.room;

        return {
          ...prev,
          [room]: upsertMessage(prev[room] || [], { ...msg, status: "sent" }),
        };
      });
    }

    socket.on("receive_message", onMessage);

    return () => {
      socket.off("receive_message", onMessage);
    };
  }, []);

  function joinRoom(room: string) {
    socket.emit("join_room", room);
    setActiveRoom(room);
    setMessagesByRoom((prev) => ({
      ...prev,
      [room]: prev[room] || [],
    }));
  }

  function sendMessage(text: string, user: string) {
    const pendingMessage: Message = {
      id: createMessageId(),
      text,
      user,
      room: activeRoomRef.current,
      time: Date.now(),
      status: "sending",
    };

    setMessagesByRoom((prev) => ({
      ...prev,
      [pendingMessage.room]: upsertMessage(prev[pendingMessage.room] || [], pendingMessage),
    }));

    socket.timeout(SEND_MESSAGE_TIMEOUT_MS).emit(
      "send_message",
      pendingMessage,
      (timeoutError: Error | null, err: string | null, sentMessage?: Message) => {
        if (timeoutError || err || !sentMessage) {
          console.error("Failed to send message:", timeoutError || err);
          return;
        }

        setMessagesByRoom((prev) => ({
          ...prev,
          [sentMessage.room]: upsertMessage(prev[sentMessage.room] || [], {
            ...sentMessage,
            status: "sent",
          }),
        }));
      },
    );
  }

	function nameToId(name: string) {
		return (
		name
			.toLowerCase()
			.trim()
			.replace(/\s+/g, "-")
			.replace(/[^a-z0-9-_]/g, "")
			.slice(0, 50) || "room"
		);
	}

	function createRoom(name: string, cb?: (err?: string, room?: Room) => void) {
		const id = nameToId(name);
		socket.timeout(CREATE_ROOM_TIMEOUT_MS).emit(
			"create_room", 
			{ id, name }, 
			(timeoutError: Error | null, err: string | null, room?: Room) => {
			if (timeoutError) {
				cb?.("Room creation timed out. Is the chat server running with the latest code?");
				return;
			}
			if (err) {
				cb?.(err);
				return;
			}
			if (room) {
			  setRooms((prev) => (prev.some((r) => r.id === room.id) ? prev : [...prev, room]));
			}

			cb?.(undefined, room);
			// server may already broadcast `room_created`, but update locally if needed
			// setRooms(prev => prev.some(r => r.id === room!.id) ? prev : [...prev, room!]);
			// cb?.(undefined, room);
		});
	}
	  return {
		rooms,
		activeRoom,
		messages: messagesByRoom[activeRoom] || [],
		messageCounts: Object.fromEntries(
		rooms.map((room) => [room.id, messagesByRoom[room.id]?.length || 0]),
		),
		joinRoom,
		sendMessage,
		createRoom,
	};
}

export default function Chat() {
  const [input, setInput] = useState("");
  const [username, setUsername] = useState<string | null>(null);
  const [inputName, setInputName] = useState("");
  const { rooms, activeRoom, messages, messageCounts, joinRoom, sendMessage, createRoom } =
    useChat(Boolean(username));
  const activeRoomName =
    rooms.find((room) => room.id === activeRoom)?.name || activeRoom;

  function handleJoin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inputName.trim()) return;

    const trimmedName = inputName.trim();
    setUsername(trimmedName);
    socket.emit("set_username", trimmedName);
    joinRoom(activeRoom);
  }

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!input.trim() || !username) return;

    sendMessage(input.trim(), username);
    setInput("");
  }

  

  return (
    <main className="text-burgundy min-h-screen bg-[#fff1f6]">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute left-0 top-0 h-80 w-80 bg-pink-300/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 bg-rose-400/10 blur-3xl" />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col p-3 sm:p-5 lg:flex-row">
        {username ? (
          <RoomSidebar
            rooms={rooms}
            activeRoom={activeRoom}
            messageCounts={messageCounts}
            onSelectRoom={joinRoom}
            onCreateRoom={createRoom}
          />
        ) : null}

        <section
          className={`flex min-h-[calc(100vh-1.5rem)] flex-1 flex-col overflow-hidden border border-white/10 bg-white/75 shadow-2xl shadow-black/30 backdrop-blur lg:min-h-[calc(100vh-2.5rem)] ${
            username
              ? "rounded-b-2xl lg:rounded-l-none lg:rounded-r-2xl"
              : "rounded-2xl"
          }`}
        >
          <header className="flex items-center justify-between gap-4 border-b border-white/10 bg-white/[0.04] px-5 py-4 sm:px-7">
            <div>
              <p className="text-sm font-medium text-pink-600">
                Emily &amp; Hang&apos;s Chatroom
              </p>
              <h1 className="text-burgundy mt-1 text-2xl font-semibold tracking-tight">
                {username ? activeRoomName : "Welcome"}
              </h1>
            </div>
            <div className="text-right">
              <div className="text-burgundy inline-flex rounded-full border border-pink-300/40 bg-pink-100/80 px-3 py-1 text-xs font-semibold">
                Live
              </div>
              {username ? (
                <p className="text-burgundy mt-2 text-sm">Hello, {username}!</p>
              ) : null}
            </div>
          </header>

          {!username ? (
            <div className="grid flex-1 place-items-center px-5 py-10">
              <form
                onSubmit={handleJoin}
                className="w-full max-w-md rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/20"
              >
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-pink-600/80">
                  Welcome
                </p>
                <h2 className="text-burgundy mt-3 text-3xl font-semibold tracking-tight">
                  Pick a name to join the room.
                </h2>
                <p className="text-black mt-3 text-sm leading-6">
                  Your messages will show up with this name while you chat.
                </p>
                <input
                  className="text-black mt-6 w-full rounded-lg border border-white/10 bg-white/75 px-4 py-3 outline-none transition placeholder:text-black-900/45 focus:border-pink-300 focus:ring-4 focus:ring-pink-200/40"
                  placeholder="Enter username"
                  value={inputName}
                  onChange={(e) => setInputName(e.target.value)}
                />
                <button
                  type="submit"
                  className="text-black hover-barbie-pink focus-ring-pink mt-4 w-full rounded-lg bg-soft-pink px-4 py-3 font-semibold transition"
                >
                  Join
                </button>
              </form>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-7">
                {messages.length === 0 ? (
                  <div className="grid h-full min-h-72 place-items-center text-center">
                    <div>
                      <div className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-pink-300/40 bg-pink-100/70 text-2xl">
                        #
                      </div>
                      <h2 className="text-black mt-4 text-xl font-semibold">
                        No messages in {activeRoomName} yet
                      </h2>
                      <p className="text-black mt-2 text-sm">
                        Start the conversation from the composer below.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messages.map((message) => {
                      const isMine = message.user === username;

                      return (
                        <div
                          key={message.id}
                          className={`flex ${
                            isMine ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[82%] rounded-2xl border px-4 py-3 shadow-lg sm:max-w-[68%] ${
                              isMine
                                ? "text-black border-pink-300/40 bg-pink-200 shadow-pink-900/10"
                                : "text-black border-white/10 bg-white/70 shadow-black/10"
                            }`}
                          >
                            <div className="mb-1 flex items-center gap-2 text-xs font-semibold">
                              <span>{isMine ? "You" : message.user}</span>
                              <span
                                className={
                                  isMine ? "text-black/80" : "text-black/70"
                                }
                              >
                                {new Date(message.time).toLocaleTimeString([], {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <p className="break-words text-sm leading-6">
                              {message.text}
                            </p>
                            {isMine ? (
                              <p className="mt-1 text-right text-[11px] font-semibold uppercase tracking-wide text-black/55">
                                {message.status === "sending" ? "Sending..." : "Sent"}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="border-t border-white/10 bg-[#fff7fa]/90 px-5 py-4 sm:px-7">
                <form
                  onSubmit={handleSend}
                  className="flex w-full items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-2 shadow-lg"
                >
                  <input
                    type="text"
                    className="text-black min-h-11 flex-1 bg-transparent px-3 outline-none placeholder:text-pink-900/45"
                    placeholder="Type your message here..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                  />
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className="text-black hover-barbie-pink focus-ring-pink rounded-xl bg-soft-pink px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:bg-pink-100 disabled:text-pink-900/35"
                  >
                    Send
                  </button>
                </form>
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
