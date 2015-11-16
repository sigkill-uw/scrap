package models

import play.api.mvc._
import play.api.libs.iteratee._
import play.api.libs.concurrent.Execution.Implicits.defaultContext
import play.api.libs.json._
import play.api.Logger
import scala.collection.mutable

// Chat server object
object ChatServer {

	def verifyNickname(nick: String): Boolean = {
		return (nick.length >= 1 && nick.length <= 20 && nick(0).isLetter && nick.forall(_.isLetterOrDigit));
	}

	def verifyRoomIdentifier(room_id: String): Boolean = {
		return (room_id.length >= 2 && room_id.length <= 30 && room_id(0) == '#' && room_id.drop(1).forall(_.isLetterOrDigit))
	}

	def verifyMessage(content: String): Boolean = {
		val stripped = content.trim
		return (stripped.length >= 1 && stripped.length <= 1000 && stripped.forall((c: Char) => {c != '\r' && c != '\n' }))
	}

	val authed_clients = new mutable.HashMap[String, ChatClient]()
	val active_rooms = new mutable.HashMap[String, ChatRoom]()

	class ChatClient(val stream: Concurrent.Channel[JsValue]) {
		var nick = "!"
		var authed = false
		var connected = true
		val joined_rooms = new mutable.HashSet[ChatRoom]()

		Logger.info("New client has connected")

		this.handleMotD()

		def handleNick(nick_v: String) = {
			val normalized_nick = nick_v.toLowerCase

			if(authed)
			{
				push(SNickPacket(nick_v, false, s"You are already authenticated as $nick."))
			}
			else if(!verifyNickname(nick_v))
			{
				push(SNickPacket(nick_v, false, "Nickname must be 1 to 20 alphanumeric characters, and must begin with a letter."))
			}
			else if(authed_clients.contains(normalized_nick))
			{
				push(SNickPacket(nick_v, false, s"The nickname $nick_v is already in use."))
			}
			else
			{
				nick = nick_v
				authed = true
				authed_clients(normalized_nick) = this

				push(SNickPacket(nick_v, true, s"You are now authenticated as $nick_v."))

				Logger.info(s"Client has authenticated as $nick")
			}
		}

		def handleMotD() = {
			push(SMotDPacket)
		}

		def handleMessage(recipient: String, content: String) = {
			val normalized_recipient = recipient.toLowerCase

			if(!authed)
			{
				push(SErrorPacket("Please authenticate yourself before attempting to send messages."))
			}
			else if(verifyNickname(recipient))
			{
				if(authed_clients.contains(normalized_recipient))
				{
					if(verifyMessage(content))
					{
						val packet = SMessagePacket(nick, recipient, content)
						push(packet)
						authed_clients(normalized_recipient).push(packet)
					}
					else
					{
						push(SErrorPacket("Message must be a single non-empty, non-blank line of at most 1000 characters."))
					}
				}
				else
				{
					push(SErrorPacket(s"User $recipient is not logged in on this server."))
				}
			}
			else if(verifyRoomIdentifier(recipient))
			{
				if(active_rooms.contains(normalized_recipient))
					active_rooms(normalized_recipient).handleMessage(this, content)
				else
					push(SErrorPacket(s"No such room $recipient on this server."));
			}
			else
			{
				push(SErrorPacket("Message recipient must be a valid room identifier or nickname."));
			}
		}

		def handleEnter(room_id: String) = {
			val normalized_id = room_id.toLowerCase

			if(!authed)
			{
				push(SErrorPacket("Please authenticate before attempting to enter rooms."))
			}
			else if(verifyRoomIdentifier(room_id))
			{
				val room = if(active_rooms.contains(normalized_id)) active_rooms(normalized_id) else new ChatRoom(room_id)
				room.handleEnter(this)

				if(room.users.contains(this))
					joined_rooms += room
			}
			else
			{
				push(SErrorPacket("Room identifiers must be between 2 and 30 characters, and must be a '#' followed by alphanumeric characters."))
			}
		}

		def handleLeave(room_id: String) = {
			val normalized_id = room_id.toLowerCase

			if(verifyRoomIdentifier(room_id))
			{
				if(active_rooms.contains(normalized_id))
				{
					val room = active_rooms(normalized_id)

					room.handleLeave(this)
					joined_rooms -= room;
				}
				else
				{
					push(SErrorPacket(s"No such room $room_id on this server."));
				}
			}
			else
			{
				push(SErrorPacket("Room identifiers must begin with a '#'; all other characters must be alphanumeric."))
			}
		}

		def handleQuit() = {
			if(connected)
			{
				connected = false

				Logger.info(s"Client $nick is disconnecting")

				joined_rooms.foreach(r => r.handleLeave(this))

				if(authed)
					authed_clients -= nick.toLowerCase
			}
		}

		def push(packet: JsValue) = {
			if(connected)
				stream.push(packet)
		}
	}

	class ChatRoom(val identifier: String) {
		Logger.info(s"Room $identifier is being created")
		active_rooms(identifier.toLowerCase) = this

