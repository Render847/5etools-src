import {BuilderBase} from "./makebrew-builder-base.js";
import {BuilderUi} from "./makebrew-builderui.js";

// ---- Static lookup tables --------------------------------------------

const _TYPE_WONDROUS = "__W__"; // sentinel: no `type`, but sets wondrous:true

const _ITEM_TYPES = [
	{abv: "",          name: "(None)"},
	{abv: _TYPE_WONDROUS, name: "Wondrous Item"},
	{abv: "M",         name: "Melee Weapon"},
	{abv: "R",    name: "Ranged Weapon"},
	{abv: "A",    name: "Ammunition"},
	{abv: "LA",   name: "Light Armor"},
	{abv: "MA",   name: "Medium Armor"},
	{abv: "HA",   name: "Heavy Armor"},
	{abv: "S",    name: "Shield"},
	{abv: "P",    name: "Potion"},
	{abv: "SC",   name: "Scroll"},
	{abv: "RD",   name: "Rod"},
	{abv: "RG",   name: "Ring"},
	{abv: "WD",   name: "Wand"},
	{abv: "SCF",  name: "Spellcasting Focus"},
	{abv: "AT",   name: "Artisan's Tools"},
	{abv: "INS",  name: "Instrument"},
	{abv: "GS",   name: "Gaming Set"},
	{abv: "T",    name: "Tool"},
	{abv: "G",    name: "Adventuring Gear"},
	{abv: "MNT",  name: "Mount"},
	{abv: "VEH",  name: "Vehicle (Land)"},
	{abv: "SHP",  name: "Vehicle (Water)"},
	{abv: "OTH",  name: "Other"},
];

const _WEAPON_TYPE_ABVS = new Set(["M", "R", "A"]);
const _ARMOR_TYPE_ABVS  = new Set(["LA", "MA", "HA"]);
const _SHIELD_TYPE_ABVS = new Set(["S"]);
const _MOUNT_TYPE_ABVS  = new Set(["MNT"]);

const _ITEM_RARITIES = [
	"none", "common", "uncommon", "rare", "very rare", "legendary", "artifact", "varies", "unknown",
];

// Sorted alphabetically by full name
const _DAMAGE_TYPES = Object.entries(Parser.DMGTYPE_JSON_TO_FULL)
	.sort((a, b) => SortUtil.ascSort(a[1], b[1]))
	.map(([abv, name]) => ({abv, name: name.charAt(0).toUpperCase() + name.slice(1)}));

const _WEAPON_PROPS = [
	{uid: "2H", label: "Two-Handed"},
	{uid: "A",  label: "Ammunition"},
	{uid: "F",  label: "Finesse"},
	{uid: "H",  label: "Heavy"},
	{uid: "L",  label: "Light"},
	{uid: "LD", label: "Loading"},
	{uid: "R",  label: "Reach"},
	{uid: "S",  label: "Special"},
	{uid: "T",  label: "Thrown"},
	{uid: "V",  label: "Versatile"},
];

const _BONUS_VALS = ["", "+1", "+2", "+3", "+4", "+5"];

const _RECHARGE_VALS = [
	{v: "dawn",     label: "Dawn"},
	{v: "dusk",     label: "Dusk"},
	{v: "midnight", label: "Midnight"},
	{v: "restLong", label: "Long Rest"},
	{v: "special",  label: "Special"},
];

// ---- Builder ---------------------------------------------------------

export class ItemBuilder extends BuilderBase {
	constructor () {
		super({
			prop: "item",
			pFnGetFluff: Renderer.item.pGetFluff.bind(Renderer.item),
		});

		this._renderOutputDebounced = MiscUtil.debounce(() => this._renderOutput(), 50);

		// Section wrappers used to show/hide conditional fields
		this._wrpWeaponStats = null;
		this._wrpArmorStats  = null;
		this._wrpShieldStats = null;
		this._wrpMountStats  = null;
		this._rowRange       = null;
		this._selTypeCached  = null;
	}

	// -- Lifecycle --

	_renderInputImpl () {
		this._doCreateProxies();
		this._doBindHeaderElements();
		this._renderInputMain();
	}

	renderOutput () { this._renderOutputDebounced(); }

	doHandleSourcesAdd () { /* items have no source-list sub-props */ }

