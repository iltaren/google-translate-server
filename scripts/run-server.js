var http = require('http');
var serverDispatcher = require('./dispatcher');
var getPostPayload = require('./core/get-post-payload');
var urlModule = require('url');
var initManager = require('./init-manager');

var server = http.createServer(requestHandler);

function startServer() {
	require('./load-dot-env')();

	var port = process.env.PORT;
	
	server.listen(port, function () {
	    console.log(`Server listening on: ${port}`);
	});

	return initManager.start();
}

function requestHandler(request, response) {
	try {
  		if (request.method === 'POST') {
			getPostPayload(request)
				.then(dataAsString => {
					var url = request.url;
					var data = JSON.parse(dataAsString);
					var dispatcherResult = serverDispatcher.request(url, data);

					handleDispatcherResult(
						request,
						response,
						dispatcherResult
					);
				});
		} else if (request.method === 'GET') {
			var url = request.url.split('?')[0];
			var data = urlModule.parse(request.url, true).query;
			var dispatcherResult = serverDispatcher.request(url, data);

			handleDispatcherResult(
				request,
				response,
				dispatcherResult
			);
		} else {
			rejectOnError(response, `Unknown method ${request.method}`);
		}
	} catch (err) {
		rejectOnError(response, err);
	}
}

function handleDispatcherResult(request, response, dispatcherResult) {
	console.info('Result type: ' + dispatcherResult.type);

	var action = dispatcherResult.type;
	var data = dispatcherResult.data;
	var contentType = dispatcherResult.contentType || 'application/json';

	if (action === 'PROXY') {
		request
			.pipe(data)
			.pipe(response);

	} else if (action === 'PROMISE/TEXT') {
		var header = {'Content-Type': contentType};

		data
			.then(responseData => {
				response.writeHead(200, header);
	            response.end(JSON.stringify(responseData));
			})
			.catch(err => {
				rejectOnError(response, err);
			});
	} else {
		rejectOnError(response, `Unknown action: ${action}`);
	}
}

function rejectOnError(response, additionalData) {
  var errorMessage = additionalData || 'Unknown Error';
  console.error(errorMessage);

  response.writeHead(502, {'Content-Type': 'application/json'});
  response.end(JSON.stringify({error: errorMessage}));
}

function isAlive() {
	return server.listening
	&& initManager.isReady();
}

module.exports = {
	startServer: startServer,
	isAlive: isAlive
};
