import {BuilderBase} from "./makebrew-builder-base.js";
import {BuilderUi} from "./makebrew-builderui.js";

// ---- Static lookup tables ------------------------------------------------

const _ITEM_RARITIES = [
	"none", "common", "uncommon", "rare", "very rare", "legendary", "artifact", "varies", "unknown",
];

const _BONUS_VALS = ["+1", "+2", "+3", "+4", "+5"];

const _RECHARGE_VALS = [
	{v: "dawn",     label: "Dawn"},
	{v: "dusk",     label: "Dusk"},
	{v: "midnight", label: "Midnight"},
	{v: "restLong", label: "Long Rest"},
	{v: "special",  label: "Special"},
];

const _LOOT_TABLES_BASE = "ABCDEFGHI".split("").map(l => `Magic Item Table ${l}`);

// Condition row: category options
const _COND_CATEGORIES = [
	{v: "weapon",  label: "Weapons"},
	{v: "armor",   label: "Armor"},
	{v: "shield",  label: "Shields"},
	{v: "ammo",    label: "Ammunition"},
	{v: "scf",     label: "Spellcasting Focus"},
	{v: "specific", label: "Specific Named Item"},
];

// Weapon sub-types within a row
const _WEAPON_TYPES = [
	{v: "any",       label: "Any Weapon",         bool: "weapon"},
	{v: "melee",     label: "Melee Weapons",       type: {classic: "M",      new: "M|XPHB"}},
	{v: "ranged",    label: "Ranged Weapons",      type: {classic: "R",      new: "R|XPHB"}},
	{v: "sword",     label: "Swords",              bool: "sword"},
	{v: "axe",       label: "Axes",                bool: "axe"},
	{v: "spear",     label: "Spears",              bool: "spear"},
	{v: "polearm",   label: "Polearms",            bool: "polearm"},
	{v: "bow",       label: "Bows",                bool: "bow"},
	{v: "crossbow",  label: "Crossbows",           bool: "crossbow"},
	{v: "arrow",     label: "Arrows",              bool: "arrow"},
	{v: "bolt",      label: "Bolts",               bool: "bolt"},
	{v: "net",       label: "Nets",                bool: "net"},
];

// Armor sub-types
const _ARMOR_TYPES = [
	{v: "any",    label: "Any Armor",     bool: "armor"},
	{v: "light",  label: "Light Armor",   type: {classic: "LA",  new: "LA|XPHB"}},
	{v: "medium", label: "Medium Armor",  type: {classic: "MA",  new: "MA|XPHB"}},
	{v: "heavy",  label: "Heavy Armor",   type: {classic: "HA",  new: "HA|XPHB"}},
];

// Ammo sub-types
const _AMMO_TYPES = [
	{v: "standard", label: "Standard (Arrows & Bolts)", type: {classic: "A",     new: "A|XPHB"}},
	{v: "firearm",  label: "Firearm Ammunition",         type: {classic: "AF|DMG", new: "AF|XDMG"}},
];

// Shield & SCF type maps
const _SHIELD_TYPES = {classic: "S", new: "S|XPHB"};
const _SCF_TYPES    = {classic: "SCF", new: "SCF|XPHB"};

// Build a reverse lookup: internal type string → {category, subtype}
const _TYPE_TO_UI = {};
_WEAPON_TYPES.filter(t => t.type).forEach(t => {
	if (t.type.classic) _TYPE_TO_UI[t.type.classic] = {category: "weapon", subtype: t.v, edition: "classic"};
	if (t.type.new)     _TYPE_TO_UI[t.type.new]     = {category: "weapon", subtype: t.v, edition: "new"};
});
_ARMOR_TYPES.filter(t => t.type).forEach(t => {
	if (t.type.classic) _TYPE_TO_UI[t.type.classic] = {category: "armor",  subtype: t.v, edition: "classic"};
	if (t.type.new)     _TYPE_TO_UI[t.type.new]     = {category: "armor",  subtype: t.v, edition: "new"};
});
_AMMO_TYPES.forEach(t => {
	if (t.type.classic) _TYPE_TO_UI[t.type.classic] = {category: "ammo",   subtype: t.v, edition: "classic"};
	if (t.type.new)     _TYPE_TO_UI[t.type.new]     = {category: "ammo",   subtype: t.v, edition: "new"};
});
_TYPE_TO_UI["S"]        = {category: "shield", subtype: null, edition: "classic"};
_TYPE_TO_UI["S|XPHB"]   = {category: "shield", subtype: null, edition: "new"};
_TYPE_TO_UI["SCF"]      = {category: "scf",    subtype: null, edition: "classic"};
_TYPE_TO_UI["SCF|XPHB"] = {category: "scf",    subtype: null, edition: "new"};

// Build a reverse lookup: boolean key → {category, subtype}
const _BOOL_TO_UI = {
	weapon:    {category: "weapon", subtype: "any"},
	armor:     {category: "armor",  subtype: "any"},
	sword:     {category: "weapon", subtype: "sword"},
	axe:       {category: "weapon", subtype: "axe"},
	spear:     {category: "weapon", subtype: "spear"},
	polearm:   {category: "weapon", subtype: "polearm"},
	bow:       {category: "weapon", subtype: "bow"},
	crossbow:  {category: "weapon", subtype: "crossbow"},
	arrow:     {category: "weapon", subtype: "arrow"},
	bolt:      {category: "weapon", subtype: "bolt"},
	net:       {category: "weapon", subtype: "net"},
};

