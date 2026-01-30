'use strict';
'require view';
'require form';
'require uci';
'require rpc';
'require ui';
'require poll';

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
	return L.resolveDefault(callServiceList('torrserver'), {}).then(function(res) {
		var isRunning = false;
		try {
			isRunning = res['torrserver']['instances']['instance1']['running'];
		} catch (e) { }
		return isRunning;
	});
}

function renderStatus(isRunning) {
	var spanTemp = '<span id="service_status" style="color:%s;font-weight:bold">%s</span>';
	if (isRunning) {
		return String.format(spanTemp, 'green', _('Running'));
	} else {
		return String.format(spanTemp, 'red', _('Not running'));
	}
}

function updateStatus(node, isRunning) {
	var statusEl = node.querySelector('#service_status');
	if (statusEl) {
		statusEl.outerHTML = renderStatus(isRunning);
	}

	var btnStart = node.querySelector('#btn_start');
	var btnStop = node.querySelector('#btn_stop');
	var btnRestart = node.querySelector('#btn_restart');

	if (btnStart && btnStop && btnRestart) {
		btnStart.disabled = isRunning;
		btnStop.disabled = !isRunning;
		btnRestart.disabled = !isRunning;
	}
}

function waitForStatus(expectedRunning, maxAttempts) {
	var attempts = 0;
	return new Promise(function(resolve) {
		function check() {
			getServiceStatus().then(function(isRunning) {
				attempts++;
				if (isRunning === expectedRunning || attempts >= maxAttempts) {
					resolve(isRunning);
				} else {
					setTimeout(check, 500);
				}
			});
		}
		check();
	});
}

function handleAction(node, action, btn) {
	var btnStart = node.querySelector('#btn_start');
	var btnStop = node.querySelector('#btn_stop');
	var btnRestart = node.querySelector('#btn_restart');

	var originalText = btn.textContent;
	var expectRunning = (action === 'start' || action === 'restart');

	btnStart.disabled = true;
	btnStop.disabled = true;
	btnRestart.disabled = true;

	btn.innerHTML = '<span class="spinning"></span>';

	return callInitAction('torrserver', action).then(function() {
		return waitForStatus(expectRunning, 10);
	}).then(function(isRunning) {
		btn.textContent = originalText;
		updateStatus(node, isRunning);
	}).catch(function(e) {
		btn.textContent = originalText;
		return getServiceStatus().then(function(isRunning) {
			updateStatus(node, isRunning);
		});
	});
}

return view.extend({
	load: function() {
		return Promise.all([
			uci.load('torrserver'),
			getServiceStatus()
		]);
	},

	render: function(data) {
		var isRunning = data[1];
		var m, s, o;

		m = new form.Map('torrserver', _('TorrServer'),
			_('TorrServer streams torrent files directly without waiting for full download. Configure and control the service below.'));

		s = m.section(form.TypedSection, 'torrserver', _('Service Status'));
		s.anonymous = true;

		o = s.option(form.DummyValue, '_status');
		o.rawhtml = true;
		o.cfgvalue = function() {
			return '<strong>' + _('Status') + ':</strong> ' + renderStatus(isRunning) +
				'<div style="margin-top:10px">' +
				'<button class="btn cbi-button cbi-button-action" id="btn_start">' + _('Start') + '</button> ' +
				'<button class="btn cbi-button cbi-button-action" id="btn_restart">' + _('Restart') + '</button> ' +
				'<button class="btn cbi-button cbi-button-remove" id="btn_stop" style="border-color:#c44;color:#c44">' + _('Stop') + '</button> ' +
				'<button class="btn cbi-button cbi-button-action" id="btn_webui" style="margin-left:20px">' + _('Open Web UI') + '</button>' +
				'</div>';
		};

		s = m.section(form.TypedSection, 'torrserver', _('Settings'));
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'),
			_('Enable TorrServer service'));
		o.rmempty = false;
		o.default = '1';

		o = s.option(form.Value, 'port', _('Port'),
			_('Web interface port (default: 8090)'));
		o.datatype = 'port';
		o.default = '8090';
		o.rmempty = false;

		o = s.option(form.Value, 'data_dir', _('Data Directory'),
			_('Directory for database and cache'));
		o.default = '/opt/torrserver/data';
		o.rmempty = false;

		return m.render().then(function(node) {
			var btnStart = node.querySelector('#btn_start');
			var btnStop = node.querySelector('#btn_stop');
			var btnRestart = node.querySelector('#btn_restart');

			btnStart.addEventListener('click', function() {
				handleAction(node, 'start', btnStart);
			});

			btnStop.addEventListener('click', function() {
				handleAction(node, 'stop', btnStop);
			});

			btnRestart.addEventListener('click', function() {
				handleAction(node, 'restart', btnRestart);
			});

			node.querySelector('#btn_webui').addEventListener('click', function() {
				var currentPort = uci.get('torrserver', 'main', 'port') || '8090';
				window.open('http://' + window.location.hostname + ':' + currentPort, '_blank');
			});

			updateStatus(node, isRunning);

			poll.add(function() {
				return getServiceStatus().then(function(running) {
					updateStatus(node, running);
				});
			}, 5);

			return node;
		});
	},

	handleSaveApply: function(ev, mode) {
		return this.handleSave(ev).then(function() {
			return callInitAction('torrserver', 'restart');
		});
	}
});
