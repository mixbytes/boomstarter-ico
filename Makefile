.PHONY: test logs

NPM_BIN := node_modules/.bin

node_modules: package.json
	npm install

build: node_modules
	$(NPM_BIN)/truffle compile

start:
	docker-compose up -d
restart:
	docker-compose restart
logs:
	docker-compose logs -f 
stop:
	docker-compose down -t 1
clean:
	rm -rf build node_modules


test: build start
	$(NPM_BIN)/truffle test $(TEST_FILE)

clean_build:
	rm -rf build


clean_all: clean_buildq
	rm -rf node_modules