// ---- "New from Copy" modal — generic variants only, richer columns ------

class _ModalFilterMagicVariantItemsCopy extends ModalFilterItems {
	_getColumnHeaders () {
		return ModalFilterBase._getFilterColumnHeaders([
			{sort: "name",        text: "Name",    width: "3-5"},
			{sort: "type",        text: "Type",    width: "3-5"},
			{sort: "weight",      text: "Weight",  width: "1-5"},
			{sort: "attunement",  text: "Att.",    width: "0-5"},
			{sort: "rarityOrder", text: "Rarity",  width: "1"},
			{sort: "source",      text: "Source",  width: "1"},
		]);
	}

	_getListItem (pageFilter, item, itI) {
		if (item.noDisplay) return null;
		Renderer.item.enhanceItem(item);
		pageFilter.mutateAndAddToFilters(item);

		const eleRow = document.createElement("div");
		eleRow.className = "ve-px-0 ve-w-100 ve-flex-col ve-no-shrink";
		const hash = UrlUtil.URL_TO_HASH_BUILDER[UrlUtil.PG_ITEMS](item);
		const source = Parser.sourceJsonToAbv(item.source);
		const type = item._textTypes.join(", ");
		const attunement = item._attunementCategory !== VeCt.STR_NO_ATTUNEMENT ? "×" : "";
		const rarity = Parser.itemRarityToShort(item.rarity) || "";
		const rarityOrder = SortUtil._ITEM_RARITY_ORDER.indexOf(item.rarity || "none");

		eleRow.innerHTML = `<div class="ve-w-100 ve-flex-vh-center ve-lst__row-border veapp__list-row ve-no-select ve-lst__wrp-cells">
			<div class="ve-col-0-5 ve-pl-0 ve-flex-vh-center">${this._isRadio ? `<input type="radio" name="radio" class="ve-no-events">` : `<input type="checkbox" class="ve-no-events">`}</div>
			<div class="ve-col-0-5 ve-px-1 ve-flex-vh-center">
				<div class="ve-ui-list__btn-inline ve-px-2 ve-no-select" title="Toggle Preview (SHIFT to Toggle Info Preview)">[+]</div>
			</div>
			<div class="ve-col-3-5 ve-px-1 ${item._versionBase_isVersion ? "ve-italic" : ""} ${this._getNameStyle()}">${item._versionBase_isVersion ? `<span class="ve-px-3"></span>` : ""}${item.name}</div>
			<div class="ve-col-3-5 ve-px-1">${type.uppercaseFirst()}</div>
			<div class="ve-col-1-5 ve-px-1 ve-text-center">${item._l_weight || "—"}</div>
			<div class="ve-col-0-5 ve-px-1 ve-flex-vh-center">${attunement}</div>
			<div class="ve-col-1 ve-px-1 ve-text-center ${item.rarity ? `ve-itm__rarity-${item.rarity}` : ""}">${rarity}</div>
			<div class="ve-col-1 ve-flex-h-center ${Parser.sourceJsonToSourceClassname(item.source)} ve-pl-1 ve-pr-0" title="${Parser.sourceJsonToFull(item.source)}">${source}${Parser.sourceJsonToMarkerHtml(item.source, {isList: true})}</div>
		</div>`;

		const btnShowHidePreview = eleRow.firstElementChild.children[1].firstElementChild;
		const listItem = new ListItem(
			itI, eleRow, item.name,
			{hash, source, sourceJson: item.source, ...ListItem.getCommonValues(item), type, weight: item._l_weight || "", attunement, rarity, rarityOrder},
			{cbSel: eleRow.firstElementChild.firstElementChild.firstElementChild, btnShowHidePreview},
		);
		this._previewButtonHandler.bindPreviewButton({entity: item, listItem, btnShowHidePreview});
		return listItem;
	}

	async _pLoadAllData () {
		const all = await super._pLoadAllData();
		return all.filter(it => it._category === "Generic Variant");
	}
}

// ---- Builder class -------------------------------------------------------

export class MagicVariantBuilder extends BuilderBase {
	constructor () {
		super({prop: "magicvariant"});
		this._renderOutputDebounced = MiscUtil.debounce(() => this._renderOutput(), 50);
		this._modalFilterItems = null;       // lazy-init, shared across condition rows (_ModalFilterMagicVariantItems)
		this._modalFilterItemsCopy = null;   // single-select modal for "New from Copy" (_ModalFilterMagicVariantItems)
	}

	async pHandleClickLoadExisting () {
		this._modalFilterItemsCopy ??= new _ModalFilterMagicVariantItemsCopy({namespace: "makebrew.magicvariant.copy", isRadio: true});
		const [selected] = (await this._modalFilterItemsCopy.pGetUserSelection()) ?? [];
		if (!selected) return;

		const variant = MiscUtil.copy(await DataLoader.pCacheAndGet(UrlUtil.PG_ITEMS, selected.values.sourceJson, selected.values.hash));
		if (!variant) return;
		return this.pHandleLoadExistingData(variant);
	}