	setStateFromLoaded (state) {
		if (!state?.s || !state?.m) return;
		this._doResetProxies();
		if (!state.s.uniqueId) state.s.uniqueId = CryptUtil.uid();
		this.__state = state.s;
		this.__meta = state.m;
	}

	async pHandleClickLoadExisting () {
		const result = await SearchWidget.pGetUserItemSearch();
		if (!result) return;
		const item = MiscUtil.copy(await DataLoader.pCacheAndGet(result.page, result.source, result.hash));
		return this.pHandleLoadExistingData(item);
	}

	async pHandleLoadExistingData (item, opts) {
		opts = opts || {};

		item.name   = `${item.name} (Copy)`;
		item.source = this._ui.source;

		// Strip computed/render fields and non-applicable meta fields
		DataUtil.cleanJson(item, {isDeleteUniqueId: true});
		for (const k of ["srd", "srd52", "basicRules", "basicRules2024", "reprintedAs"])
			delete item[k];

		const meta = {...(opts.meta || {}), ...this._getInitialMetaState({nameOriginal: item.name, isModified: true})};
		this.setStateFromLoaded({s: item, m: meta});
		this.renderInput();
		this.renderOutput();
	}

	async _pInit () {
		await Renderer.item.pPopulatePropertyAndTypeReference();
	}

	_getInitialState () {
		return {
			...super._getInitialState(),
			name:    "New Item",
			source:  this._ui ? this._ui.source : "",
			rarity:  "uncommon",
			wondrous: true,
			entries: [],
		};
	}

	// -- Input rendering --

	_renderInputMain () {
		this._sourcesCache = MiscUtil.copy(this._ui.allSources);
		const wrp = this._ui.wrpInput.empty();

		const cb = MiscUtil.debounce(() => {
			this.renderOutput();
			this.doUiSave();
			this._meta.isModified = true;
		}, 33);
		this._cbCache = cb;

		this._resetTabs({tabGroup: "input"});

		const tabOpts = {hasBorder: true, hasBackground: true};
		const tabs = this._renderTabs(
			[
				new TabUiUtil.TabMeta({...tabOpts, name: "Info"}),
				new TabUiUtil.TabMeta({...tabOpts, name: "Stats"}),
				new TabUiUtil.TabMeta({...tabOpts, name: "Bonuses"}),
				new TabUiUtil.TabMeta({...tabOpts, name: "Text"}),
			],
			{tabGroup: "input", cbTabChange: this.doUiSave.bind(this)},
		);
		const [infoTab, statsTab, bonusesTab, textTab] = tabs;
		this._tabInfoMeta  = infoTab;
		this._tabStatsMeta = statsTab;
		ee`<div class="ve-flex-v-center ve-w-100 ve-no-shrink ve-ui-tab__wrp-tab-heads--border">${tabs.map(it => it.btnTab)}</div>`.appendTo(wrp);
		tabs.forEach(it => it.wrpTab.appendTo(wrp));

		this._buildInfoTab(infoTab.wrpTab, cb);
		this._buildStatsTab(statsTab.wrpTab, cb);
		this._buildBonusesTab(bonusesTab.wrpTab, cb);
		this._buildTextTab(textTab.wrpTab, cb);
	}

	// -- Info tab --

	_buildInfoTab (wrp, cb) {
		BuilderUi.getStateIptString("Name", cb, this._state, {nullable: false}, "name").appendTo(wrp);
		this._selSource = this.getSourceInput(cb).appendTo(wrp);
		BuilderUi.getStateIptString("Page", cb, this._state, {}, "page").appendTo(wrp);

		// Type — drives conditional stat sections
		this._buildTypeInput(wrp, cb);

		// Rarity
		BuilderUi.getStateIptEnum(
			"Rarity", cb, this._state,
			{nullable: false, vals: _ITEM_RARITIES, fnDisplay: v => v.toTitleCase()},
			"rarity",
		).appendTo(wrp);

		// Tier (minor / major)
		BuilderUi.getStateIptEnum(
			"Tier", cb, this._state,
			{nullable: true, vals: ["minor", "major"], fnDisplay: v => v.toTitleCase()},
			"tier",
		).appendTo(wrp);

		// Requires Attunement
		this._buildAttunementInput(wrp, cb);

		// Weight / Value
		this._buildWeightInput(wrp, cb);
		this._buildValueInput(wrp, cb);

		// Charges / Recharge
		this._buildChargesInput(wrp, cb);

		// Curse / Sentient
		this._buildCheckboxRow("Cursed", wrp, cb, "curse");
		this._buildCheckboxRow("Sentient", wrp, cb, "sentient");
	}

