.PHONY: compile test logs

NPM_BIN := node_modules/.bin
TEST_FILE:=

node_modules:
	npm install

compile: node_modules
	$(NPM_BIN)/truffle compile

start:
	docker-compose up -d
restart:
    docker-compose restart
logs:
	docker-compose logs -f 
stop:
	docker-compose down -t 1

test: start
	$(NPM_BIN)/truffle test $(TEST_FILE)

clean_build:
	rm -rf build


clean_all: clean_build
	rm -rf node_modules