	async pHandleLoadExistingData (variant, opts = {}) {
		variant = MiscUtil.copy(variant);
		variant.name = `${variant.name} (Copy)`;
		variant.source = this._ui.source;
		variant.type = `GV|${this._ui.source}`;
		if (variant.inherits) variant.inherits.source = this._ui.source;
		DataUtil.cleanJson(variant, {isDeleteUniqueId: true});
		for (const k of ["srd", "srd52", "basicRules", "basicRules2024", "reprintedAs", "_isInherited", "_category", "_isEnhanced"])
			delete variant[k];

		const meta = {...(opts.meta || {}), ...this._getInitialMetaState({nameOriginal: variant.name, isModified: true})};
		this.setStateFromLoaded({s: variant, m: meta});
		this.renderInput();
		this.renderOutput();
	}

	setStateFromLoaded (state) {
		if (!state?.s || !state?.m) return;
		this._doResetProxies();
		if (!state.s.uniqueId) state.s.uniqueId = CryptUtil.uid();
		this.__state = state.s;
		this.__meta = state.m;
	}

	doHandleSourcesAdd () { /* no sub-sources */ }

	renderOutput () { this._renderOutputDebounced(); }

	_getInitialState () {
		const src = this._ui ? this._ui.source : "";
		return {
			...super._getInitialState(),
			name:     "New Generic Variant",
			source:   src,
			type:     src ? `GV|${src}` : "GV|",
			page:     "",
			edition:  null,
			ammo:     null,
			requires: [],
			excludes: [],
			entries:  [],
			inherits: {
				source:             src,
				page:               "",
				namePrefix:         "",
				nameSuffix:         "",
				rarity:             "",
				tier:               null,
				reqAttune:          null,
				bonusWeapon:        null,
				bonusWeaponAttack:  null,
				bonusWeaponDamage:  null,
				bonusAc:            null,
				bonusSavingThrow:   null,
				bonusSpellDamage:   null,
				charges:            null,
				recharge:           null,
				wondrous:           null,
				curse:              null,
				sentient:           null,
				stealth:            null,
				strength:           null,
				entries:            [],
				lootTables:         [],
			},
		};
	}

	// -- Lifecycle --

	_renderInputImpl () {
		this._doCreateProxies();
		this._doBindHeaderElements();
		this._renderInputMain();
	}

	_renderInputMain () {
		this._sourcesCache = MiscUtil.copy(this._ui.allSources);
		const wrp = this._ui.wrpInput.empty();

		// Ensure inherits object exists (may be absent after loading minimal data)
		this.__state.inherits ||= {};

		const cb = MiscUtil.debounce(() => {
			// Keep type and inherits.source in sync with source
			this.__state.type = `GV|${this._state.source}`;
			if (this.__state.inherits) {
				this.__state.inherits.source = this._state.source;
				this.__state.inherits.page   = this._state.page || "";
			}
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
				new TabUiUtil.TabMeta({...tabOpts, name: "Requires"}),
				new TabUiUtil.TabMeta({...tabOpts, name: "Inherits"}),
				new TabUiUtil.TabMeta({...tabOpts, name: "Text"}),
			],
			{tabGroup: "input", cbTabChange: this.doUiSave.bind(this)},
		);
		const [infoTab, reqTab, inheritsTab, textTab] = tabs;

		ee`<div class="ve-flex-v-center ve-w-100 ve-no-shrink ve-ui-tab__wrp-tab-heads--border">${tabs.map(it => it.btnTab)}</div>`.appendTo(wrp);
		tabs.forEach(it => it.wrpTab.appendTo(wrp));

		this._buildInfoTab(infoTab.wrpTab, cb);
		this._buildRequiresTab(reqTab.wrpTab, cb);
		this._buildInheritsTab(inheritsTab.wrpTab, cb);
		this._buildTextTab(textTab.wrpTab, cb);
	}

	// =========================================================================
	// -- Info tab --
	// =========================================================================

	_buildInfoTab (wrp, cb) {
		BuilderUi.getStateIptString("Name", cb, this._state, {nullable: false}, "name").appendTo(wrp);
		this._selSource = this.getSourceInput(cb).appendTo(wrp);
		BuilderUi.getStateIptString("Page", cb, this._state, {}, "page").appendTo(wrp);

		BuilderUi.getStateIptEnum(
			"Edition", cb, this._state,
			{nullable: true, vals: ["classic"], fnDisplay: () => "Classic"},
			"edition",
		).appendTo(wrp);

		BuilderUi.getStateIptBoolean("Ammunition Variant", cb, this._state, {nullable: true}, "ammo").appendTo(wrp);

		this._buildSectionHeader("Name Modification", wrp);
		this._buildInheritsStringRow("Name Prefix", wrp, cb, "namePrefix");
		this._buildInheritsStringRow("Name Suffix", wrp, cb, "nameSuffix");
		this._buildInheritsStringRow("Name Remove", wrp, cb, "nameRemove");
	}

	// =========================================================================
	// -- Requires tab --
	// =========================================================================

