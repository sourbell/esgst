/* eslint-env mocha */
import { expect } from 'chai';
import * as sinon from 'sinon';
import { Settings } from '../../src/class/Settings';
import { Filters } from '../../src/modules/Filters';

describe('Filters under a CSP without unsafe-eval', () => {
	it('loads the userscript QueryBuilder dependency without dynamic code generation', () => {
		expect(() => window.eval('1')).to.throw(EvalError);
		expect(window.$.fn.queryBuilder).to.be.a('function');
	});

	it('renders custom controls and preserves nested, negated and paused preset rules', () => {
		const savedRules = {
			condition: 'AND',
			not: false,
			rules: [
				{
					id: 'points',
					field: 'points',
					type: 'integer',
					input: 'number',
					operator: 'greater',
					value: 10,
				},
				{
					condition: 'OR',
					not: true,
					rules: [
						{
							id: 'name',
							field: 'name',
							type: 'string',
							input: 'text',
							operator: 'contains',
							value: 'Portal',
							data: { paused: true },
						},
					],
				},
			],
			valid: true,
		};
		const settings = {
			testFilters_m_b: true,
			testFilters_points: true,
			testFilters_name: true,
			testFilters_presetTest: 'Saved',
			testFilters_presets: [{ name: 'Saved', rules: savedRules }],
		};
		const settingsStub = sinon.stub(Settings, 'get').callsFake((key) => settings[key]);
		const fixture = document.createElement('div');
		const heading = document.createElement('div');
		fixture.appendChild(heading);
		document.body.appendChild(fixture);
		const filters = new Filters('testFilters').setEsgst({});
		filters.getFilters = () => ({
			points: { name: 'Points', type: 'integer', minValue: 0, maxValue: 100, check: true },
			name: { name: 'Name < "Portal" & friends', type: 'string', check: true },
			disabled: { name: 'Disabled', type: 'string', check: false },
		});
		let builder;
		try {
			filters.filters_addContainer(heading, 'Test');
			let obj = filters.esgst.testFiltersPopup;
			builder = obj.builder;
			const root = builder.model.root;
			const group = root.rules[1];
			const rule = group.rules[0];
			expect(builder.validate()).to.equal(true);
			expect(builder.$el.find('.esgst-gf-filter-count')).to.have.length(4);
			expect(builder.$el.find('option[value="disabled"]').hasClass('esgst-hidden')).to.equal(true);
			expect(rule.$el.find('option[value="name"]').text()).to.equal('Name < "Portal" & friends');
			expect(root.$el.children('.rules-group-header').find('[data-pause=group]')).to.have.length(0);
			expect(group.$el.children('.rules-group-header').find('[data-pause=group]')).to.have.length(
				1
			);
			expect(rule.$el.attr('data-esgst-paused')).to.equal('true');
			expect(builder.$el.find('.drag-handle')).to.have.length(3);
			expect(window.interact.isSet(rule.$el[0])).to.equal(true);

			const serialized = JSON.parse(JSON.stringify(obj.rules_save));
			expect(serialized.rules[1]).to.deep.equal(savedRules.rules[1]);
			expect(serialized.rules[0]).to.include({ id: 'points', operator: 'greater', value: 10 });
			builder.destroy();
			obj.container.remove();
			settings.testFilters_presets[0].rules = serialized;
			filters.filters_addContainer(heading, 'Test');
			obj = filters.esgst.testFiltersPopup;
			builder = obj.builder;
			expect(JSON.parse(JSON.stringify(obj.rules_save))).to.deep.equal(serialized);

			const restoredGroup = builder.model.root.rules[1];
			restoredGroup.$el.children('.rules-group-header').find('[data-not=group]').trigger('click');
			expect(obj.rules_save.rules[1].not).to.equal(false);
			restoredGroup.rules[0].$el.find('[data-resume=rule]').trigger('click');
			expect(obj.rules_save.rules[1].rules[0]).not.to.have.property('data');

			const pointsNode = builder.model.root.rules[0].$el[0];
			const sortable = window.interact(pointsNode);
			sortable.fire({ type: 'dragstart', target: pointsNode });
			sortable.fire({
				type: 'dragend',
				target: pointsNode,
				dropzone: true,
				relatedTarget: restoredGroup.rules[0].$el[0],
			});
			expect(obj.rules_save.rules).to.have.length(1);
			expect(obj.rules_save.rules[0].rules.map((entry) => entry.id)).to.deep.equal([
				'name',
				'points',
			]);
		} finally {
			if (builder) {
				builder.destroy();
			}
			fixture.remove();
			settingsStub.restore();
		}
	});
});
