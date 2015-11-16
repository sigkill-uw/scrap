(function(namespace) {
	"use strict";

	const SCROLLBACK_LENGTH = 512;

	function Message(sender, time, content)
	{
		return {sender: sender, time: time, content: content};
	}

	function Window(wid)
	{
		return {
			id: wid,
			users: [],
			scrollback: new WinManager.SizedQueue(SCROLLBACK_LENGTH)
		};
	}

	function WinManager()
	{
		this.windows = [];
		this.active_window = null;
	}

	WinManager.navOpen = function(wid) {
	};

	WinManager.navClose = function(wid) {
	};

	WinManager.navNext = function() {
	};

	WinManager.navPrev = function() {
	};

	WinManager.navUnread = function() {
	};

	WinManager.signalMessage = function(wid, sender, time, content) {
	};

	WinManager.signalEnter = function(wid, user, time) {
	};

	WinManager.signalLeave = function(wid, user, time) {
	};

	WinManager.iterateWindows = function(callback) {
	};

	WinManager.iterateUsers = function(wid, callback) {
	};

	namespace.WinManager = WinManager;
})(scrap);

(function(namespace) {
	function SizedQueue(size)
	{
		this.size = size;
		this.count = 0;

		this.head = 0;
		this.tail = 0;
		this.queue = new Array(size);
	}

	SizedQueue.prototype.push = function(v) {
		if(this.count >= this.size)
			this.pop();

		this.queue[this.tail ++] = v;
		if(this.tail >= this.size)
			this.tail = 0;

		this.count ++;
	};

	SizedQueue.prototype.pop = function() {
		if(this.count > 0)
		{
			var v = this.queue[this.head ++];
			if(this.head >= this.size)
				this.head = 0;

			this.count --;

			return v;
		}
	};
})(scrap.WinManager);