	_buildRequiresTab (wrp, cb) {
		// --- Requires ---
		this._buildSectionHeader("What This Variant Applies To", wrp);
		ee`<div class="ve-muted ve-mb-2" style="font-size:.82em">Each row adds items that qualify. A base item becomes a specific variant if it matches <em>any</em> row below.</div>`.appendTo(wrp);

		const wrpReq = ee`<div class="ve-flex-col ve-w-100"></div>`.appendTo(wrp);
		const reqRows = [];

		const saveRequires = () => {
			this.__state.requires = reqRows.flatMap(r => r.getConditions()).filter(c => Object.keys(c).length > 0);
			cb();
		};

		const addReqRow = (uiData) => {
			const ctrl = this._buildConditionRow(uiData || {category: "weapon", subtype: "any", edition: "both"}, saveRequires);
			ctrl.btnDelete.onn("click", () => {
				reqRows.splice(reqRows.indexOf(ctrl), 1);
				ctrl.element.remove();
				saveRequires();
			});
			ctrl.element.appendTo(wrpReq);
			reqRows.push(ctrl);
		};

		MagicVariantBuilder._parseConditionsToUIData(this.__state.requires || []).forEach(d => addReqRow(d));

		ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mt-1">+ Add Row</button>`
			.onn("click", () => addReqRow(null))
			.appendTo(wrp);

		// --- Excludes ---
		this._buildSectionHeader("Exclusions", wrp);
		ee`<div class="ve-muted ve-mb-2" style="font-size:.82em">Items matching any exclusion are removed even if they satisfy a row above.</div>`.appendTo(wrp);
		this._buildExcludesSection(wrp, cb);
	}

	// Translate raw requires array → array of UI data objects (one per row)
	static _parseConditionsToUIData (conditions) {
		const result = [];
		let i = 0;

		while (i < conditions.length) {
			const cond = conditions[i];

			// Group consecutive name-only conditions into a single "specific" row
			if (MagicVariantBuilder._isNameOnlyCond(cond)) {
				const items = [];
				while (i < conditions.length && MagicVariantBuilder._isNameOnlyCond(conditions[i])) {
					items.push({name: conditions[i].name, source: conditions[i].source || ""});
					i++;
				}
				result.push({category: "specific", items});
				continue;
			}

			const ui = MagicVariantBuilder._parseOneCondition(cond);

			// Coalesce consecutive classic+new pairs into a single "both" row
			if (ui?.edition === "classic" && i + 1 < conditions.length) {
				const nextUi = MagicVariantBuilder._parseOneCondition(conditions[i + 1]);
				if (nextUi?.category === ui.category && nextUi?.subtype === ui.subtype && nextUi?.edition === "new") {
					result.push({...ui, edition: "both"});
					i += 2;
					continue;
				}
			}

			result.push(ui ?? {category: "_raw", _raw: JSON.stringify(cond)});
			i++;
		}
		return result;
	}

	static _isNameOnlyCond (cond) {
		return !!(cond?.name && Object.keys(cond).every(k => k === "name" || k === "source"));
	}

	static _parseOneCondition (cond) {
		// Boolean flags
		for (const [key, ui] of Object.entries(_BOOL_TO_UI)) {
			if (cond[key]) {
				return {category: ui.category, subtype: ui.subtype, edition: "both", weaponCategory: cond.weaponCategory || "any"};
			}
		}
		// Type string
		if (cond.type) {
			const ui = _TYPE_TO_UI[cond.type];
			if (ui) return {category: ui.category, subtype: ui.subtype, edition: ui.edition, weaponCategory: cond.weaponCategory || "any"};
		}
		// Named item
		if (cond.name) return {category: "specific", subtype: null, edition: "both", name: cond.name, source: cond.source || ""};
		return null;
	}