	_buildTypeInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Type", {isRow: true});

		// Full list is stored in typesAll; type/typeAlt/wondrous are synced for render compat.
		const getTypesFromState = () => {
			if (this._state.typesAll?.length) return [...this._state.typesAll];
			// backward-compat: seed from legacy fields on first load
			const out = [];
			if (this._state.wondrous) out.push(_TYPE_WONDROUS);
			if (this._state.type)    out.push(this._state.type);
			if (this._state.typeAlt) out.push(this._state.typeAlt);
			return out.length ? out : [""];
		};

		const writeTypesToState = (arr) => {
			const nonEmpty = arr.filter(Boolean);
			if (nonEmpty.length) this._state.typesAll = nonEmpty;
			else delete this._state.typesAll;
			// Sync the render-layer fields
			delete this._state.wondrous;
			delete this._state.type;
			delete this._state.typeAlt;
			const nonWondrous = nonEmpty.filter(v => v !== _TYPE_WONDROUS);
			if (nonEmpty.includes(_TYPE_WONDROUS)) this._state.wondrous = true;
			if (nonWondrous[0]) this._state.type    = nonWondrous[0];
			if (nonWondrous[1]) this._state.typeAlt = nonWondrous[1];
		};

		const wrpRows = ee`<div class="ve-flex-col ve-w-100"></div>`.appendTo(rowInner);
		const addBtn  = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mt-1">+ Add Type</button>`;

		// Local array is the UI source of truth; state is only updated when a real value is chosen.
		let currentTypes = getTypesFromState();

