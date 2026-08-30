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

const _DAMAGE_TYPES = Object.entries(Parser.DMGTYPE_JSON_TO_FULL)
	.sort((a, b) => SortUtil.ascSort(a[1], b[1]))
	.map(([abv, name]) => ({abv, name: name.charAt(0).toUpperCase() + name.slice(1)}));

const _CONDITIONS = [
	"blinded", "charmed", "deafened", "disease", "exhaustion",
	"frightened", "grappled", "incapacitated", "invisible",
	"paralyzed", "petrified", "poisoned", "prone", "restrained",
	"stunned", "unconscious",
];

const _ABILITIES_FULL = {str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma"};
const _ABILITIES      = ["str", "dex", "con", "int", "wis", "cha"];

const _SPEED_TYPES = ["walk", "fly", "swim", "climb", "burrow"];

const _INH_WEAPON_CATEGORIES = [
	{v: "simple",  label: "Simple"},
	{v: "martial", label: "Martial"},
];

const _AGE_VALS = [
	{v: "renaissance", label: "Renaissance"},
	{v: "modern",      label: "Modern"},
	{v: "futuristic",  label: "Futuristic"},
];

const _FOCUS_SCF_TYPES = [
	{v: "arcane", label: "Arcane (Sorcerer/Warlock/Wizard)"},
	{v: "druid",  label: "Druid"},
	{v: "holy",   label: "Holy (Cleric/Paladin)"},
];

const _SPELLCASTER_CLASSES = [
	"Artificer", "Bard", "Cleric", "Druid", "Paladin",
	"Ranger", "Sorcerer", "Warlock", "Wizard",
];

const _MISC_TAGS = [
	{v: "CNS",   label: "Consumable"},
	{v: "CF\\W", label: "Creates Food/Water"},
	{v: "TT",    label: "Trinket Table"},
];

const _POISON_TYPES = [
	{v: "ingested", label: "Ingested"},
	{v: "injury",   label: "Injury"},
	{v: "inhaled",  label: "Inhaled"},
	{v: "contact",  label: "Contact"},
];

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
		this._modalFilterItems = null;       // lazy-init, shared across condition rows
		this._modalFilterItemsCopy = null;   // single-select modal for "New from Copy"
		this._modalFilterSpells = null;      // lazy-init for attached spells
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
				wondrous:                null,
				curse:                   null,
				sentient:                null,
				stealth:                 null,
				strength:                null,
				entries:                 [],
				lootTables:              [],
				// bonuses
				bonusWeaponCritDamage:   null,
				bonusSpellAttack:        null,
				bonusSpellSaveDc:        null,
				bonusAbilityCheck:       null,
				bonusProficiencyBonus:   null,
				ability:                 null,
				modifySpeed:             null,
				vulnerable:              null,
				resist:                  null,
				immune:                  null,
				conditionImmune:         null,
				// traits
				weaponCategory:          null,
				age:                     null,
				firearm:                 null,
				staff:                   null,
				tattoo:                  null,
				ammo:                    null,
				poison:                  null,
				focus:                   null,
				scfType:                 null,
				grantsProficiency:       null,
				grantsLanguage:          null,
				critThreshold:           null,
				miscTags:                null,
				poisonTypes:             null,
				light:                   null,
				reqAttuneTags:           null,
				reqAttuneAlt:            null,
				// links
				attachedSpells:          null,
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
		const wrp = this._ui.wrpInput.vee.empty();

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
				new TabUiUtil.TabMeta({...tabOpts, name: "Bonuses"}),
				new TabUiUtil.TabMeta({...tabOpts, name: "Traits"}),
				new TabUiUtil.TabMeta({...tabOpts, name: "Links"}),
				new TabUiUtil.TabMeta({...tabOpts, name: "Text"}),
			],
			{tabGroup: "input", cbTabChange: this.doUiSave.bind(this)},
		);
		const [infoTab, reqTab, inheritsTab, bonusesTab, traitsTab, linksTab, textTab] = tabs;

		veT`<div class="ve-flex-v-center ve-w-100 ve-no-shrink ve-ui-tab__wrp-tab-heads--border">${tabs.map(it => it.btnTab)}</div>`.vee.appendTo(wrp);
		tabs.forEach(it => it.wrpTab.vee.appendTo(wrp));

		this._buildInfoTab(infoTab.wrpTab, cb);
		this._buildRequiresTab(reqTab.wrpTab, cb);
		this._buildInheritsTab(inheritsTab.wrpTab, cb);
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

		BuilderUi.getStateIptEnum(
			"Edition", cb, this._state,
			{nullable: true, vals: ["classic"], fnDisplay: () => "Classic"},
			"edition",
		).vee.appendTo(wrp);

		BuilderUi.getStateIptBoolean("Ammunition Variant", cb, this._state, {nullable: true}, "ammo").vee.appendTo(wrp);

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
		veT`<div class="ve-muted ve-mb-2" style="font-size:.82em">Each row adds items that qualify. A base item becomes a specific variant if it matches <em>any</em> row below.</div>`.vee.appendTo(wrp);

		const wrpReq = veT`<div class="ve-flex-col ve-w-100"></div>`.vee.appendTo(wrp);
		const reqRows = [];

		const saveRequires = () => {
			this.__state.requires = reqRows.flatMap(r => r.getConditions()).filter(c => Object.keys(c).length > 0);
			cb();
		};

		const addReqRow = (uiData) => {
			const ctrl = this._buildConditionRow(uiData || {category: "weapon", subtype: "any", edition: "both"}, saveRequires);
			ctrl.btnDelete.vee.onn("click", () => {
				reqRows.splice(reqRows.indexOf(ctrl), 1);
				ctrl.element.remove();
				saveRequires();
			});
			ctrl.element.vee.appendTo(wrpReq);
			reqRows.push(ctrl);
		};

		MagicVariantBuilder._parseConditionsToUIData(this.__state.requires || []).forEach(d => addReqRow(d));

		veT`<button class="ve-btn ve-btn-xs ve-btn-default ve-mt-1">+ Add Row</button>`
			.vee.onn("click", () => addReqRow(null))
			.vee.appendTo(wrp);

		// --- Excludes ---
		this._buildSectionHeader("Exclusions", wrp);
		veT`<div class="ve-muted ve-mb-2" style="font-size:.82em">Items matching any exclusion are removed even if they satisfy a row above.</div>`.vee.appendTo(wrp);
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

		const element = veT`<div class="ve-flex ve-flex-wrap ve-gap-1 ve-py-1 ve-flex-v-center ve-mb-1 ve-px-1" style="border-left:3px solid var(--col-border-default,#888)"></div>`;

		// Category
		const catSel = veT`<select class="ve-form-control ve-input-xs">
			${_COND_CATEGORIES.map(c => `<option value="${c.v}">${c.label}</option>`)}
		</select>`.vee.val(state.category);

		// Sub-type (contents are rebuilt when category changes)
		const subSel = veT`<select class="ve-form-control ve-input-xs"></select>`;

		const rebuildSubOpts = () => {
			const cat = catSel.vee.val();
			const prev = subSel.vee.val();
			subSel.vee.empty();
			let opts = [];
			if (cat === "weapon") opts = _WEAPON_TYPES;
			else if (cat === "armor") opts = _ARMOR_TYPES;
			else if (cat === "ammo")  opts = _AMMO_TYPES;
			opts.forEach(o => subSel.vee.appends(`<option value="${o.v}">${o.label}</option>`));
			subSel.vee.val(opts.find(o => o.v === prev) ? prev : (opts[0]?.v ?? ""));
			subSel.vee.toggle(opts.length > 0);
		};

		// Edition — only shown when the chosen selection uses a type string (not a boolean flag)
		const edSel = veT`<select class="ve-form-control ve-input-xs">
			<option value="both">Any Edition</option>
			<option value="classic">Classic (pre-2024)</option>
			<option value="new">2024 (One D&D)</option>
		</select>`.vee.val(state.edition);

		// Weapon category — only shown for weapon rows
		const wpnCatSel = veT`<select class="ve-form-control ve-input-xs">
			<option value="any">Any Category</option>
			<option value="simple">Simple Weapons</option>
			<option value="martial">Martial Weapons</option>
		</select>`.vee.val(state.weaponCategory || "any");

		// Specific-item: chip list + modal-select button
		const selectedItems = [...(state.items || [])]; // [{name, source}]
		const wrpSpecific = veT`<div class="ve-flex-col ve-w-100 ve-mt-1"></div>`;

		const renderChips = () => {
			wrpSpecific.vee.empty();
			const chipRow = veT`<div class="ve-flex ve-flex-wrap ve-gap-1 ve-mb-1"></div>`.vee.appendTo(wrpSpecific);
			selectedItems.forEach((item, idx) => {
				const chip = veT`<div class="ve-flex-v-center ve-badge ve-badge--default ve-no-select" style="cursor:default">
					${item.name}
					<button class="ve-btn ve-btn-danger ve-p-0 ve-ml-1" style="font-size:.7em;line-height:1;border:none;background:none;color:inherit" title="Remove">×</button>
				</div>`;
				chip.querySelector("button").addEventListener("click", () => {
					selectedItems.splice(idx, 1);
					renderChips();
					onChange();
				});
				chipRow.vee.appends(chip);
			});
			if (!selectedItems.length) {
				veT`<span class="ve-muted ve-italic" style="font-size:.85em">No items selected — click Add to choose.</span>`.vee.appendTo(chipRow);
			}
			veT`<button class="ve-btn ve-btn-xs ve-btn-default">+ Add Items...</button>`
				.vee.onn("click", async () => {
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
				.vee.appendTo(wrpSpecific);
		};

		renderChips();

		const updateVisibility = () => {
			const cat = catSel.vee.val();
			const sub = subSel.vee.val();
			// Edition selector: only relevant when the selection produces type-string conditions (not boolean flags)
			const needsEdition = (cat === "weapon" && (sub === "melee" || sub === "ranged"))
				|| (cat === "armor" && sub !== "any")
				|| cat === "shield" || cat === "ammo" || cat === "scf";
			edSel.vee.toggle(needsEdition);
			wpnCatSel.vee.toggle(cat === "weapon");
			subSel.vee.toggle(cat !== "specific" && subSel.options?.length > 0);
			wrpSpecific.vee.toggle(cat === "specific");
		};

		catSel.vee.onn("change", () => { rebuildSubOpts(); updateVisibility(); onChange(); });
		subSel.vee.onn("change", () => { updateVisibility(); onChange(); });
		edSel.vee.onn("change", onChange);
		wpnCatSel.vee.onn("change", onChange);

		rebuildSubOpts();
		subSel.vee.val(state.subtype ?? subSel.vee.val());
		updateVisibility();

		const btnDelete = veT`<button class="ve-btn ve-btn-xs ve-btn-danger ve-align-self-start"><span class="glyphicon glyphicon-trash"></span></button>`;

		const topRow = veT`<div class="ve-flex ve-flex-wrap ve-gap-1 ve-flex-v-center"></div>`
			.vee.appends(catSel).vee.appends(subSel).vee.appends(edSel).vee.appends(wpnCatSel).vee.appends(btnDelete);
		element.vee.appends(topRow).vee.appends(wrpSpecific);

		const getConditions = () => {
			const cat   = catSel.vee.val();
			const sub   = subSel.vee.val();
			const ed    = edSel.vee.val();
			const eds   = ed === "both" ? ["classic", "new"] : [ed];
			const wc    = wpnCatSel.vee.val();

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

		const cbBullet = veT`<input type="checkbox">`;  cbBullet.checked = hasBullet;
		const cbCell   = veT`<input type="checkbox">`;  cbCell.checked   = hasCell;
		const cbNet    = veT`<input type="checkbox">`;  cbNet.checked    = hasNet;

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

		cbBullet.vee.onn("change", save);
		cbCell.vee.onn("change", save);
		cbNet.vee.onn("change", save);

		veT`<div class="ve-flex ve-flex-col ve-gap-1 ve-mb-2">
			<label class="ve-flex-v-center ve-no-select">${cbBullet} <span class="ve-ml-1">Firearm Ammunition (bullets)</span></label>
			<label class="ve-flex-v-center ve-no-select">${cbCell}   <span class="ve-ml-1">Energy Cells</span></label>
			<label class="ve-flex-v-center ve-no-select">${cbNet}    <span class="ve-ml-1">Nets</span></label>
		</div>`.vee.appendTo(wrp);

		veT`<div class="ve-bold ve-mb-1" style="font-size:.82em">Specific items to exclude:</div>`.vee.appendTo(wrp);

		const wrpChips = veT`<div class="ve-flex ve-flex-wrap ve-gap-1 ve-mb-1"></div>`.vee.appendTo(wrp);

		const renderExcludeChips = () => {
			wrpChips.vee.empty();
			excludedItems.forEach((item, idx) => {
				const chip = veT`<div class="ve-flex-v-center ve-badge ve-badge--default ve-no-select" style="cursor:default">
					${item.name}
					<button class="ve-btn ve-btn-danger ve-p-0 ve-ml-1" style="font-size:.7em;line-height:1;border:none;background:none;color:inherit" title="Remove">×</button>
				</div>`;
				chip.querySelector("button").addEventListener("click", () => {
					excludedItems.splice(idx, 1);
					renderExcludeChips();
					save();
				});
				wrpChips.vee.appends(chip);
			});
			if (!excludedItems.length) {
				veT`<span class="ve-muted ve-italic" style="font-size:.85em">No items excluded — click Add to choose.</span>`.vee.appendTo(wrpChips);
			}
		};

		renderExcludeChips();

		veT`<button class="ve-btn ve-btn-xs ve-btn-default ve-mt-1">+ Exclude Items...</button>`
			.vee.onn("click", async () => {
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
			.vee.appendTo(wrp);
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
		).vee.appendTo(wrp);

		BuilderUi.getStateIptEnum(
			"Tier", cb, inh,
			{nullable: true, vals: ["minor", "major"], fnDisplay: v => v.toTitleCase()},
			"tier",
		).vee.appendTo(wrp);

		this._buildSectionHeader("Attunement", wrp);
		this._buildAttuneInput(wrp, cb);

		this._buildSectionHeader("Charges", wrp);
		this._buildChargesInput(wrp, cb);

		this._buildSectionHeader("Flags", wrp);
		BuilderUi.getStateIptBoolean("Wondrous Item",              cb, inh, {nullable: true}, "wondrous").vee.appendTo(wrp);
		BuilderUi.getStateIptBoolean("Cursed",                     cb, inh, {nullable: true}, "curse").vee.appendTo(wrp);
		BuilderUi.getStateIptBoolean("Sentient",                   cb, inh, {nullable: true}, "sentient").vee.appendTo(wrp);
		BuilderUi.getStateIptBoolean("Stealth Disadvantage",       cb, inh, {nullable: true}, "stealth").vee.appendTo(wrp);

		this._buildSectionHeader("Armor", wrp);
		this._buildStrengthInput(wrp, cb);

		this._buildSectionHeader("Loot Tables", wrp);
		this._buildLootTablesInput(wrp, cb);

	}

	_buildAttuneInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Requires Attunement", {isRow: true});
		const inh = this.__state.inherits;

		const iptText = veT`<input type="text" class="ve-form-control ve-input-xs ve-flex-1 ve-ml-1" placeholder="condition text">`;

		const sel = veT`<select class="ve-form-control ve-input-xs">
			<option value="no">No</option>
			<option value="yes">Yes (Any)</option>
			<option value="optional">Optional</option>
			<option value="text">Yes, with condition...</option>
		</select>`.vee.onn("change", () => {
			const mode = sel.vee.val();
			iptText.vee.toggle(mode === "text");
			if (mode === "no")            { inh.reqAttune = null; cb(); }
			else if (mode === "yes")      { inh.reqAttune = true; cb(); }
			else if (mode === "optional") { inh.reqAttune = "optional"; cb(); }
		});

		iptText.vee.onn("change", () => {
			inh.reqAttune = iptText.vee.val().trim() || true;
			cb();
		});

		const cur = inh?.reqAttune;
		if (!cur)                    sel.vee.val("no");
		else if (cur === true)        sel.vee.val("yes");
		else if (cur === "optional")  sel.vee.val("optional");
		else { sel.vee.val("text"); iptText.vee.val(cur); }

		iptText.vee.toggle(sel.vee.val() === "text");

		sel.vee.appendTo(rowInner);
		iptText.vee.appendTo(rowInner);
		row.vee.appendTo(wrp);
	}

	_buildInheritsEnumRow (label, wrp, cb, key) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple(label, {isRow: true});
		const inh = this.__state.inherits;

		const sel = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:90px">
			<option value="">(none)</option>
			${_BONUS_VALS.map(v => `<option value="${v}">${v}</option>`)}
		</select>`.vee.val(inh?.[key] || "").vee.onn("change", () => {
			inh[key] = sel.vee.val() || null;
			cb();
		});
		rowInner.vee.appends(sel);
		row.vee.appendTo(wrp);
	}

	_buildChargesInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Charges", {isRow: true});
		const inh = this.__state.inherits;

		const iptCharges = veT`<input type="number" class="ve-form-control ve-input-xs" style="width:70px" min="1" max="999" placeholder="#">`
			.vee.val(inh?.charges ?? "")
			.vee.onn("change", () => doUpdate());

		const selRecharge = veT`<select class="ve-form-control ve-input-xs ve-ml-1">
			<option value="">(No Recharge)</option>
			${_RECHARGE_VALS.map(r => `<option value="${r.v}">${r.label}</option>`)}
		</select>`.vee.val(inh?.recharge || "").vee.onn("change", () => doUpdate());

		const doUpdate = () => {
			const n = parseInt(iptCharges.vee.val());
			inh.charges = isNaN(n) ? null : n;
			inh.recharge = selRecharge.vee.val() || null;
			cb();
		};

		rowInner.vee.appends(iptCharges).vee.appends(selRecharge);
		row.vee.appendTo(wrp);
	}

	_buildStrengthInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Min. Strength", {isRow: true});
		const inh = this.__state.inherits;

		const ipt = veT`<input type="number" class="ve-form-control ve-input-xs" style="width:70px" min="1" max="30" placeholder="#">`
			.vee.val(inh?.strength ?? "")
			.vee.onn("change", () => {
				const v = parseInt(ipt.vee.val());
				inh.strength = isNaN(v) ? null : v;
				cb();
			});
		rowInner.vee.appends(ipt);
		veT`<span class="ve-muted ve-ml-2" style="font-size:.85em">(for heavy armor only)</span>`.vee.appendTo(rowInner);
		row.vee.appendTo(wrp);
	}

	_buildLootTablesInput (wrp, cb) {
		const inh = this.__state.inherits;
		const wrpList = veT`<div class="ve-flex-col ve-w-100"></div>`.vee.appendTo(wrp);

		const save = () => {
			inh.lootTables = [...wrpList.querySelectorAll(".mv-loot-row input")]
				.map(el => el.value.trim())
				.filter(Boolean);
			cb();
		};

		const addRow = (v) => {
			const ipt = veT`<input type="text" class="ve-form-control ve-input-xs ve-flex-1" list="mv-loot-datalist" placeholder="Table name...">`.vee.val(v || "");
			ipt.vee.onn("change", save);
			const btnDel = veT`<button class="ve-btn ve-btn-xs ve-btn-danger ve-ml-1"><span class="glyphicon glyphicon-trash"></span></button>`.vee.onn("click", () => {
				rowEl.remove(); save();
			});
			const rowEl = veT`<div class="ve-flex ve-gap-1 ve-mb-1 mv-loot-row">${ipt}${btnDel}</div>`.vee.appendTo(wrpList);
		};

		veT`<datalist id="mv-loot-datalist">${_LOOT_TABLES_BASE.map(t => `<option value="${t}">`)}</datalist>`.vee.appendTo(wrp);
		(inh?.lootTables || []).forEach(t => addRow(t));

		veT`<button class="ve-btn ve-btn-xs ve-btn-default ve-mt-1">+ Add Table</button>`
			.vee.onn("click", () => addRow(""))
			.vee.appendTo(wrp);
	}

	// =========================================================================
	// -- Bonuses tab --
	// =========================================================================

	_buildBonusesTab (wrp, cb) {
		veT`<div class="mkbru__row ve-mb-2 ve-muted" style="font-size:.85em">Bonus values are strings such as "+1", "+2", "+3". All fields go into the inherited item.</div>`.vee.appendTo(wrp);

		this._buildSectionHeader("Weapon", wrp);
		this._buildInheritsWeaponBonusField(wrp, cb);
		this._buildInheritsEnumRow("Weapon Crit Damage", wrp, cb, "bonusWeaponCritDamage");

		this._buildSectionHeader("Defenses", wrp);
		this._buildInheritsEnumRow("Armor Class",  wrp, cb, "bonusAc");
		this._buildInheritsEnumRow("Saving Throw", wrp, cb, "bonusSavingThrow");

		this._buildSectionHeader("Spells", wrp);
		this._buildInheritsEnumRow("Spell Damage",  wrp, cb, "bonusSpellDamage");
		this._buildInheritsEnumRow("Spell Attack",  wrp, cb, "bonusSpellAttack");
		this._buildInheritsEnumRow("Spell Save DC", wrp, cb, "bonusSpellSaveDc");

		this._buildSectionHeader("Checks", wrp);
		this._buildInheritsEnumRow("Ability Check",     wrp, cb, "bonusAbilityCheck");
		this._buildInheritsEnumRow("Proficiency Bonus", wrp, cb, "bonusProficiencyBonus");

		this._buildSectionHeader("Ability Score Adjustment", wrp);
		this._buildInheritsAbilityInput(wrp, cb);

		this._buildSectionHeader("Speed Modification", wrp);
		this._buildInheritsModifySpeedInput(wrp, cb);

		this._buildSectionHeader("Damage Defenses", wrp);
		this._buildInheritsDamageDefenseInput("Vulnerability", wrp, cb, "vulnerable");
		this._buildInheritsDamageDefenseInput("Resistance",    wrp, cb, "resist");
		this._buildInheritsDamageDefenseInput("Immunity",      wrp, cb, "immune");
		this._buildInheritsConditionImmuneInput(wrp, cb);
	}

	_buildInheritsWeaponBonusField (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Weapon Bonus", {isRow: true});
		const inh = this.__state.inherits;

		const existingBonus = inh.bonusWeapon || inh.bonusWeaponAttack || inh.bonusWeaponDamage || "";
		const hasAny  = !!(inh.bonusWeapon || inh.bonusWeaponAttack || inh.bonusWeaponDamage);
		const initAtk = !hasAny || !!(inh.bonusWeapon || inh.bonusWeaponAttack);
		const initDmg = !hasAny || !!(inh.bonusWeapon || inh.bonusWeaponDamage);

		const doUpdate = () => {
			const bonus = sel.vee.val();
			const isAtk = cbAtk.prop("checked");
			const isDmg = cbDmg.prop("checked");
			delete inh.bonusWeapon; delete inh.bonusWeaponAttack; delete inh.bonusWeaponDamage;
			if (bonus && (isAtk || isDmg)) {
				if (isAtk && isDmg)  inh.bonusWeapon       = bonus;
				else if (isAtk)      inh.bonusWeaponAttack  = bonus;
				else                 inh.bonusWeaponDamage  = bonus;
			}
			cb();
		};

		const sel = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:90px">
			<option value="">(none)</option>
			${_BONUS_VALS.map(v => `<option value="${v}">${v}</option>`).join("")}
		</select>`.vee.val(existingBonus).vee.onn("change", doUpdate);

		const cbAtk = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", initAtk).vee.onn("change", doUpdate);
		const cbDmg = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", initDmg).vee.onn("change", doUpdate);

		rowInner
			.vee.appends(sel)
			.vee.appends(veT`<label class="ve-flex-v-center ve-ml-2 ve-no-select">${cbAtk}<span>Attack</span></label>`)
			.vee.appends(veT`<label class="ve-flex-v-center ve-ml-2 ve-no-select">${cbDmg}<span>Damage</span></label>`);
		row.vee.appendTo(wrp);
	}

	_buildInheritsAbilityInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Adjust", {isRow: true});
		const inh = this.__state.inherits;

		const getMode = () => {
			if (!inh.ability) return "none";
			if (inh.ability.static) return "static";
			return "modifier";
		};

		const wrpInputs = veT`<div class="ve-flex-col ve-ml-2" style="flex:1"></div>`.vee.appendTo(rowInner);

		const selMode = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:100px">
			<option value="none">(None)</option>
			<option value="modifier">Modifier</option>
			<option value="static">Set to Value</option>
		</select>`.vee.val(getMode()).vee.appendTo(rowInner);

		const buildInputs = () => {
			wrpInputs.vee.empty();
			const mode = selMode.vee.val();
			if (mode === "none") { delete inh.ability; cb(); return; }

			if (mode === "modifier") {
				const cur = inh.ability && !inh.ability.static ? inh.ability : {};
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
							if (Object.keys(obj).length) inh.ability = obj;
							else delete inh.ability;
							cb();
						});
					inputs[abl] = ipt;
					veT`<div class="ve-flex-col ve-flex-vh-center" style="gap:2px">
						<span style="font-size:.75em;font-weight:bold">${abl.toUpperCase()}</span>
					</div>`.vee.appends(ipt).vee.appendTo(row2);
				});
			} else if (mode === "static") {
				const cur = inh.ability?.static || {};
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
					if (!isNaN(v)) inh.ability = {static: {[abl]: v}};
					else delete inh.ability;
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

	_buildInheritsModifySpeedInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Modify Speed", {isRow: true});
		const inh = this.__state.inherits;

		const getMode = () => {
			if (!inh.modifySpeed) return "none";
			return Object.keys(inh.modifySpeed)[0] || "none";
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
			if (mode === "none") { delete inh.modifySpeed; cb(); return; }

			const curInner = (inh.modifySpeed || {})[mode] || {};

			if (mode === "bonus" || mode === "static") {
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
					if (!isNaN(v)) inh.modifySpeed = {[mode]: {[selSpeed.vee.val()]: v}};
					else delete inh.modifySpeed;
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
					if (!isNaN(v)) inh.modifySpeed = {multiply: {[selSpeed.vee.val()]: v}};
					else delete inh.modifySpeed;
					cb();
				};
				selSpeed.vee.onn("change", doUpdate);
				ipt.vee.onn("change", doUpdate);

			} else if (mode === "equal") {
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
					inh.modifySpeed = {equal: {[selTarget.vee.val()]: selSource.vee.val()}};
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

	_buildInheritsDamageDefenseInput (label, wrp, cb, prop) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple(label, {isRow: false});
		const inh = this.__state.inherits;
		const cur = new Set(inh[prop] || []);

		const checkboxes = _DAMAGE_TYPES.map(({abv, name}) => {
			const chk = veT`<input type="checkbox" class="ve-mr-1">`
				.prop("checked", cur.has(abv))
				.vee.onn("change", () => {
					const selected = checkboxes.filter(c => c.chk.prop("checked")).map(c => c.abv);
					if (selected.length) inh[prop] = selected;
					else delete inh[prop];
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

	_buildInheritsConditionImmuneInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Condition Immunity", {isRow: false});
		const inh = this.__state.inherits;
		const cur = new Set(inh.conditionImmune || []);

		const checkboxes = _CONDITIONS.map(cond => {
			const chk = veT`<input type="checkbox" class="ve-mr-1">`
				.prop("checked", cur.has(cond))
				.vee.onn("change", () => {
					const selected = checkboxes.filter(c => c.chk.prop("checked")).map(c => c.cond);
					if (selected.length) inh.conditionImmune = selected;
					else delete inh.conditionImmune;
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
		this._buildInheritsTypeFlagsSection(wrp, cb);

		this._buildSectionHeader("Spellcasting Focus", wrp);
		this._buildInheritsFocusSection(wrp, cb);

		this._buildSectionHeader("Miscellaneous Flags", wrp);
		this._buildInheritsMiscFlagsSection(wrp, cb);

		this._buildSectionHeader("Light Emission", wrp);
		this._buildInheritsLightInput(wrp, cb);

		this._buildSectionHeader("Attunement Conditions", wrp);
		this._buildInheritsAttuneTagsInput(wrp, cb);
	}

	_buildInheritsCheckboxRow (label, wrp, cb, key) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple(label, {isRow: true});
		const inh = this.__state.inherits;
		const chk = veT`<input type="checkbox">`.prop("checked", !!inh[key])
			.vee.onn("change", () => {
				if (chk.prop("checked")) inh[key] = true;
				else delete inh[key];
				cb();
			});
		rowInner.vee.appends(chk);
		row.vee.appendTo(wrp);
	}

	_buildInheritsTypeFlagsSection (wrp, cb) {
		const inh = this.__state.inherits;

		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Weapon Category", {isRow: true});
			const sel = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:110px">
				<option value="">(None)</option>
				${_INH_WEAPON_CATEGORIES.map(c => `<option value="${c.v}">${c.label}</option>`).join("")}
			</select>`.vee.val(inh.weaponCategory || "")
				.vee.onn("change", () => {
					const v = sel.vee.val();
					if (v) inh.weaponCategory = v; else delete inh.weaponCategory;
					cb();
				});
			rowInner.vee.appends(sel);
			row.vee.appendTo(wrp);
		}

		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Age", {isRow: true});
			const sel = veT`<select class="ve-form-control ve-input-xs form-control--minimal" style="max-width:130px">
				<option value="">(None)</option>
				${_AGE_VALS.map(a => `<option value="${a.v}">${a.label}</option>`).join("")}
			</select>`.vee.val(inh.age || "")
				.vee.onn("change", () => {
					const v = sel.vee.val();
					if (v) inh.age = v; else delete inh.age;
					cb();
				});
			rowInner.vee.appends(sel);
			row.vee.appendTo(wrp);
		}

		this._buildInheritsCheckboxRow("Firearm", wrp, cb, "firearm");
		this._buildInheritsCheckboxRow("Staff",   wrp, cb, "staff");
		this._buildInheritsCheckboxRow("Tattoo",  wrp, cb, "tattoo");
		this._buildInheritsCheckboxRow("Ammo",    wrp, cb, "ammo");
		this._buildInheritsCheckboxRow("Poison",  wrp, cb, "poison");
	}

	_buildInheritsFocusSection (wrp, cb) {
		const inh = this.__state.inherits;

		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Focus For", {isRow: false});
			const cur = inh.focus;
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
					inh.focus = true;
				} else {
					const selected = classChecks.filter(c => c.chk.prop("checked")).map(c => c.cls);
					if (selected.length) inh.focus = selected;
					else delete inh.focus;
				}
				cb();
			};
			cbAll.vee.onn("change", doUpdate);
			classChecks.forEach(c => c.chk.vee.onn("change", doUpdate));
			row.vee.appendTo(wrp);
		}

		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("SCF Subtype", {isRow: true,
				title: "For Spellcasting Focus type items, specifies which spellcasting tradition uses it."});
			const inh2 = this.__state.inherits;
			const sel = veT`<select class="ve-form-control ve-input-xs form-control--minimal">
				<option value="">(None)</option>
				${_FOCUS_SCF_TYPES.map(t => `<option value="${t.v}">${t.label}</option>`).join("")}
			</select>`.vee.val(inh2.scfType || "")
				.vee.onn("change", () => {
					const v = sel.vee.val();
					if (v) inh2.scfType = v; else delete inh2.scfType;
					cb();
				});
			rowInner.vee.appends(sel);
			row.vee.appendTo(wrp);
		}
	}

	_buildInheritsMiscFlagsSection (wrp, cb) {
		const inh = this.__state.inherits;

		this._buildInheritsCheckboxRow("Grants Proficiency", wrp, cb, "grantsProficiency");
		this._buildInheritsCheckboxRow("Grants Language",    wrp, cb, "grantsLanguage");

		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Crit Threshold", {isRow: true,
				title: "Minimum die roll needed to score a critical hit (default 20)."});
			const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="e.g. 19" style="max-width:70px">`
				.vee.val(inh.critThreshold != null ? inh.critThreshold : "")
				.vee.onn("change", () => {
					const v = parseInt(ipt.vee.val());
					if (!isNaN(v)) inh.critThreshold = v;
					else delete inh.critThreshold;
					cb();
				});
			rowInner.vee.appends(ipt);
			row.vee.appendTo(wrp);
		}

		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Misc Tags", {isRow: false});
			const cur = new Set(inh.miscTags || []);
			const checkboxes = _MISC_TAGS.map(({v, label}) => {
				const chk = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", cur.has(v))
					.vee.onn("change", () => {
						const selected = checkboxes.filter(c => c.chk.prop("checked")).map(c => c.v);
						if (selected.length) inh.miscTags = selected;
						else delete inh.miscTags;
						cb();
					});
				return {v, chk, ele: veT`<label class="ve-flex-v-center ve-mr-3" style="font-weight:normal;cursor:pointer">${chk}<span>${label}</span></label>`};
			});
			rowInner.style.flexWrap = "wrap";
			checkboxes.forEach(c => rowInner.vee.appends(c.ele));
			row.vee.appendTo(wrp);
		}

		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Poison Types", {isRow: false});
			const cur = new Set(inh.poisonTypes || []);
			const checkboxes = _POISON_TYPES.map(({v, label}) => {
				const chk = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", cur.has(v))
					.vee.onn("change", () => {
						const selected = checkboxes.filter(c => c.chk.prop("checked")).map(c => c.v);
						if (selected.length) inh.poisonTypes = selected;
						else delete inh.poisonTypes;
						cb();
					});
				return {v, chk, ele: veT`<label class="ve-flex-v-center ve-mr-3" style="font-weight:normal;cursor:pointer">${chk}<span>${label}</span></label>`};
			});
			rowInner.style.flexWrap = "wrap";
			checkboxes.forEach(c => rowInner.vee.appends(c.ele));
			row.vee.appendTo(wrp);
		}
	}

	_buildInheritsLightInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Range", {isRow: true});
		const inh = this.__state.inherits;
		const cur = (inh.light || [])[0] || {};

		const iptBright = veT`<input class="ve-form-control ve-input-xs form-control--minimal ve-text-center" placeholder="bright ft." style="width:70px">`.vee.val(cur.bright ?? "");
		const iptDim    = veT`<input class="ve-form-control ve-input-xs form-control--minimal ve-text-center" placeholder="dim ft."   style="width:70px">`.vee.val(cur.dim    ?? "");

		const doUpdate = () => {
			const bright = parseInt(iptBright.vee.val());
			const dim    = parseInt(iptDim.vee.val());
			const entry  = {};
			if (!isNaN(bright)) entry.bright = bright;
			if (!isNaN(dim))    entry.dim    = dim;
			if (Object.keys(entry).length) inh.light = [entry];
			else delete inh.light;
			cb();
		};
		iptBright.vee.onn("change", doUpdate);
		iptDim.vee.onn("change", doUpdate);

		rowInner.vee.appends(iptBright)
			.vee.appends(veT`<span class="ve-muted ve-mx-1" style="font-size:.85em">bright /</span>`)
			.vee.appends(iptDim)
			.vee.appends(veT`<span class="ve-muted ve-ml-1" style="font-size:.85em">dim</span>`);
		row.vee.appendTo(wrp);
	}

	_buildInheritsAttuneTagsInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Class Requirement", {isRow: false});
		const inh = this.__state.inherits;
		veT`<div class="ve-muted ve-mb-1" style="font-size:.8em">Specify which classes may attune to this item (in addition to the condition above).</div>`.vee.appendTo(rowInner);

		const cur = inh.reqAttuneTags || [];
		const curClasses = new Set(cur.filter(t => t.class).map(t => t.class.split("|")[0].toLowerCase()));
		const hasSpellcasting = cur.some(t => t.spellcasting);
		const hasPsionics     = cur.some(t => t.psionics);

		const save = () => {
			const tags = [];
			if (cbSpellcasting.prop("checked")) tags.push({spellcasting: true});
			if (cbPsionics.prop("checked"))     tags.push({psionics: true});
			classChecks.filter(c => c.chk.prop("checked")).forEach(c => tags.push({class: c.cls.toLowerCase()}));
			if (tags.length) inh.reqAttuneTags = tags;
			else delete inh.reqAttuneTags;
			cb();
		};

		const cbSpellcasting = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", hasSpellcasting).vee.onn("change", save);
		const cbPsionics     = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", hasPsionics).vee.onn("change", save);

		veT`<div class="ve-flex ve-flex-wrap ve-mb-1" style="gap:4px"></div>`
			.vee.appends(veT`<label class="ve-flex-v-center ve-mr-3" style="font-weight:normal;cursor:pointer">${cbSpellcasting}<span>Any Spellcaster</span></label>`)
			.vee.appends(veT`<label class="ve-flex-v-center ve-mr-3" style="font-weight:normal;cursor:pointer">${cbPsionics}<span>Psionics</span></label>`)
			.vee.appendTo(rowInner);

		const ALL_CLASSES = ["Artificer", "Barbarian", "Bard", "Cleric", "Druid", "Fighter", "Monk", "Paladin", "Ranger", "Rogue", "Sorcerer", "Warlock", "Wizard"];
		const wrpClasses = veT`<div class="ve-flex ve-flex-wrap" style="gap:4px"></div>`.vee.appendTo(rowInner);
		const classChecks = ALL_CLASSES.map(cls => {
			const chk = veT`<input type="checkbox" class="ve-mr-1">`.prop("checked", curClasses.has(cls.toLowerCase())).vee.onn("change", save);
			return {cls, chk, ele: veT`<label class="ve-flex-v-center ve-mr-2" style="font-weight:normal;cursor:pointer;font-size:.85em">${chk}<span>${cls}</span></label>`.vee.appendTo(wrpClasses)};
		});

		{
			const [row2, rowInner2] = BuilderUi.getLabelledRowTuple("Alt. Attunement", {isRow: true,
				title: "An alternate attunement path (e.g. \"optional\"). Rare — most items don't need this."});
			const ipt = veT`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder='e.g. "optional"'>`
				.vee.val(inh.reqAttuneAlt || "")
				.vee.onn("change", () => {
					const v = ipt.vee.val().trim();
					if (v === "true") inh.reqAttuneAlt = true;
					else if (v) inh.reqAttuneAlt = v;
					else delete inh.reqAttuneAlt;
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
		this._buildSectionHeader("Attached Spells", wrp);
		this._buildInheritsAttachedSpellsInput(wrp, cb);
	}

	_buildInheritsAttachedSpellsInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Spells", {isRow: false});
		const inh = this.__state.inherits;
		veT`<div class="ve-muted ve-mb-1" style="font-size:.8em">For daily/charges scheduling, edit the JSON Data tab directly.</div>`.vee.appendTo(rowInner);

		const wrpRows = veT`<div class="ve-flex-col"></div>`.vee.appendTo(rowInner);
		const rows = [];

		const saveSpells = () => {
			const vals = rows.map(r => r.name);
			if (vals.length) inh.attachedSpells = vals;
			else delete inh.attachedSpells;
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

		const raw = inh.attachedSpells;
		if (Array.isArray(raw)) raw.forEach(s => addRow(s));

		veT`<button class="ve-btn ve-btn-xs ve-btn-default ve-mt-1">+ Add Spells</button>`
			.vee.onn("click", async () => {
				this._modalFilterSpells ??= new ModalFilterSpells({namespace: "makebrew.magicvariant.spells"});
				const selected = await this._modalFilterSpells.pGetUserSelection();
				if (!selected?.length) return;
				selected.forEach(it => addRow(it.name.toLowerCase()));
				saveSpells();
			})
			.vee.appendTo(rowInner);

		row.vee.appendTo(wrp);
	}

	// =========================================================================
	// -- Text tab --
	// =========================================================================

	_buildTextTab (wrp, cb) {
		const inh = this.__state.inherits;

		this._buildSectionHeader("Variant Text", wrp);
		veT`<div class="ve-muted ve-mb-1" style="font-size:.82em">Appears on the generic variant listing only.</div>`.vee.appendTo(wrp);
		BuilderUi.getStateIptEntries(
			"Text", cb, this._state,
			{fnPostProcess: BuilderUi.fnPostProcessDice},
			"entries",
		).vee.appendTo(wrp);

		this._buildSectionHeader("Inherited Description", wrp);
		veT`<div class="ve-muted ve-mb-1" style="font-size:.82em">Appears on every specific variant created from this template.</div>`.vee.appendTo(wrp);
		BuilderUi.getStateIptEntries(
			"Text", cb, inh,
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

	_buildInheritsStringRow (label, wrp, cb, key) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple(label, {isRow: true});
		const inh = this.__state.inherits;
		const ipt = veT`<input type="text" class="ve-form-control ve-input-xs ve-flex-1" placeholder="(none)">`;
		ipt.vee.val(inh?.[key] || "");
		ipt.vee.onn("change", () => {
			inh[key] = ipt.vee.val() || null;
			cb();
		});
		rowInner.vee.appends(ipt);
		row.vee.appendTo(wrp);
	}

	// =========================================================================
	// -- Output rendering --
	// =========================================================================

	_renderOutput () {
		const wrp = this._ui.wrpOutput.vee.empty();
		this._resetTabs({tabGroup: "output"});

		const tabs = this._renderTabs(
			[
				new TabUiUtil.TabMeta({name: "Preview"}),
				new TabUiUtil.TabMeta({name: "Data"}),
			],
			{tabGroup: "output", cbTabChange: this.doUiSave.bind(this)},
		);
		const [previewTab, dataTab] = tabs;
		veT`<div class="ve-flex-v-center ve-w-100 ve-no-shrink">${tabs.map(it => it.btnTab)}</div>`.vee.appendTo(wrp);
		tabs.forEach(it => it.wrpTab.vee.appendTo(wrp));

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

			const tbl = veT`<table class="ve-w-100 ve-stats"></table>`.vee.appendTo(previewTab.wrpTab);
			tbl.vee.appends(Renderer.utils.getBorderTr());
			tbl.vee.appends(Renderer.item.getCompactRenderedString(procItem));
			tbl.vee.appends(Renderer.utils.getPageTr(procItem));
			tbl.vee.appends(Renderer.utils.getBorderTr());
		} catch (e) {
			veT`<div class="ve-muted ve-italic ve-p-2">Preview unavailable: ${e.message}</div>`.vee.appendTo(previewTab.wrpTab);
		}

		// Raw JSON
		const cleanState = DataUtil.cleanJson(MiscUtil.copy(this.__state));
		cleanState.type = `GV|${cleanState.source}`;
		if (cleanState.inherits) {
			cleanState.inherits.source = cleanState.source;
			cleanState.inherits.page   = cleanState.page || "";
		}

		const tblData = veT`<table class="ve-w-100 ve-stats ve-stats--book mkbru__wrp-output-tab-data"></table>`.vee.appendTo(dataTab.wrpTab);
		const asCode = Renderer.get().render({
			type: "entries",
			entries: [{
				type: "code",
				name: "Data",
				preformatted: JSON.stringify(cleanState, null, "\t"),
			}],
		});
		tblData.vee.appends(Renderer.utils.getBorderTr());
		tblData.vee.appends(`<tr><td colspan="6">${asCode}</td></tr>`);
		tblData.vee.appends(Renderer.utils.getBorderTr());
	}
}
