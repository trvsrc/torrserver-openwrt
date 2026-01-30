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
	var spanTemp = '<span style="color:%s;font-weight:bold">%s</span>';
	var renderHTML;
	if (isRunning) {
		renderHTML = String.format(spanTemp, 'green', _('Running'));
	} else {
		renderHTML = String.format(spanTemp, 'red', _('Not running'));
	}
	return renderHTML;
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

		o = s.option(form.DummyValue, '_status', _('Status'));
		o.rawhtml = true;
		o.cfgvalue = function() {
			return renderStatus(isRunning);
		};

		o = s.option(form.DummyValue, '_buttons', ' ');
		o.rawhtml = true;
		o.cfgvalue = function() {
			var port = uci.get('torrserver', 'main', 'port') || '8090';
			return '<button class="btn cbi-button cbi-button-apply" id="btn_start">' + _('Start') + '</button> ' +
				'<button class="btn cbi-button cbi-button-neutral" id="btn_stop">' + _('Stop') + '</button> ' +
				'<button class="btn cbi-button cbi-button-action" id="btn_restart">' + _('Restart') + '</button> ' +
				'<button class="btn cbi-button cbi-button-positive" id="btn_webui" style="margin-left:20px">' + _('Open Web UI') + '</button>';
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
			var port = uci.get('torrserver', 'main', 'port') || '8090';

			node.querySelector('#btn_start').addEventListener('click', function() {
				ui.showModal(_('Starting TorrServer'), [
					E('p', { class: 'spinning' }, _('Please wait...'))
				]);
				callInitAction('torrserver', 'start').then(function() {
					ui.hideModal();
					window.location.reload();
				});
			});

			node.querySelector('#btn_stop').addEventListener('click', function() {
				ui.showModal(_('Stopping TorrServer'), [
					E('p', { class: 'spinning' }, _('Please wait...'))
				]);
				callInitAction('torrserver', 'stop').then(function() {
					ui.hideModal();
					window.location.reload();
				});
			});

			node.querySelector('#btn_restart').addEventListener('click', function() {
				ui.showModal(_('Restarting TorrServer'), [
					E('p', { class: 'spinning' }, _('Please wait...'))
				]);
				callInitAction('torrserver', 'restart').then(function() {
					ui.hideModal();
					window.location.reload();
				});
			});

			node.querySelector('#btn_webui').addEventListener('click', function() {
				var currentPort = uci.get('torrserver', 'main', 'port') || '8090';
				window.open('http://' + window.location.hostname + ':' + currentPort, '_blank');
			});

			poll.add(function() {
				return getServiceStatus().then(function(running) {
					var statusEl = node.querySelector('[data-name="_status"] .cbi-value-field');
					if (statusEl) {
						statusEl.innerHTML = renderStatus(running);
					}
				});
			}, 5);

			return node;
		});
	},

	handleSaveApply: function(ev, mode) {
		return this.handleSave(ev).then(function() {
			ui.showModal(_('Applying changes'), [
				E('p', { class: 'spinning' }, _('Restarting service...'))
			]);
			return callInitAction('torrserver', 'restart').then(function() {
				ui.hideModal();
				window.location.reload();
			});
		});
	}
});
