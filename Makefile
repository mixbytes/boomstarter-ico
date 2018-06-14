.PHONY: compile test logs

NPM_BIN := node_modules/.bin

node_modules:
	npm install

compile: node_modules
	$(NPM_BIN)/truffle compile

start:
	docker-compose up -d
logs:
	docker-compose logs -f 
stop:
	docker-compose down -t 1

test: start
	$(NPM_BIN)/truffle test

clean_build:
	rm -rf build


clean_all: clean_build
	rm -rf node_modules
