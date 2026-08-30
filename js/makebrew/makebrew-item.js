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

const _WEAPON_CATEGORIES = [
	{v: "simple",  label: "Simple"},
	{v: "martial", label: "Martial"},
];

const _AGE_VALS = [
	{v: "renaissance", label: "Renaissance"},
	{v: "modern",      label: "Modern"},
	{v: "futuristic",  label: "Futuristic"},
];

const _SCF_TYPES = [
	{v: "arcane", label: "Arcane (Sorcerer/Warlock/Wizard)"},
	{v: "druid",  label: "Druid"},
	{v: "holy",   label: "Holy (Cleric/Paladin)"},
];

const _POISON_TYPES = [
	{v: "ingested", label: "Ingested"},
	{v: "injury",   label: "Injury"},
	{v: "inhaled",  label: "Inhaled"},
	{v: "contact",  label: "Contact"},
];

const _MISC_TAGS = [
	{v: "CNS",   label: "Consumable"},
	{v: "CF\\W", label: "Creates Food/Water"},
	{v: "TT",    label: "Trinket Table"},
];

const _CONDITIONS = [
	"blinded", "charmed", "deafened", "disease", "exhaustion",
	"frightened", "grappled", "incapacitated", "invisible",
	"paralyzed", "petrified", "poisoned", "prone", "restrained",
	"stunned", "unconscious",
];

const _LOOT_TABLES = "ABCDEFGHI".split("").map(l => `Magic Item Table ${l}`);

const _SPELLCASTER_CLASSES = [
	"Artificer", "Bard", "Cleric", "Druid", "Paladin",
	"Ranger", "Sorcerer", "Warlock", "Wizard",
];

