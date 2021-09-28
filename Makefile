clean:
	gulp clean
	rm -f integrationExamples/gpt/build/dev/prebid.js
build: clean
	gulp build-bundle-dev --modules=relayBidAdapter
	mkdir -p integrationExamples/gpt/build/dev/
	cp build/dev/prebid.js integrationExamples/gpt/build/dev/prebid.js

.PHONY: dev
dev:
	cd integrationExamples/gpt/ && python -m http.server
	