	_buildConditionRow (uiData, onChange) {
		const state = {
			category: "weapon", subtype: "any", edition: "both", weaponCategory: "any", name: "", source: "",
			...uiData,
		};

		const element = ee`<div class="ve-flex ve-flex-wrap ve-gap-1 ve-py-1 ve-flex-v-center ve-mb-1 ve-px-1" style="border-left:3px solid var(--col-border-default,#888)"></div>`;

		// Category
		const catSel = ee`<select class="ve-form-control ve-input-xs">
			${_COND_CATEGORIES.map(c => `<option value="${c.v}">${c.label}</option>`)}
		</select>`.val(state.category);

		// Sub-type (contents are rebuilt when category changes)
		const subSel = ee`<select class="ve-form-control ve-input-xs"></select>`;

		const rebuildSubOpts = () => {
			const cat = catSel.val();
			const prev = subSel.val();
			subSel.empty();
			let opts = [];
			if (cat === "weapon") opts = _WEAPON_TYPES;
			else if (cat === "armor") opts = _ARMOR_TYPES;
			else if (cat === "ammo")  opts = _AMMO_TYPES;
			opts.forEach(o => subSel.appends(`<option value="${o.v}">${o.label}</option>`));
			subSel.val(opts.find(o => o.v === prev) ? prev : (opts[0]?.v ?? ""));
			subSel.toggleVe(opts.length > 0);
		};

		// Edition — only shown when the chosen selection uses a type string (not a boolean flag)
		const edSel = ee`<select class="ve-form-control ve-input-xs">
			<option value="both">Any Edition</option>
			<option value="classic">Classic (pre-2024)</option>
			<option value="new">2024 (One D&D)</option>
		</select>`.val(state.edition);

		// Weapon category — only shown for weapon rows
		const wpnCatSel = ee`<select class="ve-form-control ve-input-xs">
			<option value="any">Any Category</option>
			<option value="simple">Simple Weapons</option>
			<option value="martial">Martial Weapons</option>
		</select>`.val(state.weaponCategory || "any");

		// Specific-item: chip list + modal-select button
		const selectedItems = [...(state.items || [])]; // [{name, source}]
		const wrpSpecific = ee`<div class="ve-flex-col ve-w-100 ve-mt-1"></div>`;

		const renderChips = () => {
			wrpSpecific.empty();
			const chipRow = ee`<div class="ve-flex ve-flex-wrap ve-gap-1 ve-mb-1"></div>`.appendTo(wrpSpecific);
			selectedItems.forEach((item, idx) => {
				const chip = ee`<div class="ve-flex-v-center ve-badge ve-badge--default ve-no-select" style="cursor:default">
					${item.name}
					<button class="ve-btn ve-btn-danger ve-p-0 ve-ml-1" style="font-size:.7em;line-height:1;border:none;background:none;color:inherit" title="Remove">×</button>
				</div>`;
				chip.querySelector("button").addEventListener("click", () => {
					selectedItems.splice(idx, 1);
					renderChips();
					onChange();
				});
				chipRow.appends(chip);
			});
			if (!selectedItems.length) {
				ee`<span class="ve-muted ve-italic" style="font-size:.85em">No items selected — click Add to choose.</span>`.appendTo(chipRow);
			}
			ee`<button class="ve-btn ve-btn-xs ve-btn-default">+ Add Items...</button>`
				.onn("click", async () => {
					this._modalFilterItems ??= new ModalFilterItems({namespace: "makebrew.magicvariant.requires"});
					const selected = await this._modalFilterItems.pGetUserSelection();
					if (!selected?.length) return;
					selected.forEach(it => {
						if (!selectedItems.some(s => s.name === it.name && s.source === it.values.sourceJson)) {
							selectedItems.push({name: it.name, source: it.values.sourceJson});
						}
					});
					renderChips();
					onChange();
				})
				.appendTo(wrpSpecific);
		};

		renderChips();

		const updateVisibility = () => {
			const cat = catSel.val();
			const sub = subSel.val();
			// Edition selector: only relevant when the selection produces type-string conditions (not boolean flags)
			const needsEdition = (cat === "weapon" && (sub === "melee" || sub === "ranged"))
				|| (cat === "armor" && sub !== "any")
				|| cat === "shield" || cat === "ammo" || cat === "scf";
			edSel.toggleVe(needsEdition);
			wpnCatSel.toggleVe(cat === "weapon");
			subSel.toggleVe(cat !== "specific" && subSel.options?.length > 0);
			wrpSpecific.toggleVe(cat === "specific");
		};

		catSel.onn("change", () => { rebuildSubOpts(); updateVisibility(); onChange(); });
		subSel.onn("change", () => { updateVisibility(); onChange(); });
		edSel.onn("change", onChange);
		wpnCatSel.onn("change", onChange);

		rebuildSubOpts();
		subSel.val(state.subtype ?? subSel.val());
		updateVisibility();

		const btnDelete = ee`<button class="ve-btn ve-btn-xs ve-btn-danger ve-align-self-start"><span class="glyphicon glyphicon-trash"></span></button>`;

		const topRow = ee`<div class="ve-flex ve-flex-wrap ve-gap-1 ve-flex-v-center"></div>`
			.appends(catSel).appends(subSel).appends(edSel).appends(wpnCatSel).appends(btnDelete);
		element.appends(topRow).appends(wrpSpecific);

		const getConditions = () => {
			const cat   = catSel.val();
			const sub   = subSel.val();
			const ed    = edSel.val();
			const eds   = ed === "both" ? ["classic", "new"] : [ed];
			const wc    = wpnCatSel.val();

			if (cat === "specific") return selectedItems.map(item => ({name: item.name}));

			if (cat === "weapon") {
				const wt = _WEAPON_TYPES.find(t => t.v === sub);
				if (!wt) return [];
				if (wt.bool) {
					const out = {[wt.bool]: true};
					if (wc && wc !== "any") out.weaponCategory = wc;
					return [out];
				}
				if (wt.type) return eds.map(e => {
					const out = {type: wt.type[e]};
					if (wc && wc !== "any") out.weaponCategory = wc;
					return out;
				});
				return [];
			}

			if (cat === "armor") {
				const at = _ARMOR_TYPES.find(t => t.v === sub);
				if (!at) return [];
				if (at.bool) return [{[at.bool]: true}];
				if (at.type) return eds.map(e => ({type: at.type[e]}));
				return [];
			}

			if (cat === "shield") return eds.map(e => ({type: _SHIELD_TYPES[e]}));
			if (cat === "scf")    return eds.map(e => ({type: _SCF_TYPES[e]}));

			if (cat === "ammo") {
				const amt = _AMMO_TYPES.find(t => t.v === sub);
				if (!amt) return [];
				return eds.map(e => ({type: amt.type[e]}));
			}

			return [];
		};

		return {element, btnDelete, getConditions};
	}