const _ABILITIES_FULL = {str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma"};
const _ABILITIES      = ["str", "dex", "con", "int", "wis", "cha"];

const _SPEED_TYPES = ["walk", "fly", "swim", "climb", "burrow"];

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

		// Lazy modal filters (shared across tab rebuilds)
		this._modalFilterItems = null;
		this._modalFilterSpells = null;
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
		const [selected] = (await new ModalFilterItems({namespace: "makebrew.item.copy", isRadio: true}).pGetUserSelection()) ?? [];
		if (!selected) return;
		const item = MiscUtil.copy(await DataLoader.pCacheAndGet(UrlUtil.PG_ITEMS, selected.values.sourceJson, selected.values.hash));
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
			rarity:  "",
			wondrous: true,
			entries: [],
		};
	}

	// -- Input rendering --

	_renderInputMain () {
		this._sourcesCache = MiscUtil.copy(this._ui.allSources);
		const wrp = this._ui.wrpInput.vee.empty();

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
				new TabUiUtil.TabMeta({...tabOpts, name: "Traits"}),
				new TabUiUtil.TabMeta({...tabOpts, name: "Links"}),
				new TabUiUtil.TabMeta({...tabOpts, name: "Text"}),
			],
			{tabGroup: "input", cbTabChange: this.doUiSave.bind(this)},
		);
		const [infoTab, statsTab, bonusesTab, traitsTab, linksTab, textTab] = tabs;
		this._tabInfoMeta  = infoTab;
		this._tabStatsMeta = statsTab;
		veT`<div class="ve-flex-v-center ve-w-100 ve-no-shrink ve-ui-tab__wrp-tab-heads--border">${tabs.map(it => it.btnTab)}</div>`.vee.appendTo(wrp);
		tabs.forEach(it => it.wrpTab.vee.appendTo(wrp));

		this._buildInfoTab(infoTab.wrpTab, cb);
		this._buildStatsTab(statsTab.wrpTab, cb);
		this._buildBonusesTab(bonusesTab.wrpTab, cb);
		this._buildTraitsTab(traitsTab.wrpTab, cb);
		this._buildLinksTab(linksTab.wrpTab, cb);
		this._buildTextTab(textTab.wrpTab, cb);
	}

	// =========================================================================
	// -- Info tab --
	// =========================================================================

	_buildInfoTab (wrp, cb) {
		BuilderUi.getStateIptString("Name", cb, this._state, {nullable: false}, "name").vee.appendTo(wrp);
		this._selSource = this.getSourceInput(cb).vee.appendTo(wrp);
		BuilderUi.getStateIptString("Page", cb, this._state, {}, "page").vee.appendTo(wrp);

		// Type — drives conditional stat sections
		this._buildTypeInput(wrp, cb);

		// Rarity
		BuilderUi.getStateIptEnum(
			"Rarity", cb, this._state,
			{nullable: false, vals: _ITEM_RARITIES, fnDisplay: v => v.toTitleCase()},
			"rarity",
		).vee.appendTo(wrp);

		// Tier (minor / major)
		BuilderUi.getStateIptEnum(
			"Tier", cb, this._state,
			{nullable: true, vals: ["minor", "major"], fnDisplay: v => v.toTitleCase()},
			"tier",
		).vee.appendTo(wrp);

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

		const wrpRows = veT`<div class="ve-flex-col ve-w-100"></div>`.vee.appendTo(rowInner);
		const addBtn  = veT`<button class="ve-btn ve-btn-xs ve-btn-default ve-mt-1">+ Add Type</button>`;

		// Local array is the UI source of truth; state is only updated when a real value is chosen.
		let currentTypes = getTypesFromState();

		const rebuildAllRows = () => {
			wrpRows.vee.empty();
			const showRemove = currentTypes.length > 1;

			currentTypes.forEach((typeVal, ix) => {
				const taken = new Set(currentTypes.filter((_, j) => j !== ix).filter(Boolean));

				const sel = veT`<select class="ve-form-control ve-input-xs form-control--minimal ve-mr-1">
					${_ITEM_TYPES.filter(t => !taken.has(t.abv)).map(t => `<option value="${t.abv}">${t.name}</option>`).join("")}
				</select>`
					.vee.val(typeVal || "")
					.vee.onn("change", () => {
						currentTypes[ix] = sel.vee.val();
						writeTypesToState(currentTypes);
						this._refreshConditionalStats();
						cb();
					});

				const btnRemove = veT`<button class="ve-btn ve-btn-xs ve-btn-danger ve-ml-1 ${showRemove ? "" : "ve-hidden"}" title="Remove type"><span class="glyphicon glyphicon-trash"></span></button>`
					.vee.onn("click", () => {
						currentTypes.splice(ix, 1);
						writeTypesToState(currentTypes);
						this._refreshConditionalStats();
						rebuildAllRows();
						cb();
					});

				veT`<div class="ve-flex ve-flex-v-center ve-mb-1">${sel}${btnRemove}</div>`.vee.appendTo(wrpRows);
			});

			addBtn.vee.appendTo(wrpRows);
		};

		addBtn.vee.onn("click", () => {
			currentTypes.push("");
			rebuildAllRows();
		});

		rebuildAllRows();
		row.vee.appendTo(wrp);
	}

	_buildCheckboxRow (label, wrp, cb, prop) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple(label, {isRow: true});
		const input = veT`<input type="checkbox">`
			.prop("checked", !!this._state[prop])
			.vee.onn("change", () => {
				if (input.prop("checked")) this._state[prop] = true;
				else delete this._state[prop];
				cb();
			});
		rowInner.vee.appends(input);
		row.vee.appendTo(wrp);
	}

	_buildAttunementInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Requires Attunement", {isRow: true});

		const isCustomString = typeof this._state.reqAttune === "string" && this._state.reqAttune !== "optional";

		const iptText = veT`<input class="ve-form-control ve-input-xs form-control--minimal ve-ml-2 ${isCustomString ? "" : "ve-hidden"}" placeholder='e.g. "by a spellcaster"'>`
			.vee.val(isCustomString ? this._state.reqAttune : "")
			.vee.onn("change", () => {
				this._state.reqAttune = iptText.vee.val().trim() || true;
				cb();
			});

		const sel = veT`<select class="ve-form-control ve-input-xs form-control--minimal">
			<option value="no">No</option>
			<option value="yes">Yes</option>
			<option value="optional">Optional</option>
			<option value="text">Yes, with condition...</option>
		</select>`.vee.onn("change", () => {
			const mode = sel.vee.val();
			iptText.vee.toggle(mode === "text");
			if (mode === "no")            { delete this._state.reqAttune; cb(); }
			else if (mode === "yes")      { this._state.reqAttune = true; cb(); }
			else if (mode === "optional") { this._state.reqAttune = "optional"; cb(); }
			// "text" mode: show input but wait for user to type before updating state
		});

		if (!this._state.reqAttune)                    sel.vee.val("no");
		else if (this._state.reqAttune === true)        sel.vee.val("yes");
		else if (this._state.reqAttune === "optional")  sel.vee.val("optional");
		else                                            sel.vee.val("text");

		sel.vee.appendTo(rowInner);
		iptText.vee.appendTo(rowInner);
		row.vee.appendTo(wrp);
	}

	_buildWeightInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Weight", {isRow: true});
		const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="lbs">`
			.vee.val(this._state.weight != null ? this._state.weight : "")
			.vee.onn("change", () => {
				const v = parseFloat(ipt.vee.val());
				if (isNaN(v)) delete this._state.weight;
				else this._state.weight = v;
				cb();
			});
		ipt.vee.appendTo(rowInner);
		veT`<span class="ve-muted ve-ml-2 ve-no-shrink" style="font-size:.85em">lb.</span>`.vee.appendTo(rowInner);
		row.vee.appendTo(wrp);
	}

	_buildValueInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Value", {isRow: true});
		// Stored as cp internally; show as gp
		const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="gp">`
			.vee.val(this._state.value != null ? this._state.value / 100 : "")
			.vee.onn("change", () => {
				const v = parseFloat(ipt.vee.val());
				if (isNaN(v)) delete this._state.value;
				else this._state.value = Math.round(v * 100);
				cb();
			});
		ipt.vee.appendTo(rowInner);
		veT`<span class="ve-muted ve-ml-2 ve-no-shrink" style="font-size:.85em">gp</span>`.vee.appendTo(rowInner);
		row.vee.appendTo(wrp);
	}

	_buildChargesInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Charges", {isRow: true});

		const iptCharges = veT`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-2" placeholder="e.g. 10" style="max-width:80px">`
			.vee.val(this._state.charges != null ? this._state.charges : "")
			.vee.onn("change", () => doUpdate());

		const selRecharge = veT`<select class="ve-form-control ve-input-xs form-control--minimal">
			<option value="">(No Recharge)</option>
			${_RECHARGE_VALS.map(r => `<option value="${r.v}">${r.label}</option>`).join("")}
		</select>`
			.vee.val(this._state.recharge || "")
			.vee.onn("change", () => doUpdate());

		const doUpdate = () => {
			const n = parseInt(iptCharges.vee.val());
			if (isNaN(n)) delete this._state.charges;
			else this._state.charges = n;

			const r = selRecharge.vee.val();
			if (r) this._state.recharge = r;
			else delete this._state.recharge;

			cb();
		};

		veT`<span class="ve-muted ve-mr-2 ve-no-shrink" style="font-size:.85em">Count</span>`.vee.appendTo(rowInner);
		iptCharges.vee.appendTo(rowInner);
		veT`<span class="ve-muted ve-mr-2 ve-no-shrink" style="font-size:.85em">Recharge</span>`.vee.appendTo(rowInner);
		selRecharge.vee.appendTo(rowInner);
		row.vee.appendTo(wrp);
	}

	// =========================================================================
	// -- Stats tab --
	// =========================================================================

	_buildStatsTab (wrp, cb) {
		this._wrpWeaponStats = veT`<div class="ve-flex-col"></div>`.vee.appendTo(wrp);
		this._wrpArmorStats  = veT`<div class="ve-flex-col"></div>`.vee.appendTo(wrp);
		this._wrpShieldStats = veT`<div class="ve-flex-col"></div>`.vee.appendTo(wrp);
		this._wrpMountStats  = veT`<div class="ve-flex-col"></div>`.vee.appendTo(wrp);

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

		if (this._wrpWeaponStats) this._wrpWeaponStats.vee.toggle(isWeapon);
		if (this._wrpArmorStats)  this._wrpArmorStats.vee.toggle(isArmor);
		if (this._wrpShieldStats) this._wrpShieldStats.vee.toggle(isShield);
		if (this._wrpMountStats)  this._wrpMountStats.vee.toggle(isMount);

		this._refreshRangeVisibility();

		if (this._tabStatsMeta) {
			const hasStats = isWeapon || isArmor || isShield || isMount;
			this._tabStatsMeta.btnTab.vee.toggle(hasStats);
			if (!hasStats && this._tabInfoMeta && this._tabStatsMeta.btnTab.vee.hasClass("ve-active")) {
				this._tabInfoMeta.btnTab.vee.trigger("click");
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
		this._rowRange.vee.toggle(isRanged || hasThrown);
	}

	_buildWeaponStatsSection (wrp, cb) {
		veT`<div class="mkbru__row ve-mb-2 ve-bold" style="font-size:.85em;text-transform:uppercase;letter-spacing:.05em">Weapon</div>`.vee.appendTo(wrp);

		// Primary damage
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Damage", {isRow: true});

			const iptDmg1 = veT`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-2" placeholder="e.g. 1d8" style="max-width:80px">`
				.vee.val(this._state.dmg1 || "")
				.vee.onn("change", () => doUpdate());

			const selDmgType = veT`<select class="ve-form-control ve-input-xs form-control--minimal">
				<option value="">—</option>
				${_DAMAGE_TYPES.map(d => `<option value="${d.abv}">${d.name}</option>`).join("")}
			</select>`
				.vee.val(this._state.dmgType || "")
				.vee.onn("change", () => doUpdate());

			const doUpdate = () => {
				const d = iptDmg1.vee.val().trim();
				if (d) this._state.dmg1 = d; else delete this._state.dmg1;
				const t = selDmgType.vee.val();
				if (t) this._state.dmgType = t; else delete this._state.dmgType;
				cb();
			};

			iptDmg1.vee.appendTo(rowInner);
			selDmgType.vee.appendTo(rowInner);
			row.vee.appendTo(wrp);
		}

		// Versatile / secondary damage — hidden unless Versatile property is checked
		let rowVersatileDmg;
		{
			const curPropsForInit = new Set((this._state.property || []).map(p => p.split("|")[0]));
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Versatile Damage", {isRow: true});
			rowVersatileDmg = row;
			const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="e.g. 1d10">`
				.vee.val(this._state.dmg2 || "")
				.vee.onn("change", () => {
					const v = ipt.vee.val().trim();
					if (v) this._state.dmg2 = v; else delete this._state.dmg2;
					cb();
				});
			rowInner.vee.appends(ipt);
			row.vee.appendTo(wrp);
			row.vee.toggle(curPropsForInit.has("V"));
		}

		// Range — hidden unless item is a ranged weapon or has Thrown property
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Range", {isRow: true});
			this._rowRange = row;
			const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder='e.g. "20/60"'>`
				.vee.val(this._state.range || "")
				.vee.onn("change", () => {
					const v = ipt.vee.val().trim();
					if (v) this._state.range = v; else delete this._state.range;
					cb();
				});
			ipt.vee.appendTo(rowInner);
			veT`<span class="ve-muted ve-ml-2 ve-no-shrink" style="font-size:.85em">ft.</span>`.vee.appendTo(rowInner);
			row.vee.appendTo(wrp);
		}

		// Mastery
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Mastery", {isRow: true});

			const masteries = Object.values(Renderer.item._masteryMap)
				.flatMap(byName => Object.values(byName))
				.sort((a, b) => SortUtil.ascSortLower(a.name, b.name));

			const curMastery = (this._state.mastery || [])[0] || "";

			const sel = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:120px">
				<option value="">(none)</option>
				${masteries.map(m => `<option value="${m.name.toLowerCase()}|${m.source.toLowerCase()}">${m.name}</option>`).join("")}
			</select>`
				.vee.val(curMastery)
				.vee.onn("change", () => {
					const v = sel.vee.val();
					if (v) this._state.mastery = [v];
					else delete this._state.mastery;
					cb();
				});

			sel.vee.appendTo(rowInner);
			row.vee.appendTo(wrp);
		}

		// Properties (checkboxes)
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Properties", {isRow: false});

			const curProps = new Set(
				(this._state.property || []).map(p => p.split("|")[0]),
			);

			const checkboxes = _WEAPON_PROPS.map(({uid, label}) => {
				const cb_ = veT`<input type="checkbox" class="ve-mr-1">`
					.prop("checked", curProps.has(uid))
					.vee.onn("change", () => {
						if (uid === "V") rowVersatileDmg.vee.toggle(cb_.prop("checked"));
						doUpdate();
						if (uid === "T") this._refreshRangeVisibility();
					});
				return {uid, cb_,
					ele: veT`<label class="ve-flex-v-center ve-mr-3 ve-mb-1" style="font-weight:normal;cursor:pointer">${cb_}<span>${label}</span></label>`,
				};
			});

			const doUpdate = () => {
				const selected = checkboxes.filter(c => c.cb_.prop("checked")).map(c => c.uid);
				if (selected.length) this._state.property = selected;
				else delete this._state.property;
				cb();
			};

			rowInner.style.flexWrap = "wrap";
			checkboxes.forEach(c => rowInner.vee.appends(c.ele));
			row.vee.appendTo(wrp);
		}
	}

	_buildMountStatsSection (wrp, cb) {
		veT`<div class="mkbru__row ve-mb-2 ve-bold" style="font-size:.85em;text-transform:uppercase;letter-spacing:.05em">Mount</div>`.vee.appendTo(wrp);

		// Speed
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Speed", {isRow: true});
			const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="e.g. 60" style="max-width:80px">`
				.vee.val(this._state.speed != null ? this._state.speed : "")
				.vee.onn("change", () => {
					const v = parseInt(ipt.vee.val());
					if (isNaN(v)) delete this._state.speed;
					else this._state.speed = v;
					cb();
				});
			ipt.vee.appendTo(rowInner);
			veT`<span class="ve-muted ve-ml-2 ve-no-shrink" style="font-size:.85em">ft.</span>`.vee.appendTo(rowInner);
			row.vee.appendTo(wrp);
		}

		// Carrying Capacity
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Carrying Capacity", {isRow: true});
			const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="e.g. 450" style="max-width:80px">`
				.vee.val(this._state.carryingCapacity != null ? this._state.carryingCapacity : "")
				.vee.onn("change", () => {
					const v = parseInt(ipt.vee.val());
					if (isNaN(v)) delete this._state.carryingCapacity;
					else this._state.carryingCapacity = v;
					cb();
				});
			ipt.vee.appendTo(rowInner);
			veT`<span class="ve-muted ve-ml-2 ve-no-shrink" style="font-size:.85em">lb.</span>`.vee.appendTo(rowInner);
			row.vee.appendTo(wrp);
		}
	}

	_buildShieldStatsSection (wrp, cb) {
		veT`<div class="mkbru__row ve-mb-2 ve-bold" style="font-size:.85em;text-transform:uppercase;letter-spacing:.05em">Shield</div>`.vee.appendTo(wrp);

		const [row, rowInner] = BuilderUi.getLabelledRowTuple("AC Bonus", {isRow: true});
		const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="e.g. 2" style="max-width:80px">`
			.vee.val(this._state.ac != null ? this._state.ac : "")
			.vee.onn("change", () => {
				const v = parseInt(ipt.vee.val());
				if (isNaN(v)) delete this._state.ac;
				else this._state.ac = v;
				cb();
			});
		rowInner.vee.appends(ipt);
		row.vee.appendTo(wrp);
	}

	_buildArmorStatsSection (wrp, cb) {
		veT`<div class="mkbru__row ve-mb-2 ve-bold" style="font-size:.85em;text-transform:uppercase;letter-spacing:.05em">Armor</div>`.vee.appendTo(wrp);

		// AC
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Armor Class", {isRow: true});
			const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="e.g. 14" style="max-width:80px">`
				.vee.val(this._state.ac != null ? this._state.ac : "")
				.vee.onn("change", () => {
					const v = parseInt(ipt.vee.val());
					if (isNaN(v)) delete this._state.ac;
					else this._state.ac = v;
					cb();
				});
			rowInner.vee.appends(ipt);
			row.vee.appendTo(wrp);
		}

		// Max Dex Bonus (Medium Armor)
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Max Dex Bonus", {isRow: true,
				title: "Leave blank for full Dex bonus (light armor). Set to 0 for no Dex (heavy). Typically 2 for medium armor."});
			const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="blank = full Dex" style="max-width:120px">`
				.vee.val(this._state.dexterityMax != null ? this._state.dexterityMax : "")
				.vee.onn("change", () => {
					const v = ipt.vee.val().trim();
					if (v === "") delete this._state.dexterityMax;
					else this._state.dexterityMax = parseInt(v) || 0;
					cb();
				});
			rowInner.vee.appends(ipt);
			row.vee.appendTo(wrp);
		}

		// Strength Requirement
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Strength Req.", {isRow: true});
			const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder='e.g. "15"' style="max-width:80px">`
				.vee.val(this._state.strength || "")
				.vee.onn("change", () => {
					const v = ipt.vee.val().trim();
					if (v) this._state.strength = v; else delete this._state.strength;
					cb();
				});
			rowInner.vee.appends(ipt);
			row.vee.appendTo(wrp);
		}

		// Stealth Disadvantage
		this._buildCheckboxRow("Stealth Disadvantage", wrp, cb, "stealth");
	}

	// =========================================================================
	// -- Bonuses tab --
	// =========================================================================

	_buildBonusesTab (wrp, cb) {
		veT`<div class="mkbru__row ve-mb-2 ve-muted" style="font-size:.85em">Bonus values are strings such as "+1", "+2", "+3".</div>`.vee.appendTo(wrp);

		this._buildSectionHeader("Weapon", wrp);
		this._buildWeaponBonusField(wrp, cb);
		this._buildBonusField("Weapon Crit Damage", wrp, cb, "bonusWeaponCritDamage");

		this._buildSectionHeader("Defenses", wrp);
		this._buildBonusField("Armor Class",  wrp, cb, "bonusAc");
		this._buildBonusField("Saving Throw", wrp, cb, "bonusSavingThrow");

		this._buildSectionHeader("Spells", wrp);
		this._buildBonusField("Spell Damage",  wrp, cb, "bonusSpellDamage");
		this._buildBonusField("Spell Attack",  wrp, cb, "bonusSpellAttack");
		this._buildBonusField("Spell Save DC", wrp, cb, "bonusSpellSaveDc");

		this._buildSectionHeader("Checks", wrp);
		this._buildBonusField("Ability Check",     wrp, cb, "bonusAbilityCheck");
		this._buildBonusField("Proficiency Bonus", wrp, cb, "bonusProficiencyBonus");

		this._buildSectionHeader("Ability Score Adjustment", wrp);
		this._buildAbilityInput(wrp, cb);

		this._buildSectionHeader("Speed Modification", wrp);
		this._buildModifySpeedInput(wrp, cb);

		this._buildSectionHeader("Damage Defenses", wrp);
		this._buildDamageDefenseInput("Vulnerability", wrp, cb, "vulnerable");
		this._buildDamageDefenseInput("Resistance",    wrp, cb, "resist");
		this._buildDamageDefenseInput("Immunity",      wrp, cb, "immune");
		this._buildConditionImmuneInput(wrp, cb);
	}

	_buildWeaponBonusField (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Weapon Bonus", {isRow: true});

		const existingBonus = this._state.bonusWeapon || this._state.bonusWeaponAttack || this._state.bonusWeaponDamage || "";
		const hasAny = !!(this._state.bonusWeapon || this._state.bonusWeaponAttack || this._state.bonusWeaponDamage);
		const initAtk = !hasAny || !!(this._state.bonusWeapon || this._state.bonusWeaponAttack);
		const initDmg = !hasAny || !!(this._state.bonusWeapon || this._state.bonusWeaponDamage);

		const doUpdate = () => {
			const bonus = sel.vee.val();
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

		const sel = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:90px">
			${_BONUS_VALS.map(v => `<option value="${v || ""}">${v || "(none)"}</option>`).join("")}
		</select>`
			.vee.val(existingBonus)
			.vee.onn("change", () => doUpdate());

		const cbAtk = veT`<input type="checkbox" class="ve-mr-1">`
			.prop("checked", initAtk)
			.vee.onn("change", () => doUpdate());

		const cbDmg = veT`<input type="checkbox" class="ve-mr-1">`
			.prop("checked", initDmg)
			.vee.onn("change", () => doUpdate());

		sel.vee.appendTo(rowInner);
		veT`<label class="ve-flex-v-center ve-ml-3" style="font-weight:normal;cursor:pointer">${cbAtk}<span>Attack</span></label>`.vee.appendTo(rowInner);
		veT`<label class="ve-flex-v-center ve-ml-2" style="font-weight:normal;cursor:pointer">${cbDmg}<span>Damage</span></label>`.vee.appendTo(rowInner);
		row.vee.appendTo(wrp);
	}

	_buildBonusField (label, wrp, cb, prop) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple(label, {isRow: true});
		const sel = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:90px">
			${_BONUS_VALS.map(v => `<option value="${v || ""}">${v || "(none)"}</option>`).join("")}
		</select>`
			.vee.val(this._state[prop] || "")
			.vee.onn("change", () => {
				const v = sel.vee.val();
				if (v) this._state[prop] = v; else delete this._state[prop];
				cb();
			});
		rowInner.vee.appends(sel);
		row.vee.appendTo(wrp);
	}

	_buildAbilityInput (wrp, cb) {
		// ability can be: {str:2, dex:-1} (modifiers) or {static:{con:19}} (set to value)
		// We support: mode select + 6 inputs for modifier mode, or ability+value for static mode
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Adjust", {isRow: true});

		const getMode = () => {
			if (!this._state.ability) return "none";
			if (this._state.ability.static) return "static";
			return "modifier";
		};

		const wrpInputs = veT`<div class="ve-flex-col ve-ml-2" style="flex:1"></div>`.vee.appendTo(rowInner);

		const selMode = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:100px">
			<option value="none">(None)</option>
			<option value="modifier">Modifier</option>
			<option value="static">Set to Value</option>
		</select>`
			.vee.val(getMode())
			.vee.appendTo(rowInner);

		const buildInputs = () => {
			wrpInputs.vee.empty();
			const mode = selMode.vee.val();
			if (mode === "none") { delete this._state.ability; cb(); return; }

			if (mode === "modifier") {
				const cur = this._state.ability && !this._state.ability.static ? this._state.ability : {};
				const row2 = veT`<div class="ve-flex ve-flex-wrap ve-mt-1" style="gap:4px"></div>`.vee.appendTo(wrpInputs);
				const inputs = {};
				_ABILITIES.forEach(abl => {
					const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal ve-text-center" placeholder="0" style="width:48px" title="${_ABILITIES_FULL[abl]}">`
						.vee.val(cur[abl] != null ? cur[abl] : "")
						.vee.onn("change", () => {
							const obj = {};
							_ABILITIES.forEach(a => {
								const v = parseInt(inputs[a].vee.val());
								if (!isNaN(v) && v !== 0) obj[a] = v;
							});
							if (Object.keys(obj).length) this._state.ability = obj;
							else delete this._state.ability;
							cb();
						});
					inputs[abl] = ipt;
					veT`<div class="ve-flex-col ve-flex-vh-center" style="gap:2px">
						<span style="font-size:.75em;font-weight:bold">${abl.toUpperCase()}</span>
					</div>`.vee.appends(ipt).vee.appendTo(row2);
				});
			} else if (mode === "static") {
				const cur = this._state.ability?.static || {};
				const firstAbl = Object.keys(cur)[0] || "str";
				const firstVal = cur[firstAbl] ?? "";
				const row2 = veT`<div class="ve-flex-v-center ve-mt-1" style="gap:4px"></div>`.vee.appendTo(wrpInputs);

				const selAbl = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:110px">
					${_ABILITIES.map(a => `<option value="${a}">${_ABILITIES_FULL[a]}</option>`).join("")}
				</select>`.vee.val(firstAbl).vee.appendTo(row2);

				const iptVal = veT`<input class="ve-form-control ve-input-xs form-control--minimal ve-text-center" placeholder="e.g. 19" style="width:60px">`
					.vee.val(firstVal).vee.appendTo(row2);

				const doUpdate = () => {
					const abl = selAbl.vee.val();
					const v = parseInt(iptVal.vee.val());
					if (!isNaN(v)) this._state.ability = {static: {[abl]: v}};
					else delete this._state.ability;
					cb();
				};
				selAbl.vee.onn("change", doUpdate);
				iptVal.vee.onn("change", doUpdate);
			}
		};

		selMode.vee.onn("change", buildInputs);
		buildInputs();
		row.vee.appendTo(wrp);
	}

	_buildModifySpeedInput (wrp, cb) {
		// modifySpeed supports: {bonus:{walk:10}}, {static:{walk:30}}, {multiply:{walk:2}}, {equal:{fly:"walk"}}
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Modify Speed", {isRow: true});

		const getMode = () => {
			if (!this._state.modifySpeed) return "none";
			return Object.keys(this._state.modifySpeed)[0] || "none";
		};

		const wrpInputs = veT`<div class="ve-flex ve-flex-wrap ve-mt-1 ve-ml-2" style="gap:4px;flex:1"></div>`.vee.appendTo(rowInner);

		const selMode = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:110px">
			<option value="none">(None)</option>
			<option value="bonus">Bonus</option>
			<option value="static">Set Static</option>
			<option value="multiply">Multiply</option>
			<option value="equal">Equal To</option>
		</select>`.vee.val(getMode()).vee.appendTo(rowInner);

		const buildInputs = () => {
			wrpInputs.vee.empty();
			const mode = selMode.vee.val();
			if (mode === "none") { delete this._state.modifySpeed; cb(); return; }

			const curInner = (this._state.modifySpeed || {})[mode] || {};

			if (mode === "bonus" || mode === "static") {
				// speed type select + number input
				const speedType = Object.keys(curInner)[0] || "walk";
				const speedVal  = curInner[speedType] ?? "";

				const selSpeed = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:80px">
					<option value="*">All</option>
					${_SPEED_TYPES.map(s => `<option value="${s}">${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join("")}
				</select>`.vee.val(speedType).vee.appendTo(wrpInputs);

				const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="ft." style="width:60px">`
					.vee.val(speedVal).vee.appendTo(wrpInputs);
				veT`<span class="ve-muted ve-no-shrink" style="font-size:.85em">ft.</span>`.vee.appendTo(wrpInputs);

				const doUpdate = () => {
					const v = parseInt(ipt.vee.val());
					if (!isNaN(v)) this._state.modifySpeed = {[mode]: {[selSpeed.vee.val()]: v}};
					else delete this._state.modifySpeed;
					cb();
				};
				selSpeed.vee.onn("change", doUpdate);
				ipt.vee.onn("change", doUpdate);

			} else if (mode === "multiply") {
				const speedType = Object.keys(curInner)[0] || "walk";
				const speedVal  = curInner[speedType] ?? "";

				const selSpeed = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:80px">
					${_SPEED_TYPES.map(s => `<option value="${s}">${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join("")}
				</select>`.vee.val(speedType).vee.appendTo(wrpInputs);

				const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="e.g. 2" style="width:60px">`
					.vee.val(speedVal).vee.appendTo(wrpInputs);
				veT`<span class="ve-muted ve-no-shrink" style="font-size:.85em">×</span>`.vee.appendTo(wrpInputs);

				const doUpdate = () => {
					const v = parseFloat(ipt.vee.val());
					if (!isNaN(v)) this._state.modifySpeed = {multiply: {[selSpeed.vee.val()]: v}};
					else delete this._state.modifySpeed;
					cb();
				};
				selSpeed.vee.onn("change", doUpdate);
				ipt.vee.onn("change", doUpdate);

			} else if (mode === "equal") {
				// equal:{fly:"walk"} means set fly speed = walk speed
				const targetSpeed = Object.keys(curInner)[0] || "fly";
				const sourceSpeed = curInner[targetSpeed] || "walk";

				const selTarget = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:80px">
					${_SPEED_TYPES.map(s => `<option value="${s}">${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join("")}
				</select>`.vee.val(targetSpeed).vee.appendTo(wrpInputs);

				veT`<span class="ve-muted ve-no-shrink" style="font-size:.85em">= </span>`.vee.appendTo(wrpInputs);

				const selSource = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:80px">
					${_SPEED_TYPES.map(s => `<option value="${s}">${s.charAt(0).toUpperCase()+s.slice(1)}</option>`).join("")}
				</select>`.vee.val(sourceSpeed).vee.appendTo(wrpInputs);

				const doUpdate = () => {
					this._state.modifySpeed = {equal: {[selTarget.vee.val()]: selSource.vee.val()}};
					cb();
				};
				selTarget.vee.onn("change", doUpdate);
				selSource.vee.onn("change", doUpdate);
			}
		};

		selMode.vee.onn("change", buildInputs);
		buildInputs();
		row.vee.appendTo(wrp);
	}

	_buildDamageDefenseInput (label, wrp, cb, prop) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple(label, {isRow: false});
		const cur = new Set(this._state[prop] || []);

		const checkboxes = _DAMAGE_TYPES.map(({abv, name}) => {
			const chk = veT`<input type="checkbox" class="ve-mr-1">`
				.prop("checked", cur.has(abv))
				.vee.onn("change", () => {
					const selected = checkboxes.filter(c => c.chk.prop("checked")).map(c => c.abv);
					if (selected.length) this._state[prop] = selected;
					else delete this._state[prop];
					cb();
				});
			return {abv, chk,
				ele: veT`<label class="ve-flex-v-center" style="font-weight:normal;cursor:pointer;font-size:.85em">${chk}<span>${name}</span></label>`,
			};
		});

		const grid = veT`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:2px 4px;width:100%"></div>`;
		checkboxes.forEach(c => grid.vee.appends(c.ele));
		rowInner.vee.appends(grid);
		row.vee.appendTo(wrp);
	}

	_buildConditionImmuneInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Condition Immunity", {isRow: false});
		const cur = new Set(this._state.conditionImmune || []);

		const checkboxes = _CONDITIONS.map(cond => {
			const chk = veT`<input type="checkbox" class="ve-mr-1">`
				.prop("checked", cur.has(cond))
				.vee.onn("change", () => {
					const selected = checkboxes.filter(c => c.chk.prop("checked")).map(c => c.cond);
					if (selected.length) this._state.conditionImmune = selected;
					else delete this._state.conditionImmune;
					cb();
				});
			return {cond, chk,
				ele: veT`<label class="ve-flex-v-center" style="font-weight:normal;cursor:pointer;font-size:.85em">${chk}<span>${cond.charAt(0).toUpperCase() + cond.slice(1)}</span></label>`,
			};
		});

		const grid = veT`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:2px 4px;width:100%"></div>`;
		checkboxes.forEach(c => grid.vee.appends(c.ele));
		rowInner.vee.appends(grid);
		row.vee.appendTo(wrp);
	}

	// =========================================================================
	// -- Traits tab --
	// =========================================================================

	_buildTraitsTab (wrp, cb) {
		this._buildSectionHeader("Type Flags", wrp);
		this._buildTypeFlagsSection(wrp, cb);

		this._buildSectionHeader("Spellcasting Focus", wrp);
		this._buildFocusSection(wrp, cb);

		this._buildSectionHeader("Miscellaneous Flags", wrp);
		this._buildMiscFlagsSection(wrp, cb);

		this._buildSectionHeader("Light Emission", wrp);
		this._buildLightInput(wrp, cb);

		this._buildSectionHeader("Pack Contents", wrp);
		this._buildPackContentsInput(wrp, cb);

		this._buildSectionHeader("Attunement Conditions", wrp);
		this._buildAttuneTagsInput(wrp, cb);
	}

	_buildTypeFlagsSection (wrp, cb) {
		// weaponCategory: simple/martial
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Weapon Category", {isRow: true});
			const sel = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:110px">
				<option value="">(None)</option>
				${_WEAPON_CATEGORIES.map(c => `<option value="${c.v}">${c.label}</option>`).join("")}
			</select>`
				.vee.val(this._state.weaponCategory || "")
				.vee.onn("change", () => {
					const v = sel.vee.val();
					if (v) this._state.weaponCategory = v; else delete this._state.weaponCategory;
					cb();
				});
			rowInner.vee.appends(sel);
			row.vee.appendTo(wrp);
		}

		// age: renaissance/modern/futuristic
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Age", {isRow: true});
			const sel = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:130px">
				<option value="">(None)</option>
				${_AGE_VALS.map(a => `<option value="${a.v}">${a.label}</option>`).join("")}
			</select>`
				.vee.val(this._state.age || "")
				.vee.onn("change", () => {
					const v = sel.vee.val();
					if (v) this._state.age = v; else delete this._state.age;
					cb();
				});
			rowInner.vee.appends(sel);
			row.vee.appendTo(wrp);
		}

		// boolean type flags
		this._buildCheckboxRow("Firearm",  wrp, cb, "firearm");
		this._buildCheckboxRow("Staff",    wrp, cb, "staff");
		this._buildCheckboxRow("Tattoo",   wrp, cb, "tattoo");
		this._buildCheckboxRow("Ammo",     wrp, cb, "ammo");
		this._buildCheckboxRow("Poison",   wrp, cb, "poison");
	}

	_buildFocusSection (wrp, cb) {
		// focus: true (all classes) or array of class names
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Focus For", {isRow: false});
			const cur = this._state.focus;
			const isAll = cur === true;
			const curArr = Array.isArray(cur) ? cur : [];

			const wrpClass = veT`<div class="ve-flex ve-flex-wrap" style="gap:4px"></div>`.vee.appendTo(rowInner);

			const cbAll = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", isAll);
			veT`<label class="ve-flex-v-center ve-w-100 ve-mb-1" style="font-weight:bold;cursor:pointer">${cbAll}<span>All Spellcasters</span></label>`.vee.appendTo(rowInner);

			const classChecks = _SPELLCASTER_CLASSES.map(cls => {
				const chk = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", curArr.includes(cls));
				return {cls, chk,
					ele: veT`<label class="ve-flex-v-center ve-mr-2" style="font-weight:normal;cursor:pointer;font-size:.85em">${chk}<span>${cls}</span></label>`.vee.appendTo(wrpClass),
				};
			});

			const doUpdate = () => {
				if (cbAll.prop("checked")) {
					this._state.focus = true;
				} else {
					const selected = classChecks.filter(c => c.chk.prop("checked")).map(c => c.cls);
					if (selected.length) this._state.focus = selected;
					else delete this._state.focus;
				}
				cb();
			};
			cbAll.vee.onn("change", doUpdate);
			classChecks.forEach(c => c.chk.vee.onn("change", doUpdate));
			row.vee.appendTo(wrp);
		}

		// scfType
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("SCF Subtype", {isRow: true,
				title: "For Spellcasting Focus type items, specifies which spellcasting tradition uses it."});
			const sel = veT`<select class="ve-form-control ve-input-xs form-control--minimal">
				<option value="">(None)</option>
				${_SCF_TYPES.map(t => `<option value="${t.v}">${t.label}</option>`).join("")}
			</select>`
				.vee.val(this._state.scfType || "")
				.vee.onn("change", () => {
					const v = sel.vee.val();
					if (v) this._state.scfType = v; else delete this._state.scfType;
					cb();
				});
			rowInner.vee.appends(sel);
			row.vee.appendTo(wrp);
		}
	}

	_buildMiscFlagsSection (wrp, cb) {
		this._buildCheckboxRow("Grants Proficiency", wrp, cb, "grantsProficiency");
		this._buildCheckboxRow("Grants Language",    wrp, cb, "grantsLanguage");

		// critThreshold: number
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Crit Threshold", {isRow: true,
				title: "The minimum die roll needed to score a critical hit when attacking with this weapon (default 20)."});
			const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="e.g. 19" style="max-width:70px">`
				.vee.val(this._state.critThreshold != null ? this._state.critThreshold : "")
				.vee.onn("change", () => {
					const v = parseInt(ipt.vee.val());
					if (!isNaN(v)) this._state.critThreshold = v;
					else delete this._state.critThreshold;
					cb();
				});
			rowInner.vee.appends(ipt);
			row.vee.appendTo(wrp);
		}

		// miscTags checkboxes
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Misc Tags", {isRow: false});
			const cur = new Set(this._state.miscTags || []);
			const checkboxes = _MISC_TAGS.map(({v, label}) => {
				const chk = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", cur.has(v))
					.vee.onn("change", () => {
						const selected = checkboxes.filter(c => c.chk.prop("checked")).map(c => c.v);
						if (selected.length) this._state.miscTags = selected;
						else delete this._state.miscTags;
						cb();
					});
				return {v, chk, ele: veT`<label class="ve-flex-v-center ve-mr-3" style="font-weight:normal;cursor:pointer">${chk}<span>${label}</span></label>`};
			});
			rowInner.style.flexWrap = "wrap";
			checkboxes.forEach(c => rowInner.vee.appends(c.ele));
			row.vee.appendTo(wrp);
		}

		// poisonTypes checkboxes
		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Poison Types", {isRow: false});
			const cur = new Set(this._state.poisonTypes || []);
			const checkboxes = _POISON_TYPES.map(({v, label}) => {
				const chk = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", cur.has(v))
					.vee.onn("change", () => {
						const selected = checkboxes.filter(c => c.chk.prop("checked")).map(c => c.v);
						if (selected.length) this._state.poisonTypes = selected;
						else delete this._state.poisonTypes;
						cb();
					});
				return {v, chk, ele: veT`<label class="ve-flex-v-center ve-mr-3" style="font-weight:normal;cursor:pointer">${chk}<span>${label}</span></label>`};
			});
			rowInner.style.flexWrap = "wrap";
			checkboxes.forEach(c => rowInner.vee.appends(c.ele));
			row.vee.appendTo(wrp);
		}
	}

	_buildLightInput (wrp, cb) {
		// light: [{bright: N, dim: M}] — single entry array
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Range", {isRow: true});

		const cur = (this._state.light || [])[0] || {};

		const iptBright = veT`<input class="ve-form-control ve-input-xs form-control--minimal ve-text-center" placeholder="—" style="width:54px">`
			.vee.val(cur.bright != null ? cur.bright : "");
		const iptDim = veT`<input class="ve-form-control ve-input-xs form-control--minimal ve-text-center" placeholder="—" style="width:54px">`
			.vee.val(cur.dim != null ? cur.dim : "");

		const doUpdate = () => {
			const bright = parseInt(iptBright.vee.val());
			const dim    = parseInt(iptDim.vee.val());
			const hasBright = !isNaN(bright);
			const hasDim    = !isNaN(dim);
			if (hasBright || hasDim) {
				const entry = {};
				if (hasBright) entry.bright = bright;
				if (hasDim)    entry.dim    = dim;
				this._state.light = [entry];
			} else {
				delete this._state.light;
			}
			cb();
		};
		iptBright.vee.onn("change", doUpdate);
		iptDim.vee.onn("change", doUpdate);

		veT`<span class="ve-muted ve-no-shrink" style="font-size:.85em">Bright</span>`.vee.appendTo(rowInner);
		iptBright.vee.appendTo(rowInner);
		veT`<span class="ve-muted ve-no-shrink ve-ml-2" style="font-size:.85em">ft.&nbsp;&nbsp;Dim</span>`.vee.appendTo(rowInner);
		iptDim.vee.appendTo(rowInner);
		veT`<span class="ve-muted ve-no-shrink ve-ml-1" style="font-size:.85em">ft.</span>`.vee.appendTo(rowInner);
		row.vee.appendTo(wrp);
	}

	_buildPackContentsInput (wrp, cb) {
		// packContents: [{item:"torch|phb", quantity:10}, ...]
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Contents", {isRow: false});

		const wrpRows = veT`<div class="ve-flex-col"></div>`.vee.appendTo(rowInner);
		const rows = [];

		const saveContents = () => {
			const out = rows
				.map(r => {
					const uid = r.uid;
					const qty = parseInt(r.iptQty.vee.val());
					if (!uid) return null;
					return {item: uid, quantity: isNaN(qty) ? 1 : qty};
				})
				.filter(Boolean);
			if (out.length) this._state.packContents = out;
			else delete this._state.packContents;
			cb();
		};

		const addRow = (uid = "", quantity = 1) => {
			const rowEl = veT`<div class="ve-flex-v-center ve-mb-1" style="gap:4px"></div>`.vee.appendTo(wrpRows);
			const rowMeta = {uid, rowEl, iptQty: null};

			const nameSpan = veT`<span class="ve-flex-1 ve-px-1 ve-bold" style="font-size:.85em">${uid || "(none)"}</span>`;

			const iptQty = veT`<input class="ve-form-control ve-input-xs form-control--minimal ve-text-center" type="number" min="1" placeholder="qty" style="width:54px">`
				.vee.val(quantity)
				.vee.onn("change", saveContents);
			rowMeta.iptQty = iptQty;

			veT`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-1" title="Change item">&#x270e;</button>`
				.vee.onn("click", async () => {
					const result = await SearchWidget.pGetUserItemSearch();
					if (!result) return;
					rowMeta.uid = `${result.n}|${result.s}`.toLowerCase();
					nameSpan.vee.txt(rowMeta.uid);
					saveContents();
				}).vee.appendTo(rowEl);

			veT`<button class="ve-btn ve-btn-xs ve-btn-danger" title="Remove"><span class="glyphicon glyphicon-trash"></span></button>`
				.vee.onn("click", () => {
					rows.splice(rows.indexOf(rowMeta), 1);
					rowEl.remove();
					saveContents();
				}).vee.appendTo(rowEl);

			nameSpan.vee.appendTo(rowEl);
			iptQty.vee.appendTo(rowEl);
			rows.push(rowMeta);
		};

		(this._state.packContents || []).forEach(c => addRow(c.item || "", c.quantity || 1));

		veT`<button class="ve-btn ve-btn-xs ve-btn-default ve-mt-1">+ Add Items</button>`
			.vee.onn("click", async () => {
				if (!this._modalFilterItems) {
					this._modalFilterItems = new ModalFilterItems({namespace: "makebrew.item.packContents"});
				}
				const selected = await this._modalFilterItems.pGetUserSelection();
				if (!selected?.length) return;
				selected.forEach(it => addRow(`${it.name}|${it.values.sourceJson}`.toLowerCase(), 1));
				saveContents();
			})
			.vee.appendTo(rowInner);

		row.vee.appendTo(wrp);
	}

	_buildAttuneTagsInput (wrp, cb) {
		// reqAttuneTags: [{class:"wizard"}, {class:"sorcerer"}]
		// Also supports: {spellcasting:true}, {psionics:true}, {alignment:["LG"]}
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Class Requirement", {isRow: false});
		veT`<div class="ve-muted ve-mb-1" style="font-size:.8em">Specify which classes may attune to this item (in addition to the condition above).</div>`.vee.appendTo(rowInner);

		const cur = this._state.reqAttuneTags || [];
		const curClasses = new Set(cur.filter(t => t.class).map(t => t.class.split("|")[0].toLowerCase()));
		const hasSpellcasting = cur.some(t => t.spellcasting);
		const hasPsionics     = cur.some(t => t.psionics);

		const save = () => {
			const tags = [];
			if (cbSpellcasting.prop("checked")) tags.push({spellcasting: true});
			if (cbPsionics.prop("checked"))     tags.push({psionics: true});
			classChecks.filter(c => c.chk.prop("checked")).forEach(c => tags.push({class: c.cls.toLowerCase()}));
			if (tags.length) this._state.reqAttuneTags = tags;
			else delete this._state.reqAttuneTags;
			cb();
		};

		const cbSpellcasting = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", hasSpellcasting).vee.onn("change", save);
		const cbPsionics     = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", hasPsionics).vee.onn("change", save);

		veT`<div class="ve-flex ve-flex-wrap ve-mb-1" style="gap:4px">
		</div>`
			.vee.appends(veT`<label class="ve-flex-v-center ve-mr-3" style="font-weight:normal;cursor:pointer">${cbSpellcasting}<span>Any Spellcaster</span></label>`)
			.vee.appends(veT`<label class="ve-flex-v-center ve-mr-3" style="font-weight:normal;cursor:pointer">${cbPsionics}<span>Psionics</span></label>`)
			.vee.appendTo(rowInner);

		const wrpClasses = veT`<div class="ve-flex ve-flex-wrap" style="gap:4px"></div>`.vee.appendTo(rowInner);
		const ALL_CLASSES = ["Artificer", "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"];
		const classChecks = ALL_CLASSES.map(cls => {
			const chk = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", curClasses.has(cls.toLowerCase())).vee.onn("change", save);
			return {cls, chk, ele: veT`<label class="ve-flex-v-center ve-mr-2" style="font-weight:normal;cursor:pointer;font-size:.85em">${chk}<span>${cls}</span></label>`.vee.appendTo(wrpClasses)};
		});

		// reqAttuneAlt / reqAttuneAltTags (alternate attunement path)
		{
			const [row2, rowInner2] = BuilderUi.getLabelledRowTuple("Alt. Attunement", {isRow: true,
				title: "An alternate attunement path (e.g. \"optional\"). Rare — most items don't need this."});
			const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder='e.g. "optional"'>`
				.vee.val(this._state.reqAttuneAlt || "")
				.vee.onn("change", () => {
					const v = ipt.vee.val().trim();
					if (v === "true") this._state.reqAttuneAlt = true;
					else if (v) this._state.reqAttuneAlt = v;
					else delete this._state.reqAttuneAlt;
					cb();
				});
			rowInner2.vee.appends(ipt);
			row2.vee.appendTo(rowInner);
		}

		row.vee.appendTo(wrp);
	}

	// =========================================================================
	// -- Links tab --
	// =========================================================================

	_buildLinksTab (wrp, cb) {
		this._buildSectionHeader("Base Item", wrp);
		this._buildBaseItemInput(wrp, cb);

		this._buildSectionHeader("Loot Tables", wrp);
		this._buildLootTablesInput(wrp, cb);

		this._buildSectionHeader("Attached Spells", wrp);
		this._buildAttachedSpellsInput(wrp, cb);


	}

	_buildBaseItemInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Base Item", {isRow: true,
			title: "The base item this is a specific variant of (e.g. \"shortsword|phb\")."});

		const nameSpan = veT`<span class="ve-flex-1 ve-px-1" style="font-size:.85em">${this._state.baseItem || "(none selected)"}</span>`
			.vee.toggleClass("ve-muted", !this._state.baseItem)
			.vee.toggleClass("ve-italic", !this._state.baseItem);

		veT`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-1">Browse...</button>`
			.vee.onn("click", async () => {
				const result = await SearchWidget.pGetUserItemSearch();
				if (!result) return;
				this._state.baseItem = `${result.n}|${result.s}`.toLowerCase();

				const hash = UrlUtil.encodeArrayForHash(result.n, result.s);
				const baseItem = await DataLoader.pCacheAndGet(UrlUtil.PG_ITEMS, result.s, hash);
				if (baseItem) {
					for (const f of ["dmg1", "dmgType", "dmg2", "range", "mastery", "property"]) {
						if (baseItem[f] != null) this._state[f] = baseItem[f];
						else delete this._state[f];
					}
					// Sync type fields so the brew item has the correct weapon/armor type
					if (baseItem.type) {
						this._state.typesAll = [baseItem.type];
						this._state.type = baseItem.type;
						delete this._state.wondrous;
						delete this._state.typeAlt;
					}
				}

				this.renderInput();
				this.renderOutput();
			}).vee.appendTo(rowInner);

		veT`<button class="ve-btn ve-btn-xs ve-btn-danger" title="Clear">&times;</button>`
			.vee.onn("click", () => {
				delete this._state.baseItem;
				nameSpan.vee.txt("(none selected)").vee.addClass("ve-muted").vee.addClass("ve-italic");
				cb();
			}).vee.appendTo(rowInner);

		nameSpan.vee.appendTo(rowInner);
		row.vee.appendTo(wrp);
	}

	_buildLootTablesInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Tables", {isRow: false,
			title: "Which DMG magic item loot tables include this item."});
		const cur = new Set(this._state.lootTables || []);

		const checkboxes = _LOOT_TABLES.map(tbl => {
			const letter = tbl.slice(-1);
			const chk = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", cur.has(tbl))
				.vee.onn("change", () => {
					const selected = checkboxes.filter(c => c.chk.prop("checked")).map(c => c.tbl);
					if (selected.length) this._state.lootTables = selected;
					else delete this._state.lootTables;
					cb();
				});
			return {tbl, chk,
				ele: veT`<label class="ve-flex-v-center ve-mr-2" style="font-weight:normal;cursor:pointer;font-size:.85em">${chk}<span>Table ${letter}</span></label>`,
			};
		});

		rowInner.style.flexWrap = "wrap";
		checkboxes.forEach(c => rowInner.vee.appends(c.ele));
		row.vee.appendTo(wrp);
	}

	_buildAttachedSpellsInput (wrp, cb) {
		// Simple array format only: ["fireball", "magic missile"]
		// Complex scheduling format (daily/charges) must be edited in the JSON Data tab.
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Spells", {isRow: false});
		veT`<div class="ve-muted ve-mb-1" style="font-size:.8em">For daily/charges scheduling, edit the JSON Data tab directly.</div>`.vee.appendTo(rowInner);

		const wrpRows = veT`<div class="ve-flex-col"></div>`.vee.appendTo(rowInner);
		const rows = [];

		const saveSpells = () => {
			const vals = rows.map(r => r.name);
			if (vals.length) this._state.attachedSpells = vals;
			else delete this._state.attachedSpells;
			cb();
		};

		const addRow = (name) => {
			const rowEl = veT`<div class="ve-flex-v-center ve-mb-1" style="gap:4px"></div>`.vee.appendTo(wrpRows);
			const rowMeta = {name, rowEl};
			rows.push(rowMeta);
			veT`<button class="ve-btn ve-btn-xs ve-btn-danger ve-no-shrink" title="Remove"><span class="glyphicon glyphicon-trash"></span></button>`
				.vee.onn("click", () => { rows.splice(rows.indexOf(rowMeta), 1); rowEl.remove(); saveSpells(); })
				.vee.appendTo(rowEl);
			veT`<span style="font-size:.85em">${name}</span>`.vee.appendTo(rowEl);
		};

		const raw = this._state.attachedSpells;
		if (Array.isArray(raw)) raw.forEach(s => addRow(s));

		veT`<button class="ve-btn ve-btn-xs ve-btn-default ve-mt-1">+ Add Spells</button>`
			.vee.onn("click", async () => {
				if (!this._modalFilterSpells) {
					this._modalFilterSpells = new ModalFilterSpells({namespace: "makebrew.item.spells"});
				}
				const selected = await this._modalFilterSpells.pGetUserSelection();
				if (!selected?.length) return;
				selected.forEach(it => addRow(it.name.toLowerCase()));
				saveSpells();
			})
			.vee.appendTo(rowInner);

		row.vee.appendTo(wrp);
	}

	_buildStringArrayInput (itemLabel, wrp, cb, prop, placeholder = "") {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("UIDs", {isRow: false});
		const wrpRows = veT`<div class="ve-flex-col"></div>`.vee.appendTo(rowInner);
		const rows = [];

		const save = () => {
			const vals = rows.map(r => r.ipt.vee.val().trim()).filter(Boolean);
			if (vals.length) this._state[prop] = vals;
			else delete this._state[prop];
			cb();
		};

		const addRow = (val = "") => {
			const rowEl = veT`<div class="ve-flex-v-center ve-mb-1" style="gap:4px"></div>`.vee.appendTo(wrpRows);
			const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="${placeholder}" style="flex:1">`
				.vee.val(val).vee.onn("change", save);
			const rowMeta = {ipt, rowEl};
			rows.push(rowMeta);
			veT`<button class="ve-btn ve-btn-xs ve-btn-danger" title="Remove"><span class="glyphicon glyphicon-trash"></span></button>`
				.vee.onn("click", () => { rows.splice(rows.indexOf(rowMeta), 1); rowEl.remove(); save(); })
				.vee.appendTo(rowEl);
			ipt.vee.appendTo(rowEl);
		};

		(this._state[prop] || []).forEach(v => addRow(v));

		veT`<button class="ve-btn ve-btn-xs ve-btn-default ve-mt-1">+ Add ${itemLabel}</button>`
			.vee.onn("click", () => addRow())
			.vee.appendTo(rowInner);

		row.vee.appendTo(wrp);
	}

	// =========================================================================
	// -- Text tab --
	// =========================================================================

	_buildTextTab (wrp, cb) {
		BuilderUi.getStateIptEntries(
			"Text", cb, this._state,
			{fnPostProcess: BuilderUi.fnPostProcessDice},
			"entries",
		).vee.appendTo(wrp);
	}

	// =========================================================================
	// -- Shared helpers --
	// =========================================================================

	_buildSectionHeader (label, wrp) {
		veT`<div class="mkbru__row ve-mt-2 ve-mb-1 ve-bold" style="font-size:.8em;text-transform:uppercase;letter-spacing:.06em;color:var(--col-heading-grey,#888);border-bottom:1px solid var(--col-border-default,#ccc)">${label}</div>`.vee.appendTo(wrp);
	}

	// =========================================================================
	// -- Output rendering --
	// =========================================================================

	_renderOutput () {
		const wrp = this._ui.wrpOutput.vee.empty();

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
		veT`<div class="ve-flex-v-center ve-w-100 ve-no-shrink">${tabs.map(it => it.btnTab)}</div>`.vee.appendTo(wrp);
		tabs.forEach(it => it.wrpTab.vee.appendTo(wrp));

		// Item preview
		const tblItem = veT`<table class="ve-w-100 ve-stats"></table>`.vee.appendTo(itemTab.wrpTab);
		const procItem = DataUtil.cleanJson(MiscUtil.copy(this._state), {isDeleteUniqueId: false});
		Renderer.item.enhanceItem(procItem);
		tblItem.vee.appends(Renderer.utils.getBorderTr());
		tblItem.vee.appends(Renderer.item.getCompactRenderedString(procItem));
		tblItem.vee.appends(Renderer.utils.getPageTr(procItem));
		tblItem.vee.appends(Renderer.utils.getBorderTr());

		// Fluff — Info
		const tblInfo = veT`<table class="ve-w-100 ve-stats"></table>`.vee.appendTo(infoTab.wrpTab);
		Renderer.utils.pBuildFluffTab({
			isImageTab: false,
			wrpContent: tblInfo,
			entity: this._state,
			pFnGetFluff: Renderer.item.pGetFluff,
		});

		// Fluff — Images
		const tblImages = veT`<table class="ve-w-100 ve-stats"></table>`.vee.appendTo(imageTab.wrpTab);
		Renderer.utils.pBuildFluffTab({
			isImageTab: true,
			wrpContent: tblImages,
			entity: this._state,
			pFnGetFluff: Renderer.item.pGetFluff,
		});

		// Raw JSON
		const tblData = veT`<table class="ve-w-100 ve-stats ve-stats--book mkbru__wrp-output-tab-data"></table>`.vee.appendTo(dataTab.wrpTab);
		const asCode = Renderer.get().render({
			type: "entries",
			entries: [{
				type: "code",
				name: "Data",
				preformatted: JSON.stringify(DataUtil.cleanJson(MiscUtil.copy(this._state)), null, "\t"),
			}],
		});
		tblData.vee.appends(Renderer.utils.getBorderTr());
		tblData.vee.appends(`<tr><td colspan="6">${asCode}</td></tr>`);
		tblData.vee.appends(Renderer.utils.getBorderTr());
	}
}
