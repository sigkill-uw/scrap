package controllers

import play.api._
import play.api.mvc._
import play.api.libs.json._
import models._

class Application extends Controller {

	def scrap = Action {
		Ok(views.html.scrap())
	}

	def scrap_ws = WebSocket.using[JsValue] { request =>
		models.ChatServer.connect()
	}
}