	_buildExcludesSection (wrp, cb) {
		// excludes is a single flat object, e.g. {net: true, name: ["Hide Armor", "Leather Armor"]}
		const excl = this.__state.excludes || {};

		const hasBullet = !!excl.bulletFirearm;
		const hasCell   = !!excl.cellEnergy;
		const hasNet    = !!excl.net;
		const initNames = excl.name ? (Array.isArray(excl.name) ? excl.name : [excl.name]) : [];
		const excludedItems = initNames.map(n => ({name: n, source: ""}));

		const cbBullet = ee`<input type="checkbox">`;  cbBullet.checked = hasBullet;
		const cbCell   = ee`<input type="checkbox">`;  cbCell.checked   = hasCell;
		const cbNet    = ee`<input type="checkbox">`;  cbNet.checked    = hasNet;

		const save = () => {
			const out = {};
			if (cbBullet.checked) out.bulletFirearm = true;
			if (cbCell.checked)   out.cellEnergy = true;
			if (cbNet.checked)    out.net = true;
			if (excludedItems.length === 1) out.name = excludedItems[0].name;
			else if (excludedItems.length > 1) out.name = excludedItems.map(i => i.name);
			this.__state.excludes = Object.keys(out).length ? out : null;
			cb();
		};

		cbBullet.onn("change", save);
		cbCell.onn("change", save);
		cbNet.onn("change", save);

		ee`<div class="ve-flex ve-flex-col ve-gap-1 ve-mb-2">
			<label class="ve-flex-v-center ve-no-select">${cbBullet} <span class="ve-ml-1">Firearm Ammunition (bullets)</span></label>
			<label class="ve-flex-v-center ve-no-select">${cbCell}   <span class="ve-ml-1">Energy Cells</span></label>
			<label class="ve-flex-v-center ve-no-select">${cbNet}    <span class="ve-ml-1">Nets</span></label>
		</div>`.appendTo(wrp);

		ee`<div class="ve-bold ve-mb-1" style="font-size:.82em">Specific items to exclude:</div>`.appendTo(wrp);

		const wrpChips = ee`<div class="ve-flex ve-flex-wrap ve-gap-1 ve-mb-1"></div>`.appendTo(wrp);

		const renderExcludeChips = () => {
			wrpChips.empty();
			excludedItems.forEach((item, idx) => {
				const chip = ee`<div class="ve-flex-v-center ve-badge ve-badge--default ve-no-select" style="cursor:default">
					${item.name}
					<button class="ve-btn ve-btn-danger ve-p-0 ve-ml-1" style="font-size:.7em;line-height:1;border:none;background:none;color:inherit" title="Remove">×</button>
				</div>`;
				chip.querySelector("button").addEventListener("click", () => {
					excludedItems.splice(idx, 1);
					renderExcludeChips();
					save();
				});
				wrpChips.appends(chip);
			});
			if (!excludedItems.length) {
				ee`<span class="ve-muted ve-italic" style="font-size:.85em">No items excluded — click Add to choose.</span>`.appendTo(wrpChips);
			}
		};

		renderExcludeChips();

		ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mt-1">+ Exclude Items...</button>`
			.onn("click", async () => {
				this._modalFilterItems ??= new ModalFilterItems({namespace: "makebrew.magicvariant.requires"});
				const selected = await this._modalFilterItems.pGetUserSelection();
				if (!selected?.length) return;
				selected.forEach(it => {
					if (!excludedItems.some(s => s.name === it.name && s.source === it.values.sourceJson)) {
						excludedItems.push({name: it.name, source: it.values.sourceJson});
					}
				});
				renderExcludeChips();
				save();
			})
			.appendTo(wrp);
	}

	// =========================================================================
	// -- Inherits tab --
	// =========================================================================

