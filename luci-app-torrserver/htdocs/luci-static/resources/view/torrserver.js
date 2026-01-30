'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require poll';

var SERVICE_NAME = 'torrserver';
var POLL_INTERVAL = 5;
var STATUS_CHECK_INTERVAL = 500;
var STATUS_CHECK_MAX_ATTEMPTS = 10;

var callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

var callInitAction = rpc.declare({
	object: 'luci',
	method: 'setInitAction',
	params: ['name', 'action'],
	expect: { result: false }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList(SERVICE_NAME), {}).then(function(res) {
		try {
			return res[SERVICE_NAME]['instances']['instance1']['running'] === true;
		} catch (e) {
			return false;
		}
	});
}

function renderStatusHtml(isRunning) {
	return String.format(
		'<span id="service_status" style="color:%s;font-weight:bold">%s</span>',
		isRunning ? 'green' : 'red',
		isRunning ? _('Running') : _('Not running')
	);
}

function renderButtonsHtml() {
	return E('div', { 'style': 'display:flex;flex-wrap:wrap;gap:5px' }, [
		E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'id': 'btn_start'
		}, _('Start')),
		E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'id': 'btn_restart'
		}, _('Restart')),
		E('button', {
			'class': 'btn cbi-button cbi-button-remove',
			'id': 'btn_stop',
			'style': 'border-color:#c44;color:#c44'
		}, _('Stop')),
		E('button', {
			'class': 'btn cbi-button cbi-button-action',
			'id': 'btn_webui',
			'style': 'margin-left:15px'
		}, _('Open Web UI'))
	]);
}

function getButtons(node) {
	return {
		start: node.querySelector('#btn_start'),
		stop: node.querySelector('#btn_stop'),
		restart: node.querySelector('#btn_restart'),
		webui: node.querySelector('#btn_webui')
	};
}

function setButtonsDisabled(buttons, disabled) {
	buttons.start.disabled = disabled;
	buttons.stop.disabled = disabled;
	buttons.restart.disabled = disabled;
}

function updateButtonStates(buttons, isRunning) {
	buttons.start.disabled = isRunning;
	buttons.stop.disabled = !isRunning;
	buttons.restart.disabled = !isRunning;
}

function updateStatusDisplay(node, isRunning) {
	var statusEl = node.querySelector('#service_status');
	if (statusEl) {
		statusEl.outerHTML = renderStatusHtml(isRunning);
	}
	updateButtonStates(getButtons(node), isRunning);
}

function waitForStatusChange(expectedRunning) {
	var attempts = 0;

	return new Promise(function(resolve) {
		(function check() {
			getServiceStatus().then(function(isRunning) {
				attempts++;
				if (isRunning === expectedRunning || attempts >= STATUS_CHECK_MAX_ATTEMPTS) {
					resolve(isRunning);
				} else {
					setTimeout(check, STATUS_CHECK_INTERVAL);
				}
			});
		})();
	});
}

function handleServiceAction(node, action, btn) {
	var buttons = getButtons(node);
	var originalText = btn.textContent;
	var expectRunning = (action !== 'stop');

	setButtonsDisabled(buttons, true);
	btn.innerHTML = '<span class="spinning"></span>';

	return callInitAction(SERVICE_NAME, action)
		.then(function() {
			return waitForStatusChange(expectRunning);
		})
		.then(function(isRunning) {
			btn.textContent = originalText;
			updateStatusDisplay(node, isRunning);
		})
		.catch(function() {
			btn.textContent = originalText;
			return getServiceStatus().then(function(isRunning) {
				updateStatusDisplay(node, isRunning);
			});
		});
}

function openWebUI() {
	var port = uci.get(SERVICE_NAME, 'main', 'port') || '8090';
	window.open('http://' + window.location.hostname + ':' + port, '_blank');
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load(SERVICE_NAME),
			getServiceStatus()
		]);
	},

	render: function(data) {
		var isRunning = data[1];
		var m, s, o;

		m = new form.Map(SERVICE_NAME, _('TorrServer'),
			_('TorrServer streams torrent files directly without waiting for full download.'));

		s = m.section(form.TypedSection, SERVICE_NAME, _('Service Control'));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_status');
		o.rawhtml = true;
		o.render = function() {
			return E('div', { 'class': 'cbi-value', 'style': 'display:flex;align-items:baseline' }, [
				E('label', { 'class': 'cbi-value-title' }, _('Status')),
				E('div', { 'class': 'cbi-value-field' }, renderStatusHtml(isRunning))
			]);
		};

		o = s.option(form.DummyValue, '_buttons');
		o.rawhtml = true;
		o.render = function() {
			return E('div', { 'class': 'cbi-value' }, [
				E('label', { 'class': 'cbi-value-title' }),
				E('div', { 'class': 'cbi-value-field' }, renderButtonsHtml())
			]);
		};

		s = m.section(form.TypedSection, SERVICE_NAME, _('Settings'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'),
			_('Start TorrServer automatically on boot'));
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.Value, 'port', _('Port'),
			_('Web interface port'));
		o.datatype = 'port';
		o.default = '8090';
		o.rmempty = false;
		o.placeholder = '8090';

		o = s.option(form.Value, 'data_dir', _('Data Directory'),
			_('Directory for database and cache files'));
		o.default = '/opt/torrserver/data';
		o.rmempty = false;

		return m.render().then(function(node) {
			var buttons = getButtons(node);

			buttons.start.addEventListener('click', function() {
				handleServiceAction(node, 'start', buttons.start);
			});

			buttons.stop.addEventListener('click', function() {
				handleServiceAction(node, 'stop', buttons.stop);
			});

			buttons.restart.addEventListener('click', function() {
				handleServiceAction(node, 'restart', buttons.restart);
			});

			buttons.webui.addEventListener('click', openWebUI);

			updateStatusDisplay(node, isRunning);

			poll.add(function() {
				return getServiceStatus().then(function(running) {
					updateStatusDisplay(node, running);
				});
			}, POLL_INTERVAL);

			return node;
		});
	},

	handleSaveApply: function(ev) {
		return this.handleSave(ev).then(function() {
			return callInitAction(SERVICE_NAME, 'restart');
		});
	}
});
