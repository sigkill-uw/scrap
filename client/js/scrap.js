(function(namespace) {
	"use strict";

	const font = "medium Arial, 'Helvetica Neue', Helvetica, sans-serif";

	var client;

	var ui_wrapper;
	var ui_container;
	var ui_screen;
	var ui_screen_table;
	var ui_screen_overlay;
	var ui_input;
	var ui_submit_button;
	var ui_right_dock;
	var ui_window_list;
	var ui_user_list;
	var ui_window_title;

	function initDOMRefs()
	{
		ui_wrapper = document.getElementById("scrap-wrapper");
		ui_container = document.getElementById("scrap-container");
		ui_screen = document.getElementById("scrap-screen");
		ui_screen_table = document.getElementById("scrap-screen-table");
		ui_screen_overlay = document.getElementById("scrap-screen-overlay");
		ui_input = document.getElementById("scrap-input");
		ui_submit_button = document.getElementById("scrap-submit-button");
		ui_right_dock = document.getElementById("scrap-right-dock");
		ui_window_list = document.getElementById("scrap-window-list");
		ui_user_list = document.getElementById("scrap-user-list");
		ui_window_title = document.getElementById("scrap-window-title");

		ui_right_dock.style.width = getTextWidth("MMMMMMMMMMMMMMMM") + "px";

		ui_screen.addEventListener("scroll", function() {
			ui_screen_overlay.style.top = ui_screen.scrollTop + "px";
		});
		ui_screen_overlay.style.top = ui_screen.scrollTop + "px";
		ui_screen.scrollTop = ui_screen.scrollHeight;
	}

	function handleResize()
	{
		var vw = verge.viewportW();
		var vh = verge.viewportH();

		ui_wrapper.style.width = (0.94 * vw) + "px";
		ui_wrapper.style.height = (0.94 * vh) + "px";
		ui_wrapper.style.marginLeft = ui_wrapper.style.marginRight = (0.03 * vw) + "px";
		ui_wrapper.style.marginTop = ui_wrapper.style.marginBottom = (0.03 * vh) + "px";

		var spacing = Math.min(0.03 * vw, 0.03 * vh);

		var screen_area_width = ui_wrapper.clientWidth - spacing - ui_right_dock.offsetWidth;
		var screen_area_height = ui_wrapper.clientHeight - spacing - ui_input.offsetHeight;

		ui_screen.style.width = screen_area_width + "px";
		ui_screen.style.height = ui_right_dock.style.height = screen_area_height + "px";
		ui_screen.style.marginBottom = ui_right_dock.style.marginBottom = spacing + "px";

		ui_container.style.width = (screen_area_width + spacing + ui_right_dock.offsetWidth) + "px";
		ui_container.style.height = (screen_area_height + spacing + ui_input.offsetHeight) + "px";
	};

	function getTimeString(d)
	{
		/* 01/01/1970 00:00:00 */
		var date = d.getDate();
		var month = d.getMonth();
		var year = d.getFullYear();
		var hours = d.getHours();
		var minutes = d.getMinutes();
		var seconds = d.getSeconds();

		return (
			(date < 10 ? "0" : "") + date + "/" +
			(month < 10 ? "0" : "") + month + "/" +
			year + " " +
			(hours < 10 ? "0" : "") + hours + ":" +
			(minutes < 10 ? "0" : "") + minutes + ":" +
			(seconds < 10 ? "0" : "") + seconds
		);
	};

	var measure_context = document.createElement("canvas").getContext("2d");
	function getTextWidth(text, cur_font)
	{
		measure_context.font = cur_font || font;
		return measure_context.measureText(text).width;
	}

	var escape_div = document.createElement("div");
	function escapeHTML(data)
	{
		escape_div.appendChild(document.createTextNode(data));
		var escaped = escape_div.innerHTML;
		escape_div.removeChild(escape_div.firstChild);

		return escaped;
	}

	window.addEventListener("load", function() {
		initDOMRefs();
		handleResize();
		window.addEventListener("resize", handleResize);
		WindowManager.init();
		CommandInterface.init();

		WindowManager.message("!client", null, "Welcome to an early alpha of the scrap messaging server.");

		client = new Client(function(packet) {
				switch(packet.command.toUpperCase())
				{
					case "NICK":
						WindowManager.nick(packet.success, packet.message, packet.time);
						break;

					case "ERROR":
						WindowManager.error(packet.content, packet.time);
						break;

					case "ENTER":
						WindowManager.enter(packet.nick, packet.room, packet.users, packet.time);
						break;

					case "LEAVE":
						WindowManager.leave(packet.nick, packet.room, packet.users, packet.time);
						break;

					case "MESSAGE":
						WindowManager.message(packet.sender, packet.recipient, packet.content, packet.time);
						break;

					case "MOTD":
						WindowManager.message("!system", null, "<b>Server message of the day:</b><br>" + packet.motd, packet.time, true);
						break;
				}
			},
			function() { WindowManager.message("!client", null, "Successfully connected to server."); },
			function() { WindowManager.message("!client", null, "Something went wrong with the network. Please refresh the page."); },
			function() { WindowManager.message("!client", null, "Connection has been closed."); }
		);

		ui_input.addEventListener("keydown", function(e) {
			if(e.keyCode === 13)
			{
				var data = ui_input.value;
				ui_input.value = "";

				CommandInterface.run(data);
			}
		});
	});

	var WindowManager = {
		windows: {},
		active_window: null,
		ordered_windows: [],
		ordering_index: -1,

		init: function() {
			var self = this;

			ui_screen.addEventListener("scroll", function() {
				if(self.active_window)
				{
					if(Math.abs(ui_screen.scrollHeight - ui_screen.clientHeight - ui_screen.scrollTop) <= 10)
						self.active_window.scroll = Infinity;
					else
						self.active_window.scroll = ui_screen.scrollTop;
				}
			});

			this.open("!system");
		},

		open: function(name, activate) {
			var normalized_name = name.toLowerCase();

			if(!(normalized_name in this.windows))
			{
				var win = this.Window(name);

				this.windows[normalized_name] = win;
				this.ordered_windows.push(win);
				ui_window_list.appendChild(win.ui_window_list_item);
			}

			if(activate !== false)
				this.activate(name);
		},

		close: function(name) {
			var normalized_name = name.toLowerCase();

			if(normalized_name !== "!system")
			{
				var win = this.windows[normalized_name];
				delete this.windows[normalized_name];

				if(win === this.active_window)
					this.activate(Object.keys(this.windows)[0]);

				ui_window_list.removeChild(win.ui_window_list_item);
			}
		},

		activate: function(name) {
			var normalized_name = name.toLowerCase();

			if(this.active_window === null || normalized_name != this.active_window.normalized_name)
			{
				if(this.active_window !== null)
				{
					this.active_window.ui_window_list_item.style.fontWeight = "normal";
				}

				if(ui_screen_table.firstChild)
				{
					ui_screen_table.removeChild(ui_screen_table.firstChild);
				}

				while(ui_user_list.firstChild)
				{
					ui_user_list.removeChild(ui_user_list.firstChild);
				}

				var win = this.windows[normalized_name];

				ui_window_title.innerHTML = win.name;

				ui_screen_table.appendChild(win.ui_message_tbody);

				for(var i = 0; i < win.users.length; i ++)
					ui_user_list.appendChild(win.ui_user_list_items[i]);

				this.ordering_index = this.ordered_windows.length;
				while(this.ordered_windows[-- this.ordering_index] != win);

				ui_screen.scrollTop = Math.min(ui_screen.scrollHeight, win.scroll);

				this.active_window = win;
				this.active_window.ui_window_list_item.style.fontWeight = "bold";
			}
		},

		nick: function(success, message, timestamp) {
			var html = '<span class = "' + (success ? "success" : "error") + '">' +
				escapeHTML(message) + "</span>";

			this.message("!system", null, html, timestamp, true);
		},

		error: function(message, timestamp) {
			var html = '<span class = "error">' + escapeHTML(message) + "</span>";
			this.message("!system", null, html, timestamp, true);
		},

		message: function(sender, recipient, content, timestamp, raw) {
			if(sender[0] === "!" && recipient === null)
			{
				this.message(sender, this.active_window.name, content, timestamp, raw);
				if(this.active_window.name !== "!system")
					this.message(sender, "!system", content, timestamp, raw);

				return;
			}

			var now = Date.now();
			var normalized_sender = sender.toLowerCase();
			var normalized_recipient = recipient.toLowerCase();

			var win;
			if(client && normalized_recipient === client.nickname.toLowerCase())
			{
				this.open(sender, false);
				win = this.windows[normalized_sender];
			}
			else
			{
				this.open(recipient, false);
				win = this.windows[normalized_recipient];
			}

			if(normalized_sender === win.last_message_norm_sender &&
				now - win.last_message_local_ts <= 5000)
			{
				if(!raw)
				{
					var lines = content.split("\n");
					for(var i = 0; i < lines.length; i ++)
					{
						win.ui_last_message.appendChild(document.createElement("br"));
						win.ui_last_message.appendChild(document.createTextNode(lines[i]));
					}
				}
				else
				{
					win.ui_last_message.appendChild(document.createElement("br"));
					win.ui_last_message.innerHTML += content;
				}
			}
			else
			{
				var time_string;
				if(!timestamp)
				{
					time_string = "[LT " + getTimeString(new Date()) + "]";
				}
				else
				{
					time_string = "[" + getTimeString(new Date(1000 * timestamp)) + "]";
				}

				var header = document.createElement("td");
				header.innerHTML = sender + "<br>" + time_string;

				var payload = document.createElement("td");

				if(!raw)
				{
					var lines = content.split("\n");
					for(var i = 0; i < lines.length; i ++)
					{
						if(i > 0) payload.appendChild(document.createElement("br"));
						payload.appendChild(document.createTextNode(lines[i]));
					}
				}
				else
				{
					payload.innerHTML = content;
				}

				var row = document.createElement("tr");
				row.appendChild(header);
				row.appendChild(payload);

				win.ui_message_tbody.appendChild(row);
				win.ui_last_message = payload;
			}

			if(this.active_window === win && win.scroll >= ui_screen.scrollHeight)
				ui_screen.scrollTop = ui_screen.scrollHeight;

			win.last_message_norm_sender = normalized_sender;
			win.last_message_local_ts = now;
		},

		enter: function(nick, room, users, timestamp) {
			this.open(room, (nick === client.nickname), false);

			var html = '<span class = "info">' +
				escapeHTML(nick) + " has entered " +
				escapeHTML(room) + ".</span>";

			this.message("!system", room, html, timestamp, true);

			var win = this.windows[room.toLowerCase()];
			if(win.users.length === 0)
			{
				win.users = users;
				win.ui_user_list_items = users.map(WindowManager.UserListingElement, WindowManager);
				win.ui_user_list_items.forEach(ui_user_list.appendChild, ui_user_list);
			}
			else
			{
				win.users.push(nick);

				var li = this.UserListingElement(nick);
				win.ui_user_list_items.push(li);
				ui_user_list.appendChild(li);
			}

			if(nick === client.nickname)
				this.activate(room);
		},

		leave: function(nick, room, users, timestamp) {
			if(nick === client.nickname.toLowerCase())
			{
				this.close(room);
			}
			else
			{
				var html = '<span class = "info">' +
					escapeHTML(nick) + " has left " +
					escapeHTML(room) + ".</span>";

				this.message("!system", room, html, timestamp, true);

				var win = this.windows[room.toLowerCase()];

				var i;
				for(i = 0; i < win.users.length; i ++)
					if(win.users[i] === nick)
						break;

				var elem = win.ui_user_list_items[i];
				win.users.splice(i, 1);
				win.ui_user_list_items.splice(i, 1);

				if(win === this.active_window)
					ui_user_list.removeChild(elem);
			}
		},

		Window: function(name) {
			return {
				"name": name,
				"normalized_name": name.toLowerCase(),

				"users": (name[0] == "#" ? [] : (name[0] == "!" ? [name] : [client.nickname, name])),
				"ui_user_list_items": (name[0] == "#" ? [] : (name[0] == "!" ?
					[this.UserListingElement(name)] :
					[this.UserListingElement(client.nickname), this.UserListingElement(name)])),

				"unread": false,
				"hilighted": false,

				"last_message_norm_sender": null,
				"last_message_local_ts": 0,
				"ui_last_message": null,

				"ui_message_tbody": document.createElement("tbody"),
				"ui_window_list_item": this.WindowListingElement(name),

				"scroll": Infinity
			};
		},

		windowListingOnclick: function(e) {
			if(e.button === 0)
				WindowManager.activate(this.innerHTML);
		},

		userListingOnclick: function(e) {
			if(e.button === 0)
				WindowManager.open(this.innerHTML);
		},

		WindowListingElement: function(name) {
			var btn = document.createElement("button")
			btn.className = "btn btn-default";
			btn.innerHTML = name;
			btn.onclick = this.windowListingOnclick;

			return btn;
		},

		UserListingElement: function(name) {
			var btn = document.createElement("button")
			btn.className = "btn btn-default";
			btn.innerHTML = name;
			btn.onclick = this.userListingOnclick;

			return btn;
		}
	};

	var CommandInterface = {
		init: function() {
			var par = function(data) {
				var sp = data.split(" ");
				var result = [];

				for(var i = 0; i < sp.length; i ++)
					if(sp[i] !== "")
						result.push(sp[i]);

				return result;
			};

			this.commands = {
				"say": function(data) {
					client.message(WindowManager.active_window.name, data);
				},

				"motd": function(data) {
					var params = par(data);
					if(params.length === 0)
					{
						client.motd();
					}
				},

				"nick": function(data) {
					var params = par(data);
					if(params.length === 1 || params.length === 2)
					{
						client.nick(params[0], (params.length < 2) ? "" : params[1]);
					}
					else
					{
					}
				},

				"enter": function(data) {
					var params = par(data);

					if(params.length === 1 && params[0][0] === '#')
					{
						client.enter(params[0]);
					}
					else
					{
					}
				},

				"leave": function(data) {
					var params = par(data);
					if(params.length === 1 && params[0][0] === '#')
					{
						client.leave(params[0]);
					}
					else
					{
					}
				}
			};
		},

		run: function(string) {
			if(string[0] === '/')
			{
				var cmd = string.substring(1).split(" ", 1)[0].toLowerCase();

				if(cmd in this.commands)
				{
					this.commands[cmd](string.substring(1 + cmd.length));
				}
				else
				{
				}
			}
			else this.run("/say " + string);
		}
	};

	function Client(onrecv, onopen, onerror, onclose, host)
	{

		this.nickname = "!not-authed",
		this.socket = new WebSocket(host || ("ws://" + window.location.hostname + ":" + window.location.port + "/scrap-ws"));

		this.socket.onopen = onopen;
		this.socket.onerror = onerror;
		this.socket.onclose = onclose;

		var self = this;
		this.socket.onmessage = function(e) {
			var packet = JSON.parse(e.data);

			if(packet.command.toUpperCase() === "NICK" && packet.success === true)
				self.nickname = packet.nick;

			onrecv(packet, self);
		};
	}

	Client.prototype.nick = function(nick, password) {
		this.socket.send(JSON.stringify({
			"command": "NICK",
			"nick": nick,
			"password": (password || "")
		}));
	};

	Client.prototype.register = function(password) {
		this.socket.send(JSON.stringify({
			"command": "REGISTER",
			"password": password
		}));
	};

	Client.prototype.motd = function() {
		this.socket.send('{"command": "MOTD"}');
	};

	Client.prototype.message = function(recipient, content) {
		this.socket.send(JSON.stringify({
			"command": "MESSAGE",
			"recipient": recipient,
			"content": content
		}));
	};

	Client.prototype.enter = function(room) {
		this.socket.send(JSON.stringify({
			"command": "ENTER",
			"room": room
		}));
	};

	Client.prototype.leave = function(room) {
		this.socket.send(JSON.stringify({
			"command": "LEAVE",
			"room": room
		}));
	};

	Client.prototype.quit = function() {
		this.socket.send('{"command": "QUIT"}');
	};
})();