	_buildInheritsTab (wrp, cb) {
		const inh = this.__state.inherits;

		this._buildSectionHeader("Rarity & Tier", wrp);
		BuilderUi.getStateIptEnum(
			"Rarity", cb, inh,
			{nullable: false, vals: _ITEM_RARITIES, fnDisplay: v => v.toTitleCase()},
			"rarity",
		).appendTo(wrp);

		BuilderUi.getStateIptEnum(
			"Tier", cb, inh,
			{nullable: true, vals: ["minor", "major"], fnDisplay: v => v.toTitleCase()},
			"tier",
		).appendTo(wrp);

		this._buildSectionHeader("Attunement", wrp);
		this._buildAttuneInput(wrp, cb);

		this._buildSectionHeader("Bonuses", wrp);
		this._buildInheritsEnumRow("Weapon (Atk + Dmg)", wrp, cb, "bonusWeapon");
		this._buildInheritsEnumRow("Weapon Attack", wrp, cb, "bonusWeaponAttack");
		this._buildInheritsEnumRow("Weapon Damage", wrp, cb, "bonusWeaponDamage");
		this._buildInheritsEnumRow("AC Bonus", wrp, cb, "bonusAc");
		this._buildInheritsEnumRow("Saving Throw", wrp, cb, "bonusSavingThrow");
		this._buildInheritsEnumRow("Spell Damage", wrp, cb, "bonusSpellDamage");

		this._buildSectionHeader("Charges", wrp);
		this._buildChargesInput(wrp, cb);

		this._buildSectionHeader("Flags", wrp);
		BuilderUi.getStateIptBoolean("Wondrous Item",              cb, inh, {nullable: true}, "wondrous").appendTo(wrp);
		BuilderUi.getStateIptBoolean("Cursed",                     cb, inh, {nullable: true}, "curse").appendTo(wrp);
		BuilderUi.getStateIptBoolean("Sentient",                   cb, inh, {nullable: true}, "sentient").appendTo(wrp);
		BuilderUi.getStateIptBoolean("Stealth Disadvantage",       cb, inh, {nullable: true}, "stealth").appendTo(wrp);

		this._buildSectionHeader("Armor", wrp);
		this._buildStrengthInput(wrp, cb);

		this._buildSectionHeader("Loot Tables", wrp);
		this._buildLootTablesInput(wrp, cb);

		this._buildSectionHeader("Inherited Description", wrp);
		BuilderUi.getStateIptEntries(
			"Text", cb, inh,
			{fnPostProcess: BuilderUi.fnPostProcessDice},
			"entries",
		).appendTo(wrp);
	}

	_buildAttuneInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Requires Attunement", {isRow: true});
		const inh = this.__state.inherits;

		const iptText = ee`<input type="text" class="ve-form-control ve-input-xs ve-flex-1 ve-ml-1" placeholder="condition text">`;

		const sel = ee`<select class="ve-form-control ve-input-xs">
			<option value="no">No</option>
			<option value="yes">Yes (Any)</option>
			<option value="optional">Optional</option>
			<option value="text">Yes, with condition...</option>
		</select>`.onn("change", () => {
			const mode = sel.val();
			iptText.toggleVe(mode === "text");
			if (mode === "no")            { inh.reqAttune = null; cb(); }
			else if (mode === "yes")      { inh.reqAttune = true; cb(); }
			else if (mode === "optional") { inh.reqAttune = "optional"; cb(); }
		});

		iptText.onn("change", () => {
			inh.reqAttune = iptText.val().trim() || true;
			cb();
		});

		const cur = inh?.reqAttune;
		if (!cur)                    sel.val("no");
		else if (cur === true)        sel.val("yes");
		else if (cur === "optional")  sel.val("optional");
		else { sel.val("text"); iptText.val(cur); }

		iptText.toggleVe(sel.val() === "text");