		const rebuildAllRows = () => {
			wrpRows.empty();
			const showRemove = currentTypes.length > 1;

			currentTypes.forEach((typeVal, ix) => {
				const taken = new Set(currentTypes.filter((_, j) => j !== ix).filter(Boolean));

				const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal ve-mr-1">
					${_ITEM_TYPES.filter(t => !taken.has(t.abv)).map(t => `<option value="${t.abv}">${t.name}</option>`).join("")}
				</select>`
					.val(typeVal || "")
					.onn("change", () => {
						currentTypes[ix] = sel.val();
						writeTypesToState(currentTypes);
						this._refreshConditionalStats();
						cb();
					});

				const btnRemove = ee`<button class="ve-btn ve-btn-xs ve-btn-danger ve-ml-1 ${showRemove ? "" : "ve-hidden"}" title="Remove type"><span class="glyphicon glyphicon-trash"></span></button>`
					.onn("click", () => {
						currentTypes.splice(ix, 1);
						writeTypesToState(currentTypes);
						this._refreshConditionalStats();
						rebuildAllRows();
						cb();
					});

				ee`<div class="ve-flex ve-flex-v-center ve-mb-1">${sel}${btnRemove}</div>`.appendTo(wrpRows);
			});

			addBtn.appendTo(wrpRows);
		};

		addBtn.onn("click", () => {
			currentTypes.push("");
			rebuildAllRows();
		});

		rebuildAllRows();
		row.appendTo(wrp);
	}

	_buildCheckboxRow (label, wrp, cb, prop) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple(label, {isRow: true});
		const input = ee`<input type="checkbox">`
			.prop("checked", !!this._state[prop])
			.onn("change", () => {
				if (input.prop("checked")) this._state[prop] = true;
				else delete this._state[prop];
				cb();
			});
		rowInner.appends(input);
		row.appendTo(wrp);
	}

	_buildAttunementInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Requires Attunement", {isRow: true});

		const isCustomString = typeof this._state.reqAttune === "string" && this._state.reqAttune !== "optional";

		const iptText = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-ml-2 ${isCustomString ? "" : "ve-hidden"}" placeholder='e.g. "by a spellcaster"'>`
			.val(isCustomString ? this._state.reqAttune : "")
			.onn("change", () => {
				this._state.reqAttune = iptText.val().trim() || true;
				cb();
			});

		const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal">
			<option value="no">No</option>
			<option value="yes">Yes</option>
			<option value="optional">Optional</option>
			<option value="text">Yes, with condition...</option>
		</select>`.onn("change", () => {
			const mode = sel.val();
			iptText.toggleVe(mode === "text");
			if (mode === "no")            { delete this._state.reqAttune; cb(); }
			else if (mode === "yes")      { this._state.reqAttune = true; cb(); }
			else if (mode === "optional") { this._state.reqAttune = "optional"; cb(); }
			// "text" mode: show input but wait for user to type before updating state
		});

		if (!this._state.reqAttune)                    sel.val("no");
		else if (this._state.reqAttune === true)        sel.val("yes");
		else if (this._state.reqAttune === "optional")  sel.val("optional");
		else                                            sel.val("text");

		sel.appendTo(rowInner);
		iptText.appendTo(rowInner);
		row.appendTo(wrp);
	}

	_buildWeightInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Weight", {isRow: true});
		const ipt = ee`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="lbs">`
			.val(this._state.weight != null ? this._state.weight : "")
			.onn("change", () => {
				const v = parseFloat(ipt.val());
				if (isNaN(v)) delete this._state.weight;
				else this._state.weight = v;
				cb();
			});
		ipt.appendTo(rowInner);
		ee`<span class="ve-muted ve-ml-2 ve-no-shrink" style="font-size:.85em">lb.</span>`.appendTo(rowInner);
		row.appendTo(wrp);
	}

	_buildValueInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Value", {isRow: true});
		// Stored as cp internally; show as gp
		const ipt = ee`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="gp">`
			.val(this._state.value != null ? this._state.value / 100 : "")
			.onn("change", () => {
				const v = parseFloat(ipt.val());
				if (isNaN(v)) delete this._state.value;
				else this._state.value = Math.round(v * 100);
				cb();
			});
		ipt.appendTo(rowInner);
		ee`<span class="ve-muted ve-ml-2 ve-no-shrink" style="font-size:.85em">gp</span>`.appendTo(rowInner);
		row.appendTo(wrp);
	}

	_buildChargesInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Charges", {isRow: true});

		const iptCharges = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-2" placeholder="e.g. 10" style="max-width:80px">`
			.val(this._state.charges != null ? this._state.charges : "")
			.onn("change", () => doUpdate());

		const selRecharge = ee`<select class="ve-form-control ve-input-xs form-control--minimal">
			<option value="">(No Recharge)</option>
			${_RECHARGE_VALS.map(r => `<option value="${r.v}">${r.label}</option>`).join("")}
		</select>`
			.val(this._state.recharge || "")
			.onn("change", () => doUpdate());

		const doUpdate = () => {
			const n = parseInt(iptCharges.val());
			if (isNaN(n)) delete this._state.charges;
			else this._state.charges = n;

			const r = selRecharge.val();
			if (r) this._state.recharge = r;
			else delete this._state.recharge;

			cb();
		};

		ee`<span class="ve-muted ve-mr-2 ve-no-shrink" style="font-size:.85em">Count</span>`.appendTo(rowInner);
		iptCharges.appendTo(rowInner);
		ee`<span class="ve-muted ve-mr-2 ve-no-shrink" style="font-size:.85em">Recharge</span>`.appendTo(rowInner);
		selRecharge.appendTo(rowInner);
		row.appendTo(wrp);
	}

	// -- Stats tab --

	_buildStatsTab (wrp, cb) {
		this._wrpWeaponStats = ee`<div class="ve-flex-col"></div>`.appendTo(wrp);
		this._wrpArmorStats  = ee`<div class="ve-flex-col"></div>`.appendTo(wrp);
		this._wrpShieldStats = ee`<div class="ve-flex-col"></div>`.appendTo(wrp);
		this._wrpMountStats  = ee`<div class="ve-flex-col"></div>`.appendTo(wrp);

		this._buildWeaponStatsSection(this._wrpWeaponStats, cb);
		this._buildArmorStatsSection(this._wrpArmorStats, cb);
		this._buildShieldStatsSection(this._wrpShieldStats, cb);
		this._buildMountStatsSection(this._wrpMountStats, cb);

		this._refreshConditionalStats();
	}

	_refreshConditionalStats () {
		const allTypeAbvs = (this._state.typesAll || [this._state.type, this._state.typeAlt])
			.filter(v => v && v !== _TYPE_WONDROUS)
			.map(v => v.split("|")[0]);
		const isWeapon = allTypeAbvs.some(a => _WEAPON_TYPE_ABVS.has(a));
		const isArmor  = allTypeAbvs.some(a => _ARMOR_TYPE_ABVS.has(a));
		const isShield = allTypeAbvs.some(a => _SHIELD_TYPE_ABVS.has(a));
		const isMount  = allTypeAbvs.some(a => _MOUNT_TYPE_ABVS.has(a));

		if (this._wrpWeaponStats) this._wrpWeaponStats.toggleVe(isWeapon);
		if (this._wrpArmorStats)  this._wrpArmorStats.toggleVe(isArmor);
		if (this._wrpShieldStats) this._wrpShieldStats.toggleVe(isShield);
		if (this._wrpMountStats)  this._wrpMountStats.toggleVe(isMount);

		this._refreshRangeVisibility();

		if (this._tabStatsMeta) {
			const hasStats = isWeapon || isArmor || isShield || isMount;
			this._tabStatsMeta.btnTab.toggleVe(hasStats);
			if (!hasStats && this._tabInfoMeta && this._tabStatsMeta.btnTab.hasClass("ve-active")) {
				this._tabInfoMeta.btnTab.trigger("click");
			}
		}
	}

	_refreshRangeVisibility () {
		if (!this._rowRange) return;
		const allTypeAbvs = (this._state.typesAll || [this._state.type, this._state.typeAlt])
			.filter(v => v && v !== _TYPE_WONDROUS)
			.map(v => v.split("|")[0]);
		const isRanged  = allTypeAbvs.includes("R");
		const hasThrown = (this._state.property || []).map(p => p.split("|")[0]).includes("T");
		this._rowRange.toggleVe(isRanged || hasThrown);
	}

	_buildWeaponStatsSection (wrp, cb) {
		ee`<div class="mkbru__row ve-mb-2 ve-bold" style="font-size:.85em;text-transform:uppercase;letter-spacing:.05em">Weapon</div>`.appendTo(wrp);

		// Primary damage
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Damage", {isRow: true});

			const iptDmg1 = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-2" placeholder="e.g. 1d8" style="max-width:80px">`
				.val(this._state.dmg1 || "")
				.onn("change", () => doUpdate());

			const selDmgType = ee`<select class="ve-form-control ve-input-xs form-control--minimal">
				<option value="">—</option>
				${_DAMAGE_TYPES.map(d => `<option value="${d.abv}">${d.name}</option>`).join("")}
			</select>`
				.val(this._state.dmgType || "")
				.onn("change", () => doUpdate());

			const doUpdate = () => {
				const d = iptDmg1.val().trim();
				if (d) this._state.dmg1 = d; else delete this._state.dmg1;
				const t = selDmgType.val();
				if (t) this._state.dmgType = t; else delete this._state.dmgType;
				cb();
			};

			iptDmg1.appendTo(rowInner);
			selDmgType.appendTo(rowInner);
			row.appendTo(wrp);
		}

		// Versatile / secondary damage — hidden unless Versatile property is checked
		let rowVersatileDmg;
		{
			const curPropsForInit = new Set((this._state.property || []).map(p => p.split("|")[0]));
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Versatile Damage", {isRow: true});
			rowVersatileDmg = row;
			const ipt = ee`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="e.g. 1d10">`
				.val(this._state.dmg2 || "")
				.onn("change", () => {
					const v = ipt.val().trim();
					if (v) this._state.dmg2 = v; else delete this._state.dmg2;
					cb();
				});
			rowInner.appends(ipt);
			row.appendTo(wrp);
			row.toggleVe(curPropsForInit.has("V"));
		}

		// Range — hidden unless item is a ranged weapon or has Thrown property
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Range", {isRow: true});
			this._rowRange = row;
			const ipt = ee`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder='e.g. "20/60"'>`
				.val(this._state.range || "")
				.onn("change", () => {
					const v = ipt.val().trim();
					if (v) this._state.range = v; else delete this._state.range;
					cb();
				});
			ipt.appendTo(rowInner);
			ee`<span class="ve-muted ve-ml-2 ve-no-shrink" style="font-size:.85em">ft.</span>`.appendTo(rowInner);
			row.appendTo(wrp);
		}

		// Mastery
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Mastery", {isRow: true});

			const masteries = Object.values(Renderer.item._masteryMap)
				.flatMap(byName => Object.values(byName))
				.sort((a, b) => SortUtil.ascSortLower(a.name, b.name));

			const curMastery = (this._state.mastery || [])[0] || "";

			const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:120px">
				<option value="">(none)</option>
				${masteries.map(m => `<option value="${m.name.toLowerCase()}|${m.source.toLowerCase()}">${m.name}</option>`).join("")}
			</select>`
				.val(curMastery)
				.onn("change", () => {
					const v = sel.val();
					if (v) this._state.mastery = [v];
					else delete this._state.mastery;
					cb();
				});

			sel.appendTo(rowInner);
			row.appendTo(wrp);
		}

		// Properties (checkboxes)
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Properties", {isRow: false});

			const curProps = new Set(
				(this._state.property || []).map(p => p.split("|")[0]),
			);

			const checkboxes = _WEAPON_PROPS.map(({uid, label}) => {
				const cb_ = ee`<input type="checkbox" class="ve-mr-1">`
					.prop("checked", curProps.has(uid))
					.onn("change", () => {
						if (uid === "V") rowVersatileDmg.toggleVe(cb_.prop("checked"));
						doUpdate();
						if (uid === "T") this._refreshRangeVisibility();
					});
				return {uid, cb_,
					ele: ee`<label class="ve-flex-v-center ve-mr-3 ve-mb-1" style="font-weight:normal;cursor:pointer">${cb_}<span>${label}</span></label>`,
				};
			});

			const doUpdate = () => {
				const selected = checkboxes.filter(c => c.cb_.prop("checked")).map(c => c.uid);
				if (selected.length) this._state.property = selected;
				else delete this._state.property;
				cb();
			};

			rowInner.style.flexWrap = "wrap";
			checkboxes.forEach(c => rowInner.appends(c.ele));
			row.appendTo(wrp);
		}
	}

	_buildMountStatsSection (wrp, cb) {
		ee`<div class="mkbru__row ve-mb-2 ve-bold" style="font-size:.85em;text-transform:uppercase;letter-spacing:.05em">Mount</div>`.appendTo(wrp);

		// Speed
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Speed", {isRow: true});
			const ipt = ee`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="e.g. 60" style="max-width:80px">`
				.val(this._state.speed != null ? this._state.speed : "")
				.onn("change", () => {
					const v = parseInt(ipt.val());
					if (isNaN(v)) delete this._state.speed;
					else this._state.speed = v;
					cb();
				});
			ipt.appendTo(rowInner);
			ee`<span class="ve-muted ve-ml-2 ve-no-shrink" style="font-size:.85em">ft.</span>`.appendTo(rowInner);
			row.appendTo(wrp);
		}

		// Carrying Capacity
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Carrying Capacity", {isRow: true});
			const ipt = ee`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="e.g. 450" style="max-width:80px">`
				.val(this._state.carryingCapacity != null ? this._state.carryingCapacity : "")
				.onn("change", () => {
					const v = parseInt(ipt.val());
					if (isNaN(v)) delete this._state.carryingCapacity;
					else this._state.carryingCapacity = v;
					cb();
				});
			ipt.appendTo(rowInner);
			ee`<span class="ve-muted ve-ml-2 ve-no-shrink" style="font-size:.85em">lb.</span>`.appendTo(rowInner);
			row.appendTo(wrp);
		}
	}

	_buildShieldStatsSection (wrp, cb) {
		ee`<div class="mkbru__row ve-mb-2 ve-bold" style="font-size:.85em;text-transform:uppercase;letter-spacing:.05em">Shield</div>`.appendTo(wrp);

		const [row, rowInner] = BuilderUi.getLabelledRowTuple("AC Bonus", {isRow: true});
		const ipt = ee`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="e.g. 2" style="max-width:80px">`
			.val(this._state.ac != null ? this._state.ac : "")
			.onn("change", () => {
				const v = parseInt(ipt.val());
				if (isNaN(v)) delete this._state.ac;
				else this._state.ac = v;
				cb();
			});
		rowInner.appends(ipt);
		row.appendTo(wrp);
	}

	_buildArmorStatsSection (wrp, cb) {
		ee`<div class="mkbru__row ve-mb-2 ve-bold" style="font-size:.85em;text-transform:uppercase;letter-spacing:.05em">Armor</div>`.appendTo(wrp);

		// AC
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Armor Class", {isRow: true});
			const ipt = ee`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="e.g. 14" style="max-width:80px">`
				.val(this._state.ac != null ? this._state.ac : "")
				.onn("change", () => {
					const v = parseInt(ipt.val());
					if (isNaN(v)) delete this._state.ac;
					else this._state.ac = v;
					cb();
				});
			rowInner.appends(ipt);
			row.appendTo(wrp);
		}

		// Max Dex Bonus (Medium Armor)
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Max Dex Bonus", {isRow: true,
				title: "Leave blank for full Dex bonus (light armor). Set to 0 for no Dex (heavy). Typically 2 for medium armor."});
			const ipt = ee`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="blank = full Dex" style="max-width:120px">`
				.val(this._state.dexterityMax != null ? this._state.dexterityMax : "")
				.onn("change", () => {
					const v = ipt.val().trim();
					if (v === "") delete this._state.dexterityMax;
					else this._state.dexterityMax = parseInt(v) || 0;
					cb();
				});
			rowInner.appends(ipt);
			row.appendTo(wrp);
		}

		// Strength Requirement
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Strength Req.", {isRow: true});
			const ipt = ee`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder='e.g. "15"' style="max-width:80px">`
				.val(this._state.strength || "")
				.onn("change", () => {
					const v = ipt.val().trim();
					if (v) this._state.strength = v; else delete this._state.strength;
					cb();
				});
			rowInner.appends(ipt);
			row.appendTo(wrp);
		}

		// Stealth Disadvantage
		this._buildCheckboxRow("Stealth Disadvantage", wrp, cb, "stealth");
	}

	// -- Bonuses tab --

	_buildBonusesTab (wrp, cb) {
		ee`<div class="mkbru__row ve-mb-2 ve-muted" style="font-size:.85em">Bonus values are strings such as "+1", "+2", "+3".</div>`.appendTo(wrp);

		this._buildWeaponBonusField(wrp, cb);
		this._buildBonusField("Armor Class",       wrp, cb, "bonusAc");
		this._buildBonusField("Spell Attack",      wrp, cb, "bonusSpellAttack");
		this._buildBonusField("Spell Save DC",     wrp, cb, "bonusSpellSaveDc");
		this._buildBonusField("Saving Throw",      wrp, cb, "bonusSavingThrow");
		this._buildBonusField("Ability Check",     wrp, cb, "bonusAbilityCheck");
		this._buildBonusField("Proficiency Bonus", wrp, cb, "bonusProficiencyBonus");
	}

	_buildWeaponBonusField (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Weapon Bonus", {isRow: true});

		const existingBonus = this._state.bonusWeapon || this._state.bonusWeaponAttack || this._state.bonusWeaponDamage || "";
		const hasAny = !!(this._state.bonusWeapon || this._state.bonusWeaponAttack || this._state.bonusWeaponDamage);
		const initAtk = !hasAny || !!(this._state.bonusWeapon || this._state.bonusWeaponAttack);
		const initDmg = !hasAny || !!(this._state.bonusWeapon || this._state.bonusWeaponDamage);

		const doUpdate = () => {
			const bonus = sel.val();
			const isAtk = cbAtk.prop("checked");
			const isDmg = cbDmg.prop("checked");
			delete this._state.bonusWeapon;
			delete this._state.bonusWeaponAttack;
			delete this._state.bonusWeaponDamage;
			if (bonus && (isAtk || isDmg)) {
				if (isAtk && isDmg)  this._state.bonusWeapon = bonus;
				else if (isAtk)      this._state.bonusWeaponAttack = bonus;
				else                 this._state.bonusWeaponDamage = bonus;
			}
			cb();
		};

		const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:90px">
			${_BONUS_VALS.map(v => `<option value="${v || ""}">${v || "(none)"}</option>`).join("")}
		</select>`
			.val(existingBonus)
			.onn("change", () => doUpdate());

		const cbAtk = ee`<input type="checkbox" class="ve-mr-1">`
			.prop("checked", initAtk)
			.onn("change", () => doUpdate());

		const cbDmg = ee`<input type="checkbox" class="ve-mr-1">`
			.prop("checked", initDmg)
			.onn("change", () => doUpdate());

		sel.appendTo(rowInner);
		ee`<label class="ve-flex-v-center ve-ml-3" style="font-weight:normal;cursor:pointer">${cbAtk}<span>Attack</span></label>`.appendTo(rowInner);
		ee`<label class="ve-flex-v-center ve-ml-2" style="font-weight:normal;cursor:pointer">${cbDmg}<span>Damage</span></label>`.appendTo(rowInner);
		row.appendTo(wrp);
	}