		var users = new mutable.HashSet[ChatClient]()
		val scrollback = new mutable.Queue[JsValue]()

		val scrollback_length = 50

		def scrollbackEnqueue(packet: JsValue) = {
			scrollback.enqueue(packet)
			if(scrollback.length > scrollback_length)
				scrollback.dequeue()
		}

		def handleEnter(user: ChatClient) {
			if(!users.contains(user))
			{
				users += user

				scrollback.foreach(p => user.push(p))

				val packet = SEnterPacket(user.nick, identifier, this.getUserNicknames)
				users.foreach(u => u.push(packet))

				scrollbackEnqueue(packet)
			}
			else
			{
			}
		}

		def handleLeave(user: ChatClient) {
			if(users.contains(user))
			{
				users -= user

				val packet = SLeavePacket(user.nick, identifier, this.getUserNicknames)
				users.foreach(u => u.push(packet))
				user.push(packet)

				scrollbackEnqueue(packet)

				if(users.isEmpty)
				{
					active_rooms -= identifier.toLowerCase
					Logger.info(s"Room $identifier is empty and is being pruned")
				}
			}
			else
			{
				user.push(SErrorPacket(s"You are not in room $identifier"))
			}
		}

		def handleMessage(sender: ChatClient, content: String) {
			if(users.contains(sender))
			{
				if(verifyMessage(content))
				{
					val packet = SMessagePacket(sender.nick, identifier, content)
					users.foreach { u => u.push(packet) };

					scrollbackEnqueue(packet)
				}
				else
				{
					sender.push(SErrorPacket("Message must be a single non-empty, non-blank line of at most 1000 characters."))
				}
			}
			else
			{
				sender.push(SErrorPacket(s"You are not in room $identifier"))
			}
		}

		def getUserNicknames(): Seq[String] = {
			users.map(_.nick).toSeq
		}
	}

	// Connection callback to be invoked from the relevant view
	def connect(): (Iteratee[JsValue, _], Enumerator[JsValue]) = {

		var client: ChatClient = null;

		// Create output stream
		val enumerator = Concurrent.unicast[JsValue](onStart = { stream =>
			client = new ChatClient(stream)
		})

		// Using an Iteratee, process incoming JSON packets, until quit
		val iteratee = Iteratee.foreach[JsValue]({ packet =>
			// Dispatch the appropriate command
			(packet \ "command").as[String].toUpperCase match {
				case "NICK" => client.handleNick((packet \ "nick").as[String])
				case "ENTER" => client.handleEnter((packet \ "room").as[String])
				case "LEAVE" => client.handleLeave((packet \ "room").as[String])
				case "MESSAGE" => client.handleMessage((packet \ "recipient").as[String], (packet \ "content").as[String])
				case "MOTD" => client.handleMotD()
				case "QUIT" => client.handleQuit()
			}
		}).map({ _ =>
			client.handleQuit()
		})

		(iteratee, enumerator)
	}

	def ServerPacket(command: String, fields: Seq[(String, Any)]): JsValue = {
		def serialize(z: Any): JsValue = z match {
			case z: String => JsString(z)
			case z: Int => JsNumber(z)
			case z: Float => JsNumber(z)
			case z: Boolean => JsBoolean(z)
			case z: Seq[Any] => JsArray(z.map(serialize))
		}

		JsObject(Seq[(String, JsValue)](
			"command" -> JsString(command),
			"time" -> JsNumber(System.currentTimeMillis / 1000)
		) ++ fields.map(pair =>
			(pair._1, serialize(pair._2))
		))
	}

	def SNickPacket(nick: String, success: Boolean, message: String) = {
		ServerPacket("NICK", Seq("nick" -> nick, "success" -> success, "message" -> message))
	}

	def SRegisterPacket(success: Boolean, message: String) = {
		ServerPacket("REGISTER", Seq("success" -> success, "message" -> message))
	}

	def SEnterPacket(nick: String, room: String, users: Seq[String]) = {
		ServerPacket("ENTER", Seq("nick" -> nick, "room" -> room, "users" -> users))
	}

	def SLeavePacket(nick: String, room: String, users: Seq[String]) = {
		ServerPacket("LEAVE", Seq("nick" -> nick, "room" -> room, "users" -> users))
	}

	def SMessagePacket(sender: String, recipient: String, content: String) = {
		ServerPacket("MESSAGE", Seq(
			"sender" -> sender,
			"recipient" -> recipient,
			"content" -> content))
	}

	def SErrorPacket(content: String) = {
		ServerPacket("ERROR", Seq("content" -> content))
	}

	def SMotDPacket() = {
		ServerPacket("MOTD", Seq("motd" ->
			"Welcome to a very early alpha of the scrap messaging protocol. Please authenticate yourself by typing `/nick ` followed by your desired nickname."))
	}

	def SQuitPacket(message: String) = {
		ServerPacket("QUIT", Seq("message" -> message));
	}
}