		sel.appendTo(rowInner);
		iptText.appendTo(rowInner);
		row.appendTo(wrp);
	}

	_buildInheritsEnumRow (label, wrp, cb, key) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple(label, {isRow: true});
		const inh = this.__state.inherits;

		const sel = ee`<select class="ve-form-control ve-input-xs ve-flex-1">
			<option value="">(none)</option>
			${_BONUS_VALS.map(v => `<option value="${v}">${v}</option>`)}
		</select>`.val(inh?.[key] || "").onn("change", () => {
			inh[key] = sel.val() || null;
			cb();
		});
		rowInner.appends(sel);
		row.appendTo(wrp);
	}

	_buildChargesInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Charges", {isRow: true});
		const inh = this.__state.inherits;

		const iptCharges = ee`<input type="number" class="ve-form-control ve-input-xs" style="width:70px" min="1" max="999" placeholder="#">`
			.val(inh?.charges ?? "")
			.onn("change", () => doUpdate());

		const selRecharge = ee`<select class="ve-form-control ve-input-xs ve-ml-1">
			<option value="">(No Recharge)</option>
			${_RECHARGE_VALS.map(r => `<option value="${r.v}">${r.label}</option>`)}
		</select>`.val(inh?.recharge || "").onn("change", () => doUpdate());

		const doUpdate = () => {
			const n = parseInt(iptCharges.val());
			inh.charges = isNaN(n) ? null : n;
			inh.recharge = selRecharge.val() || null;
			cb();
		};

		rowInner.appends(iptCharges).appends(selRecharge);
		row.appendTo(wrp);
	}

	_buildStrengthInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Min. Strength", {isRow: true});
		const inh = this.__state.inherits;

		const ipt = ee`<input type="number" class="ve-form-control ve-input-xs" style="width:70px" min="1" max="30" placeholder="#">`
			.val(inh?.strength ?? "")
			.onn("change", () => {
				const v = parseInt(ipt.val());
				inh.strength = isNaN(v) ? null : v;
				cb();
			});
		rowInner.appends(ipt);
		ee`<span class="ve-muted ve-ml-2" style="font-size:.85em">(for heavy armor only)</span>`.appendTo(rowInner);
		row.appendTo(wrp);
	}

	_buildLootTablesInput (wrp, cb) {
		const inh = this.__state.inherits;
		const wrpList = ee`<div class="ve-flex-col ve-w-100"></div>`.appendTo(wrp);

		const save = () => {
			inh.lootTables = [...wrpList.querySelectorAll(".mv-loot-row input")]
				.map(el => el.value.trim())
				.filter(Boolean);
			cb();
		};

		const addRow = (v) => {
			const ipt = ee`<input type="text" class="ve-form-control ve-input-xs ve-flex-1" list="mv-loot-datalist" placeholder="Table name...">`.val(v || "");
			ipt.onn("change", save);
			const btnDel = ee`<button class="ve-btn ve-btn-xs ve-btn-danger ve-ml-1"><span class="glyphicon glyphicon-trash"></span></button>`.onn("click", () => {
				rowEl.remove(); save();
			});
			const rowEl = ee`<div class="ve-flex ve-gap-1 ve-mb-1 mv-loot-row">${ipt}${btnDel}</div>`.appendTo(wrpList);
		};

		ee`<datalist id="mv-loot-datalist">${_LOOT_TABLES_BASE.map(t => `<option value="${t}">`)}</datalist>`.appendTo(wrp);
		(inh?.lootTables || []).forEach(t => addRow(t));

		ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mt-1">+ Add Table</button>`
			.onn("click", () => addRow(""))
			.appendTo(wrp);
	}

	// =========================================================================
	// -- Text tab --
	// =========================================================================

	_buildTextTab (wrp, cb) {
		ee`<div class="ve-muted ve-mb-1" style="font-size:.82em">Top-level entries appear on the generic variant itself (e.g. variant-specific notes). Description that should appear on all specific variants goes in the Inherits tab.</div>`.appendTo(wrp);
		BuilderUi.getStateIptEntries(
			"Text", cb, this._state,
			{fnPostProcess: BuilderUi.fnPostProcessDice},
			"entries",
		).appendTo(wrp);
	}

	// =========================================================================
	// -- Shared helpers --
	// =========================================================================

	_buildSectionHeader (label, wrp) {
		ee`<div class="mkbru__row ve-mt-2 ve-mb-1 ve-bold" style="font-size:.8em;text-transform:uppercase;letter-spacing:.06em;color:var(--col-heading-grey,#888);border-bottom:1px solid var(--col-border-default,#ccc)">${label}</div>`.appendTo(wrp);
	}

	_buildInheritsStringRow (label, wrp, cb, key) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple(label, {isRow: true});
		const inh = this.__state.inherits;
		const ipt = ee`<input type="text" class="ve-form-control ve-input-xs ve-flex-1" placeholder="(none)">`;
		ipt.val(inh?.[key] || "");
		ipt.onn("change", () => {
			inh[key] = ipt.val() || null;
			cb();
		});
		rowInner.appends(ipt);
		row.appendTo(wrp);
	}

	// =========================================================================
	// -- Output rendering --
	// =========================================================================

	_renderOutput () {
		const wrp = this._ui.wrpOutput.empty();
		this._resetTabs({tabGroup: "output"});

		const tabs = this._renderTabs(
			[
				new TabUiUtil.TabMeta({name: "Preview"}),
				new TabUiUtil.TabMeta({name: "Data"}),
			],
			{tabGroup: "output", cbTabChange: this.doUiSave.bind(this)},
		);
		const [previewTab, dataTab] = tabs;
		ee`<div class="ve-flex-v-center ve-w-100 ve-no-shrink">${tabs.map(it => it.btnTab)}</div>`.appendTo(wrp);
		tabs.forEach(it => it.wrpTab.appendTo(wrp));

		// Preview — promote inherits properties then render as an item
		try {
			const procItem = MiscUtil.copy(this.__state);
			procItem.type = `GV|${procItem.source}`;
			delete procItem._isInherited;
			delete procItem._isEnhanced;
			if (procItem.inherits) {
				procItem.inherits.source = procItem.source;
				procItem.inherits.page = procItem.page || "";
			}
			Renderer.item._genericVariants_addInheritedPropertiesToSelf(procItem);
			Renderer.item.enhanceItem(procItem);

			const tbl = ee`<table class="ve-w-100 ve-stats"></table>`.appendTo(previewTab.wrpTab);
			tbl.appends(Renderer.utils.getBorderTr());
			tbl.appends(Renderer.item.getCompactRenderedString(procItem));
			tbl.appends(Renderer.utils.getPageTr(procItem));
			tbl.appends(Renderer.utils.getBorderTr());
		} catch (e) {
			ee`<div class="ve-muted ve-italic ve-p-2">Preview unavailable: ${e.message}</div>`.appendTo(previewTab.wrpTab);
		}

		// Raw JSON
		const cleanState = DataUtil.cleanJson(MiscUtil.copy(this.__state));
		cleanState.type = `GV|${cleanState.source}`;
		if (cleanState.inherits) {
			cleanState.inherits.source = cleanState.source;
			cleanState.inherits.page   = cleanState.page || "";
		}

		const tblData = ee`<table class="ve-w-100 ve-stats ve-stats--book mkbru__wrp-output-tab-data"></table>`.appendTo(dataTab.wrpTab);
		const asCode = Renderer.get().render({
			type: "entries",
			entries: [{
				type: "code",
				name: "Data",
				preformatted: JSON.stringify(cleanState, null, "\t"),
			}],
		});
		tblData.appends(Renderer.utils.getBorderTr());
		tblData.appends(`<tr><td colspan="6">${asCode}</td></tr>`);
		tblData.appends(Renderer.utils.getBorderTr());
	}
}