	_buildBonusField (label, wrp, cb, prop) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple(label, {isRow: true});
		const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:90px">
			${_BONUS_VALS.map(v => `<option value="${v || ""}">${v || "(none)"}</option>`).join("")}
		</select>`
			.val(this._state[prop] || "")
			.onn("change", () => {
				const v = sel.val();
				if (v) this._state[prop] = v; else delete this._state[prop];
				cb();
			});
		rowInner.appends(sel);
		row.appendTo(wrp);
	}

	// -- Text tab --

	_buildTextTab (wrp, cb) {
		BuilderUi.getStateIptEntries(
			"Text", cb, this._state,
			{fnPostProcess: BuilderUi.fnPostProcessDice},
			"entries",
		).appendTo(wrp);
	}

	// -- Output rendering --

	_renderOutput () {
		const wrp = this._ui.wrpOutput.empty();

		this._resetTabs({tabGroup: "output"});

		const tabs = this._renderTabs(
			[
				new TabUiUtil.TabMeta({name: "Item"}),
				new TabUiUtil.TabMeta({name: "Info"}),
				new TabUiUtil.TabMeta({name: "Images"}),
				new TabUiUtil.TabMeta({name: "Data"}),
			],
			{tabGroup: "output", cbTabChange: this.doUiSave.bind(this)},
		);
		const [itemTab, infoTab, imageTab, dataTab] = tabs;
		ee`<div class="ve-flex-v-center ve-w-100 ve-no-shrink">${tabs.map(it => it.btnTab)}</div>`.appendTo(wrp);
		tabs.forEach(it => it.wrpTab.appendTo(wrp));

		// Item preview
		const tblItem = ee`<table class="ve-w-100 ve-stats"></table>`.appendTo(itemTab.wrpTab);
		const procItem = DataUtil.cleanJson(MiscUtil.copy(this._state), {isDeleteUniqueId: false});
		Renderer.item.enhanceItem(procItem);
		tblItem.appends(Renderer.utils.getBorderTr());
		tblItem.appends(Renderer.item.getCompactRenderedString(procItem));
		tblItem.appends(Renderer.utils.getPageTr(procItem));
		tblItem.appends(Renderer.utils.getBorderTr());

		// Fluff — Info
		const tblInfo = ee`<table class="ve-w-100 ve-stats"></table>`.appendTo(infoTab.wrpTab);
		Renderer.utils.pBuildFluffTab({
			isImageTab: false,
			wrpContent: tblInfo,
			entity: this._state,
			pFnGetFluff: Renderer.item.pGetFluff,
		});

		// Fluff — Images
		const tblImages = ee`<table class="ve-w-100 ve-stats"></table>`.appendTo(imageTab.wrpTab);
		Renderer.utils.pBuildFluffTab({
			isImageTab: true,
			wrpContent: tblImages,
			entity: this._state,
			pFnGetFluff: Renderer.item.pGetFluff,
		});

		// Raw JSON
		const tblData = ee`<table class="ve-w-100 ve-stats ve-stats--book mkbru__wrp-output-tab-data"></table>`.appendTo(dataTab.wrpTab);
		const asCode = Renderer.get().render({
			type: "entries",
			entries: [{
				type: "code",
				name: "Data",
				preformatted: JSON.stringify(DataUtil.cleanJson(MiscUtil.copy(this._state)), null, "\t"),
			}],
		});
		tblData.appends(Renderer.utils.getBorderTr());
		tblData.appends(`<tr><td colspan="6">${asCode}</td></tr>`);
		tblData.appends(Renderer.utils.getBorderTr());
	}
}
