.PHONY: populate-static-assets

populate-static-assets:
	cd client; grunt; cd ..
	cp -r client/dist/* scrap-server/public
	rm scrap-server/public/scrap.html
	cp client/dist/scrap.html scrap-server/app/views/scrap.scala.html
