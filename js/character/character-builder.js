import {BuilderBase} from "../makebrew/makebrew-builder-base.js";
import {BuilderUi} from "../makebrew/makebrew-builderui.js";
import {SITE_STYLE__CLASSIC, SITE_STYLE__ONE} from "../consts.js";
import {VetoolsConfig} from "../utils-config/utils-config-config.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const _ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const _ABILITY_FULL = {str: "Strength", dex: "Dexterity", con: "Constitution", int: "Intelligence", wis: "Wisdom", cha: "Charisma"};
const _SKILLS = [
	{name: "Acrobatics",      ability: "dex"},
	{name: "Animal Handling", ability: "wis"},
	{name: "Arcana",          ability: "int"},
	{name: "Athletics",       ability: "str"},
	{name: "Deception",       ability: "cha"},
	{name: "History",         ability: "int"},
	{name: "Insight",         ability: "wis"},
	{name: "Intimidation",    ability: "cha"},
	{name: "Investigation",   ability: "int"},
	{name: "Medicine",        ability: "wis"},
	{name: "Nature",          ability: "int"},
	{name: "Perception",      ability: "wis"},
	{name: "Performance",     ability: "cha"},
	{name: "Persuasion",      ability: "cha"},
	{name: "Religion",        ability: "int"},
	{name: "Sleight of Hand", ability: "dex"},
	{name: "Stealth",         ability: "dex"},
	{name: "Survival",        ability: "wis"},
];
const _ALIGNMENTS = [
	"", "Lawful Good", "Neutral Good", "Chaotic Good",
	"Lawful Neutral", "True Neutral", "Chaotic Neutral",
	"Lawful Evil", "Neutral Evil", "Chaotic Evil",
	"Unaligned",
];
const _SIZES = ["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"];
const _SPELL_SLOTS_BY_LEVEL = {
	1:  [2,0,0,0,0,0,0,0,0],
	2:  [3,0,0,0,0,0,0,0,0],
	3:  [4,2,0,0,0,0,0,0,0],
	4:  [4,3,0,0,0,0,0,0,0],
	5:  [4,3,2,0,0,0,0,0,0],
	6:  [4,3,3,0,0,0,0,0,0],
	7:  [4,3,3,1,0,0,0,0,0],
	8:  [4,3,3,2,0,0,0,0,0],
	9:  [4,3,3,3,1,0,0,0,0],
	10: [4,3,3,3,2,0,0,0,0],
	11: [4,3,3,3,2,1,0,0,0],
	12: [4,3,3,3,2,1,0,0,0],
	13: [4,3,3,3,2,1,1,0,0],
	14: [4,3,3,3,2,1,1,0,0],
	15: [4,3,3,3,2,1,1,1,0],
	16: [4,3,3,3,2,1,1,1,0],
	17: [4,3,3,3,2,1,1,1,1],
	18: [4,3,3,3,3,1,1,1,1],
	19: [4,3,3,3,3,2,1,1,1],
	20: [4,3,3,3,3,2,2,1,1],
};
const _CASTER_CLASSES = new Set([
	"Bard","Cleric","Druid","Paladin","Ranger","Sorcerer","Warlock","Wizard",
	"Artificer",
]);
const _COMMON_TOOLS = [
	"Alchemist's Supplies","Brewer's Supplies","Calligrapher's Supplies",
	"Carpenter's Tools","Cartographer's Tools","Cobbler's Tools","Cook's Utensils",
	"Glassblower's Tools","Jeweler's Tools","Leatherworker's Tools","Mason's Tools",
	"Painter's Supplies","Potter's Tools","Smith's Tools","Tinker's Tools",
	"Weaver's Tools","Woodcarver's Tools",
	"Disguise Kit","Forgery Kit","Herbalism Kit","Navigator's Tools","Poisoner's Kit","Thieves' Tools",
	"Vehicles (Land)","Vehicles (Water)","Vehicles (Air)",
	"Bagpipes","Drum","Dulcimer","Flute","Lute","Lyre","Horn","Pan Flute","Shawm","Viol",
	"Dice Set","Dragonchess Set","Playing Card Set","Three-Dragon Ante Set",
];

// Stat generation constants
const _STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];
const _SG_PB_COSTS    = {8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9};
const _SG_PB_SCORES   = [8, 9, 10, 11, 12, 13, 14, 15];
const _SG_PB_BUDGET   = 27;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function _abilMod (score) {
	return Math.floor((score - 10) / 2);
}
function _fmtMod (mod) {
	return mod >= 0 ? `+${mod}` : `${mod}`;
}
function _profBonus (level) {
	return Math.ceil(level / 4) + 1;
}

// ---------------------------------------------------------------------------
// CharacterBuilder
// ---------------------------------------------------------------------------

export class CharacterBuilder extends BuilderBase {
	constructor () {
		super({
			titleSidebarLoadExisting: "Load Existing Character",
			titleSidebarDownloadJson: "Download Characters as JSON",
			prop: "character",
		});

		this._renderOutputDebounced = MiscUtil.debounce(() => this._renderOutput(), 50);

		// PDF preview state
		this._pdfBlobUrl = null;
		this._pdfGenId   = 0;

		// Modal filters - lazily instantiated on first use (defer scripts may not
		// yet have run when the constructor fires).
		this._modalFilterRaces       = null;
		this._modalFilterBackgrounds = null;
		this._modalFilterFeats       = null;
		this._modalFilterFeatsAsi    = null;
		this._modalFilterSpells      = null;
		this._rebuildSpellsTab       = null;
		this._modalFilterItems       = null;
		this._modalFilterItemsMagic  = null;
		this._rebuildEquipmentTab    = null;
		this._rebuildHpSection       = null;
		this._onEditionChange        = null; // set by _buildClassInput; called when edition toggle fires

		// cached data for dropdowns
		this._allClasses     = [];
		this._allSubclasses  = {};
		this._allSpecies     = [];
		this._allBackgrounds = [];
		this._allFeats       = [];
		this._allOptFeatures = [];
		this._allSpells      = [];
		this._allItems       = [];

		this._isDataLoaded = false;
	}

	// -------------------------------------------------------------------------
	// Init
	// -------------------------------------------------------------------------
	// Init
	// -------------------------------------------------------------------------

	async pInit () {
		try {
			await this._pInit();
		} catch (e) {
			console.error("CharacterBuilder: _pInit failed -", e);
			// Still mark as loaded so the UI doesn't hang on "Loading..." forever
			this._isDataLoaded = true;
		}
	}

	async _pInit () {
		const pLoad = (path) => DataUtil.loadJSON(path).catch(() => ({}));

		// loadJSON() returns resolved class/subclass; loadRawJSON() adds subclassFeature entries
		const pLoadClasses = () => Promise.all([
			DataUtil.class.loadJSON().catch(() => ({class: [], subclass: []})),
			DataUtil.class.loadRawJSON().catch(() => ({subclassFeature: []})),
		]).then(([resolved, raw]) => ({...resolved, subclassFeature: raw.subclassFeature || []}));

		const [classData, raceDataAll, bgData, featDataAll, optFeatData, spellData, items] = await Promise.all([
			pLoadClasses(),
			// Use DataLoader so that _versions (subspecies like "Dragonborn (Black)") are expanded
			DataLoader.pCacheAndGetAllSite(UrlUtil.PG_RACES).catch(() => []),
			DataUtil.background.loadJSON().catch(() => ({})),
			// Use DataLoader so that _versions (e.g. "Magic Initiate; Cleric") are expanded
			DataLoader.pCacheAndGetAllSite(UrlUtil.PG_FEATS).catch(() => []),
			DataUtil.loadJSON("data/optionalfeatures.json").catch(() => ({})),
			DataUtil.spell.pLoadAll().catch(() => []),
			Renderer.item.pBuildList().catch(() => []),
		]);


		this._allClasses           = (classData.class || []).sort((a, b) => SortUtil.ascSortLower(a.name, b.name));
		this._allSubclasses        = {};
		this._allSubclassFeatures  = classData.subclassFeature || [];
		(classData.subclass || []).forEach(sc => {
			const key = (sc.className || "").toLowerCase();
			(this._allSubclasses[key] = this._allSubclasses[key] || []).push(sc);
		});
		this._allSpecies     = (raceDataAll || []).sort((a, b) => SortUtil.ascSortLower(a.name, b.name));
		this._allBackgrounds = (bgData.background || []).sort((a, b) => SortUtil.ascSortLower(a.name, b.name));
		this._allFeats       = (featDataAll || []).sort((a, b) => SortUtil.ascSortLower(a.name, b.name));
		this._allOptFeatures = (optFeatData.optionalfeature || []).sort((a, b) => SortUtil.ascSortLower(a.name, b.name));
		this._allSpells      = (spellData || []).sort((a, b) => SortUtil.ascSortLower(a.name, b.name));
		this._allItems       = (items || []).filter(it => it.name).sort((a, b) => SortUtil.ascSortLower(a.name, b.name));

		this._isDataLoaded = true;

		// _pInit runs inside Promise.all before ui.init() assigns this._ui AND
		// before this._state is initialised. Poll until both exist, then apply
		// class data and re-render.
		const tryRerender = () => {
			if (!this._ui || !this._state) return setTimeout(tryRerender, 50);
			// Apply all automation now that state exists and data is loaded
			this._applyClassData();
			this._applyBackgroundData();
			this._applySpeciesData();
			this._applyFeatData();
			if (this._ui.activeBuilder === "characterBuilder") {
				this.renderInput();
				this.renderOutput();
			}
		};
		setTimeout(tryRerender, 50);
	}

	// -------------------------------------------------------------------------
	// State
	// -------------------------------------------------------------------------

	_getInitialState () {
		return {
			...super._getInitialState(),
			// meta
			name: "New Character",
			styleHint: VetoolsConfig.get("styleSwitcher", "style") ?? SITE_STYLE__ONE,
			// identity
			playerName: "",
			classes: [{cls: "", sub: "", level: 1}],
			background: "",
			species: "",
			alignment: "",
			xp: 0,
			// appearance
			age: "",
			height: "",
			weight: "",
			eyes: "",
			skin: "",
			hair: "",
			size: "Medium",
			appearance: "",
			// ability scores (standard array default)
			str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10,
			// proficiencies
			savingThrowProfs: [],
			skillProfs: [],
			classSkillChoices: [],
			classExpertise: [],
			_classExpertiseCount: 0,
			skillExpertise: [],
			skillHalfProfs: [],
			languages: [],
			armorProfs: [],
			weaponProfs: [],
			toolProfs: [],
			bgToolProfs: [],         // auto-managed: background-granted tool proficiencies
			excludedBgToolProfs: [], // user-excluded background tool proficiencies
			// combat
			ac: 10,
			speed: 30,
			initiative: null, // null = auto from dex
			hp: 0,
			hpMax: 0,
			hitDice: "",
			// personality
			personalityTraits: "",
			ideals: "",
			bonds: "",
			flaws: "",
			backstory: "",
			// equipment
			cp: 0, sp: 0, ep: 0, gp: 0, pp: 0,
			equipment: [],
			// class features / species traits - per-item arrays with exclude flag
			classFeatureItems: [],        // [{text, excluded}] - auto-filled from class data
			optionalFeatureChoices: {},   // {featureType: [chosenName, ...]}
			_optionalFeatureSlots: [],    // computed: [{name, featureType[], count}]
			asiChoices: [],              // [{featName}]
			_asiCount: 0,                // computed: number of ASI slots from class at current level
			speciesTraitItems: [],   // [{text, excluded}] - auto-filled from species data
			speciesChoices: {},      // {speciesSpell_0: "Thorn Whip", ...} - user-chosen species spells
			// weapon masteries
			weaponMasteries: [],        // [weaponName, ...] - user-chosen weapon masteries
			_weaponMasteryCount: 0,     // computed: number of mastery slots from class at current level
			// tool proficiency choices (class-granted any-tool slots)
			classToolChoices: [],        // [toolName, ...] - user-chosen tools for class any-tool slots
			_classToolSlots: [],         // computed: [{type:"INS"|"AT", count:N}]
			// shield (toggled in Combat tab)
			shield: false,
			// magic item attunement slots
			magicItems: ["", "", ""],
			// equipment (non-magic user items + auto-granted; autoGranted managed by _syncGrantedEquipment)
			magicEquipment: [],      // [{name, qty, note}] - user-added magic items
			equipmentChoices: {},    // {cls_0:"a", bg_0:"b"} - starting equipment choice selections
			// equipped-item computed values (managed by _syncEquippedItems)
			equippedAC:      null,   // number | null - set when armor is equipped
			equippedShield:  false,  // bool - set when a shield item is equipped
			equippedWeapons: [],     // [{name,atkBonus,damage,notes}] - from equipped weapons
			// weapons table
			weapons: [],
			weaponHidden: [],     // names hidden from PDF
			weaponOverrides: {},  // {[name]: {atkBonus?, damage?, notes?}} - override auto-computed values
			// feats
			feats: [],
			bgFeat: "",
			featChoices: {},
			// feat-granted proficiencies (auto-managed by _applyFeatData)
			featSkillProfs: [],
			featToolProfs: [],
			featLanguages: [],
			featArmorProfs: [],
			featWeaponProfs: [],
			featSavingThrowProfs: [],
			featExpertise: [],
			featResistances: [],
			featHpBonus: 0,
			featSpeedBonus: 0,
			featInitiativeBonus: 0,
				// spells
			spellcastingAbility: "",
			spellcastingAbilities: [],
			spellSlots: [0,0,0,0,0,0,0,0,0],
			pactSlots: [0,0,0,0,0,0,0,0,0],
			spellSlotsUsed: [0,0,0,0,0,0,0,0,0],
			spells: [], // [{name, source, level, prepared}]
			hpMode:  "auto", // "auto" | "rolled"
			hpRolls: [],     // [number|null] - rolled die values for levels 2..level
			// proficiency bonus override
			profBonusOverride: null,
			// stat generation
			sg_mode: "manual",
			sg_rolls: [],
			sg_roll_str: null, sg_roll_dex: null, sg_roll_con: null,
			sg_roll_int: null, sg_roll_wis: null, sg_roll_cha: null,
			sg_arr_str: null,  sg_arr_dex: null,  sg_arr_con: null,
			sg_arr_int: null,  sg_arr_wis: null,  sg_arr_cha: null,
			sg_pb_str: 8, sg_pb_dex: 8, sg_pb_con: 8,
			sg_pb_int: 8, sg_pb_wis: 8, sg_pb_cha: 8,
			// entity ability choices (for choose.from / choose.weighted / multiple ability sets)
			race_ixAbilitySet: 0,
			race_choice_from: [],     // [{ability, amount}]
			race_choice_weighted: [], // [{ability, amount, ix}]
			bg_ixAbilitySet: 0,
			bg_choice_from: [],
			bg_choice_weighted: [],
		};
	}

	setStateFromLoaded (state) {
		if (!state?.s || !state?.m) return;
		this._doResetProxies();
		if (!state.s.uniqueId) state.s.uniqueId = CryptUtil.uid();
		// Migrate old single-class format to classes array
		if (!state.s.classes && (state.s.class !== undefined || state.s.level !== undefined)) {
			state.s.classes = [{
				cls:   state.s.class   || "",
				sub:   state.s.subclass || "",
				level: state.s.level   || 1,
			}];
			delete state.s.class;
			delete state.s.subclass;
			delete state.s.level;
		}
		this.__state = state.s;
		this.__meta = state.m;
	}

	// -------------------------------------------------------------------------
	// Sidebar
	// -------------------------------------------------------------------------

	async pHandleSidebarLoadExistingData (character, opts = {}) {
		delete character.uniqueId;
		const meta = {...(opts.meta || {}), ...this._getInitialMetaState({nameOriginal: character.name})};
		this.setStateFromLoaded({s: character, m: meta});
		this.renderInput();
		this.renderOutput();
	}

	// -------------------------------------------------------------------------
	// Character save / load (localStorage-backed)
	// -------------------------------------------------------------------------

	async _pGetSavedCharacters () {
		return await StorageUtil.pGetForPage(CharacterBuilder._STORAGE_KEY_SAVED) || [];
	}

	async _pSaveCharacter () {
		const chars = await this._pGetSavedCharacters();
		const uid = this.__state.uniqueId;
		const ix = chars.findIndex(c => c.uniqueId === uid);
		const entry = {
			uniqueId: uid,
			name: this.__state.name || "New Character",
			s: MiscUtil.copy(this.__state),
			m: MiscUtil.copy(this.__meta),
		};
		if (ix >= 0) chars[ix] = entry;
		else chars.push(entry);
		await StorageUtil.pSetForPage(CharacterBuilder._STORAGE_KEY_SAVED, chars);
		this._meta.isModified = false;
		this._meta.nameOriginal = this.__state.name;
		this.doUiSave();
		await this._pDoUpdateSidemenu();
	}

	async pRenderSideMenu () {
		if (!this._eleSideMenuStageSaved) {
			this._eleSideMenuWrpList = ee`<div class="ve-w-100 ve-flex-col">`;
			this._eleSideMenuStageSaved = ee`<div class="ve-w-100">${this._eleSideMenuWrpList}</div>`;
		}
		this._eleSideMenuStageSaved.appendTo(this._ui.wrpSideMenu);
		await this._pDoUpdateSidemenu();
	}

	async _pDoUpdateSidemenu () {
		if (!this._eleSideMenuStageSaved) return;
		this._sidemenuListRenderCache = this._sidemenuListRenderCache || {};
		const chars = await this._pGetSavedCharacters();
		this._eleSideMenuStageSaved.toggleVe(!!chars.length);

		const metasVisible = new Set();
		chars.forEach((char, ix) => {
			metasVisible.add(char.uniqueId);

			if (this._sidemenuListRenderCache[char.uniqueId]) {
				const meta = this._sidemenuListRenderCache[char.uniqueId];
				meta.row.showVe();
				if (meta.name !== char.name) { meta.dispName.txt(char.name); meta.name = char.name; }
				if (meta.position !== ix) { meta.row.css({"order": ix}); meta.position = ix; }
				return;
			}

			const btnEdit = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-2" title="Load"><span class="glyphicon glyphicon-pencil"></span></button>`
				.onn("click", async () => {
					if (
						this.getOnNavMessage()
						&& !await InputUiUtil.pGetUserBoolean({title: "Discard Unsaved Changes", htmlDescription: "You have unsaved changes. Are you sure?", textYes: "Yes", textNo: "Cancel"})
					) return;
					this.setStateFromLoaded({s: MiscUtil.copy(char.s), m: MiscUtil.copy(char.m)});
					this.renderInput();
					this.renderOutput();
					this.doUiSave();
				});

			const btnDelete = ee`<button class="ve-btn ve-btn-xs ve-btn-danger" title="Delete"><span class="glyphicon glyphicon-trash"></span></button>`
				.onn("click", async () => {
					if (!await InputUiUtil.pGetUserBoolean({title: "Delete Character", htmlDescription: `Delete "${char.name}"?`, textYes: "Yes", textNo: "Cancel"})) return;
					const next = (await this._pGetSavedCharacters()).filter(c => c.uniqueId !== char.uniqueId);
					await StorageUtil.pSetForPage(CharacterBuilder._STORAGE_KEY_SAVED, next);
					if (this.__state.uniqueId === char.uniqueId) this.reset();
					await this._pDoUpdateSidemenu();
				});

			const dispName = ee`<span class="ve-py-1">${char.name}</span>`;
			const row = ee`<div class="mkbru__sidebar-entry ve-flex-v-center ve-split ve-px-2" style="order:${ix}">
				${dispName}
				<div class="ve-py-1 ve-no-shrink">${btnEdit}${btnDelete}</div>
			</div>`.appendTo(this._eleSideMenuWrpList);

			this._sidemenuListRenderCache[char.uniqueId] = {dispName, row, name: char.name, position: ix};
		});

		Object.entries(this._sidemenuListRenderCache)
			.filter(([uid]) => !metasVisible.has(uid))
			.forEach(([, meta]) => meta.row.hideVe());
	}

	async pHandleSidebarDownloadJsonClick () {
		const chars = await this._pGetSavedCharacters();
		const out = this._ui._getJsonOutputTemplate();
		out.character = chars.map(c => DataUtil.cleanJson(MiscUtil.copy(c.s)));
		DataUtil.userDownload("characters", out);
	}

	// -------------------------------------------------------------------------
	// Input rendering
	// -------------------------------------------------------------------------

	renderInputControls () {
		const btnSave = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-2">Save</button>`
			.onn("click", () => this._pSaveCharacter());
		this._addHook("meta", "isModified", () => btnSave.txt(this._meta.isModified ? "Save *" : "Save"))();

		const btnNew = ee`<button class="ve-btn ve-btn-xs ve-btn-default" title="SHIFT to reset additional state">New Character</button>`
			.onn("click", async (evt) => {
				if (!await InputUiUtil.pGetUserBoolean({title: "Reset Builder", htmlDescription: "Are you sure?", textYes: "Yes", textNo: "Cancel"})) return;
				this.reset({isResetAllMeta: !!evt.shiftKey});
			});

		ee(this._ui.wrpInputControls.empty())`
			<div class="ve-flex-v-center">${btnSave}${btnNew}</div>
		`;
	}

	_renderInputImpl () {
		this.doCreateProxies();
		this.renderInputControls();
		this._renderInputMain();
	}

	_renderInputMain () {
		const wrp = this._ui.wrpInput.empty();

		// Data is loaded async - show a spinner until ready, then re-render
		if (!this._isDataLoaded) {
			ee`<div class="ve-flex-vh-center ve-w-100 ve-h-100 ve-py-4">
				<span class="ve-muted ve-italic">Loading character data...</span>
			</div>`.appendTo(wrp);
			return;
		}

		const _cb = () => {
			this.renderOutput();
			this.doUiSave();
			this._meta.isModified = true;
		};
		const cb = MiscUtil.debounce(_cb, 33);
		this._cbCache = cb;

		this._resetTabs({tabGroup: "input"});
		const tabs = this._renderTabs(
			[
				new TabUiUtil.TabMeta({name: "Origin",   hasBorder: true}),
				new TabUiUtil.TabMeta({name: "Class",   hasBorder: true}),
				new TabUiUtil.TabMeta({name: "Abilities",  hasBorder: true}),
				new TabUiUtil.TabMeta({name: "Combat",     hasBorder: true}),
				new TabUiUtil.TabMeta({name: "Equipment",  hasBorder: true}),
				new TabUiUtil.TabMeta({name: "Feats",      hasBorder: true}),
				new TabUiUtil.TabMeta({name: "Spells",     hasBorder: true}),
				new TabUiUtil.TabMeta({name: "Description",hasBorder: true}),
			],
			{tabGroup: "input", cbTabChange: this.doUiSave.bind(this)},
		);
		const [identityTab, classOptsTab, abilitiesTab, combatTab, equipTab, featsTab, spellsTab, personalityTab] = tabs;
		ee`<div class="ve-flex-v-center ve-w-100 ve-no-shrink ui-tab__wrp-tab-heads--border">${tabs.map(it => it.btnTab)}</div>`.appendTo(wrp);
		tabs.forEach(it => it.wrpTab.appendTo(wrp));

		// -- IDENTITY ----------------------------------------------------------
		this._buildIdentityTab(identityTab.wrpTab, cb);
		
		// -- CLASS ----------------------------------------------------------
		this._buildClassTab(classOptsTab.wrpTab, cb);

		// -- ABILITIES & PROFICIENCIES -----------------------------------------
		this._buildAbilitiesTab(abilitiesTab.wrpTab, cb);

		// -- COMBAT ------------------------------------------------------------
		this._buildCombatTab(combatTab.wrpTab, cb);

		// -- EQUIPMENT ---------------------------------------------------------
		this._buildEquipmentTab(equipTab.wrpTab, cb);

		// -- FEATS -------------------------------------------------------------
		this._buildFeatsTab(featsTab.wrpTab, cb);

		// -- SPELLS ------------------------------------------------------------
		this._buildSpellsTab(spellsTab.wrpTab, cb);

		// -- PERSONALITY -------------------------------------------------------
		this._buildPersonalityTab(personalityTab.wrpTab, cb);

	}

	// -- Class tab -------------------------------------------------------------

	_buildClassTab (wrp, cb) {
		// Class input - mirrored from Origin tab (shared state, separate DOM instance)
		this._buildClassInput(wrp, cb);

		// Per-item feature list builder - renders each item as a row with an eye-icon toggle button
		const buildItemList = (label, stateKey, emptyMsg) => {
			const [row, rowInner] = BuilderUi.getLabelledRowTuple(label);
			const listWrp = ee`<div class="ve-flex-col ve-w-100"></div>`;
			let _skipRefresh = false;

			const refresh = () => {
				if (_skipRefresh) return;
				listWrp.empty();
				const items = this._state[stateKey] || [];
				if (!items.length) {
					listWrp.append(ee`<div class="ve-muted ve-small ve-italic">${emptyMsg}</div>`);
					return;
				}
				items.forEach((item, ix) => {
					const itemRow = ee`<div class="ve-flex ve-mb-1" style="align-items:flex-start"></div>`;
					const btnEye = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-1 ve-mt-1" title="${item.excluded ? "Show in PDF" : "Hide from PDF"}" style="flex-shrink:0"><span class="glyphicon ${item.excluded ? "glyphicon-eye-close" : "glyphicon-eye-open"}"></span></button>`;
					const ta = ee`<textarea class="ve-form-control ve-input-xs form-control--minimal ve-small" rows="2" style="flex:1;resize:vertical"></textarea>`;
					ta.val(item.text);
					btnEye.onn("click", () => {
						const cur = (this._state[stateKey] || []).map((it, i) => i === ix ? {...it, excluded: !it.excluded} : it);
						this._state[stateKey] = cur;
						const nowExcluded = cur[ix]?.excluded;
						btnEye.attr("title", nowExcluded ? "Show in PDF" : "Hide from PDF");
						btnEye.find("span").attr("class", `glyphicon ${nowExcluded ? "glyphicon-eye-close" : "glyphicon-eye-open"}`);
						cb();
					});
					ta.onn("input", () => {
						_skipRefresh = true;
						const cur = (this._state[stateKey] || []).map((it, i) => i === ix ? {...it, text: ta.val(), _autoText: it._autoText ?? it.text} : it);
						this._state[stateKey] = cur;
						_skipRefresh = false;
						cb();
					});
					itemRow.append(btnEye, ta);
					listWrp.append(itemRow);
				});
			};

			refresh();
			this._addHook("state", stateKey, refresh);
			listWrp.appendTo(rowInner);
			return row;
		};

		// Class Features
		buildItemList("Class Features", "classFeatureItems", "Auto-filled when a class is selected.").appendTo(wrp);

		// Optional Feature Choices (Fighting Style, Metamagic, Eldritch Invocations, etc.)
		{
			const [optRow, optRowInner] = BuilderUi.getLabelledRowTuple("Class Feature Options");
			const wrpGroups = ee`<div class="ve-flex-col ve-w-100"></div>`.appendTo(optRowInner);

			const buildOptFeatUI = () => {
				wrpGroups.empty();
				const slots = this._state._optionalFeatureSlots || [];
				optRow.toggleVe(slots.length > 0);
				if (!slots.length) return;

				const isNew    = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
				const choices  = this._state.optionalFeatureChoices || {};

				slots.forEach(slot => {
					const key = slot.key;

					// Build option list from the appropriate data source
					let opts;
					if (slot.dataSource === "feat") {
						opts = (this._allFeats || []).filter(f => (slot.category || []).includes(f.category));
					} else {
						opts = (this._allOptFeatures || []).filter(f =>
							(f.featureType || []).some(ft => (slot.featureType || []).includes(ft)),
						);
					}
					// Edition-filtered options; fall back to all if nothing matches
					const editionOpts = opts.filter(f =>
						isNew ? !SourceUtil.isClassicSource(f.source) : SourceUtil.isClassicSource(f.source),
					);
					if (editionOpts.length) opts = editionOpts;

					const slotChoices = choices[key] || [];
					ee`<span class="ve-muted ve-bold ve-mt-1" style="font-size:.8em">${slot.name}</span>`.appendTo(wrpGroups);
					const wrpSels = ee`<div class="ve-flex-wrap ve-gap-1 ve-mb-1"></div>`.appendTo(wrpGroups);

					const sels = [];
					const refreshDisabled = () => {
						const taken = new Set(sels.map(s => s.val()).filter(Boolean));
						sels.forEach(sel => {
							const myVal = sel.val();
							Array.from(sel.options).forEach(opt => {
								if (!opt.value) return;
								opt.disabled = taken.has(opt.value) && opt.value !== myVal;
							});
						});
					};

					for (let i = 0; i < slot.count; i++) {
						const savedVal = opts.find(f => f.name === slotChoices[i]) ? slotChoices[i] : "";
						const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" style="min-width:160px">
							<option value="">- Choose -</option>
							${opts.map(f => `<option value="${f.name}"${f.name === savedVal ? " selected" : ""}>${f.name}</option>`).join("")}
						</select>`;
						sel.onn("change", () => {
							const updated = {...(this._state.optionalFeatureChoices || {})};
							updated[key] = sels.map(s => s.val()).filter(Boolean);
							this._state.optionalFeatureChoices = updated;
							refreshDisabled();
							cb();
						});
						sels.push(sel);
						wrpSels.append(sel);
					}
					refreshDisabled();
				});
			};

			buildOptFeatUI();
			this._addHook("state", "_optionalFeatureSlots", buildOptFeatUI);
			this._addHook("state", "styleHint",             buildOptFeatUI);
			optRow.appendTo(wrp);
		}

	// Ability Score Improvements
	{
		const [asiRow, asiRowInner] = BuilderUi.getLabelledRowTuple("Ability Score Improvements");
		const wrpAsiRows = ee`<div class="ve-flex-col ve-w-100"></div>`.appendTo(asiRowInner);

		const buildAsiUI = () => {
			wrpAsiRows.empty();
			const count = this._state._asiCount || 0;
			asiRow.toggleVe(count > 0);
			if (!count) return;

			for (let ix = 0; ix < count; ix++) {
				const ix_ = ix;
				const getChoice = () => (this._state.asiChoices || [])[ix_] || {};
				const setChoice = (patch) => {
					const cur = [...(this._state.asiChoices || [])];
					while (cur.length <= ix_) cur.push({});
					cur[ix_] = {...cur[ix_], ...patch};
					this._state.asiChoices = cur;
					this._sg_syncAbilityScores();
					this._applyFeatData();
					cb();
				};

				const slotWrp = ee`<div class="ve-flex-col ve-py-1 ve-border-b ve-mb-1"></div>`.appendTo(wrpAsiRows);

				// Feat name display + filter button
				const spanFeatName = ee`<span class="ve-bold ve-ml-1" style="flex:1">${getChoice().featName || "Ability Score Improvement"}</span>`;
				const btnFilter = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-1" title="Filter feats"><span class="glyphicon glyphicon-filter"></span> Filter</button>`
					.onn("click", async () => {
						if (!this._modalFilterFeatsAsi) {
							this._modalFilterFeatsAsi = new ModalFilterFeats({
								namespace: "charBuilder.feats.asi",
								isRadio: true,
								allData: this._allFeats,
							});
						}
						const selected = await this._modalFilterFeatsAsi.pGetUserSelection();
						if (!selected?.length) return;
						const name = selected[0].name;
						setChoice({featName: name});
						spanFeatName.txt(name);
						refreshFeatChoices();
					});
				ee`<div class="ve-flex-v-center ve-mb-1">${btnFilter}${spanFeatName}</div>`.appendTo(slotWrp);

				const wrpFeatChoices = ee`<div class="ve-flex-col"></div>`.appendTo(slotWrp);
				const refreshFeatChoices = () => {
					Array.from(wrpFeatChoices.querySelectorAll(".cb-feat-choices-wrp")).forEach(n => n.remove());
					const name = getChoice().featName || "Ability Score Improvement";
					this._buildFeatChoiceInputs(name, wrpFeatChoices, cb);
				};
				refreshFeatChoices();

				
							}
		};

		buildAsiUI();
		this._addHook("state", "_asiCount", buildAsiUI);
		this._addHook("state", "styleHint", buildAsiUI);
		asiRow.appendTo(wrp);
	}

	// Weapon Masteries
	{
		const [mastRow, mastRowInner] = BuilderUi.getLabelledRowTuple("Weapon Masteries");
		const wrpMastSels = ee`<div class="ve-flex-wrap ve-gap-1"></div>`.appendTo(mastRowInner);

		const buildMasteryUI = () => {
			wrpMastSels.empty();
			const count = this._state._weaponMasteryCount || 0;
			mastRow.toggleVe(count > 0);
			if (!count) return;

			const profWeapons = this._getProficientWeaponNames();
			const saved = this._state.weaponMasteries || [];

			const sels = [];
			const refreshDisabled = () => {
				const taken = new Set(sels.map(s => s.val()).filter(Boolean));
				sels.forEach(sel => {
					const myVal = sel.val();
					Array.from(sel.options).forEach(opt => {
						if (!opt.value) return;
						opt.disabled = taken.has(opt.value) && opt.value !== myVal;
					});
				});
			};

			for (let i = 0; i < count; i++) {
				const savedVal = profWeapons.includes(saved[i]) ? saved[i] : "";
				const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal" style="min-width:160px">
					<option value="">- Choose -</option>
					${profWeapons.map(w => `<option value="${w}"${w === savedVal ? " selected" : ""}>${w}</option>`).join("")}
				</select>`;
				sel.onn("change", () => {
					this._state.weaponMasteries = sels.map(s => s.val()).filter(Boolean);
					refreshDisabled();
					cb();
				});
				sels.push(sel);
				wrpMastSels.append(sel);
			}
			refreshDisabled();
		};

		buildMasteryUI();
		this._addHook("state", "_weaponMasteryCount", buildMasteryUI);
		this._addHook("state", "weaponProfs",         buildMasteryUI);
		this._addHook("state", "featWeaponProfs",     buildMasteryUI);
		mastRow.appendTo(wrp);
	}
	}

	// -- Identity tab ----------------------------------------------------------

	_buildIdentityTab (wrp, cb) {
		BuilderUi.getStateIptString("Character Name", cb, this._state, {nullable: false, callback: () => this.pRenderSideMenu()}, "name").appendTo(wrp);
		BuilderUi.getStateIptString("Player Name",    cb, this._state, {}, "playerName").appendTo(wrp);

		// Edition toggle
		const editionRow = this._buildEditionToggle(cb);
		editionRow.appendTo(wrp);

		// Class dropdown
		this._buildClassInput(wrp, cb);

		// Species / Race
		this._buildSpeciesInput(wrp, cb);

		// Background
		this._buildBackgroundInput(wrp, cb);

		// Alignment
		BuilderUi.getStateIptEnum(
			"Alignment", cb, this._state,
			{nullable: false, vals: _ALIGNMENTS, fnDisplay: v => String(v)},
			"alignment",
		).appendTo(wrp);

		// XP
		BuilderUi.getStateIptNumber("Experience Points", cb, this._state, {nullable: true, placeholder: "0"}, "xp").appendTo(wrp);

		// State hook - fires whenever classes array changes
		this._addHook("state", "classes", () => {
			this._state.classFeatureItems  = [];
			this._state.hitDice            = "";
			this._state.spellSlots         = [0,0,0,0,0,0,0,0,0];
			this._state.pactSlots          = [0,0,0,0,0,0,0,0,0];
			this._state.classSkillChoices  = [];
			this._applyClassData();
			this.renderInput();
			this.renderOutput();
		});

		// Species Traits
		{
			const stateKey = "speciesTraitItems";
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Species Traits");
			const listWrp = ee`<div class="ve-flex-col ve-w-100"></div>`;
			let _skipRefresh = false;
			const refresh = () => {
				if (_skipRefresh) return;
				listWrp.empty();
				const items = this._state[stateKey] || [];
				if (!items.length) {
					listWrp.append(ee`<div class="ve-muted ve-small ve-italic">Auto-filled when a species is selected.</div>`);
					return;
				}
				items.forEach((item, ix) => {
					const itemRow = ee`<div class="ve-flex ve-mb-1" style="align-items:flex-start"></div>`;
					const btnEye = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-1 ve-mt-1" title="${item.excluded ? "Show in PDF" : "Hide from PDF"}" style="flex-shrink:0"><span class="glyphicon ${item.excluded ? "glyphicon-eye-close" : "glyphicon-eye-open"}"></span></button>`;
					const ta = ee`<textarea class="ve-form-control ve-input-xs form-control--minimal ve-small" rows="2" style="flex:1;resize:vertical"></textarea>`;
					ta.val(item.text);
					btnEye.onn("click", () => {
						const cur = (this._state[stateKey] || []).map((it, i) => i === ix ? {...it, excluded: !it.excluded} : it);
						this._state[stateKey] = cur;
						const nowExcluded = cur[ix]?.excluded;
						btnEye.attr("title", nowExcluded ? "Show in PDF" : "Hide from PDF");
						btnEye.find("span").attr("class", `glyphicon ${nowExcluded ? "glyphicon-eye-close" : "glyphicon-eye-open"}`);
						cb();
					});
					ta.onn("input", () => {
						_skipRefresh = true;
						const cur = (this._state[stateKey] || []).map((it, i) => i === ix ? {...it, text: ta.val(), _autoText: it._autoText ?? it.text} : it);
						this._state[stateKey] = cur;
						_skipRefresh = false;
						cb();
					});
					itemRow.append(btnEye, ta);
					listWrp.append(itemRow);
				});
			};
			refresh();
			this._addHook("state", stateKey, refresh);
			listWrp.appendTo(rowInner);
			row.appendTo(wrp);
		}

		// Species spell-choice dropdowns - shown below species traits
		if (this._speciesSpellChoiceRow) this._speciesSpellChoiceRow.appendTo(wrp);
	}

	_buildEditionToggle (cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Edition");

		const isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;

		const btnClassic = ee`<button class="ve-btn ve-btn-xs ${!isNew ? "ve-btn-primary" : "ve-btn-default"} ve-mr-1">5e (2014)</button>`;
		const btnNew     = ee`<button class="ve-btn ve-btn-xs ${isNew  ? "ve-btn-primary" : "ve-btn-default"}">5.5e (2024)</button>`;

		const doUpdate = () => {
			const using2024 = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
			btnClassic.toggleClass("ve-btn-primary", !using2024).toggleClass("ve-btn-default", using2024);
			btnNew.toggleClass("ve-btn-primary", using2024).toggleClass("ve-btn-default", !using2024);
		};

		btnClassic.onn("click", () => { this._state.styleHint = SITE_STYLE__CLASSIC; doUpdate(); this._onEditionChange?.(); this.renderInput(); cb(); });
		btnNew.onn("click",     () => { this._state.styleHint = SITE_STYLE__ONE;     doUpdate(); this._onEditionChange?.(); this.renderInput(); cb(); });

		ee`<div class="ve-flex">${btnClassic}${btnNew}</div>`.appendTo(rowInner);
		return row;
	}

	_buildClassInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Class");

		const getFilteredClasses = () => {
			const isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
			const seen = new Set();
			return this._allClasses.filter(c => {
				const edOk = isNew ? !SourceUtil.isClassicSource(c.source) : SourceUtil.isClassicSource(c.source);
				if (!edOk || seen.has(c.name)) return false;
				seen.add(c.name);
				return true;
			});
		};

		const getFilteredSubclasses = (className) => {
			if (!className) return [];
			const isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
			const key = className.toLowerCase();
			const all = this._allSubclasses[key] || [];
			const seen = new Set();
			return all.filter(sc => {
				const edOk = isNew ? !SourceUtil.isClassicSource(sc.source) : SourceUtil.isClassicSource(sc.source);
				if (!edOk || seen.has(sc.name)) return false;
				seen.add(sc.name);
				return true;
			});
		};

		const _LEVELS = [...Array(20)].map((_, i) => i + 1);
		const wrpRows = ee`<div class="ve-flex-col ve-w-100"></div>`.appendTo(rowInner);

		const addBtn = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mt-1">+ Add Class</button>`;

		const rebuildAllRows = () => {
			wrpRows.empty();
			const classes = this._state.classes || [{cls: "", sub: "", level: 1}];
			const showRemove = classes.length > 1;
			classes.forEach((_, ix) => {
				const c = this._state.classes[ix];

				const selClass    = ee`<select class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" style="flex:2"></select>`;
				const selSubclass = ee`<select class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" style="flex:2"></select>`;
				const selLevel    = ee`<select class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" style="width:55px;flex:0 0 55px"></select>`;
				const btnRemove   = ee`<button class="ve-btn ve-btn-xs ve-btn-danger" title="Remove class" style="flex:0 0 auto;display:${showRemove ? "" : "none"}"><span class="glyphicon glyphicon-trash"></span></button>`;

				const _othersTotal = (this._state.classes || [])
					.filter((_, j) => j !== ix)
					.reduce((s, oc) => s + Math.max(1, Math.min(20, parseInt(oc.level) || 1)), 0);
				const _maxLvl = Math.max(1, 20 - _othersTotal);
				const _curLvl = Math.max(1, Math.min(_maxLvl, parseInt(c.level) || 1));
				_LEVELS.filter(l => l <= _maxLvl).forEach(l => {
					const opt = document.createElement("option");
					opt.value = l;
					opt.textContent = l;
					if (l === _curLvl) opt.selected = true;
					selLevel.appendChild(opt);
				});

				const _usedClasses = new Set(
					(this._state.classes || []).filter((_, j) => j !== ix).map(oc => oc.cls).filter(Boolean),
				);
				selClass.innerHTML = '<option value="">(None)</option>';
				getFilteredClasses().forEach(cls => {
					if (_usedClasses.has(cls.name)) return;
					const opt = document.createElement("option");
					opt.value = cls.name;
					opt.textContent = cls.name;
					if (cls.name === (c.cls || "")) opt.selected = true;
					selClass.appendChild(opt);
				});

				const rebuildSubs = () => {
					const curSub = (this._state.classes?.[ix]?.sub) || "";
					selSubclass.innerHTML = '<option value="">(No Subclass)</option>';
					getFilteredSubclasses((this._state.classes?.[ix]?.cls) || "").forEach(sc => {
						const opt = document.createElement("option");
						opt.value = sc.name;
						opt.textContent = sc.name;
						if (sc.name === curSub) opt.selected = true;
						selSubclass.appendChild(opt);
					});
				};
				rebuildSubs();

				selClass.onn("change", () => {
					const name = selClass.val();
					const cur = [...(this._state.classes || [])];
					if (!cur[ix] || cur[ix].cls === name) return;
					cur[ix] = {...cur[ix], cls: name, sub: ""};
					this._state.classes = cur;
					rebuildSubs();
					this._onLevelOrClassChange({resetClass: ix === 0});
				});

				selSubclass.onn("change", () => {
					const name = selSubclass.val();
					const cur = [...(this._state.classes || [])];
					if (!cur[ix] || cur[ix].sub === name) return;
					cur[ix] = {...cur[ix], sub: name};
					this._state.classes = cur;
					this._applyClassData();
					this.renderInput();
					this.renderOutput();
				});

				selLevel.onn("change", () => {
					const cur = [...(this._state.classes || [])];
					if (!cur[ix]) return;
					cur[ix] = {...cur[ix], level: parseInt(selLevel.val()) || 1};
					this._state.classes = cur;
					this._onLevelOrClassChange();
				});

				btnRemove.onn("click", () => {
					const cur = [...(this._state.classes || [])];
					if (cur.length <= 1) return;
					cur.splice(ix, 1);
					this._state.classes = cur;
					this._onLevelOrClassChange({resetClass: false});
					rebuildAllRows();
				});

				ee`<div class="ve-flex ve-flex-v-center ve-mb-1 ve-w-100">
					${selClass}${selSubclass}${selLevel}${btnRemove}
				</div>`.appendTo(wrpRows);
			});
			addBtn.appendTo(wrpRows);
			const _totalLvl = (this._state.classes || []).reduce((s, oc) => s + Math.max(1, Math.min(20, parseInt(oc.level) || 1)), 0);
			const _takenNames = new Set((this._state.classes || []).map(oc => oc.cls).filter(Boolean));
			addBtn.disabled = _totalLvl >= 20 || !getFilteredClasses().some(cls => !_takenNames.has(cls.name));
		};

		addBtn.onn("click", () => {
			const cur = [...(this._state.classes || [{cls: "", sub: "", level: 1}])];
			cur.push({cls: "", sub: "", level: 1});
			this._state.classes = cur;
			rebuildAllRows();
		});

		rebuildAllRows();

		this._onEditionChange = () => {
			const availableClasses = getFilteredClasses().map(c => c.name);
			const cur = [...(this._state.classes || [])];
			let changed = false;
			cur.forEach((c, i) => {
				if (c.cls && !availableClasses.includes(c.cls)) {
					cur[i] = {cls: "", sub: "", level: c.level};
					changed = true;
				}
			});
			if (changed) {
				this._state.classes = cur;
				this._onLevelOrClassChange({resetClass: true});
			}
			rebuildAllRows();
		};

		wrp.append(row);
	}

	// -- Background + Species filter inputs ------------------------------------

	_buildBackgroundInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Background");

		const dlId = "cb-bg-dl";
		if (!document.getElementById(dlId)) {
			const dl = document.createElement("datalist");
			dl.id = dlId;
			this._allBackgrounds.forEach(b => {
				const opt = document.createElement("option");
				opt.value = b.name;
				dl.appendChild(opt);
			});
			document.body.appendChild(dl);
		}

		const ipt = ee`<input class="ve-form-control ve-input-xs form-control--minimal" list="${dlId}" placeholder="(None)" style="flex:1">`.val(this._state.background || "");

		const doApply = (name) => {
			const trimmed = (name || "").trim();
			// Prefer the canonical casing from our loaded list, fall back to whatever was typed/selected
			const match = this._allBackgrounds.find(b => b.name.toLowerCase() === trimmed.toLowerCase());
			const newVal = match ? match.name : trimmed;
			ipt.val(newVal);
			if (newVal === this._state.background) return;
			this._state.background   = newVal;
			this._state.skillProfs     = [];
			this._state.skillExpertise = [];
			this._state.skillHalfProfs = [];
			this._state.bgToolProfs          = [];
			this._state.excludedBgToolProfs  = [];
			this._state.languages            = [];
			this._state.bgFeat         = "";
			this._state.bg_choice_from     = [];
			this._state.bg_choice_weighted = [];
			this._state.bg_ixAbilitySet    = 0;
			this._applyClassData();
			this._applyBackgroundData();
			this._applySpeciesData();
			this._applyFeatData();
			this.renderInput();
			this.renderOutput();
		};

		ipt.onn("change", () => doApply(ipt.val()));

		const btnFilter = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-1" title="Filter backgrounds"><span class="glyphicon glyphicon-filter"></span> Filter</button>`
			.onn("click", async () => {
				this._modalFilterBackgrounds = this._modalFilterBackgrounds
					|| new ModalFilterBackgrounds({namespace: "charBuilder.backgrounds", isRadio: true});
				const selected = await this._modalFilterBackgrounds.pGetUserSelection();
				if (!selected?.length) return;
				doApply(selected[0].name);
			});

		ee`<div class="ve-flex ve-w-100 ve-flex-v-center">${btnFilter}${ipt}</div>`.appendTo(rowInner);
		wrp.append(row);
	}

	_buildSpeciesInput (wrp, cb) {
		const _isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
		const [row, rowInner] = BuilderUi.getLabelledRowTuple(_isNew ? "Species" : "Race");

		const dlId = "cb-species-dl";
		if (!document.getElementById(dlId)) {
			const dl = document.createElement("datalist");
			dl.id = dlId;
			this._allSpecies.forEach(s => {
				const opt = document.createElement("option");
				opt.value = s.name;
				dl.appendChild(opt);
			});
			document.body.appendChild(dl);
		}

		const ipt = ee`<input class="ve-form-control ve-input-xs form-control--minimal" list="${dlId}" placeholder="(None)" style="flex:1">`.val(this._state.species || "");

		const doApply = (name) => {
			const trimmed = (name || "").trim();
			const match = this._allSpecies.find(s => s.name.toLowerCase() === trimmed.toLowerCase());
			const newVal = match ? match.name : trimmed;
			ipt.val(newVal);
			if (newVal === this._state.species) return;
			this._state.species          = newVal;
			this._state.speciesTraitItems = [];
			this._state.speciesChoices    = {};
			this._state.size          = "Medium";
			this._state.speed         = 30;
			this._state._speciesSpeed = null;  // reset so _applySpeciesData always applies new species defaults
			this._state._speciesSize  = null;
			this._state.languages     = [];
			this._state.race_choice_from     = [];
			this._state.race_choice_weighted = [];
			this._state.race_ixAbilitySet    = 0;
			this._applyBackgroundData();
			this._applySpeciesData();
			this._applyFeatData();
			this.renderInput();
			this.renderOutput();
		};

		ipt.onn("change", () => doApply(ipt.val()));

		const btnFilter = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-1" title="Filter species"><span class="glyphicon glyphicon-filter"></span> Filter</button>`
			.onn("click", async () => {
				this._modalFilterRaces = this._modalFilterRaces
					|| new ModalFilterRaces({namespace: "charBuilder.races", isRadio: true});
				const selected = await this._modalFilterRaces.pGetUserSelection();
				if (!selected?.length) return;
				doApply(selected[0].name);
			});

		ee`<div class="ve-flex ve-w-100 ve-flex-v-center">${btnFilter}${ipt}</div>`.appendTo(rowInner);
		wrp.append(row);

		// Species spell-choice dropdowns (e.g. "choose a druid cantrip" from Lorwyn lineage)
		const [spellChoiceRow, spellChoiceRowInner] = BuilderUi.getLabelledRowTuple("Species Spells");
		const wrpSpellChoices = ee`<div class="ve-flex-wrap ve-gap-1"></div>`.appendTo(spellChoiceRowInner);

		const buildSpeciesSpellChoiceUI = () => {
			wrpSpellChoices.empty();
			const speciesEntry = this._sg_getSpeciesEntry();
			const choices = this._getSpeciesSpellChoices(speciesEntry);
			spellChoiceRow.toggleVe(choices.length > 0);
			if (!choices.length) return;

			const saved = this._state.speciesChoices || {};
			choices.forEach(({key, label, options}) => {
				const savedVal = options?.find(o => o.value === saved[key]) ? saved[key] : "";
				const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" style="min-width:160px" title="${label}">
					<option value="">- Choose ${label} -</option>
					${(options || []).map(o => `<option value="${o.value}"${o.value === savedVal ? " selected" : ""}>${o.label}</option>`).join("")}
				</select>`;
				sel.onn("change", () => {
					const updated = {...(this._state.speciesChoices || {})};
					updated[key] = sel.val();
					this._state.speciesChoices = updated;
					this._syncGrantedSpells();
					cb();
				});
				wrpSpellChoices.append(sel);
			});
		};

		buildSpeciesSpellChoiceUI();
		this._addHook("state", "species",  buildSpeciesSpellChoiceUI);
		this._addHook("state", "styleHint", buildSpeciesSpellChoiceUI);
		this._speciesSpellChoiceRow = spellChoiceRow;
	}

	// Returns [{key, label, options}] for each spell-choose slot in a species entry's additionalSpells.
	_getSpeciesSpellChoices (speciesEntry) {
		if (!speciesEntry?.additionalSpells?.length) return [];
		const choices = [];
		let idx = 0;
		for (const grp of speciesEntry.additionalSpells) {
			// Only use the active named group if applicable (multi-group species)
			for (const prop of ["known", "innate", "prepared", "expanded"]) {
				if (!grp[prop]) continue;
				CharacterBuilder._eachSpellChoose(grp[prop], ({filter}) => {
					const lbl = CharacterBuilder._spellChooseLabel(filter);
					const opts = this._getSpellOptions(filter);
					choices.push({key: `speciesSpell_${idx++}`, label: lbl, options: opts});
				});
			}
		}
		return choices;
	}

	_autoSetSpellcastingAbility () {
		const cls = (this._state.classes?.[0]?.cls) || "";
		if (!this._state.spellcastingAbility && _CASTER_CLASSES.has(cls)) {
			const defaults = {
				Bard: "cha", Cleric: "wis", Druid: "wis", Paladin: "cha",
				Ranger: "wis", Sorcerer: "cha", Warlock: "cha", Wizard: "int",
				Artificer: "int",
			};
			this._state.spellcastingAbility = defaults[cls] || "";
		}
	}

	// -- Class-data automation -------------------------------------------------
	// Called whenever class or level changes. Reads the loaded class JSON and
	// auto-fills: spell slots, hit dice, spellcasting ability, armor/weapon profs,
	// skill proficiency options, and class features text.

	// -- Central handler for level / class changes ---------------------------
	_onLevelOrClassChange ({resetClass = false} = {}) {
		if (!this._state) return;
		this._state.classFeatures      = "";
		this._state.classFeatures2     = "";
		this._state.hitDice            = "";
		this._state.spellSlots         = [0, 0, 0, 0, 0, 0, 0, 0, 0];
		this._state.pactSlots          = [0, 0, 0, 0, 0, 0, 0, 0, 0];
		if (resetClass) {
			this._state.armorProfs          = [];
			this._state.weaponProfs         = [];
			this._state.savingThrowProfs    = [];
			this._state.spellcastingAbility  = "";
			this._state.spellcastingAbilities = [];
		}
		this._applyClassData();
		this._applyBackgroundData();
		this._applySpeciesData();
		this._applyFeatData();
		this.renderInput();
		this.renderOutput();
	}

	_getClassEntry () {
		if (!this._state) return null;
		const clsName = (this._state.classes?.[0]?.cls) || "";
		if (!clsName) return null;
		const isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
		// Prefer edition-matching entry; fall back to any match
		const matches = this._allClasses.filter(c => c.name === clsName);
		if (!matches.length) return null;
		const preferred = matches.find(c => isNew ? !SourceUtil.isClassicSource(c.source) : SourceUtil.isClassicSource(c.source));
		return preferred || matches[0];
	}

	_getClassEntries () {
		const classes = this._state.classes || [];
		const isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
		return classes.map(c => {
			const clsName = c.cls || "";
			if (!clsName) return null;
			const matches = this._allClasses.filter(x => x.name === clsName);
			if (!matches.length) return null;
			const preferred = matches.find(x => isNew ? !SourceUtil.isClassicSource(x.source) : SourceUtil.isClassicSource(x.source));
			return preferred || matches[0];
		});
	}

	_getTotalLevel () {
		const classes = this._state.classes;
		if (!classes?.length) return 1;
		return classes.reduce((s, c) => s + Math.max(1, Math.min(20, parseInt(c.level) || 1)), 0);
	}

	_applyClassData () {
		if (!this._state) return;
		const classes = this._state.classes || [];
		if (!classes.length) return;

		const isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
		const classEntries = this._getClassEntries();
		const primaryCls = classEntries[0];
		if (!primaryCls) return;

		const totalLvl = this._getTotalLevel();

		// -- Spellcasting ability ---------------------------------------------
		// Collect all unique spellcasting abilities across every class entry
		this._state.spellcastingAbilities = [...new Set(
			classEntries.filter(Boolean).map(c => c.spellcastingAbility).filter(Boolean)
		)];
		if (primaryCls.spellcastingAbility && !this._state.spellcastingAbility) {
			this._state.spellcastingAbility = primaryCls.spellcastingAbility;
		}

		// -- Spell slots ------------------------------------------------------
		const _getCasterType = (clsEntry) => {
			if (!clsEntry) return "none";
			const slotGroup = (clsEntry.classTableGroups || []).find(g => g.rowsSpellProgression);
			if (slotGroup) {
				const rows = slotGroup.rowsSpellProgression;
				const lastRow = rows[Math.min(19, rows.length - 1)];
				if (lastRow?.[8] > 0) return "full";
				if (lastRow?.[4] > 0) return "half";
				if (lastRow?.[2] > 0) return "third";
				return "full";
			}
			const pactGroup = (clsEntry.classTableGroups || []).find(g => {
				const labels = g.colLabels || [];
				return !g.rowsSpellProgression
					&& labels.some(l => l === "Spell Slots")
					&& labels.some(l => l === "Slot Level");
			});
			if (pactGroup) return "pact";
			return "none";
		};

		const _getPactSlots = (clsEntry, clsLvl) => {
			const pactGroup = (clsEntry.classTableGroups || []).find(g => {
				const labels = g.colLabels || [];
				return !g.rowsSpellProgression
					&& labels.some(l => l === "Spell Slots")
					&& labels.some(l => l === "Slot Level");
			});
			if (!pactGroup) return null;
			const labels = pactGroup.colLabels;
			const iCount = labels.indexOf("Spell Slots");
			const iLevel = labels.indexOf("Slot Level");
			const row = (pactGroup.rows || [])[clsLvl - 1];
			if (!row) return null;
			const count = parseInt(row[iCount]) || 0;
			const levelCell = String(row[iLevel]);
			const match = levelCell.match(/\blevel=(\d+)/i);
			const slotLvl = match ? parseInt(match[1]) : parseInt(levelCell);
			if (slotLvl < 1 || slotLvl > 9) return null;
			return {count, slotLvl};
		};

		if (classes.length === 1) {
			// Single class - original logic
			const cls = primaryCls;
			const lvl = Math.max(1, Math.min(20, parseInt(classes[0].level) || 1));
			const slotGroup = (cls.classTableGroups || []).find(g => g.rowsSpellProgression);
			const casterType = _getCasterType(cls);
			if (slotGroup) {
				const row = slotGroup.rowsSpellProgression[lvl - 1];
				if (row) this._state.spellSlots = [...row];
				else this._state.spellSlots = [0,0,0,0,0,0,0,0,0];
			} else if (casterType === "pact") {
				const pact = _getPactSlots(cls, lvl);
				const pactArr = [0,0,0,0,0,0,0,0,0];
				if (pact) pactArr[pact.slotLvl - 1] = pact.count;
				this._state.spellSlots = [0,0,0,0,0,0,0,0,0];
				this._state.pactSlots  = pactArr;
			} else {
				this._state.spellSlots = [0,0,0,0,0,0,0,0,0];
				this._state.pactSlots  = [0,0,0,0,0,0,0,0,0];
			}
		} else {
			// Multiclass - combine spell slots using D&D 5e rules
			const _MC_SLOTS = [
				[2,0,0,0,0,0,0,0,0], [3,0,0,0,0,0,0,0,0], [4,2,0,0,0,0,0,0,0],
				[4,3,0,0,0,0,0,0,0], [4,3,2,0,0,0,0,0,0], [4,3,3,0,0,0,0,0,0],
				[4,3,3,1,0,0,0,0,0], [4,3,3,2,0,0,0,0,0], [4,3,3,3,1,0,0,0,0],
				[4,3,3,3,2,0,0,0,0], [4,3,3,3,2,1,0,0,0], [4,3,3,3,2,1,0,0,0],
				[4,3,3,3,2,1,1,0,0], [4,3,3,3,2,1,1,0,0], [4,3,3,3,2,1,1,1,0],
				[4,3,3,3,2,1,1,1,0], [4,3,3,3,2,1,1,1,1], [4,3,3,3,3,1,1,1,1],
				[4,3,3,3,3,2,1,1,1], [4,3,3,3,3,2,2,1,1],
			];
			let effectiveCasterLevel = 0;
			const pactSlotsArr = [0,0,0,0,0,0,0,0,0];

			classes.forEach((c, i) => {
				const entry = classEntries[i];
				if (!entry) return;
				const clsLvl = Math.max(1, Math.min(20, parseInt(c.level) || 1));
				const casterType = _getCasterType(entry);
				if (casterType === "full")       effectiveCasterLevel += clsLvl;
				else if (casterType === "half")  effectiveCasterLevel += Math.floor(clsLvl / 2);
				else if (casterType === "third") effectiveCasterLevel += Math.floor(clsLvl / 3);
				else if (casterType === "pact") {
					const pact = _getPactSlots(entry, clsLvl);
					if (pact) pactSlotsArr[pact.slotLvl - 1] = (pactSlotsArr[pact.slotLvl - 1] || 0) + pact.count;
				}
			});

			this._state.spellSlots = effectiveCasterLevel > 0
				? [...(_MC_SLOTS[Math.min(19, effectiveCasterLevel - 1)] || [0,0,0,0,0,0,0,0,0])]
				: [0,0,0,0,0,0,0,0,0];
			this._state.pactSlots = pactSlotsArr;
		}

		// -- Hit dice (combined for multiclass) -------------------------------
		const hitDiceParts = [];
		classes.forEach((c, i) => {
			const entry = classEntries[i];
			if (!entry?.hd) return;
			const clsLvl = Math.max(1, Math.min(20, parseInt(c.level) || 1));
			hitDiceParts.push(`${clsLvl}d${entry.hd.faces}`);
		});
		this._state.hitDice = hitDiceParts.join("+") || "";

		// -- Armor proficiencies (primary class only) -------------------------
		const sp = primaryCls.startingProficiencies || {};
		if (sp.armor && !this._state.armorProfs?.length) {
			const ARMOR_MAP = {"light": "Light", "medium": "Medium", "heavy": "Heavy", "shield": "Shields"};
			this._state.armorProfs = sp.armor.map(a => {
				if (typeof a === "object" && a) {
					const key = (a.proficiency || "").toLowerCase();
					return ARMOR_MAP[key] || a.full || a.proficiency || null;
				}
				return ARMOR_MAP[a.toLowerCase()] || a;
			}).filter(Boolean);
		}

		// -- Weapon proficiencies (primary class only) ------------------------
		if (sp.weapons && !this._state.weaponProfs?.length) {
			const WEAPON_MAP = {"simple": "Simple weapons", "martial": "Martial weapons"};
			this._state.weaponProfs = sp.weapons.map(w => {
				if (typeof w === "object" && w) {
					const key = (w.proficiency || "").toLowerCase();
					return WEAPON_MAP[key] || w.proficiency || null;
				}
				const lower = w.toLowerCase();
				if (WEAPON_MAP[lower]) return WEAPON_MAP[lower];
				const tagMatch = w.match(/\{@\w+ [^|]+\|[^|]+\|([^}]+)\}/);
				if (tagMatch) return tagMatch[1];
				const simpleTag = w.match(/\{@\w+ ([^|}]+)[|}]/);
				if (simpleTag) return simpleTag[1];
				return w;
			}).filter(Boolean);
		}

		// -- Saving throw proficiencies (primary class only) ------------------
		if (primaryCls.proficiency && !this._state.savingThrowProfs?.length) {
			this._state.savingThrowProfs = [...primaryCls.proficiency];
		}

		// -- Skill choices (primary class only) ------------------------------
		const skillEntry = (sp.skills || [])[0];
		if (skillEntry) {
			if (skillEntry.any) {
				this._state._skillChoiceCount = skillEntry.any;
				this._state._skillChoiceFrom  = null;
			} else if (skillEntry.choose) {
				this._state._skillChoiceCount = skillEntry.choose.count || 2;
				this._state._skillChoiceFrom  = skillEntry.choose.from || null;
			}
		}

		// TODO [TEMPORARY - HARDCODED]: Replace with general class feature parser
		// Expertise count: Rogue (L1+2, L6+2), Bard (L3+2, L10+2)
		{
			let expertiseCount = 0;
			(this._state.classes || []).forEach(c => {
				const lvl  = c.level || 0;
				const name = c.cls   || "";
				if (name === "Rogue") { if (lvl >= 1) expertiseCount += 2; if (lvl >= 6) expertiseCount += 2; }
				if (name === "Bard")  { if (lvl >= 3) expertiseCount += 2; if (lvl >= 10) expertiseCount += 2; }
			});
			this._state._classExpertiseCount = expertiseCount;
			// Trim saved choices if count shrinks
			if ((this._state.classExpertise || []).length > expertiseCount)
				this._state.classExpertise = (this._state.classExpertise || []).slice(0, expertiseCount);
		}

		// -- Class features (from ALL classes) -------------------------------
		const featureLines = [];
		let asiCount = 0;
		const _pushFeature = (featureLvl, feature) => {
			const name = feature.name || "";
			const text = CharacterBuilder._renderFeatureToPlainText(feature);
			featureLines.push(`[L${featureLvl}] ${name}\n${text}`);
		};

		classes.forEach((c, i) => {
			const entry = classEntries[i];
			if (!entry) return;
			const clsLvl = Math.max(1, Math.min(20, parseInt(c.level) || 1));
			const subName = (c.sub || "").toLowerCase();
			const clsKey  = (entry.name || "").toLowerCase();
			const _isNew  = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;

			(entry.classFeatures || []).forEach((lvlFeatures, ixLvl) => {
				const featureLvl = ixLvl + 1;
				if (featureLvl > clsLvl) return;
				(Array.isArray(lvlFeatures) ? lvlFeatures : []).forEach(feature => {
					if (feature.gainSubclassFeature) return;
					if ((feature.name || "").toLowerCase() === "ability score improvement") asiCount++;
					_pushFeature(featureLvl, feature);
				});
			});

			if (subName) {
				const _scList = this._allSubclasses[clsKey] || [];
				const _nameMatches = _scList.filter(s => (s.name || "").toLowerCase() === subName);
				const _sc = _isNew
					? (_nameMatches.find(s => !SourceUtil.isClassicSource(s.source)) || _nameMatches[0])
					: (_nameMatches.find(s => SourceUtil.isClassicSource(s.source)) || _nameMatches[0]);
				if (_sc) {
					const _scShort  = (_sc.shortName || "").toLowerCase();
					const _scSource = _sc.source || "";
					(this._allSubclassFeatures || []).forEach(feature => {
						if ((feature.className || "").toLowerCase() !== clsKey) return;
						if ((feature.subclassShortName || "").toLowerCase() !== _scShort) return;
						if (_scSource && feature.subclassSource && feature.subclassSource !== _scSource) return;
						const featureLvl = feature.level || 0;
						if (!featureLvl || featureLvl > clsLvl) return;
						_pushFeature(featureLvl, feature);
					});
				}
			}
		});

		featureLines.sort((a, b) => {
			const getLvl = s => parseInt((s.match(/^\[L(\d+)\]/) || [])[1] || 0);
			return getLvl(a) - getLvl(b);
		});

		const oldItems = this._state.classFeatureItems || [];
		const oldByAutoText = new Map(oldItems.filter(i => i._autoText).map(i => [i._autoText, i]));
		const oldExcluded = new Set(oldItems.filter(i => i.excluded && !i._autoText).map(i => i.text));
		this._state.classFeatureItems = featureLines.map(text => {
			const old = oldByAutoText.get(text);
			if (old) return old; // preserve user-edited text and excluded status
			return {text, _autoText: text, excluded: oldExcluded.has(text)};
		});

		// -- Optional feature slots (Fighting Style, Metamagic, Eldritch Invocations, etc.) -----
		{
			const _getProgCount = (progression, level) => {
				if (!progression) return 0;
				if (Array.isArray(progression)) return progression[Math.max(0, level - 1)] || 0;
				let max = 0;
				Object.entries(progression).forEach(([k, v]) => { if (parseInt(k) <= level) max = v; });
				return max;
			};
			const _isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
			const slots  = [];
			const _pushOptSlot = (prog, lvl) => {
				const count = _getProgCount(prog.progression, lvl);
				if (!count) return;
				slots.push({name: prog.name, featureType: prog.featureType, count, dataSource: "optFeature", key: (prog.featureType || [])[0]});
			};
			const _pushFeatSlot = (prog, lvl) => {
				const count = _getProgCount(prog.progression, lvl);
				if (!count) return;
				slots.push({name: prog.name, category: prog.category, count, dataSource: "feat", key: (prog.category || [])[0]});
			};
			classes.forEach((c, i) => {
				const entry = classEntries[i];
				if (!entry) return;
				const lvl = Math.max(1, Math.min(20, parseInt(c.level) || 1));
				(entry.optionalfeatureProgression || []).forEach(prog => _pushOptSlot(prog, lvl));
				(entry.featProgression            || []).forEach(prog => _pushFeatSlot(prog, lvl));
				// Subclass progressions
				const subName = (c.sub || "").toLowerCase();
				if (subName) {
					const clsKey       = (entry.name || "").toLowerCase();
					const _nameMatches = (this._allSubclasses[clsKey] || []).filter(s => (s.name || "").toLowerCase() === subName);
					const _sc = _isNew
						? (_nameMatches.find(s => !SourceUtil.isClassicSource(s.source)) || _nameMatches[0])
						: (_nameMatches.find(s =>  SourceUtil.isClassicSource(s.source)) || _nameMatches[0]);
					if (_sc) {
						(_sc.optionalfeatureProgression || []).forEach(prog => _pushOptSlot(prog, lvl));
						(_sc.featProgression            || []).forEach(prog => _pushFeatSlot(prog, lvl));
					}
				}
			});
			this._state._optionalFeatureSlots = slots;
			// Trim saved choices that exceed the new count
			const validKeys  = new Set(slots.map(s => s.key).filter(Boolean));
			const curChoices = {};
			slots.forEach(slot => {
				const prev = (this._state.optionalFeatureChoices || {})[slot.key] || [];
				curChoices[slot.key] = prev.slice(0, slot.count);
			});
			// Drop any keys not present in the new slot set
			Object.keys(this._state.optionalFeatureChoices || {}).forEach(k => {
				if (!validKeys.has(k)) delete curChoices[k];
			});
			this._state.optionalFeatureChoices = curChoices;
		}

		// -- ASI count ------------------------------------------------------------
		this._state._asiCount = asiCount;
		if ((this._state.asiChoices || []).length > asiCount)
			this._state.asiChoices = (this._state.asiChoices || []).slice(0, asiCount);

		// -- Weapon mastery count (TODO TEMPORARY - hardcoded by class/level) --
		{
			let masteryCount = 0;
			(this._state.classes || []).forEach(c => {
				const lvl  = c.level || 0;
				const name = c.cls   || "";
				// Fighter, Barbarian, Paladin: 2 at L1, 3 at L4, 4 at L10
				if (name === "Fighter" || name === "Barbarian" || name === "Paladin") {
					if (lvl >= 1)  masteryCount += 2;
					if (lvl >= 4)  masteryCount += 1;
					if (lvl >= 10) masteryCount += 1;
				}
				// Ranger: 2 at L1, 3 at L4
				if (name === "Ranger") {
					if (lvl >= 1) masteryCount += 2;
					if (lvl >= 4) masteryCount += 1;
				}
			});
			this._state._weaponMasteryCount = masteryCount;
			if ((this._state.weaponMasteries || []).length > masteryCount)
				this._state.weaponMasteries = (this._state.weaponMasteries || []).slice(0, masteryCount);
		}

		// -- Tool proficiency choice slots (class any-tool grants) -------------
		{
			const toolSlots = [];
			// Only primary class grants starting proficiencies
			const sp2 = primaryCls.startingProficiencies || {};
			(sp2.toolProficiencies || []).forEach(toolObj => {
				if (typeof toolObj !== "object" || !toolObj) return;
				if (toolObj.anyMusicalInstrument) toolSlots.push({type: "INS", count: toolObj.anyMusicalInstrument});
				if (toolObj.anyArtisansTool)      toolSlots.push({type: "AT",  count: toolObj.anyArtisansTool});
			});
			this._state._classToolSlots = toolSlots;
			const totalToolSlots = toolSlots.reduce((s, t) => s + t.count, 0);
			if ((this._state.classToolChoices || []).length > totalToolSlots)
				this._state.classToolChoices = (this._state.classToolChoices || []).slice(0, totalToolSlots);
		}

		this._syncGrantedEquipment();
		this._rebuildHpSection?.();
	}

	// -- Shared tag-stripping helper -----------------------------------------
	static _stripTags (text) {
		return String(text || "")
			.replace(/\{@\w+ ([^|}]+)(?:\|[^}]*)?\}/g, "$1")
			.replace(/\s+/g, " ").trim();
	}

	// -- Entries → plain text (shared by bg/race/feat) ------------------------
	static _entriesToPlainText (entries, depth = 0) {
		const lines = [];
		const indent = "  ".repeat(depth);
		(entries || []).forEach(entry => {
			if (typeof entry === "string") {
				const t = CharacterBuilder._stripTags(entry);
				if (t) lines.push(indent + t);
			} else if (typeof entry === "object" && entry) {
				const type = entry.type || "";
				const name = entry.name ? CharacterBuilder._stripTags(entry.name) : "";
				if (type === "list") {
					(entry.items || []).forEach(item => {
						if (typeof item === "string") lines.push(indent + "• " + CharacterBuilder._stripTags(item));
						else if (item.name) {
							lines.push(indent + "• " + CharacterBuilder._stripTags(item.name) + (item.entry ? ": " + CharacterBuilder._stripTags(item.entry) : ""));
							if (item.entries) lines.push(...CharacterBuilder._entriesToPlainText(item.entries, depth + 1));
						} else lines.push(...CharacterBuilder._entriesToPlainText([item], depth));
					});
				} else if (type === "table") {
					if (entry.caption) lines.push(indent + "[Table: " + CharacterBuilder._stripTags(entry.caption) + "]");
				} else if (type === "item") {
					if (name) lines.push(indent + name + (entry.entry ? ": " + CharacterBuilder._stripTags(entry.entry) : ""));
					if (entry.entries) lines.push(...CharacterBuilder._entriesToPlainText(entry.entries, depth + 1));
				} else {
					if (name && depth > 0) lines.push(indent + name + ":");
					if (entry.entries) lines.push(...CharacterBuilder._entriesToPlainText(entry.entries, depth + (name ? 1 : 0)));
				}
			}
		});
		return lines;
	}

	// -- Shared spell-collection helper ---------------------------------------
	// Recursively collects concrete spell name strings from an additionalSpells
	// group value (innate / known / prepared / expanded).  Skips choose objects.
	static _collectSpells (obj) {
		if (typeof obj === "string") return [obj.split("|")[0].replace(/#[a-z]$/, "").trim()];
		if (Array.isArray(obj))      return obj.flatMap(CharacterBuilder._collectSpells);
		if (obj && typeof obj === "object") {
			if (obj.choose !== undefined) return [];
			return Object.values(obj).flatMap(CharacterBuilder._collectSpells);
		}
		return [];
	}

	// -- Equipment item parsing helpers ---------------------------------------
	// Parses a single startingEquipment item entry → {name, qty} or null.
	static _parseEquipItem (item) {
		if (!item) return null;
		// Capitalize first letter of each word but not letters after apostrophes
		const toTitle = s => s.replace(/(^|\s)\w/g, c => c.toUpperCase());
		if (typeof item === "string") {
			const name = item.split("|")[0].replace(/#[a-z]$/, "").trim();
			return name ? {name: toTitle(name), qty: 1} : null;
		}
		if (item.special) return {name: item.special, qty: item.quantity || 1};
		if (item.item) {
			const name = item.item.split("|")[0].trim();
			return name ? {name: toTitle(name), qty: item.quantity || 1} : null;
		}
		if (item.equipmentType) {
			const map = {
				weaponMartial: "Martial Weapon", weaponSimple: "Simple Weapon",
				focusSpellcastingHoly: "Holy Symbol", focusSpellcastingArcane: "Arcane Focus",
				focusSpellcastingDruidic: "Druidic Focus", weaponHandCrossbow: "Hand Crossbow",
			instrumentMusical: "Musical Instrument",
			};
			return {name: map[item.equipmentType] || item.equipmentType, qty: item.quantity || 1};
		}
		return null;
	}

	// Formats a list of startingEquipment items as a short human-readable label.
	static _fmtEquipChoiceLabel (items) {
		return (items || []).map(item => {
			if (item && typeof item === "object" && item.value != null) {
				return CharacterBuilder._fmtCp(item.value);
			}
			const parsed = CharacterBuilder._parseEquipItem(item);
			if (!parsed) return null;
			return parsed.qty > 1 ? `${parsed.name} ×${parsed.qty}` : parsed.name;
		}).filter(Boolean).join(", ");
	}

	// Converts a copper-piece value to a human-readable currency string (GP/SP/CP).
	static _fmtCp (cp) {
		const gp = Math.floor(cp / 100);
		const rem = cp % 100;
		const sp = Math.floor(rem / 10);
		const c = rem % 10;
		const parts = [];
		if (gp) parts.push(`${gp} GP`);
		if (sp) parts.push(`${sp} SP`);
		if (c) parts.push(`${c} CP`);
		return parts.length ? parts.join(" ") : "0 CP";
	}

	// -- Background automation -------------------------------------------------
	_applyBackgroundData () {
		if (!this._state) return;
		const bgName = this._state.background || "";
		if (!bgName) return;
		const isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
		const matches = this._allBackgrounds.filter(b => b.name === bgName);
		if (!matches.length) return;
		const bg = isNew
			? (matches.find(b => !SourceUtil.isClassicSource(b.source)) || matches[0])
			: (matches.find(b => SourceUtil.isClassicSource(b.source)) || matches[0]);

		// Skill proficiencies - keys are skill names (lowercase), value true means proficient
		const bgSkills = [];
		(bg.skillProficiencies || []).forEach(sp => {
			Object.keys(sp).forEach(k => {
				if (k === "choose" || k === "any") return;
				const mapped = _SKILLS.find(s => s.name.toLowerCase() === k.toLowerCase())?.name;
				if (mapped) bgSkills.push(mapped);
			});
		});
		const existingSkills = this._state.skillProfs || [];
		const newSkills = [...new Set([...existingSkills, ...bgSkills])];
		if (newSkills.length !== existingSkills.length) this._state.skillProfs = newSkills;

		// Tool proficiencies — stored in bgToolProfs (auto-managed) to keep toolProfs user-editable
		const bgTools = [];
		(bg.toolProficiencies || []).forEach(tp => {
			Object.keys(tp).forEach(k => {
				if (k === "choose" || k === "any") return;
				bgTools.push(k.split("|")[0]);
			});
		});
		const excludedBg = new Set((this._state.excludedBgToolProfs || []).map(t => t.toLowerCase()));
		this._state.bgToolProfs = bgTools.filter(t => !excludedBg.has(t.toLowerCase()));
		// Migrate: remove exact-match entries from toolProfs that are now tracked in bgToolProfs
		if (bgTools.length) {
			const bgToolSet = new Set(bgTools.map(t => t.toLowerCase()));
			this._state.toolProfs = (this._state.toolProfs || []).filter(t => !bgToolSet.has(t.toLowerCase()));
		}

		// Language proficiencies
		const bgLangs = [];
		(bg.languageProficiencies || []).forEach(lp => {
			Object.keys(lp).forEach(k => {
				if (k === "anyStandard" || k === "any" || k === "choose") {
					const n = lp[k]; if (typeof n === "number") bgLangs.push(`Any standard language ×${n}`);
				} else bgLangs.push(k.charAt(0).toUpperCase() + k.slice(1));
			});
		});
		if (bgLangs.length) {
			const existing = this._state.languages || [];
			this._state.languages = [...new Set([...existing, ...bgLangs])];
		}

		// Granted feat from background (2024) - stored separately so user feats are unaffected
		if (bg.feats?.length) {
			const featKey = Object.keys(bg.feats[0])[0];
			this._state.bgFeat = featKey.split("|")[0].replace(/\b\w/g, c => c.toUpperCase());
		} else {
			this._state.bgFeat = "";
		}

		this._syncGrantedSpells();
		this._syncGrantedEquipment();
		this._sg_syncAbilityScores();
	}

	// -- Species automation ----------------------------------------------------
	_applySpeciesData () {
		if (!this._state) return;
		const raceName = this._state.species || "";
		if (!raceName) return;
		const isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
		const matches = this._allSpecies.filter(r => r.name === raceName);
		if (!matches.length) return;
		const race = isNew
			? (matches.find(r => !SourceUtil.isClassicSource(r.source)) || matches[0])
			: (matches.find(r => SourceUtil.isClassicSource(r.source)) || matches[0]);

		// Size — only overwrite if the user hasn't customised away from the species default
		if (race.size?.length) {
			const SIZE_MAP = {F:"Fine",D:"Diminutive",T:"Tiny",S:"Small",M:"Medium",L:"Large",H:"Huge",G:"Gargantuan",C:"Colossal",V:"Varies"};
			const sizeVal = SIZE_MAP[race.size[0]] || "Medium";
			const oldSpeciesSize = this._state._speciesSize;
			this._state._speciesSize = sizeVal;
			if (oldSpeciesSize == null || this._state.size === oldSpeciesSize) this._state.size = sizeVal;
		}

		// Speed — only overwrite if the user hasn't customised away from the species default
		if (race.speed !== undefined) {
			const spd = typeof race.speed === "object" ? (race.speed.walk ?? 30) : race.speed;
			const oldSpeciesSpeed = this._state._speciesSpeed;
			this._state._speciesSpeed = spd;
			if (oldSpeciesSpeed == null || this._state.speed === oldSpeciesSpeed) this._state.speed = spd;
		}

		// Language proficiencies
		const raceLangs = [];
		(race.languageProficiencies || []).forEach(lp => {
			Object.keys(lp).forEach(k => {
				if (k === "anyStandard" || k === "any" || k === "choose") {
					const n = lp[k]; if (typeof n === "number") raceLangs.push(`Any standard language ×${n}`);
				} else raceLangs.push(k.charAt(0).toUpperCase() + k.slice(1));
			});
		});
		if (raceLangs.length) {
			const existing = this._state.languages || [];
			this._state.languages = [...new Set([...existing, ...raceLangs])];
		}

		// Species traits - build per-item array
		const traitLines = [];
		(race.entries || []).forEach(entry => {
			const name = entry.name ? CharacterBuilder._stripTags(entry.name) : "";
			const text = CharacterBuilder._entriesToPlainText(
				typeof entry === "string" ? [entry] : (entry.entries || [])
			).join(" ");
			if (name) traitLines.push(name + (text ? ": " + text : ""));
			else if (text) traitLines.push(text);
		});

		// Prepend darkvision note if not already present
		if (race.darkvision && !traitLines.some(l => l.includes("Darkvision"))) {
			traitLines.unshift(`Darkvision ${race.darkvision}ft.`);
		}

		if (traitLines.length) {
			const oldTraits = this._state.speciesTraitItems || [];
			const oldByAutoText = new Map(oldTraits.filter(i => i._autoText).map(i => [i._autoText, i]));
			const oldExcluded = new Set(oldTraits.filter(i => i.excluded && !i._autoText).map(i => i.text));
			this._state.speciesTraitItems = traitLines.map(text => {
				const old = oldByAutoText.get(text);
				if (old) return old;
				return {text, _autoText: text, excluded: oldExcluded.has(text)};
			});
		}

		this._syncGrantedSpells();
		this._sg_syncAbilityScores();
		this._rebuildHpSection?.();
	}

	// -- Feat grants automation ------------------------------------------------
	// Resets and re-populates all feat-granted proficiency/spell buckets from
	// current feat selections and user choices.  The feat* arrays are kept
	// separate from the user-editable main arrays; the output sheet unions them.
	_applyFeatData () {
		if (!this._state) return;

		// Reset feat-granted buckets
		this._state.featSkillProfs      = [];
		this._state.featToolProfs       = [];
		this._state.featLanguages       = [];
		this._state.featArmorProfs      = [];
		this._state.featWeaponProfs     = [];
		this._state.featSavingThrowProfs = [];
		this._state.featExpertise        = [];
		this._state.featResistances      = [];
		this._state.featHpBonus          = 0;
		this._state.featSpeedBonus       = 0;
		this._state.featInitiativeBonus  = 0;

		const allChoices = this._state.featChoices || {};
		const featNames  = [
			...(this._state.bgFeat ? [this._state.bgFeat] : []),
			...(this._state.feats || []),
			// ASI-slot feats
			...(this._state.asiChoices || []).filter(c => c.featName).map(c => c.featName),
		].filter(Boolean);

		const toTitle    = s => s.charAt(0).toUpperCase() + s.slice(1);
		const ARMOR_MAP  = {light: "Light", medium: "Medium", heavy: "Heavy", shield: "Shields"};

		// Helper: add to a state array, deduplicating
		const push = (arr, val) => { if (val && !arr.includes(val)) arr.push(val); };

		for (const featName of featNames) {
			const feat = this._getFeatEntry(featName);
			if (!feat) continue;
			const chosen = allChoices[featName] || {};
			// Helper: read both single-slot (key) and indexed slots (key_0, key_1, ...) for a choice
			const getChosenList = key => {
				const vals = [];
				if (chosen[key]) vals.push(chosen[key]);
				for (let i = 0; chosen[key + "_" + i] !== undefined; i++) {
					if (chosen[key + "_" + i]) vals.push(chosen[key + "_" + i]);
				}
				return vals;
			};

			// -- Skill proficiencies --------------------------------------
			(feat.skillProficiencies || []).forEach(sp => {
				Object.keys(sp).forEach(k => {
					if (k === "choose") {
						getChosenList("skillProficiencies").forEach(val => {
							const mapped = val && _SKILLS.find(s => s.name.toLowerCase() === val.toLowerCase())?.name;
							if (mapped) push(this._state.featSkillProfs, mapped);
						});
					} else if (k !== "any" && k !== "anyProficientSkill") {
						const mapped = _SKILLS.find(s => s.name.toLowerCase() === k.toLowerCase())?.name;
						if (mapped) push(this._state.featSkillProfs, mapped);
					}
				});
			});

			// -- Skill/Tool/Language combined block (e.g. Skilled) --------
			(feat.skillToolLanguageProficiencies || []).forEach(block => {
				// Fixed concrete keys
				Object.keys(block).forEach(k => {
					if (k === "choose") return;
					const mapped = _SKILLS.find(s => s.name.toLowerCase() === k.toLowerCase())?.name;
					if (mapped) push(this._state.featSkillProfs, mapped);
				});
				// User-chosen picks: route each to the correct array by type
				if (block.choose) {
					getChosenList("skillToolLanguageProficiencies").forEach(val => {
						if (!val) return;
						const asSkill = _SKILLS.find(s => s.name.toLowerCase() === val.toLowerCase())?.name;
						if (asSkill) push(this._state.featSkillProfs, asSkill);
						else push(this._state.featToolProfs, val);
					});
				}
			});

			// -- Tool proficiencies ---------------------------------------
			(feat.toolProficiencies || []).forEach(tp => {
				Object.keys(tp).forEach(k => {
					if (k === "choose" || k === "any" || k === "anyMusicalInstrument") {
						getChosenList("toolProficiencies").forEach(val => {
							if (val) push(this._state.featToolProfs, val);
						});
					} else {
						push(this._state.featToolProfs, k.split("|")[0]);
					}
				});
			});

			// -- Language proficiencies -----------------------------------
			(feat.languageProficiencies || []).forEach(lp => {
				Object.keys(lp).forEach(k => {
					if (k === "anyStandard" || k === "any" || k === "choose") {
						getChosenList("languageProficiencies").forEach(val => {
							if (val) push(this._state.featLanguages, val);
						});
					} else {
						push(this._state.featLanguages, toTitle(k));
					}
				});
			});

			// -- Armor proficiencies --------------------------------------
			(feat.armorProficiencies || []).forEach(ap => {
				Object.keys(ap).forEach(k => {
					if (k === "choose") return;
					const disp = ARMOR_MAP[k.toLowerCase()] || toTitle(k);
					push(this._state.featArmorProfs, disp);
				});
			});

			// -- Weapon proficiencies -------------------------------------
			(feat.weaponProficiencies || []).forEach(wp => {
				Object.keys(wp).forEach(k => {
					if (k === "choose") return;
					push(this._state.featWeaponProfs, toTitle(k));
				});
			});

			// -- Saving throw proficiencies (e.g. Resilient) ---------------
			(feat.savingThrowProficiencies || []).forEach(sp => {
				if (sp.choose) {
					getChosenList("savingThrowProficiencies").forEach(val => {
						if (val) push(this._state.featSavingThrowProfs, _ABILITY_FULL[val] || toTitle(val));
					});
				} else {
					Object.keys(sp).forEach(k => push(this._state.featSavingThrowProfs, _ABILITY_FULL[k] || toTitle(k)));
				}
			});

			// -- Expertise (e.g. Skill Expert, Prodigy) -------------------
			(feat.expertise || []).forEach(ex => {
				Object.keys(ex).forEach(k => {
					if (k === "anyProficientSkill" || k === "choose" || k === "any") {
						getChosenList("expertise").forEach(val => {
							if (val) push(this._state.featExpertise, val);
						});
					} else {
						const mapped = _SKILLS.find(s => s.name.toLowerCase() === k.toLowerCase())?.name;
						if (mapped) push(this._state.featExpertise, mapped);
					}
				});
			});

			// -- Damage resistances ---------------------------------------
			(feat.resist || []).forEach(res => {
				Object.keys(res).forEach(k => {
					if (k === "choose") {
						getChosenList("resist").forEach(val => {
							if (val) push(this._state.featResistances, val);
						});
					} else {
						push(this._state.featResistances, k);
					}
				});
			});

			// -- HP bonus (e.g. Tough) ------------------------------------
			if (feat.hp) {
				const hpArr = Array.isArray(feat.hp) ? feat.hp : [feat.hp];
				hpArr.forEach(hpEntry => {
					if (typeof hpEntry.perLevel === "number") {
						this._state.featHpBonus += hpEntry.perLevel * this._getTotalLevel();
					} else if (typeof hpEntry.value === "number") {
						this._state.featHpBonus += hpEntry.value;
					}
				});
			}

			}

		// -- Hardcoded feat bonuses (no machine-readable data in feat JSON) ------
		// These feats grant flat stat bonuses expressed only in their entries text.
		const _hasFeat = name => featNames.some(n => n.toLowerCase() === name.toLowerCase());
		const profBonusForFeat = _profBonus(this._getTotalLevel());

		// Tough (PHB + XPHB): +2 HP per character level
		if (_hasFeat("Tough")) this._state.featHpBonus += this._getTotalLevel() * 2;

		// Mobile (PHB 2014) / Speedy (XPHB 2024): +10 ft. walking speed
		if (_hasFeat("Mobile") || _hasFeat("Speedy")) this._state.featSpeedBonus += 10;

		// Alert - edition determines the bonus:
		//   PHB (classic): flat +5 to initiative
		//   XPHB (modern): +proficiency bonus to initiative
		if (_hasFeat("Alert")) {
			const alertFeat = this._getFeatEntry("Alert");
			if (alertFeat) {
				if (SourceUtil.isClassicSource(alertFeat.source)) {
					this._state.featInitiativeBonus += 5;
				} else {
					this._state.featInitiativeBonus += profBonusForFeat;
				}
			}
		}

		this._syncGrantedSpells();
		this._sg_syncAbilityScores();
	}

	// -- Auto-granted spell sync -----------------------------------------------
	// Single source of truth for spells granted by feats, species, and background.
	// Removes all previously auto-granted entries from this._state.spells then
	// re-adds the current set with {autoGranted:true, notes:"from <source>"}.
	// Called at the end of every apply method so all sources are always in sync.
	_syncGrantedSpells () {
		if (!this._state) return;

		const cs = CharacterBuilder._collectSpells;

		// 1. Collect all desired grants as [{name, source}], deduped by name
		const desiredGrants = [];
		const pushDesired = (name, source) => {
			if (!name) return;
			const canonical = this._getSpellEntry(name)?.name || name;
			if (!desiredGrants.some(g => g.name.toLowerCase() === canonical.toLowerCase())) {
				desiredGrants.push({name: canonical, source});
			}
		};

		// Feat-granted spells
		const allChoices = this._state.featChoices || {};
		const featNames  = [
			...(this._state.bgFeat ? [this._state.bgFeat] : []),
			...(this._state.feats || []),
			...(this._state.asiChoices || []).filter(c => c.featName).map(c => c.featName),
		].filter(Boolean);
		for (const featName of featNames) {
			const feat = this._getFeatEntry(featName);
			if (!feat?.additionalSpells) continue;
			const chosen = allChoices[featName] || {};
			const groups = feat.additionalSpells;
			const active = (groups.length > 1 && groups.every(g => g.name))
				? (chosen.spellList ? groups.filter(g => g.name === chosen.spellList) : [])
				: groups;
			active.forEach(grp => {
				["innate", "known", "prepared", "expanded"].forEach(prop => {
					if (grp[prop]) cs(grp[prop]).forEach(n => pushDesired(n, featName));
				});
			});
			// User-chosen spells via spell choose slots (e.g. Magic Initiate)
			let spellIdx = 0;
			while (chosen[`featSpell_${spellIdx}`] !== undefined) {
				pushDesired(chosen[`featSpell_${spellIdx}`], featName);
				spellIdx++;
			}
		}

		// Species-granted spells
		const speciesEntry = this._sg_getSpeciesEntry();
		if (speciesEntry?.additionalSpells) {
			const speciesChoices = this._state.speciesChoices || {};
			let spellIdx = 0;
			speciesEntry.additionalSpells.forEach(grp => {
				["innate", "known", "prepared", "expanded"].forEach(prop => {
					if (!grp[prop]) return;
					cs(grp[prop]).forEach(n => pushDesired(n, speciesEntry.name));
					CharacterBuilder._eachSpellChoose(grp[prop], () => {
						const chosen = speciesChoices[`speciesSpell_${spellIdx++}`];
						if (chosen) pushDesired(chosen, speciesEntry.name);
					});
				});
			});
		}

		// Background-granted spells (direct additionalSpells, not via feat)
		const bgEntry = this._sg_getBgEntry();
		if (bgEntry?.additionalSpells) {
			bgEntry.additionalSpells.forEach(grp => {
				["innate", "known", "prepared", "expanded"].forEach(prop => {
					if (grp[prop]) cs(grp[prop]).forEach(n => pushDesired(n, bgEntry.name));
				});
			});
		}

		// 2. Diff: keep user-added spells, match desired grants against existing auto-granted
		// spells (preserving user edits), adding fresh entries only for newly-granted spells.
		const existingGranted = (this._state.spells || []).filter(sp => sp.autoGranted);
		const matched = new Set();
		const newSpells = (this._state.spells || []).filter(sp => !sp.autoGranted);

		for (const grant of desiredGrants) {
			const key = grant.name.toLowerCase();
			const existingIdx = existingGranted.findIndex((sp, i) => !matched.has(i) && sp.name.toLowerCase() === key);
			if (existingIdx >= 0) {
				matched.add(existingIdx);
				newSpells.push(existingGranted[existingIdx]); // preserve user edits
			} else {
				newSpells.push({name: grant.name, notes: `from ${grant.source}`, autoGranted: true, prepared: false});
			}
		}

		this._state.spells = newSpells;
		this._rebuildSpellsTab?.();
	}

	// -- Feats automation ------------------------------------------------------
	// Called to enrich the feats text area with descriptions from loaded feat data.
	// Feats are already stored as name strings in state.feats[]; this method
	// builds a rich class-features2-style description block.
	_buildFeatsDescription () {
		if (!this._state) return "";
		const featNames = [
			...(this._state.bgFeat ? [this._state.bgFeat] : []),
			...(this._state.feats || []),
		].filter(Boolean);
		if (!featNames.length) return "";
		const lines = [];
		const allChoices = this._state.featChoices || {};
		featNames.forEach(name => {
			const feat = this._getFeatEntry(name);
			const chosen = allChoices[name] || {};
			const chosenParts = [...new Set(Object.values(chosen).filter(Boolean))];
			const chosenSuffix = chosenParts.length ? ` (${chosenParts.join(", ")})` : "";
			if (!feat) { lines.push(`• ${name}${chosenSuffix}`); return; }
			const desc = CharacterBuilder._entriesToPlainText(feat.entries || []).join(" ");
			lines.push(`• ${feat.name}${chosenSuffix}: ${desc.slice(0, 400)}`);
		});
		return lines.join("\n");
	}

	// -- Feat choice helpers ---------------------------------------------------
	// Returns an array of choice descriptors for a feat.
	// Each: {key, label, options: [{value,label}]|null, placeholder?}
	//   key         – stable identifier used in featChoices[featName][key]
	//   options     – fixed list for a <select>, or null for a free-text <input>
	//   placeholder – hint text for free-text inputs
	//
	// A single recursive walker scans ALL feat properties for "choose" keys and
	// implicit-choice keys (any, anyMusicalInstrument, etc.). A metadata table
	// keyed by feat-property name maps each found pattern to display info, so
	// new feat properties only require adding one entry to PROP_META.
	_getFeatChoices (featName) {
		const feat = this._getFeatEntry(featName);
		if (!feat) return [];

		const toTitle  = s => s.charAt(0).toUpperCase() + s.slice(1);
		const ABIL_FULL = {str:"Strength",dex:"Dexterity",con:"Constitution",int:"Intelligence",wis:"Wisdom",cha:"Charisma"};
		const abilOpts  = from => (from || []).map(a => ({value: a, label: ABIL_FULL[a] || toTitle(a)}));
		const ANY_LABELS = {anySkill:"any skill", anyTool:"any tool", anyLanguage:"any language",
			anyMusicalInstrument:"any instrument", anyProficientSkill:"any proficient skill"};

		// -- Metadata per feat property --------------------------------------
		// label(from, count, amount) → display string
		// options(from)              → [{value,label}] or null (null = text input)
		// placeholder(from, count)   → hint for text inputs
		const PROP_META = {
			ability: {
				label:       (from, cnt, amt) => cnt > 1 ? `Ability Scores (×${cnt}, +${amt ?? 1} ea.)` : `Ability Score (+${amt ?? 1})`,
				options:     abilOpts,
			},
			savingThrowProficiencies: {
				label:       () => "Saving Throw",
				options:     abilOpts,
			},
			skillProficiencies: {
				label:       (from, cnt) => cnt > 1 ? `Skills (×${cnt})` : "Skill",
				options:     from => from?.every(f => !ANY_LABELS[f]) ? from.map(s => ({value: s, label: toTitle(s)})) : null,
				placeholder: (from, cnt) => `Pick ${cnt} skill(s)`,
			},
			skillToolLanguageProficiencies: {
				label:       (from, cnt) => cnt > 1 ? `Proficiency (×${cnt})` : "Proficiency",
				options:     from => {
					const opts = [];
					const hasAnySkill = !from || from.includes("anySkill");
					const hasAnyTool  = !from || from.includes("anyTool") || from.includes("anyMusicalInstrument");
					if (hasAnySkill) opts.push(..._SKILLS.map(s => ({value: s.name, label: s.name})));
					if (hasAnyTool)  opts.push(..._COMMON_TOOLS.map(t => ({value: t, label: t})));
					if (from) from.filter(f => !ANY_LABELS[f]).forEach(f => { const n = toTitle(f); if (!opts.some(o => o.value === n)) opts.push({value: n, label: n}); });
					return opts.length ? opts : null;
				},
			},
			toolProficiencies: {
				label:       (from, cnt) => cnt > 1 ? `Tools (×${cnt})` : "Tool",
				options:     from => from?.every(f => !ANY_LABELS[f]) ? from.map(t => ({value: t, label: toTitle(t)})) : null,
				placeholder: (from, cnt) => from ? `e.g. ${from.slice(0,2).map(toTitle).join(", ")}` : "Tool name",
			},
			languageProficiencies: {
				label:       (from, cnt) => cnt > 1 ? `Languages (×${cnt})` : "Language",
				options:     null,
				placeholder: () => "e.g. Elvish, Dwarvish",
			},
			resist: {
				label:       (from, cnt) => cnt > 1 ? `Damage Resistances (×${cnt})` : "Damage Resistance",
				options:     from => from?.map(t => ({value: t, label: toTitle(t)})),
			},
			weaponProficiencies: {
				label:       (from, cnt) => cnt > 1 ? `Weapons (×${cnt})` : "Weapon",
				options:     null,
				placeholder: () => "Weapon type",
			},
			expertise: {
				label:       (from, cnt) => cnt > 1 ? `Expertise Skills (×${cnt})` : "Expertise Skill",
				options:     () => {
					const allProf = [...new Set([...(this._state.skillProfs||[]), ...(this._state.featSkillProfs||[]), ...(this._state.classSkillChoices||[])])];
					const pool = allProf.length ? allProf : _SKILLS.map(s => s.name);
					return pool.map(s => ({value: s, label: s}));
				},
				placeholder: () => "Skill you're proficient in",
			},
			// Virtual key for additionalSpells[].ability.choose
			spellcastingAbility: {
				label:       () => "Spellcasting Ability",
				options:     abilOpts,
			},
		};

		// -- Recursive walker ------------------------------------------------
		const choices      = [];
		const pendingEmits = []; // queued so total slot counts are known before key assignment

		// Queue one entry per choose-block; keys are assigned in the two-pass below.
		const emit = (propKey, from, count, amount) => {
			if (!PROP_META[propKey]) return;
			pendingEmits.push({propKey, from, count: count || 1, amount});
		};

		const walk = (val, propKey) => {
			if (!val || typeof val !== "object") return;
			if (Array.isArray(val)) { val.forEach(v => walk(v, propKey)); return; }
			for (const [k, v] of Object.entries(val)) {
				if (k === "choose") {
					// v may be an object {from,count,amount}, an array of blocks
					// [{from,count}], or the shorthand array ["str","dex",...].
					const blocks = Array.isArray(v)
						? (v.length && typeof v[0] === "string" ? [{from: v}] : v)
						: [v];
					for (const blk of blocks) emit(propKey, blk.from, blk.count, blk.amount);
				} else if ((k === "any" || k in ANY_LABELS) && typeof v === "number") {
					emit(propKey, null, v, null);
				} else {
					walk(v, propKey);
				}
			}
		};

		// -- Main scan -------------------------------------------------------
		const SKIP = new Set(["entries", "_versions", "reprintedAs", "prerequisite",
			"hasFluff", "hasFluffImages", "page", "source", "name", "category",
			"srd52", "basicRules2024", "repeatable", "repeatableHidden", "hidden"]);

		for (const [k, v] of Object.entries(feat)) {
			if (SKIP.has(k)) continue;
			if (k === "additionalSpells") {
				// Multiple named groups → spell-list choice (pick one group)
				if (v.length > 1 && v.every(g => g.name)) {
					choices.push({key: "spellList", label: "Spell List",
						options: v.map(g => ({value: g.name, label: g.name})), placeholder: null});
				}
				// Any group's spellcasting ability may itself be a choice
				const abilGroup = v.find(g => Array.isArray(g.ability?.choose));
				if (abilGroup) emit("spellcastingAbility", abilGroup.ability.choose, 1, null);
				// Spell choose slots
				const chosenSpellList = (this._state.featChoices?.[featName] || {}).spellList;
				const activeSpellGroups = v.length === 1 ? v
					: (chosenSpellList ? v.filter(g => g.name === chosenSpellList) : []);
				let spellIdx = 0;
				for (const grp of activeSpellGroups) {
					for (const prop of ["known", "innate", "prepared", "expanded"]) {
						if (!grp[prop]) continue;
						CharacterBuilder._eachSpellChoose(grp[prop], ({filter, count}) => {
							const lbl = CharacterBuilder._spellChooseLabel(filter);
							const opts = this._getSpellOptions(filter);
							for (let i = 0; i < count; i++) {
								choices.push({key: `featSpell_${spellIdx++}`, label: lbl,
									options: opts, placeholder: opts ? null : `Type ${lbl} name`});
							}
						});
					}
				}
			} else {
				walk(v, k);
			}
		}

		// -- Two-pass key assignment ------------------------------------------
		// First pass: total slot count per propKey determines bare vs. indexed keys.
		const slotTotals = {};
		pendingEmits.forEach(({propKey, count}) => { slotTotals[propKey] = (slotTotals[propKey] || 0) + count; });

		// Second pass: build choice descriptors with stable keys.
		const slotStarts = {};
		pendingEmits.forEach(({propKey, from, count, amount}) => {
			const meta      = PROP_META[propKey];
			const startIdx  = slotStarts[propKey] ?? 0;
			slotStarts[propKey] = startIdx + count;
			const total     = slotTotals[propKey];
			const getOpts   = () => typeof meta.options === "function" ? meta.options(from) : null;
			const phFn      = meta.placeholder;
			if (total === 1) {
				// Exactly one slot - use bare key for backwards compatibility with saved state
				const options     = getOpts();
				const placeholder = phFn ? phFn(from, 1) : null;
				choices.push({key: propKey, label: meta.label(from, 1, amount), options, placeholder});
			} else {
				// Multiple total slots - all use indexed keys so every slot is reachable
				for (let i = 0; i < count; i++) {
					const idx         = startIdx + i;
					const options     = getOpts();
					const placeholder = phFn ? phFn(from, 1) : (options ? `e.g. ${options.slice(0, 2).map(o => o.label).join(", ")}` : null);
					choices.push({key: `${propKey}_${idx}`, label: `${meta.label(from, 1, amount)} (${idx + 1}/${total})`, options, placeholder});
				}
			}
		});

		return choices;
	}

	// Walk an additionalSpells section looking for {choose: filterStr, count?} entries.
	static _eachSpellChoose (obj, cb) {
		if (!obj || typeof obj !== "object") return;
		if (Array.isArray(obj)) { obj.forEach(v => CharacterBuilder._eachSpellChoose(v, cb)); return; }
		if (typeof obj.choose === "string") { cb({filter: obj.choose, count: obj.count ?? 1}); return; }
		Object.values(obj).forEach(v => CharacterBuilder._eachSpellChoose(v, cb));
	}

	// Turn a spell filter string like "level=0|class=Cleric" into a readable label.
	static _spellChooseLabel (filter) {
		const parts = {};
		(filter || "").split("|").forEach(p => { const i = p.indexOf("="); if (i > 0) parts[p.slice(0, i)] = p.slice(i + 1); });
		const level = parseInt(parts.level ?? -1);
		const cls   = parts.class || "";
		const lvl   = level === 0 ? "Cantrip" : level > 0 ? `Level ${level} Spell` : "Spell";
		return cls ? `${cls} ${lvl}` : lvl;
	}

	// Filter this._allSpells by a filter string like "level=0|class=Cleric".
	// Edition-aware: uses SourceUtil.isClassicSource to include only sources matching the active edition,
	// then deduplicates by name keeping the edition-preferred entry.
	// Returns [{value, label}, ...] sorted alphabetically, or null if no spells loaded.
	_getSpellOptions (filter) {
		if (!this._allSpells?.length) return null;
		const isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
		const parts = {};
		(filter || "").split("|").forEach(p => { const i = p.indexOf("="); if (i > 0) parts[p.slice(0, i).toLowerCase()] = p.slice(i + 1); });
		const levelFilter = parts.level !== undefined ? parseInt(parts.level) : null;
		const classFilter = (parts.class || "").toLowerCase();
		const matches = this._allSpells.filter(sp => {
			if (levelFilter !== null && sp.level !== levelFilter) return false;
			if (classFilter) {
				const inList = sp.classes?.fromClassList?.some(c => c.name.toLowerCase() === classFilter);
				if (!inList) return false;
			}
			return true;
		});
		if (!matches.length) return null;
		// Deduplicate by name, keeping the edition-preferred version.
		// isNew (2024): prefer non-classic sources; classic (2014): prefer classic sources.
		const byName = new Map();
		for (const sp of matches) {
			const key = sp.name.toLowerCase();
			if (!byName.has(key)) { byName.set(key, sp); continue; }
			const existing = byName.get(key);
			const spPref      = isNew ? !SourceUtil.isClassicSource(sp.source)       : SourceUtil.isClassicSource(sp.source);
			const existPref   = isNew ? !SourceUtil.isClassicSource(existing.source)  : SourceUtil.isClassicSource(existing.source);
			if (spPref && !existPref) byName.set(key, sp);
		}
		return [...byName.values()].sort((a, b) => SortUtil.ascSortLower(a.name, b.name))
			.map(sp => ({value: sp.name, label: sp.name}));
	}

	// Convert a classFeature entry object to plain text, stripping 5etools tags
	static _renderFeatureToPlainText (feature) {
		return CharacterBuilder._entriesToPlainText(feature.entries || []).join("\n");
	}

	_buildFeatsTab (wrp, cb) {
		this._buildFeatsInput(wrp, cb);
	}

	// Appends choice inputs (select or text) for each choice a feat requires.
	// Each choice gets its own indented row. State stored as featChoices[featName][choiceKey].
	// Wraps everything in a .cb-feat-choices-wrp div so it can be cleared and rebuilt.
	_buildFeatChoiceInputs (featName, container, cb) {
		const wrp = ee`<div class="cb-feat-choices-wrp"></div>`.appendTo(container);
		const stored = () => (this._state.featChoices || {})[featName] || {};

		const build = () => {
			wrp.innerHTML = "";
			const choiceList = this._getFeatChoices(featName);
			if (!choiceList.length) return;

			for (const choice of choiceList) {
				const choiceRow = ee`<div class="ve-flex-v-center ve-mt-1 ve-pl-3"></div>`.appendTo(wrp);

				const lbl = document.createElement("span");
				lbl.className = "ve-mr-2 ve-muted";
				lbl.style.cssText = "font-size:.85em;white-space:nowrap;min-width:8em";
				lbl.textContent = choice.label + ":";
				choiceRow.appendChild(lbl);

				const onchange = (key, value) => {
					if (!this._state.featChoices) this._state.featChoices = {};
					if (!this._state.featChoices[featName]) this._state.featChoices[featName] = {};
					this._state.featChoices[featName][key] = value;
					this._applyFeatData();
					this._sg_syncAbilityScores();
					if (this._sg_doRebuild) this._sg_doRebuild();
					cb();
					if (key === "spellList") build();
				};

				if (choice.options) {
					const sel = document.createElement("select");
					sel.className = "ve-form-control ve-input-xs form-control--minimal";
					sel.style.flex = "1";
					const blank = document.createElement("option");
					blank.value = ""; blank.textContent = "(choose)";
					sel.appendChild(blank);
					choice.options.forEach(o => {
						const opt = document.createElement("option");
						opt.value = o.value; opt.textContent = o.label;
						sel.appendChild(opt);
					});
					sel.value = stored()[choice.key] || "";
					sel.addEventListener("change", () => onchange(choice.key, sel.value));
					choiceRow.appendChild(sel);
				} else {
					const ipt = document.createElement("input");
					ipt.type = "text";
					ipt.className = "ve-form-control ve-input-xs form-control--minimal";
					ipt.style.flex = "1";
					ipt.placeholder = choice.placeholder || "(type here)";
					ipt.value = stored()[choice.key] || "";
					ipt.addEventListener("change", () => onchange(choice.key, ipt.value));
					choiceRow.appendChild(ipt);
				}
			}
		};

		build();
	}

	_buildFeatsInput (wrp, cb) {
		const featsArr = () => this._state.feats || [];
		const featRows = [];
		const wrpRows = ee`<div class="ve-flex-col ve-mb-2"></div>`.appendTo(wrp);

		// Background-granted feat: card at the top, hidden when no bgFeat
		const bgFeatCard = ee`<div class="ve-mb-2 ve-p-2 ve-hidden" style="border:1px solid var(--col-border-default,#ccc);border-radius:4px"></div>`.appendTo(wrpRows);
		const bgFeatNameRow = ee`<div class="ve-flex-v-center"></div>`.appendTo(bgFeatCard);
		const bgFeatSpan = ee`<span class="ve-mr-2 ve-bold" style="flex:1"></span>`.appendTo(bgFeatNameRow);
		ee`<span class="ve-muted ve-italic" style="font-size:.85em">(from background)</span>`.appendTo(bgFeatNameRow);

		const refreshBgFeatRow = () => {
			const name = this._state.bgFeat || "";
			bgFeatCard.toggleVe(!!name);
			bgFeatSpan.textContent = name;
			// Remove any old choice rows, then add fresh ones
			Array.from(bgFeatCard.querySelectorAll(".cb-feat-choices-wrp")).forEach(n => n.remove());
			if (name) this._buildFeatChoiceInputs(name, bgFeatCard, cb);
		};
		refreshBgFeatRow();

		const doUpdateState = () => {
			this._state.feats = featRows.map(r => r.name).filter(Boolean);
			this._applyFeatData();
			this._sg_syncAbilityScores();
			if (this._sg_doRebuild) this._sg_doRebuild();
			cb();
		};

		const addRow = (name) => {
			const card = ee`<div class="ve-mb-2 ve-p-2" style="border:1px solid var(--col-border-default,#ccc);border-radius:4px"></div>`.appendTo(wrpRows);

			const nameRow = ee`<div class="ve-flex-v-center"></div>`.appendTo(card);
			ee`<span class="ve-bold ve-mr-2" style="flex:1">${name}</span>`.appendTo(nameRow);
			const btnRemove = ee`<button class="ve-btn ve-btn-xs ve-btn-danger" title="Remove Feat"><span class="glyphicon glyphicon-trash"></span></button>`
				.onn("click", () => {
					featRows.splice(featRows.indexOf(rowMeta), 1);
					card.remove();
					doUpdateState();
				})
				.appendTo(nameRow);

			this._buildFeatChoiceInputs(name, card, cb);

			const rowMeta = {name};
			featRows.push(rowMeta);
		};

		featsArr().forEach(f => addRow(f));

		ee`<button class="ve-btn ve-btn-xs ve-btn-default">Add Feat</button>`
			.appendTo(wrp)
			.onn("click", async () => {
				if (!this._modalFilterFeats) {
					this._modalFilterFeats = new ModalFilterFeats({
						namespace: "charBuilder.feats",
						allData: this._allFeats,
					});
				}
				const selected = await this._modalFilterFeats.pGetUserSelection();
				if (!selected?.length) return;
				selected.forEach(item => { if (item.name) addRow(item.name); });
				doUpdateState();
			});
	}

	// -- Abilities tab ---------------------------------------------------------

	_buildAbilitiesTab (wrp, cb) {
		// -- Stat generation (Roll / Std Array / Point Buy / Manual) ----------
		this._buildStatGen(wrp, cb);

		// -- ASI Choices (Background / Race) ----------------------------------
		const choiceWrp = ee`<div class="ve-w-100 stripe-even"></div>`;
		const onChoiceChange = () => {
			choiceWrp.empty();
			this._sg_buildAbilityChoices(choiceWrp, cb, onChoiceChange);
			this._sg_syncAbilityScores();
			if (this._sg_doRebuild) this._sg_doRebuild();
			cb();
		};
		this._sg_buildAbilityChoices(choiceWrp, cb, onChoiceChange);
		wrp.append(choiceWrp);

		// -- Saving Throws ----------------------------------------------------
		this._buildSavingThrowsInput(wrp, cb);

		// -- Skills -----------------------------------------------------------
		this._buildSkillsInput(wrp, cb);

		// -- Other proficiencies ----------------------------------------------
		// Helper: adds a small reactive "From feats: …" label below a row that
		// updates whenever the given feat state key changes.
		const appendFeatGrantedLabel = (parentRow, featKey, prefix = "From feats", onRemove = null) => {
			const lbl = ee`<div class="ve-pl-1 ve-mt-1"></div>`.appendTo(parentRow);
			const refresh = () => {
				lbl.empty();
				const vals = this._state[featKey] || [];
				lbl.toggleVe(vals.length > 0);
				if (!vals.length) return;
				if (onRemove) {
					for (const val of vals) {
						const chip = ee`<span class="ve-flex-v-center ve-gap-1 ve-mr-2" style="font-size:.85em"></span>`.appendTo(lbl);
						chip.txt(val);
						ee`<button class="ve-btn ve-btn-xxs ve-btn-danger" title="Remove"><span class="glyphicon glyphicon-trash"></span></button>`
							.onn("click", () => onRemove(val))
							.appendTo(chip);
					}
				} else {
					lbl.addClass("ve-muted ve-italic").txt(`${prefix}: ${vals.join(", ")}`);
				}
			};
			this._addHook("state", featKey, refresh);
			refresh();
		};

		const langRow = BuilderUi.getStateIptStringArray("Languages", cb, this._state, {shortName: "Language", nullable: true}, "languages").appendTo(wrp);
		appendFeatGrantedLabel(langRow, "featLanguages");

		{
			const [row, rowInner] = BuilderUi.getLabelledRowTuple("Armor Prof.");
			const _ARMOR_CATS = ["Light", "Medium", "Heavy", "Shields"];
			const btnWrp = ee`<div class="ve-flex"></div>`;
			_ARMOR_CATS.forEach(cat => {
				const btn = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-1">${cat}</button>`;
				const hasArmor = () =>
					(this._state.armorProfs     || []).includes(cat) ||
					(this._state.featArmorProfs  || []).includes(cat);
				const refresh = () => btn.toggleClass("ve-active", hasArmor());
				btn.onn("click", () => {
					const cur = this._state.armorProfs || [];
					this._state.armorProfs = cur.includes(cat) ? cur.filter(v => v !== cat) : [...cur, cat];
					cb();
				});
				this._addHook("state", "armorProfs",     refresh);
				this._addHook("state", "featArmorProfs", refresh);
				refresh();
				btnWrp.appends(btn);
			});
			btnWrp.appendTo(rowInner);
			row.appendTo(wrp);
		}

		const weapRow = BuilderUi.getStateIptStringArray("Weapon Prof.", cb, this._state, {shortName: "Weapon Proficiency", nullable: true}, "weaponProfs").appendTo(wrp);
		appendFeatGrantedLabel(weapRow, "featWeaponProfs");

		const toolRow = BuilderUi.getStateIptStringArray("Tool Prof.", cb, this._state, {shortName: "Tool Proficiency", nullable: true}, "toolProfs").appendTo(wrp);
		appendFeatGrantedLabel(toolRow, "featToolProfs");
		// Background-granted tool chips — each has a trash button to exclude it
		const bgToolChipWrp = ee`<div class="ve-flex ve-flex-wrap ve-gap-1 ve-pl-1 ve-mt-1"></div>`.appendTo(toolRow);
		const refreshBgToolChips = () => {
			bgToolChipWrp.empty();
			const tools = this._state.bgToolProfs || [];
			bgToolChipWrp.toggleVe(tools.length > 0);
			tools.forEach(tool => {
				const chip = ee`<span class="ve-flex-v-center ve-gap-1" style="font-size:.85em"></span>`;
				chip.txt(tool);
				ee`<button class="ve-btn ve-btn-xxs ve-btn-danger" title="Remove"><span class="glyphicon glyphicon-trash"></span></button>`
					.onn("click", () => {
						this._state.excludedBgToolProfs = [...(this._state.excludedBgToolProfs || []), tool];
						this._applyBackgroundData();
						cb();
					})
					.appendTo(chip);
				bgToolChipWrp.append(chip);
			});
		};
		this._addHook("state", "bgToolProfs", refreshBgToolChips);
		refreshBgToolChips();

		// Class-granted any-tool choice slots (e.g. Bard's musical instruments, Monk's artisan's tools)
		{
			const [clsToolRow, clsToolRowInner] = BuilderUi.getLabelledRowTuple("Class Tool Choices");
			const wrpClsToolSels = ee`<div class="ve-flex-wrap ve-gap-1"></div>`.appendTo(clsToolRowInner);

			const buildClsToolUI = () => {
				wrpClsToolSels.empty();
				const slots = this._state._classToolSlots || [];
				clsToolRow.toggleVe(slots.length > 0);
				if (!slots.length) return;

				const isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
				const saved = this._state.classToolChoices || [];
				let slotIdx = 0;
				const sels = [];

				slots.forEach(slot => {
					const typeCode = slot.type; // "INS" or "AT"
					const opts = (this._allItems || []).filter(it => {
						const t = it.type || "";
						if (typeCode === "INS") return t === "INS" || t === "INS|XPHB";
						if (typeCode === "AT")  return t === "AT"  || t === "AT|XPHB";
						return false;
					}).filter(it => !it.rarity || it.rarity === "none")
					.filter(it => isNew ? !SourceUtil.isClassicSource(it.source) : SourceUtil.isClassicSource(it.source));
					const label = typeCode === "INS" ? "Musical Instrument" : "Artisan's Tool";

					ee`<span class="ve-muted ve-bold" style="font-size:.8em;margin-right:4px">${label}:</span>`.appendTo(wrpClsToolSels);

					for (let i = 0; i < slot.count; i++) {
						const idx = slotIdx++;
						const savedVal = (saved[idx] && opts.find(it => it.name === saved[idx])) ? saved[idx] : "";
						const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal" style="min-width:160px">
							<option value="">- Choose -</option>
							${opts.map(it => `<option value="${it.name}"${it.name === savedVal ? " selected" : ""}>${it.name}</option>`).join("")}
						</select>`;
						sel.onn("change", () => {
							const cur = [...(this._state.classToolChoices || [])];
							while (cur.length <= idx) cur.push("");
							cur[idx] = sel.val();
							this._state.classToolChoices = cur;
							cb();
						});
						sels.push(sel);
						wrpClsToolSels.append(sel);
					}
				});
			};

			buildClsToolUI();
			this._addHook("state", "_classToolSlots", buildClsToolUI);
			this._addHook("state", "styleHint",       buildClsToolUI);
			clsToolRow.appendTo(wrp);
		}
	}

	// -- Stat generation -------------------------------------------------------

	_buildStatGen (wrp, cb) {
		// -- Mode selector ----------------------------------------------------
		const [modeRow, modeRowInner] = BuilderUi.getLabelledRowTuple("Ability Scores");
		const modeBtns = {};
		const modeList = [
			{key: "manual",   label: "Manual"},
			{key: "roll",     label: "Roll"},
			{key: "array",    label: "Std. Array"},
			{key: "pointbuy", label: "Point Buy"},
		];

		// -- Roll controls (visible only in roll mode) ---------------------
		const rollRow = ee`<div class="ve-flex-col ve-mt-1 ${this._state.sg_mode !== "roll" ? "ve-hidden" : ""}">`;
		const rollsDisp = ee`<span class="ve-muted ve-mt-1" style="font-size:.85em"></span>`;
		rollRow.appends(
			ee`<button class="ve-btn ve-btn-xs ve-btn-success ve-w-100">Roll 4d6×6</button>`
				.onn("click", () => {
					const rolls = Array.from({length: 6}, () => {
						const d = Array.from({length: 4}, () => Math.ceil(Math.random() * 6)).sort((a, b) => b - a);
						return d[0] + d[1] + d[2];
					}).sort((a, b) => b - a);
					this._state.sg_rolls = rolls;
					_ABILITIES.forEach(abl => { this._state[`sg_roll_${abl}`] = null; });
					rollsDisp.txt(`Rolled: ${rolls.join(", ")}`);
					doRebuild();
				}),
			rollsDisp,
		);

		// -- Point buy info (visible only in pointbuy mode) ----------------
		const pbRow = ee`<div class="ve-mt-1 ${this._state.sg_mode !== "pointbuy" ? "ve-hidden" : ""}">`;
		this._sg_pbSpentDisp = ee`<b>0</b>`;
		pbRow.appends(ee`<span class="ve-muted" style="font-size:.85em">Points spent: ${this._sg_pbSpentDisp} / ${_SG_PB_BUDGET}</span>`);

		// -- Layout: [buttons col] | [grid + choices col] ------------------
		this._sg_rollsDisp = rollsDisp;
		const btnCol    = ee`<div class="ve-flex-col ve-no-shrink ve-mr-2" style="width:80px">`;
		const gridWrp   = ee`<div class="ve-mb-2"></div>`;
		// Single rebuild function used by mode buttons and roll
		const doRebuild = () => {
			gridWrp.empty();
			this._sg_buildGrid(gridWrp, cb);
			pbRow.toggleVe(this._state.sg_mode === "pointbuy");
			rollRow.toggleVe(this._state.sg_mode === "roll");
			// Sync state so the PDF / output reflects the new totals immediately
			this._sg_syncAbilityScores();
			cb();
		};
		this._sg_doRebuild = doRebuild;

		modeList.forEach(({key, label}) => {
			const btn = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-w-100 ve-mb-1">${label}</button>`
				.onn("click", () => {
					if (this._state.sg_mode === key) return;
					this._state.sg_mode = key;
					this._sg_updateModeBtns(modeBtns);
					doRebuild();
				});
			modeBtns[key] = btn;
			btnCol.append(btn);
		});
		btnCol.append(rollRow);
		btnCol.append(pbRow);

		modeRowInner.appends(ee`<div class="ve-flex ve-w-100">${btnCol}<div class="ve-flex-col" style="flex:1">${gridWrp}</div></div>`);
		wrp.append(modeRow);

		this._sg_updateModeBtns(modeBtns);

		if (this._state.sg_mode === "roll" && (this._state.sg_rolls || []).length) {
			rollsDisp.txt(`Rolled: ${this._state.sg_rolls.join(", ")}`);
		}

		this._sg_buildGrid(gridWrp, cb);
	}

	_sg_updateModeBtns (btns) {
		const mode = this._state.sg_mode || "manual";
		Object.entries(btns).forEach(([k, btn]) => {
			btn.toggleClass("ve-btn-primary", k === mode).toggleClass("ve-btn-default", k !== mode);
		});
	}

	// Returns the active ability object for an entity, honouring the ixAbilitySet selection.
	_sg_getEntityAbilityObj (entity, ixSetProp) {
		if (!entity?.ability) return null;
		const arr = Array.isArray(entity.ability) ? entity.ability : [entity.ability];
		const ix  = Math.min(this._state[ixSetProp] || 0, arr.length - 1);
		return arr[ix] || null;
	}

	// Sum fixed + chosen bonuses for one entity.
	_sg_calcEntityBonus (abl, abilObj, choiceFromProp, choiceWeightedProp) {
		if (!abilObj) return 0;
		let total = typeof abilObj[abl] === "number" ? abilObj[abl] : 0;
		if (abilObj.choose?.from)
			total += (this._state[choiceFromProp] || []).filter(c => c.ability === abl).reduce((s, c) => s + c.amount, 0);
		if (abilObj.choose?.weighted?.weights)
			total += (this._state[choiceWeightedProp] || []).filter(c => c.ability === abl).reduce((s, c) => s + c.amount, 0);
		return total;
	}

	// Edition-aware species/background lookup - mirrors the selection logic in
	// _applySpeciesData / _applyBackgroundData so bonus calculations use the
	// same entry the rest of the code uses.
	_sg_getSpeciesEntry () {
		const name    = this._state.species || "";
		const isNew   = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
		const matches = (this._allSpecies || []).filter(r => r.name === name);
		if (!matches.length) return null;
		return isNew
			? (matches.find(r => !SourceUtil.isClassicSource(r.source)) || matches[0])
			: (matches.find(r => SourceUtil.isClassicSource(r.source)) || matches[0]);
	}

	_sg_getBgEntry () {
		const name    = this._state.background || "";
		const isNew   = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
		const matches = (this._allBackgrounds || []).filter(b => b.name === name);
		if (!matches.length) return null;
		return isNew
			? (matches.find(b => !SourceUtil.isClassicSource(b.source)) || matches[0])
			: (matches.find(b => SourceUtil.isClassicSource(b.source)) || matches[0]);
	}

	_sg_getAsiBonus (abl) {
		const _isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
		if (_isNew) {
			const obj = this._sg_getEntityAbilityObj(this._sg_getBgEntry(), "bg_ixAbilitySet");
			return this._sg_calcEntityBonus(abl, obj, "bg_choice_from", "bg_choice_weighted");
		} else {
			const obj = this._sg_getEntityAbilityObj(this._sg_getSpeciesEntry(), "race_ixAbilitySet");
			return this._sg_calcEntityBonus(abl, obj, "race_choice_from", "race_choice_weighted");
		}
	}

	// Sum ability score bonuses from class Ability Score Improvement slots (mode === "asi").
	_sg_getClassAsiBonus (abl) {
		return (this._state.asiChoices || [])
			.filter(c => c.mode === "asi")
			.reduce((sum, c) => sum + (c[abl] || 0), 0);
	}

	// Sum ability score bonuses granted by active feats for one ability.
	// Handles both static grants ({str:1}) and choose.from grants (stored in
	// featChoices[featName]["ability"] as the chosen ability abbreviation).
	// Also includes feats chosen via class ASI slots (mode === "feat").
	_sg_getFeatBonus (abl) {
		if (!this._allFeats) return 0;
		const allChoices = this._state.featChoices || {};
		const featNames  = [
			...(this._state.bgFeat ? [this._state.bgFeat] : []),
			...(this._state.feats || []),
			...(this._state.asiChoices || []).filter(c => c.featName).map(c => c.featName),
		].filter(Boolean);
		let total = 0;
		for (const featName of featNames) {
			const feat = this._getFeatEntry(featName);
			if (!feat?.ability) continue;
			const abilArr = Array.isArray(feat.ability) ? feat.ability : [feat.ability];
			const chosenEntry = allChoices[featName] || {};
			// Collect all chosen ability values (single key + indexed keys for multi-slot)
			const chosenAbils = [];
			if (chosenEntry.ability) chosenAbils.push(chosenEntry.ability.trim().toLowerCase());
			for (let i = 0; chosenEntry["ability_" + i] !== undefined; i++) {
				const v = (chosenEntry["ability_" + i] || "").trim().toLowerCase();
				if (v) chosenAbils.push(v);
			}
			const chosenCount = chosenAbils.filter(v => v === abl).length;
			for (const abilObj of abilArr) {
				if (typeof abilObj[abl] === "number") total += abilObj[abl];
				if (abilObj.choose?.from) total += (abilObj.choose.amount ?? 1) * chosenCount;
			}
		}
		return total;
	}

	// For non-manual stat gen modes, write base+race+bg+feat total to this._state[abl].
	// Safe to call at any time; is a no-op in manual mode.
	_sg_syncAbilityScores () {
		if (!this._state) return;
		if ((this._state.sg_mode || "manual") === "manual") return;
		_ABILITIES.forEach(abl => {
			this._state[abl] = Math.min(20, this._sg_getBase(abl)
				+ this._sg_getAsiBonus(abl)
				+ this._sg_getFeatBonus(abl)
				+ this._sg_getClassAsiBonus(abl));
		});
	}

	_sg_getBase (abl) {
		const mode = this._state.sg_mode || "manual";
		if (mode === "manual")   return this._state[abl] ?? 10;
		if (mode === "roll")     { const idx = this._state[`sg_roll_${abl}`]; return idx == null ? 0 : (this._state.sg_rolls || [])[idx] ?? 0; }
		if (mode === "array")    return this._state[`sg_arr_${abl}`] ?? 0;
		if (mode === "pointbuy") return this._state[`sg_pb_${abl}`]  ?? 8;
		return 10;
	}

	_sg_getPbSpent () {
		return _ABILITIES.reduce((sum, abl) => sum + (_SG_PB_COSTS[this._state[`sg_pb_${abl}`] ?? 8] ?? 0), 0);
	}

	_sg_buildGrid (container, cb) {
		const mode     = this._state.sg_mode || "manual";
		const isManual = mode === "manual";

		const _isNew    = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
		const asiBonus  = _ABILITIES.map(a => this._sg_getAsiBonus(a));
		const featBonus     = _ABILITIES.map(a => this._sg_getFeatBonus(a));
		const classAsiBonus = _ABILITIES.map(a => this._sg_getClassAsiBonus(a));
		const hasAsi        = asiBonus.some(b => b !== 0);
		const hasFeat       = featBonus.some(b => b !== 0);
		const hasClassAsi   = classAsiBonus.some(b => b !== 0);
		const showExtra     = !isManual || hasAsi || hasFeat || hasClassAsi;

		// -- Header row ---------------------------------------------------
		const hdr = ee`<div class="ve-flex-v-center ve-mb-1" style="font-size:.78em;font-weight:bold;color:var(--col-heading-grey,#888)">`;
		hdr.appends(ee`<span style="width:46px"> </span>`);
		const baseLabel = {manual: "Score", roll: "Assign", array: "Array", pointbuy: "Score"}[mode];
		hdr.appends(ee`<span class="ve-text-center" style="width:80px">${baseLabel}</span>`);
		if (showExtra) {
			hdr.appends(ee`<span class="ve-text-center" style="width:46px">${_isNew ? "+BG" : "+Race"}</span>`);
			if (hasFeat)     hdr.appends(ee`<span class="ve-text-center" style="width:42px">+Feat</span>`);
			if (hasClassAsi) hdr.appends(ee`<span class="ve-text-center" style="width:42px">+ASI</span>`);
			hdr.appends(ee`<span class="ve-text-center" style="width:46px">Total</span>`);
		}
		hdr.appends(ee`<span class="ve-text-center" style="width:36px">Mod</span>`);
		container.appends(hdr);

		// -- One row per ability ------------------------------------------
		_ABILITIES.forEach((abl, ablIdx) => {
			const row = ee`<div class="ve-flex-v-center ve-mb-1">`;
			row.appends(ee`<span class="bold" style="width:46px">${abl.toUpperCase()}</span>`);

			const getScore = () => {
				const base = isManual ? (this._state[abl] ?? 10) : this._sg_getBase(abl);
				return base + this._sg_getAsiBonus(abl) + this._sg_getFeatBonus(abl) + this._sg_getClassAsiBonus(abl);
			};

			let dispTotal = null;
			const dispMod = ee`<span class="ve-text-center ve-muted" style="width:36px">${_fmtMod(_abilMod(getScore()))}</span>`;
			if (showExtra) {
				dispTotal = ee`<span class="ve-text-center ve-bold" style="width:46px">${getScore()}</span>`;
			}

			const doUpdate = () => {
				const score = getScore();
				if (!isManual) this._state[abl] = score;
				if (dispTotal) dispTotal.txt(String(score));
				dispMod.txt(_fmtMod(_abilMod(score)));
				if (mode === "pointbuy" && this._sg_pbSpentDisp) {
					this._sg_pbSpentDisp.txt(String(this._sg_getPbSpent()));
				}
				cb();
			};

			// -- Base cell ------------------------------------------------
			let baseCell;
			switch (mode) {
				case "manual": {
					const ipt = ee`<input class="ve-form-control form-control--minimal ve-input-xs ve-text-center" style="width:80px">`
						.val(this._state[abl] ?? 10)
						.onn("change", () => {
							const v = Math.min(30, Math.max(1, UiUtil.strToInt(ipt.val(), 10, {fallbackOnNaN: 10})));
							this._state[abl] = v;
							ipt.val(v);
							doUpdate();
						});
					baseCell = ee`<span style="width:80px">${ipt}</span>`;
					break;
				}
				case "roll": {
					const rolls = this._state.sg_rolls || [];
					const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal" style="width:80px">
						<option value="">- assign -</option>
						${rolls.map((v, i) => `<option value="${i}">${v}</option>`).join("")}
					</select>`;
					const cur = this._state[`sg_roll_${abl}`];
					if (cur != null) sel.val(String(cur));
					sel.onn("change", () => {
						const v = sel.val();
						this._state[`sg_roll_${abl}`] = v === "" ? null : Number(v);
						doUpdate();
					});
					baseCell = ee`<span style="width:80px">${sel}</span>`;
					break;
				}
				case "array": {
					const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal" style="width:80px">
						<option value="">- assign -</option>
						${_STANDARD_ARRAY.map(v => `<option value="${v}">${v}</option>`).join("")}
					</select>`;
					const cur = this._state[`sg_arr_${abl}`];
					if (cur != null) sel.val(String(cur));
					sel.onn("change", () => {
						const v = sel.val();
						this._state[`sg_arr_${abl}`] = v === "" ? null : Number(v);
						doUpdate();
					});
					baseCell = ee`<span style="width:80px">${sel}</span>`;
					break;
				}
				case "pointbuy": {
					const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal" style="width:80px">
						${_SG_PB_SCORES.map(v => `<option value="${v}">${v} (${_SG_PB_COSTS[v]}pts)</option>`).join("")}
					</select>`;
					sel.val(String(this._state[`sg_pb_${abl}`] ?? 8));
					sel.onn("change", () => {
						this._state[`sg_pb_${abl}`] = Number(sel.val());
						doUpdate();
					});
					baseCell = ee`<span style="width:80px">${sel}</span>`;
					break;
				}
			}

			row.appends(baseCell);

			if (showExtra) {
				const aB  = asiBonus[ablIdx];
				const fB  = featBonus[ablIdx];
				const cAB = classAsiBonus[ablIdx];
				row.appends(ee`<span class="ve-text-center ve-muted" style="width:46px">${aB >= 0 ? "+" : ""}${aB}</span>`);
				if (hasFeat)     row.appends(ee`<span class="ve-text-center ve-muted" style="width:42px">${fB >= 0 ? "+" : ""}${fB}</span>`);
				if (hasClassAsi) row.appends(ee`<span class="ve-text-center ve-muted" style="width:42px">${cAB >= 0 ? "+" : ""}${cAB}</span>`);
				row.appends(dispTotal);
			}
			row.appends(dispMod);
			container.appends(row);
		});

		// Initial PB point display
		if (mode === "pointbuy" && this._sg_pbSpentDisp) {
			this._sg_pbSpentDisp.txt(String(this._sg_getPbSpent()));
		}

		// Cross-validate: prevent duplicate picks and enforce PB budget
		if (mode === "roll" || mode === "array") {
			const containerEl = container[0] || container;
			const selEls = Array.from(containerEl.querySelectorAll("select"));
			const getVal = (a) => mode === "roll" ? this._state[`sg_roll_${a}`] : this._state[`sg_arr_${a}`];
			const refresh = () => {
				const used = new Set(_ABILITIES.map(a => getVal(a)).filter(v => v != null));
				selEls.forEach((el, idx) => {
					const a = _ABILITIES[idx];
					const cur = getVal(a);
					for (const opt of el.options) {
						if (!opt.value) continue;
						const val = Number(opt.value);
						opt.disabled = used.has(val) && val !== cur;
					}
				});
			};
			selEls.forEach(el => el.addEventListener("change", refresh));
			refresh();
		} else if (mode === "pointbuy") {
			const containerEl = container[0] || container;
			const selEls = Array.from(containerEl.querySelectorAll("select"));
			const refresh = () => {
				const totalSpent = this._sg_getPbSpent();
				selEls.forEach((el, idx) => {
					const a = _ABILITIES[idx];
					const curScore = this._state[`sg_pb_${a}`] ?? 8;
					const curCost = _SG_PB_COSTS[curScore] ?? 0;
					const remaining = _SG_PB_BUDGET - (totalSpent - curCost);
					for (const opt of el.options) {
						const cost = _SG_PB_COSTS[Number(opt.value)] ?? 0;
						opt.disabled = cost > remaining && Number(opt.value) !== curScore;
					}
				});
			};
			selEls.forEach(el => el.addEventListener("change", refresh));
			refresh();
		}
	}

	// -- Ability choice UI (choose.from / choose.weighted / multiple sets) -----

	_sg_buildAbilityChoices (wrp, cb, onChoiceChange) {
		const _isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
		const entities = [
			{
				label:        _isNew ? "Background" : "Race",
				data:         _isNew ? this._sg_getBgEntry() : this._sg_getSpeciesEntry(),
				ixSetProp:    _isNew ? "bg_ixAbilitySet" : "race_ixAbilitySet",
				choiceFrom:   _isNew ? "bg_choice_from" : "race_choice_from",
				choiceWeight: _isNew ? "bg_choice_weighted" : "race_choice_weighted",
			},
		];

		entities.forEach(({label, data, ixSetProp, choiceFrom, choiceWeight}) => {
			if (!data?.ability) return;
			const abilArr = Array.isArray(data.ability) ? data.ability : [data.ability];

			const [secRow, secRowInner] = BuilderUi.getLabelledRowTuple(`${label} Ability Increase`, {isMarked: true});

			// -- Multiple ability-set selector (e.g. Human: (a) or (b)) ----
			if (abilArr.length > 1) {
				const optLabels = abilArr.map((obj, i) => {
					const parts = [];
					_ABILITIES.forEach(a => { if (typeof obj[a] === "number" && obj[a]) parts.push(`${a.toUpperCase()} +${obj[a]}`); });
					if (obj.choose?.from)     parts.push(`choose +${obj.choose.amount||1} from ${(obj.choose.from).map(a=>a.toUpperCase()).join("/")}`);
					if (obj.choose?.weighted) parts.push(`choose ${obj.choose.weighted.weights.map(w=>`+${w}`).join("/")} from ${obj.choose.weighted.from.map(a=>a.toUpperCase()).join("/")}`);
					return `(${String.fromCharCode(97 + i)}) ${parts.join(", ") || "(none)"}`;
				});
				const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal ve-mb-1">
					${optLabels.map((l, i) => `<option value="${i}">${l.qq()}</option>`).join("")}
				</select>`;
				sel.val(String(this._state[ixSetProp] || 0));
				sel.onn("change", () => {
					this._state[ixSetProp]    = Number(sel.val());
					this._state[choiceFrom]   = [];
					this._state[choiceWeight] = [];
					onChoiceChange();
				});
				secRowInner.appends(sel);
			}

			const ixSet = Math.min(this._state[ixSetProp] || 0, abilArr.length - 1);
			const abilObj = abilArr[ixSet];
			if (!abilObj) { wrp.append(secRow); return; }

			// Static bonuses summary (read-only info line)
			const staticParts = _ABILITIES.filter(a => typeof abilObj[a] === "number" && abilObj[a]).map(a => `${a.toUpperCase()} +${abilObj[a]}`);
			if (staticParts.length) {
				secRowInner.appends(ee`<div class="ve-muted ve-mb-1" style="font-size:.85em">${staticParts.join(", ")}</div>`);
			}

			// -- choose.from (pick N abilities each getting +amount) -------
			if (abilObj.choose?.from) {
				const from   = abilObj.choose.from;
				const amount = abilObj.choose.amount ?? 1;
				const count  = abilObj.choose.count  ?? 1;
				const stored = () => this._state[choiceFrom] || [];

				secRowInner.appends(ee`<div class="ve-muted ve-mb-1" style="font-size:.85em">Choose ${count} ×+${amount} from: ${from.map(a=>a.toUpperCase()).join(", ")}</div>`);

				const sels = Array.from({length: count}, (_, slotIx) => {
					const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal ve-mr-1 ve-mb-1" style="width:90px">
						<option value="">-</option>
						${from.map(a => `<option value="${a}">${a.toUpperCase()}</option>`).join("")}
					</select>`;
					// Restore saved choice for this slot
					const saved = stored().filter(c => c._slot === slotIx)[0];
					if (saved) sel.val(saved.ability);
					sel.onn("change", () => {
						// Replace this slot's entry
						const next = stored().filter(c => c._slot !== slotIx);
						if (sel.val()) next.push({ability: sel.val(), amount, _slot: slotIx});
						this._state[choiceFrom] = next;
						onChoiceChange();
					});
					return sel;
				});
				const slotWrp = ee`<div class="ve-flex ve-flex-wrap ve-mb-1">`;
				sels.forEach(s => slotWrp.appends(s));
				secRowInner.appends(slotWrp);
			}

			// -- choose.weighted (one ability per weight column) -----------
			if (abilObj.choose?.weighted?.weights) {
				const {from, weights} = abilObj.choose.weighted;
				const stored = () => this._state[choiceWeight] || [];

				secRowInner.appends(ee`<div class="ve-muted ve-mb-1" style="font-size:.85em">Assign each bonus to a different ability (${from.map(a=>a.toUpperCase()).join(", ")})</div>`);

				const slotWrp = ee`<div class="ve-flex ve-flex-wrap ve-mb-1">`;
				weights.forEach((weight, slotIx) => {
					const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal ve-mr-1 ve-mb-1" style="width:110px">
						<option value="">+${weight}: -</option>
						${from.map(a => `<option value="${a}">+${weight}: ${a.toUpperCase()}</option>`).join("")}
					</select>`;
					const saved = stored().filter(c => c.ix === slotIx)[0];
					if (saved) sel.val(saved.ability);
					sel.onn("change", () => {
						// Clear same ability chosen in other slots + this slot
						const next = stored().filter(c => c.ix !== slotIx && (sel.val() ? c.ability !== sel.val() : true));
						if (sel.val()) next.push({ability: sel.val(), amount: weight, ix: slotIx});
						this._state[choiceWeight] = next;
						// Deselect any sibling that had the same ability
						slotWrp.findAll("select").forEach(other => {
							if (other !== sel && other.value === sel.val() && sel.val()) other.value = "";
						});
						onChoiceChange();
					});
					slotWrp.appends(sel);
				});
				secRowInner.appends(slotWrp);
			}

			wrp.append(secRow);
		});
	}

	_buildSavingThrowsInput (wrp, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Saving Throws", {isMarked: true, isRow: true});

		_ABILITIES.forEach(abl => {
			const hasFeatSave      = () => (this._state.featSavingThrowProfs || []).some(p => p.toLowerCase() === (_ABILITY_FULL[abl] || abl).toLowerCase());
			const isSaveProficient = () => (this._state.savingThrowProfs || []).includes(abl) || hasFeatSave();
			const getBonus = () => {
				const pb  = this._state.profBonusOverride ?? _profBonus(this._getTotalLevel());
				const mod = _abilMod(this._state[abl] || 10);
				return mod + (isSaveProficient() ? pb : 0);
			};

			const dispBonus = ee`<div class="ve-text-center ve-muted" style="font-size:.85em;min-width:28px">${_fmtMod(getBonus())}</div>`;

			const btnProf = ee`<button class="ve-btn ve-btn-xs ve-btn-default" title="Saving Throw Proficiency">Prof.</button>`
				.onn("click", () => {
					const profs = [...(this._state.savingThrowProfs || [])];
					const idx   = profs.indexOf(abl);
					if (idx >= 0) profs.splice(idx, 1); else profs.push(abl);
					this._state.savingThrowProfs = profs;
					btnProf.toggleClass("ve-active", isSaveProficient());
					dispBonus.txt(_fmtMod(getBonus()));
					cb();
				});
			if (isSaveProficient()) btnProf.addClass("ve-active");

			this._addHook("state", abl,                    () => dispBonus.txt(_fmtMod(getBonus())));
			this._addHook("state", "classes",              () => dispBonus.txt(_fmtMod(getBonus())));
			this._addHook("state", "profBonusOverride",    () => dispBonus.txt(_fmtMod(getBonus())));
			this._addHook("state", "featSavingThrowProfs", () => { btnProf.toggleClass("ve-active", isSaveProficient()); dispBonus.txt(_fmtMod(getBonus())); });

			ee`<div class="ve-flex-col ve-flex-vh-center ve-mb-2 ve-mr-2">
				<span class="ve-mb-1 ve-bold ve-text-center">${abl.toUpperCase()}</span>
				${dispBonus}
				${btnProf}
			</div>`.appendTo(rowInner);
		});

		wrp.append(row);
	}

	_buildSkillsInput (wrp, cb) {
		// -- Class Skill Choices ------------------------------------------------
		{
			const [choiceRow, choiceRowInner] = BuilderUi.getLabelledRowTuple("Class Skills");
			choiceRowInner.css("flex-direction", "column");

			// -- Skills sub-section ------------------------------------------
			ee`<span class="ve-muted ve-bold" style="font-size:.8em">Skills</span>`.appendTo(choiceRowInner);
			const wrpSkillSels = ee`<div class="ve-flex-wrap ve-gap-1 ve-mb-1"></div>`.appendTo(choiceRowInner);

			const count = this._state._skillChoiceCount || 0;
			const allowedFrom = this._state._skillChoiceFrom;
			const skillOptions = allowedFrom
				? _SKILLS.filter(s => allowedFrom.some(f => f.toLowerCase() === s.name.toLowerCase()))
				: [..._SKILLS];

			if (!count) {
				wrpSkillSels.appends(ee`<span class="ve-muted ve-italic" style="font-size:.85em">No class skill choices available.</span>`);
			} else {
				const sels = [];
				const savedChoices = this._state.classSkillChoices || [];

				const refreshDisabled = () => {
					const taken = new Set(sels.map(s => s.val()).filter(Boolean));
					sels.forEach(sel => {
						const myVal = sel.val();
						Array.from(sel.options).forEach(opt => {
							if (!opt.value) return;
							opt.disabled = taken.has(opt.value) && opt.value !== myVal;
						});
					});
				};

				for (let i = 0; i < count; i++) {
					const saved = skillOptions.find(s => s.name === savedChoices[i]) ? savedChoices[i] : "";
					const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" style="min-width:130px">
						<option value="">- None -</option>
						${skillOptions.map(({name}) => `<option value="${name}"${name === saved ? " selected" : ""}>${name}</option>`).join("")}
					</select>`;
					sel.onn("change", () => {
						this._state.classSkillChoices = sels.map(s => s.val());
						refreshDisabled();
						cb();
					});
					sels.push(sel);
					wrpSkillSels.appends(sel);
				}

				refreshDisabled();
			}

			// -- Expertise sub-section (TODO [TEMPORARY - HARDCODED]: Replace with general class feature parser) --
			const expertHeading  = ee`<span class="ve-muted ve-bold" style="font-size:.8em">Expertise</span>`.appendTo(choiceRowInner);
			const wrpExpertSels  = ee`<div class="ve-flex-wrap ve-gap-1"></div>`.appendTo(choiceRowInner);

			const buildExpertiseDropdowns = () => {
				wrpExpertSels.empty();
				const expertCount = this._state._classExpertiseCount || 0;
				expertHeading.toggleVe(expertCount > 0);
				wrpExpertSels.toggleVe(expertCount > 0);
				if (!expertCount) return;

				const allProfSkills = _SKILLS.filter(s =>
					(this._state.skillProfs        || []).includes(s.name) ||
					(this._state.featSkillProfs    || []).includes(s.name) ||
					(this._state.classSkillChoices || []).includes(s.name),
				);
				const saved = this._state.classExpertise || [];
				const sels  = [];

				const refreshDisabled = () => {
					const taken = new Set([...sels.map(s => s.val()).filter(Boolean), ...(this._state.featExpertise || [])]);
					sels.forEach(sel => {
						const myVal = sel.val();
						Array.from(sel.options).forEach(opt => {
							if (!opt.value) return;
							opt.disabled = taken.has(opt.value) && opt.value !== myVal;
						});
					});
				};

				for (let i = 0; i < expertCount; i++) {
					const savedVal = allProfSkills.find(s => s.name === saved[i]) ? saved[i] : "";
					const sel = ee`<select class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" style="min-width:130px">
						<option value="">- None -</option>
						${allProfSkills.map(({name}) => `<option value="${name}"${name === savedVal ? " selected" : ""}>${name}</option>`).join("")}
					</select>`;
					sel.onn("change", () => {
						this._state.classExpertise = sels.map(s => s.val()).filter(Boolean);
						refreshDisabled();
						cb();
					});
					sels.push(sel);
					wrpExpertSels.append(sel);
				}
				refreshDisabled();
			};

			buildExpertiseDropdowns();
			this._addHook("state", "_classExpertiseCount", buildExpertiseDropdowns);
			this._addHook("state", "classSkillChoices",    buildExpertiseDropdowns);
			this._addHook("state", "skillProfs",           buildExpertiseDropdowns);
			this._addHook("state", "featSkillProfs",       buildExpertiseDropdowns);

			wrp.append(choiceRow);
		}

		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Skills", {isMarked: true});
		const halfProfBtns = [];

		_SKILLS.forEach(({name, ability}) => {
			const isProficient = () =>
				(this._state.skillProfs         || []).includes(name) ||
				(this._state.featSkillProfs      || []).includes(name) ||
				(this._state.classSkillChoices   || []).includes(name);
			const isExpert     = () => (this._state.skillExpertise || []).includes(name) || (this._state.featExpertise || []).includes(name) || (this._state.classExpertise || []).includes(name);
			const isHalfProf   = () => (this._state.skillHalfProfs || []).includes(name);

			const getBonus = () => {
				const pb  = this._state.profBonusOverride ?? _profBonus(this._getTotalLevel());
				const mod = _abilMod(this._state[ability] || 10);
				if (isExpert())     return mod + pb * 2;
				if (isProficient()) return mod + pb;
				if (isHalfProf())   return mod + Math.floor(pb / 2);
				return mod;
			};

			const dispBonus = ee`<span class="ve-muted ve-mr-2" style="min-width:30px;font-size:.9em">${_fmtMod(getBonus())}</span>`;
			const updateBonus = () => dispBonus.txt(_fmtMod(getBonus()));
			this._addHook("state", ability,            updateBonus);
			this._addHook("state", "classes",          updateBonus);
			this._addHook("state", "skillHalfProfs",   updateBonus);
			this._addHook("state", "profBonusOverride", updateBonus);

			const btnProf = ee`<button class="ve-btn ve-btn-xs ve-btn-default" title="Proficient">Prof.</button>`
				.onn("click", () => {
					if (isProficient()) {
						this._state.skillProfs     = (this._state.skillProfs     || []).filter(s => s !== name);
					} else {
						this._state.skillProfs     = [...new Set([...(this._state.skillProfs || []), name])];
						this._state.skillExpertise = (this._state.skillExpertise || []).filter(s => s !== name);
						this._state.skillHalfProfs = (this._state.skillHalfProfs || []).filter(s => s !== name);
					}
					btnProf.toggleClass("ve-active",   isProficient());
					btnExpert.toggleClass("ve-active", isExpert());
					updateBonus();
					cb();
				});
			if (isProficient()) btnProf.addClass("ve-active");

			const btnExpert = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-ml-1" title="Expertise">Expert.</button>`
				.onn("click", () => {
					if (isExpert()) {
						this._state.skillExpertise = (this._state.skillExpertise || []).filter(s => s !== name);
					} else {
						this._state.skillExpertise = [...new Set([...(this._state.skillExpertise || []), name])];
						this._state.skillProfs     = (this._state.skillProfs     || []).filter(s => s !== name);
						this._state.skillHalfProfs = (this._state.skillHalfProfs || []).filter(s => s !== name);
					}
					btnProf.toggleClass("ve-active",   isProficient());
					btnExpert.toggleClass("ve-active", isExpert());
					updateBonus();
					cb();
				});
			if (isExpert()) btnExpert.addClass("ve-active");
			this._addHook("state", "featSkillProfs",    () => { btnProf.toggleClass("ve-active",   isProficient()); updateBonus(); });
			this._addHook("state", "featExpertise",     () => { btnExpert.toggleClass("ve-active", isExpert());     updateBonus(); });
			this._addHook("state", "classSkillChoices", () => { btnProf.toggleClass("ve-active",   isProficient()); updateBonus(); });
			this._addHook("state", "classExpertise",    () => { btnExpert.toggleClass("ve-active", isExpert());     updateBonus(); });
			const btnHalfProf = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-ml-1" title="Half Proficiency">Half.</button>`;
			if (isHalfProf()) btnHalfProf.addClass("ve-active");
			halfProfBtns.push({btnHalfProf, btnProf, btnExpert, name, isHalfProf, isProficient, isExpert, updateBonus});

			ee`<div class="ve-flex-v-center ve-mb-1">
				<span class="ve-mr-2 mkbru__sub-name--33">${name}</span>
				<span class="ve-muted ve-mr-2" style="font-size:.8em;width:28px">(${ability.toUpperCase()})</span>
				${dispBonus}${btnProf}${btnExpert}
			</div>`.appendTo(rowInner);
		});

		// Insert half-prof buttons into DOM and wire up click handlers
		halfProfBtns.forEach(({btnHalfProf, btnProf, btnExpert, name, isHalfProf, isProficient, isExpert, updateBonus}) => {
			btnHalfProf.insertAfter(btnProf);
			btnHalfProf.onn("click", () => {
				if (isHalfProf()) {
					this._state.skillHalfProfs = (this._state.skillHalfProfs || []).filter(s => s !== name);
				} else {
					this._state.skillHalfProfs = [...new Set([...(this._state.skillHalfProfs || []), name])];
					this._state.skillProfs     = (this._state.skillProfs || []).filter(s => s !== name);
					this._state.skillExpertise = (this._state.skillExpertise || []).filter(s => s !== name);
				}
				btnHalfProf.toggleClass("ve-active", isHalfProf());
				btnProf.toggleClass("ve-active",     isProficient());
				btnExpert.toggleClass("ve-active",   isExpert());
				updateBonus();
				cb();
			});
			this._addHook("state", "skillHalfProfs", () => btnHalfProf.toggleClass("ve-active", isHalfProf()));
		});

		wrp.append(row);
	}

	_buildPointBuyHelper (wrp, scoreDisplays, cb) {
		const [row, rowInner] = BuilderUi.getLabelledRowTuple("Point Buy Helper");

		const PB_COSTS = {8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9};
		const MAX_POINTS = 27;

		const dispPoints = ee`<span class="ve-mr-2 ve-muted">Points remaining: <b>--</b></span>`;
		const btnApply = ee`<button class="ve-btn ve-btn-xs ve-btn-default">Apply Standard Array</button>`;

		const updatePointDisplay = () => {
			const used = _ABILITIES.reduce((acc, abl) => {
				const score = Math.min(15, Math.max(8, this._state[abl] || 10));
				return acc + (PB_COSTS[score] ?? 0);
			}, 0);
			const rem = MAX_POINTS - used;
			dispPoints.find("b").txt(`${rem}`);
			dispPoints.toggleClass("ve-error", rem < 0);
		};
		updatePointDisplay();

		btnApply.onn("click", () => {
			const arr = [15, 14, 13, 12, 10, 8];
			_ABILITIES.forEach((abl, i) => {
				this._state[abl] = arr[i];
				scoreDisplays[abl].iptScore.val(arr[i]);
				scoreDisplays[abl].modDisp.txt(_fmtMod(_abilMod(arr[i])));
			});
			updatePointDisplay();
			cb();
		});

		// Re-calc when abilities change
		this._addHook("state", "str", updatePointDisplay);
		this._addHook("state", "dex", updatePointDisplay);
		this._addHook("state", "con", updatePointDisplay);
		this._addHook("state", "int", updatePointDisplay);
		this._addHook("state", "wis", updatePointDisplay);
		this._addHook("state", "cha", updatePointDisplay);

		ee`<div class="ve-flex-v-center">${dispPoints}${btnApply}</div>`.appendTo(rowInner);
		wrp.append(row);
	}

	// -- Combat tab ------------------------------------------------------------

	_buildCombatTab (wrp, cb) {
		// HP - dynamic section that rebuilds when class/level changes
		const [hpRow, hpRowInner] = BuilderUi.getLabelledRowTuple("Hit Points");
		const wrpHpContent = ee`<div class="ve-flex-col ve-w-100"></div>`.appendTo(hpRowInner);

		const buildHpSection = () => {
			wrpHpContent.empty();
			const classEntries = this._getClassEntries();
			const totalLevel  = this._getTotalLevel();
			const conMod      = _abilMod(this._state.con || 10);
			const isAuto      = (this._state.hpMode || "auto") === "auto";
			const conStr      = conMod >= 0 ? `+${conMod}` : `${conMod}`;

			// Build ordered list of {faces} for each character level:
			// primary class L1, L2..N, secondary L1..M, ...
			const _levelDice = [];
			(this._state.classes || [{cls: "", sub: "", level: 1}]).forEach((c, ci) => {
				const entry = classEntries[ci];
				const faces = entry?.hd?.faces || null;
				const clsLvl = Math.max(1, Math.min(20, parseInt(c.level) || 1));
				for (let i = 0; i < clsLvl; i++) _levelDice.push(faces);
			});

			const btnAuto   = ee`<button class="ve-btn ve-btn-xs ${isAuto  ? "ve-btn-primary" : "ve-btn-default"} ve-mr-1">Auto</button>`;
			const btnRolled = ee`<button class="ve-btn ve-btn-xs ${!isAuto ? "ve-btn-primary" : "ve-btn-default"}">Rolled</button>`;
			btnAuto  .onn("click", () => { this._state.hpMode = "auto";   buildHpSection(); cb(); });
			btnRolled.onn("click", () => { this._state.hpMode = "rolled"; buildHpSection(); cb(); });
			ee`<div class="ve-btn-group ve-mb-1">${btnAuto}${btnRolled}</div>`.appendTo(wrpHpContent);

			let calcMax = 0;
			let iptHp = null;

			if (isAuto) {
				if (_levelDice.length && _levelDice[0] != null) {
					calcMax = _levelDice[0]; // L1 = max die
					for (let i = 1; i < _levelDice.length; i++) {
						const f = _levelDice[i];
						calcMax += f != null ? Math.floor(f / 2) + 1 : 0;
					}
					calcMax += conMod * totalLevel;
					calcMax += this._state.featHpBonus || 0;
					const parts = [`(${_levelDice[0]}${conStr})`];
					for (let i = 1; i < _levelDice.length; i++) {
						const f = _levelDice[i];
						parts.push(`(${f != null ? Math.floor(f / 2) + 1 : "?"}${conStr})`);
					}
					if (this._state.featHpBonus) parts.push(`${this._state.featHpBonus} (feats)`);
					ee`<div class="ve-muted ve-mb-1" style="font-size:.8em">${parts.join("+")}</div>`.appendTo(wrpHpContent);
				} else {
					ee`<div class="ve-muted ve-mb-1" style="font-size:.8em">Select a class first</div>`.appendTo(wrpHpContent);
				}
			} else {
				if (!Array.isArray(this._state.hpRolls)) this._state.hpRolls = [];
				const hpRolls = this._state.hpRolls;
				const lvl1Max = _levelDice[0] ?? 0;

				const wrpRolls    = ee`<div class="ve-flex ve-flex-wrap ve-flex-v-center ve-mb-1"></div>`.appendTo(wrpHpContent);
				const dispBreakdown = ee`<div class="ve-muted ve-mb-1" style="font-size:.8em"></div>`.appendTo(wrpHpContent);

				ee`<span class="ve-muted ve-mr-2" style="font-size:.8em">L1:<b>${lvl1Max}</b></span>`.appendTo(wrpRolls);

				const recalc = () => {
					calcMax = lvl1Max + hpRolls.slice(0, totalLevel - 1).reduce((s, v) => s + (v || 0), 0) + conMod * totalLevel + (this._state.featHpBonus || 0);
					const parts = [`(${lvl1Max}${conStr})`];
					for (let i = 0; i < totalLevel - 1; i++) parts.push(`(${hpRolls[i] ?? "?"}${conStr})`);
					dispBreakdown.txt(parts.join("+"));
					this._state.hpMax = calcMax;
					if (iptHp) iptHp.val(calcMax);
				};

				for (let i = 0; i < totalLevel - 1; i++) {
					const rollDie = _levelDice[i + 1];
					const ipt = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" type="number" min="1" max="${rollDie || 20}" style="width:42px" placeholder="${rollDie != null ? Math.floor(rollDie / 2) + 1 : "?"}">`;
					if (hpRolls[i] != null) ipt.val(hpRolls[i]);
					ipt.onn("change", () => { hpRolls[i] = UiUtil.strToInt(ipt.val(), 0, {fallbackOnNaN: 0}) || null; recalc(); cb(); });
					ee`<span class="ve-muted" style="font-size:.75em;margin-right:1px">L${i + 2}</span>`.appendTo(wrpRolls);
					ipt.appendTo(wrpRolls);
				}
				recalc();
			}

			iptHp = ee`<input class="ve-form-control ve-input-xs form-control--minimal" type="number" min="0" style="width:60px" title="Max HP">`.val(calcMax);
			iptHp.onn("change", () => {
				const raw = iptHp.val().trim();
				this._state.hpMax = raw === "" ? calcMax : UiUtil.strToInt(raw, calcMax, {fallbackOnNaN: calcMax});
				cb();
			});
			this._state.hpMax = calcMax;
			ee`<div class="ve-flex-v-center ve-mt-1">
				<span class="ve-muted ve-mr-1" style="font-size:.8em">Max HP</span>
				${iptHp}
			</div>`.appendTo(wrpHpContent);
		};

		this._rebuildHpSection = buildHpSection;
		buildHpSection();
		this._addHook("state", "con", () => { buildHpSection(); cb(); });
		wrp.append(hpRow);

		{
			const acRow = BuilderUi.getStateIptNumber("Armor Class", cb, this._state, {nullable: true, placeholder: "Auto"}, "ac").appendTo(wrp);
			const btnReset = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-ml-1" title="Reset to automatic calculation">Auto</button>`
				.onn("click", () => { this._state.ac = null; cb(); });
			acRow.querySelector(".mkbru__wrp-row").append(btnReset);
		}

		{
			const speedRow = BuilderUi.getStateIptNumber("Speed (ft.)", cb, this._state, {nullable: false, placeholder: "30"}, "speed").appendTo(wrp);
			const speedLbl = ee`<div class="ve-muted ve-italic ve-pl-1" style="font-size:.8em"></div>`.appendTo(speedRow);
			const refreshSpeed = () => {
				const bonus = this._state.featSpeedBonus || 0;
				speedLbl.toggleVe(bonus !== 0);
				speedLbl.txt(bonus ? `From feats: +${bonus} ft. (total ${(this._state.speed || 30) + bonus} ft.)` : "");
			};
			this._addHook("state", "featSpeedBonus", refreshSpeed);
			this._addHook("state", "speed",          refreshSpeed);
			refreshSpeed();
		}

		{
			const initRow = BuilderUi.getStateIptNumber("Initiative Override", cb, this._state, {nullable: true, placeholder: "Auto (Dex mod)"}, "initiative").appendTo(wrp);
			const initLbl = ee`<div class="ve-muted ve-italic ve-pl-1" style="font-size:.8em"></div>`.appendTo(initRow);
			const refreshInit = () => {
				const bonus = this._state.featInitiativeBonus || 0;
				initLbl.toggleVe(bonus !== 0);
				initLbl.txt(bonus ? `From feats: +${bonus} to initiative` : "");
			};
			this._addHook("state", "featInitiativeBonus", refreshInit);
			refreshInit();
		}

		// Prof bonus
		BuilderUi.getStateIptNumber("Proficiency Bonus Override", cb, this._state, {nullable: true, placeholder: `Auto (+${_profBonus(this._getTotalLevel())})`}, "profBonusOverride").appendTo(wrp);

		// Weapons table
		const [wpnRow, wpnRowInner] = BuilderUi.getLabelledRowTuple("Weapons & Cantrips", {isMarked: true});

		// -- Auto entries (equipped weapons + damage cantrips) ------------------
		const wrpAutoWpn = ee`<div class="ve-flex-col ve-mb-1"></div>`.appendTo(wpnRowInner);

		const buildAutoWpnSection = () => {
			wrpAutoWpn.empty();
			const hidden = new Set(this._state.weaponHidden || []);

			const autoEntries = [];

			// Equipped weapons from equipment / magic equipment
			for (const it of [...(this._state.equipment || []), ...(this._state.magicEquipment || [])]) {
				if (!it.equipped) continue;
				const e = this._getItemEntry(it.name);
				if (!e?.weapon) continue;
				autoEntries.push(it.name);
			}

			// Damage-dealing cantrips
			for (const sp of (this._state.spells || [])) {
				const data = this._getSpellEntry(sp.name);
				if (!data || data.level !== 0 || !data.damageInflict?.length) continue;
				autoEntries.push(sp.name);
			}

			if (!autoEntries.length) return;

			for (const name of autoEntries) {
				const isHidden = hidden.has(name);
				const ov = (this._state.weaponOverrides || {})[name] || {};

				const iptAtk  = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" placeholder="Atk/DC" style="width:65px">`.val(ov.atkBonus || "");
				const iptDmg  = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" placeholder="Dmg" style="width:80px">`.val(ov.damage || "");
				const iptNote = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" placeholder="Notes" style="flex:1">`.val(ov.notes || "");

				const doUpdateOverride = () => {
					const cur = MiscUtil.copy(this._state.weaponOverrides || {});
					const atk = iptAtk.val().trim(), dmg = iptDmg.val().trim(), notes = iptNote.val().trim();
					if (atk || dmg || notes) cur[name] = {atkBonus: atk, damage: dmg, notes};
					else delete cur[name];
					this._state.weaponOverrides = cur;
					cb();
				};

				iptAtk.onn("input", doUpdateOverride);
				iptDmg.onn("input", doUpdateOverride);
				iptNote.onn("input", doUpdateOverride);

				const btnEye = ee`<button class="ve-btn ve-btn-xs ve-btn-default" title="${isHidden ? "Show in PDF" : "Hide from PDF"}"><span class="glyphicon ${isHidden ? "glyphicon-eye-close" : "glyphicon-eye-open"}"></span></button>`
					.onn("click", () => {
						const cur = new Set(this._state.weaponHidden || []);
						if (cur.has(name)) cur.delete(name); else cur.add(name);
						this._state.weaponHidden = [...cur];
						cb();
						buildAutoWpnSection();
					});
				ee`<div class="ve-flex-v-center ve-mb-1">
					<span style="flex:2;font-size:.85em" class="${isHidden ? "ve-muted ve-strikethrough" : ""}">${name}</span>
					${iptAtk}${iptDmg}${iptNote}${btnEye}
				</div>`.appendTo(wrpAutoWpn);
			}
		};

		buildAutoWpnSection();
		this._addHook("state", "equipment",      buildAutoWpnSection);
		this._addHook("state", "magicEquipment", buildAutoWpnSection);
		this._addHook("state", "spells",         buildAutoWpnSection);

		// -- Manual entries -----------------------------------------------------
		const wpnList = () => this._state.weapons || [];
		const wpnRows = [];
		const doUpdateWpn = () => { this._state.weapons = wpnRows.map(r => r.getState()).filter(it => it.name); cb(); };
		const wrpWpnRows = ee`<div class="ve-flex-col ve-mb-1"></div>`.appendTo(wpnRowInner);
		wpnList().forEach(w => addWpnRow(w));
		function addWpnRow (initial) {
			const iptName = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" placeholder="Name" style="flex:2">`.val(initial?.name || "").onn("change", doUpdateWpn);
			const iptAtk  = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" placeholder="Atk/DC" style="width:65px">`.val(initial?.atkBonus || "").onn("change", doUpdateWpn);
			const iptDmg  = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" placeholder="Dmg" style="width:80px">`.val(initial?.damage || "").onn("change", doUpdateWpn);
			const iptNote = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" placeholder="Notes" style="flex:1">`.val(initial?.notes || "").onn("change", doUpdateWpn);
			const btnRm   = ee`<button class="ve-btn ve-btn-xs ve-btn-danger"><span class="glyphicon glyphicon-trash"></span></button>`.onn("click", () => { wpnRows.splice(wpnRows.indexOf(rowMeta), 1); rowEle.empty().remove(); doUpdateWpn(); });
			const rowEle  = ee`<div class="ve-flex-v-center ve-mb-1">${iptName}${iptAtk}${iptDmg}${iptNote}${btnRm}</div>`.appendTo(wrpWpnRows);
			const rowMeta = {getState: () => ({name: iptName.val().trim(), atkBonus: iptAtk.val().trim(), damage: iptDmg.val().trim(), notes: iptNote.val().trim()})};
			wpnRows.push(rowMeta);
		}
		ee`<button class="ve-btn ve-btn-xs ve-btn-default">Add Weapon / Cantrip</button>`.appendTo(ee`<div></div>`.appendTo(wpnRowInner)).onn("click", () => { addWpnRow(null); doUpdateWpn(); });
		wrp.append(wpnRow);
	}

	// -- Equipment tab ---------------------------------------------------------

	// -- Auto-granted equipment sync -------------------------------------------
	// Diff-syncs {autoGranted:true} equipment entries — computes desired grants from class/background
	// startingEquipment, removes grants no longer valid, preserves user edits on existing grants,
	// and adds newly-valid grants.
	_syncGrantedEquipment () {
		if (!this._state) return;

		const choices = this._state.equipmentChoices || {};
		const desiredGrants = [];
		let totalGrantedCp = 0;

		const addGroup = (group, prefix, idx, source) => {
			const choiceKey = `${prefix}_${idx}`;
			const keys = Object.keys(group).filter(k => k !== "_");
			if (group._) {
				for (const item of group._) {
					if (item && typeof item === "object" && item.value != null) { totalGrantedCp += item.value; continue; }
					const parsed = CharacterBuilder._parseEquipItem(item);
					if (parsed) desiredGrants.push({...parsed, note: `from ${source}`, autoGranted: true});
				}
			}
			if (keys.length > 0) {
				const chosen = choices[choiceKey];
				if (chosen && group[chosen]) {
					for (const item of group[chosen]) {
						if (item && typeof item === "object" && item.value != null) { totalGrantedCp += item.value; continue; }
						const parsed = CharacterBuilder._parseEquipItem(item);
						if (parsed) desiredGrants.push({...parsed, note: `from ${source}`, autoGranted: true});
					}
				}
			}
		};

		const cls = this._getClassEntry();
		if (cls?.startingEquipment?.defaultData) {
			cls.startingEquipment.defaultData.forEach((grp, i) => addGroup(grp, "cls", i, cls.name));
		}
		const bg = this._sg_getBgEntry();
		if (bg?.startingEquipment) {
			bg.startingEquipment.forEach((grp, i) => addGroup(grp, "bg", i, bg.name));
		}

		// Diff: keep user-added items, then match desired grants against existing auto-granted items
		// (preserving user edits), adding fresh entries only for newly-granted items.
		const existingGrants = (this._state.equipment || []).filter(e => e.autoGranted);
		const matched = new Set();
		const newEquipment = (this._state.equipment || []).filter(e => !e.autoGranted);

		for (const grant of desiredGrants) {
			const key = grant.name.toLowerCase();
			const existingIdx = existingGrants.findIndex((e, i) => !matched.has(i) && e.name.toLowerCase() === key);
			if (existingIdx >= 0) {
				matched.add(existingIdx);
				newEquipment.push(existingGrants[existingIdx]); // preserve user edits
			} else {
				newEquipment.push(grant); // newly granted
			}
		}

		this._state.equipment = newEquipment;
		this._state.gp = Math.floor(totalGrantedCp / 100);
		this._state.sp = Math.floor((totalGrantedCp % 100) / 10);
		this._state.cp = totalGrantedCp % 10;

		this._rebuildEquipmentTab?.();
	}

	_buildEquipmentTab (wrp, cb) {
		const buildContent = () => {
			// -- Currency --------------------------------------------------------
			const [currRow, currRowInner] = BuilderUi.getLabelledRowTuple("Currency");
			const currencies = [{k:"cp",l:"CP"},{k:"sp",l:"SP"},{k:"ep",l:"EP"},{k:"gp",l:"GP"},{k:"pp",l:"PP"}];
			const currEles = ee`<div class="ve-flex ve-flex-wrap ve-w-100">`;
			currencies.forEach(({k, l}) => {
				const ipt = ee`<input class="ve-form-control ve-input-xs form-control--minimal" type="number" min="0" style="width:60px">`.val(this._state[k] || 0).onn("change", () => { this._state[k] = Math.max(0, UiUtil.strToInt(ipt.val(), 0, {fallbackOnNaN:0})); cb(); });
				currEles.appends(ee`<div class="ve-flex-v-center ve-mr-3 ve-mb-1"><span class="ve-mr-1 ve-muted" style="font-size:.8em">${l}</span>${ipt}</div>`);
			});
			currRowInner.append(currEles);
			wrp.append(currRow);

			// -- Starting Equipment choices ---------------------------------------
			const cls = this._getClassEntry();
			const bg  = this._sg_getBgEntry();
			if (cls?.startingEquipment?.defaultData?.length || bg?.startingEquipment?.length) {
				const [seRow, seRowInner] = BuilderUi.getLabelledRowTuple("Starting Equipment");

								const renderChoiceGroups = (groups, prefix, sourceName) => {
					if (!groups?.length) return;
					ee`<div class="ve-muted ve-italic ve-mb-1" style="font-size:.85em">${sourceName}:</div>`.appendTo(seRowInner);
					groups.forEach((group, idx) => {
						const choiceKey = `${prefix}_${idx}`;
						const choiceKeys = Object.keys(group).filter(k => k !== "_");

						// Mandatory block
						if (group._) {
							const lbl = CharacterBuilder._fmtEquipChoiceLabel(group._);
							if (lbl) ee`<div class="ve-mb-1 ve-ml-1" style="font-size:.85em">${lbl}</div>`.appendTo(seRowInner);
						}

						// Choice dropdown
						if (choiceKeys.length > 0) {
							const sel = document.createElement("select");
							sel.className = "ve-form-control ve-input-xs form-control--minimal ve-mb-1";
							const blank = document.createElement("option");
							blank.value = ""; blank.textContent = "(choose one)";
							sel.appendChild(blank);
							choiceKeys.sort().forEach(k => {
								const opt = document.createElement("option");
								opt.value = k;
								opt.textContent = `${k.toUpperCase()}: ${CharacterBuilder._fmtEquipChoiceLabel(group[k])}`;
								sel.appendChild(opt);
							});
							sel.value = (this._state.equipmentChoices || {})[choiceKey] || "";

							sel.addEventListener("change", () => {
								if (!this._state.equipmentChoices) this._state.equipmentChoices = {};
								this._state.equipmentChoices[choiceKey] = sel.value;
								this._syncGrantedEquipment();
								cb();
							});
							seRowInner.appendChild(sel);
						}
					});
				};

				renderChoiceGroups(cls?.startingEquipment?.defaultData, "cls", cls?.name);
				renderChoiceGroups(bg?.startingEquipment, "bg", bg?.name);
				wrp.append(seRow);
			}

			// -- Equipment (non-magic: auto-granted + user-added) -----------------
			const [eqRow, eqRowInner] = BuilderUi.getLabelledRowTuple("Equipment", {isMarked: true});
			const eqRows = [];
			const doUpdateEqState = () => {
				const activeItems = eqRows.map(r => r.getState()).filter(it => it.name);
				// Excluded auto-granted items are not in eqRows; pass them through directly from state
				const excludedItems = (this._state.equipment || []).filter(e => e.autoGranted && e.excluded);
				this._state.equipment = [...activeItems, ...excludedItems];
				this._syncEquippedItems();
				cb();
			};
			const wrpEqRows = ee`<div class="ve-flex-col ve-mb-1"></div>`.appendTo(eqRowInner);

			// Auto-granted items (removeable, with equip checkbox for weapons/armor/shields)
			(this._state.equipment || []).filter(() => false).forEach(item => {
				const entry = this._getItemEntry(item.name);
				const isEquippable = !!(entry && (entry.weapon || entry.armor || entry.type === "S"));
				const row = ee`<div class="ve-flex-v-center ve-mb-1"></div>`.appendTo(wrpEqRows);
				if (isEquippable) {
					ee`<span class="ve-muted ve-mr-1" style="font-size:.75em" title="Equipped">E</span>`.appendTo(row);
					const cbEle = ee`<input type="checkbox" class="mkbru__ipt-cb ve-mr-2" title="Equip">`.prop("checked", !!item.equipped);
					cbEle.onn("change", () => { item.equipped = !!cbEle.prop("checked"); cb(); });
					cbEle.appendTo(row);
				}
				ee`<span class="ve-mr-2" style="flex:1">${item.name}${item.qty > 1 ? ` ×${item.qty}` : ""}</span>`.appendTo(row);
				ee`<span class="ve-muted ve-italic ve-mr-2" style="font-size:.85em;flex:1">${item.note || ""}</span>`.appendTo(row);
				ee`<button class="ve-btn ve-btn-xs ve-btn-danger" title="Remove"><span class="glyphicon glyphicon-trash"></span></button>`
					.onn("click", () => {
						this._state.equipment = (this._state.equipment || []).filter(e => e !== item);
						row.remove();
						this._syncEquippedItems();
						cb();
					})
					.appendTo(row);
			});

			// Equipment items (auto-granted + user-added)
			const addEqRow = (initial) => {
				// Excluded auto-granted items are kept in state but not rendered
				if (initial?.autoGranted && initial?.excluded) return;

				const entry = this._getItemEntry(initial?.name || "");
				const isEquippable = !!(entry && (entry.weapon || entry.armor || entry.type === "S"));
				const iptQty  = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" type="number" min="1" placeholder="Qty" style="width:50px">`.val(initial?.qty || 1).onn("change", doUpdateEqState);
				const iptNote = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" placeholder="Notes" style="flex:1">`.val(initial?.note || "").onn("input", doUpdateEqState);
				const nameSpan = ee`<span class="ve-bold ve-mr-2" style="flex:2">${initial?.name || ""}</span>`;
				const cbEquip = isEquippable
					? ee`<input type="checkbox" class="mkbru__ipt-cb ve-mr-2" title="Equip">`.prop("checked", !!initial?.equipped).onn("change", doUpdateEqState)
					: null;
				const btnRm = ee`<button class="ve-btn ve-btn-xs ve-btn-danger" title="Remove"><span class="glyphicon glyphicon-trash"></span></button>`.onn("click", () => {
					if (initial?.autoGranted) {
						// Mark as excluded so sync won't re-add it
						initial.excluded = true;
						rowEle.remove();
					} else {
						eqRows.splice(eqRows.indexOf(rowMeta), 1);
						rowEle.remove();
					}
					doUpdateEqState();
				});
				const rowEle = ee`<div class="ve-flex-v-center ve-mb-1"></div>`.appendTo(wrpEqRows);
				if (isEquippable) {
					ee`<span class="ve-muted ve-mr-1" style="font-size:.75em" title="Equipped">E</span>`.appendTo(rowEle);
					cbEquip.appendTo(rowEle);
				}
				rowEle.appends(nameSpan).appends(iptQty).appends(iptNote).appends(btnRm);
				const rowMeta = {getState: () => ({name: (initial?.name || ""), qty: UiUtil.strToInt(iptQty.val(), 1, {fallbackOnNaN:1}), note: iptNote.val().trim(), equipped: isEquippable ? !!cbEquip.prop("checked") : false, ...(initial?.autoGranted ? {autoGranted: true} : {})})};
				eqRows.push(rowMeta);
			};
			(this._state.equipment || []).forEach(item => addEqRow(item));

			ee`<button class="ve-btn ve-btn-xs ve-btn-default">Add Item</button>`
				.appendTo(ee`<div></div>`.appendTo(eqRowInner))
				.onn("click", async () => {
					if (!this._modalFilterItems) {
						this._modalFilterItems = new ModalFilterItems({
							namespace: "charBuilder.items",
							allData: this._allItems.filter(it => !it.rarity || it.rarity === "none"),
						});
					}
					const selected = await this._modalFilterItems.pGetUserSelection();
					if (!selected?.length) return;
					selected.forEach(item => { if (item.name) addEqRow({name: item.name, qty: 1, note: ""}); });
					doUpdateEqState();
				});
			wrp.append(eqRow);

			// -- Magic Items ------------------------------------------------------
			const [mgRow, mgRowInner] = BuilderUi.getLabelledRowTuple("Magic Items", {isMarked: true});
			const mgRows = [];
			const doUpdateMgState = () => {
				this._state.magicEquipment = mgRows.map(r => r.getState()).filter(it => it.name);
				this._syncEquippedItems();
				cb();
			};
			const wrpMgRows = ee`<div class="ve-flex-col ve-mb-1"></div>`.appendTo(mgRowInner);

			const addMgRow = (initial) => {
				const entry = this._getItemEntry(initial?.name || "");
				const isEquippable = !!(entry && (entry.weapon || entry.armor || entry.type === "S"));
				const needsAttune = !!(entry?.reqAttune);
				const iptQty  = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" type="number" min="1" placeholder="Qty" style="width:50px">`.val(initial?.qty || 1).onn("change", doUpdateMgState);
				const iptNote = ee`<input class="ve-form-control ve-input-xs form-control--minimal ve-mr-1" placeholder="Notes" style="flex:1">`.val(initial?.note || "").onn("input", doUpdateMgState);
				const nameSpan = ee`<span class="ve-bold ve-mr-2" style="flex:2">${initial?.name || ""}</span>`;
				const cbEquip = isEquippable
					? ee`<input type="checkbox" class="mkbru__ipt-cb ve-mr-2" title="Equip">`.prop("checked", !!initial?.equipped).onn("change", doUpdateMgState)
					: null;
				const btnAttune = needsAttune
					? ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-1" title="Requires attunement">Att.</button>`
					: null;
				if (btnAttune) {
					if (initial?.attuned) btnAttune.addClass("ve-active");
					btnAttune.onn("click", () => { btnAttune.toggleClass("ve-active"); doUpdateMgState(); });
				}
				const btnRm = ee`<button class="ve-btn ve-btn-xs ve-btn-danger" title="Remove"><span class="glyphicon glyphicon-trash"></span></button>`.onn("click", () => {
					mgRows.splice(mgRows.indexOf(rowMeta), 1);
					rowEle.remove();
					doUpdateMgState();
				});
				const rowEle = ee`<div class="ve-flex-v-center ve-mb-1"></div>`.appendTo(wrpMgRows);
				if (isEquippable) {
					ee`<span class="ve-muted ve-mr-1" style="font-size:.75em" title="Equipped">E</span>`.appendTo(rowEle);
					cbEquip.appendTo(rowEle);
				}
				if (btnAttune) btnAttune.appendTo(rowEle);
				rowEle.appends(nameSpan).appends(iptQty).appends(iptNote).appends(btnRm);
				const rowMeta = {getState: () => ({name: (initial?.name || ""), qty: UiUtil.strToInt(iptQty.val(), 1, {fallbackOnNaN:1}), note: iptNote.val().trim(), equipped: isEquippable ? !!cbEquip.prop("checked") : false, attuned: needsAttune ? !!btnAttune.hasClass("ve-active") : false})};
				mgRows.push(rowMeta);
			};
			(this._state.magicEquipment || []).forEach(item => addMgRow(item));

			ee`<button class="ve-btn ve-btn-xs ve-btn-default">Add Magic Item</button>`
				.appendTo(ee`<div></div>`.appendTo(mgRowInner))
				.onn("click", async () => {
					if (!this._modalFilterItemsMagic) {
						this._modalFilterItemsMagic = new ModalFilterItems({
							namespace: "charBuilder.itemsMagic",
							allData: this._allItems.filter(it => it.rarity && it.rarity !== "none"),
						});
					}
					const selected = await this._modalFilterItemsMagic.pGetUserSelection();
					if (!selected?.length) return;
					selected.forEach(item => { if (item.name) addMgRow({name: item.name, qty: 1, note: ""}); });
					doUpdateMgState();
				});
			wrp.append(mgRow);
		};

		this._rebuildEquipmentTab = () => { wrp.empty(); buildContent(); };
		buildContent();
	}

	// -- Spell data helpers ----------------------------------------------------

	_getClassHitDie () {
		return this._getClassEntry()?.hd?.faces || null;
	}

	_getSpellEntry (name) {
		if (!this._allSpells || !name) return null;
		return this._allSpells.find(s => s.name.toLowerCase() === name.toLowerCase()) || null;
	}

	// Returns the edition-appropriate feat entry for a given name.
	// Prefers the source matching the active edition (classic vs. modern),
	// with a fallback to the first match - same pattern as _sg_getSpeciesEntry etc.
	_getFeatEntry (featName) {
		if (!this._allFeats || !featName) return null;
		const matches = this._allFeats.filter(f => f.name.toLowerCase() === featName.toLowerCase());
		if (!matches.length) return null;
		const isNew = (this._state.styleHint ?? SITE_STYLE__ONE) !== SITE_STYLE__CLASSIC;
		return (isNew
			? matches.find(f => !SourceUtil.isClassicSource(f.source))
			: matches.find(f => SourceUtil.isClassicSource(f.source))
		) || matches[0];
	}

	_getItemEntry (name) {
		if (!this._allItems || !name) return null;
		return this._allItems.find(it => it.name.toLowerCase() === name.toLowerCase()) || null;
	}

	// Returns a sorted list of weapon names the character is proficient with,
	// expanding "Simple weapons" / "Martial weapons" strings to individual items.
	_getProficientWeaponNames () {
		const allProfs = [
			...(this._state.weaponProfs || []),
			...(this._state.featWeaponProfs || []),
		];
		const names = new Set();
		for (const prof of allProfs) {
			const lower = prof.toLowerCase();
			if (lower === "simple weapons") {
				(this._allItems || []).filter(it => it.weaponCategory === "simple" && it.weapon && (!it.rarity || it.rarity === "none"))
					.forEach(it => names.add(it.name));
			} else if (lower === "martial weapons") {
				(this._allItems || []).filter(it => it.weaponCategory === "martial" && it.weapon && (!it.rarity || it.rarity === "none"))
					.forEach(it => names.add(it.name));
			} else {
				names.add(prof);
			}
		}
		return [...names].sort(SortUtil.ascSortLower);
	}

	// Computes equippedAC, equippedShield, equippedWeapons from items marked equipped:true.
	// Called whenever an equip checkbox changes or equipment state updates.
	_syncEquippedItems () {
		if (!this._state) return;
		const dexMod = _abilMod(this._state.dex || 10);
		const strMod = _abilMod(this._state.str || 10);
		const prof   = _profBonus(this._getTotalLevel());
		const all    = [...(this._state.equipment || []), ...(this._state.magicEquipment || [])];
		const equipped = all.filter(it => it.equipped);

		let equippedAC   = null;
		let equippedShield = false;
		const equippedWeapons = [];

		const _DMG_TYPE = {S:"slashing",P:"piercing",B:"bludgeoning",F:"fire",C:"cold",
			L:"lightning",N:"necrotic",R:"radiant",T:"thunder",A:"acid"};

		for (const it of equipped) {
			const entry = this._getItemEntry(it.name);
			if (!entry) continue;
			if (entry.type === "LA") {
				const ac = (entry.ac || 11) + dexMod;
				if (equippedAC === null || ac > equippedAC) equippedAC = ac;
			} else if (entry.type === "MA") {
				const ac = (entry.ac || 13) + Math.min(dexMod, 2);
				if (equippedAC === null || ac > equippedAC) equippedAC = ac;
			} else if (entry.type === "HA") {
				const ac = entry.ac || 16;
				if (equippedAC === null || ac > equippedAC) equippedAC = ac;
			} else if (entry.type === "S") {
				equippedShield = true;
			}
			if (entry.weapon) {
				const props = entry.property || [];
				const isFinesse = props.includes("F");
				const isRanged  = entry.type === "R" || entry.type === "A";
				const abilMod   = isFinesse ? Math.max(strMod, dexMod) : (isRanged ? dexMod : strMod);
				const atkBonus  = _fmtMod(abilMod + prof);
				const dmgType   = _DMG_TYPE[entry.dmgType] || entry.dmgType || "";
				const dmgMod    = abilMod !== 0 ? ` ${_fmtMod(abilMod)}` : "";
				const damage    = `${entry.dmg1 || "-"}${dmgMod}${dmgType ? " " + dmgType : ""}`;
				equippedWeapons.push({name: it.name, atkBonus, damage, notes: it.note || ""});
			}
		}

		// Combine armor AC + shield bonus into a single effective AC.
		// Only set equippedAC when at least one piece of equipment affects it,
		// so the manual AC field is still used when nothing is equipped.
		const hasArmorOrShield = equippedAC !== null || equippedShield;
		const baseAC = equippedAC ?? (this._state.ac || 10);
		this._state.equippedAC      = hasArmorOrShield ? baseAC + (equippedShield ? 2 : 0) : null;
		this._state.equippedShield  = equippedShield;
		this._state.equippedWeapons = equippedWeapons;
	}

	_fmtSpellCastingTime (spell) {
		if (!spell?.time?.length) return "";
		const t = spell.time[0];
		const unit = t.unit;
		if (unit === "action")   return "Action";
		if (unit === "bonus")    return "Bonus Action";
		if (unit === "reaction") return "Reaction";
		return `${t.number} ${unit}`;
	}

	_fmtSpellRange (spell) {
		if (!spell?.range) return "";
		const r = spell.range;
		if (r.type === "special") return "Special";
		if (!r.distance) return r.type || "";
		const d = r.distance;
		if (d.type === "self")      return "Self";
		if (d.type === "touch")     return "Touch";
		if (d.type === "sight")     return "Sight";
		if (d.type === "unlimited") return "Unlimited";
		if (d.type === "feet")      return `${d.amount} ft.`;
		if (d.type === "miles")     return `${d.amount} mi.`;
		return `${d.amount} ${d.type}`;
	}

	_isSpellConcentration (spell) {
		return (spell?.duration || []).some(d => d.concentration);
	}

	// -- Spells tab ------------------------------------------------------------

	_buildSpellsTab (wrp, cb) {
		const buildContent = () => {
			const spellsArr = () => this._state.spells || [];
			const spellRows = [];

			const doUpdateState = () => {
				const activeSpells = spellRows.map(r => r.getState()).filter(it => it.name);
				// Excluded auto-granted spells are not in spellRows; pass them through directly
				const excludedSpells = (this._state.spells || []).filter(sp => sp.autoGranted && sp.excluded);
				this._state.spells = [...activeSpells, ...excludedSpells];
				cb();
			};

			const LEVEL_LABELS = ["Cantrip", "1st Level", "2nd Level", "3rd Level", "4th Level", "5th Level", "6th Level", "7th Level", "8th Level", "9th Level"];

			// Pre-create all level sections; hide until populated
			const wrpSections = ee`<div class="ve-flex-col ve-mb-2"></div>`.appendTo(wrp);
			const sections = LEVEL_LABELS.map((label) => {
				const wrpSection = ee`<div class="ve-mb-2"></div>`.hideVe().appendTo(wrpSections);
				ee`<div class="ve-bold ve-mb-1" style="font-size:.85em;border-bottom:1px solid var(--col-border-default,#555);padding-bottom:2px">${label}</div>`.appendTo(wrpSection);
				const wrpRows = ee`<div class="ve-flex-col"></div>`.appendTo(wrpSection);
				return {wrpSection, wrpRows, rowCount: 0};
			});

			const addRow = (initial) => {
				const name = typeof initial === "string" ? initial : (initial?.name || "");
				if (!name) return;
				const isAuto    = !!initial?.autoGranted;
				// Excluded auto-granted spells are kept in state but not rendered
				if (isAuto && initial?.excluded) return;

				const spellData = this._getSpellEntry(name);
				const level     = Math.min(spellData?.level ?? 0, 9);
				const section   = sections[level];

				if (section.rowCount === 0) section.wrpSection.showVe();
				section.rowCount++;

				const row = ee`<div class="ve-flex-v-center ve-py-1" style="gap:6px;border-bottom:1px solid var(--col-border-default,#333)"></div>`.appendTo(section.wrpRows);
				ee`<span class="ve-bold" style="min-width:140px;flex:0 0 auto">${name}</span>`.appendTo(row);
				const iptNotes = ee`<input class="ve-form-control ve-input-xs form-control--minimal" placeholder="Notes..." style="flex:1;min-width:0">`.val(initial?.notes || "").onn("input", doUpdateState).appendTo(row);
				ee`<span class="ve-muted" style="font-size:.8em;white-space:nowrap">Prep</span>`.appendTo(row);
				const cbPrep = ee`<input type="checkbox" class="mkbru__ipt-cb" title="Prepared">`.prop("checked", !!(initial?.prepared)).onn("change", doUpdateState).appendTo(row);
				ee`<button class="ve-btn ve-btn-xs ve-btn-danger" title="Remove Spell"><span class="glyphicon glyphicon-trash"></span></button>`
					.onn("click", () => {
						if (isAuto) {
							// Mark as excluded so sync won't re-add it
							initial.excluded = true;
						} else {
							spellRows.splice(spellRows.indexOf(rowMeta), 1);
						}
						row.remove();
						section.rowCount--;
						if (section.rowCount === 0) section.wrpSection.hideVe();
						doUpdateState();
					})
					.appendTo(row);

				const rowMeta = {
					getState: () => ({
						name,
						prepared: !!cbPrep.prop("checked"),
						notes: iptNotes.val().trim(),
						...(isAuto ? {autoGranted: true} : {}),
					}),
				};
				spellRows.push(rowMeta);
			};

			spellsArr().forEach(sp => addRow(sp));

			ee`<button class="ve-btn ve-btn-xs ve-btn-default">Add Spell</button>`
				.appendTo(wrp)
				.onn("click", async () => {
					if (!this._modalFilterSpells) {
						this._modalFilterSpells = new ModalFilterSpells({
							namespace: "charBuilder.spells",
							allData: this._allSpells,
						});
					}
					const selected = await this._modalFilterSpells.pGetUserSelection();
					if (!selected?.length) return;
					selected.forEach(item => { if (item.name) addRow(item.name); });
					doUpdateState();
				});
		};

		this._rebuildSpellsTab = () => { wrp.empty(); buildContent(); };
		buildContent();
	}

	// -- Personality tab -------------------------------------------------------

	_buildPersonalityTab (wrp, cb) {
		BuilderUi.getStateIptEntries("Personality Traits", cb, this._state, {placeholder: "Describe your personality..."}, "personalityTraits").appendTo(wrp);
		BuilderUi.getStateIptEntries("Ideals",             cb, this._state, {placeholder: "What drives you?"}, "ideals").appendTo(wrp);
		BuilderUi.getStateIptEntries("Bonds",              cb, this._state, {placeholder: "Who or what do you care about?"}, "bonds").appendTo(wrp);
		BuilderUi.getStateIptEntries("Flaws",              cb, this._state, {placeholder: "What are your weaknesses?"}, "flaws").appendTo(wrp);
		BuilderUi.getStateIptEntries("Backstory",          cb, this._state, {placeholder: "Character history and backstory..."}, "backstory").appendTo(wrp);
		BuilderUi.getStateIptString("Age",    cb, this._state, {placeholder: "e.g. 30"}, "age").appendTo(wrp);
		BuilderUi.getStateIptString("Height", cb, this._state, {placeholder: "e.g. 5'10\""}, "height").appendTo(wrp);
		BuilderUi.getStateIptString("Weight", cb, this._state, {placeholder: "e.g. 160 lbs"}, "weight").appendTo(wrp);
		BuilderUi.getStateIptString("Eyes",   cb, this._state, {placeholder: "e.g. Brown"}, "eyes").appendTo(wrp);
		BuilderUi.getStateIptString("Skin",   cb, this._state, {placeholder: "e.g. Tan"}, "skin").appendTo(wrp);
		BuilderUi.getStateIptString("Hair",   cb, this._state, {placeholder: "e.g. Black"}, "hair").appendTo(wrp);
		BuilderUi.getStateIptEnum("Size", cb, this._state, {nullable: false, vals: _SIZES, fnDisplay: v => String(v)}, "size").appendTo(wrp);
		BuilderUi.getStateIptEntries("Appearance Notes", cb, this._state, {placeholder: "Physical description..."}, "appearance").appendTo(wrp);
	}

	// -------------------------------------------------------------------------
	// Output rendering
	// -------------------------------------------------------------------------

	renderOutput () { this._renderOutputDebounced(); }

	_renderOutput () {
		const wrp = this._ui.wrpOutput.empty();

		if (!this._isDataLoaded) {
			ee`<div class="ve-flex-vh-center ve-w-100 ve-h-100 ve-py-4">
				<span class="ve-muted ve-italic">Loading character data...</span>
			</div>`.appendTo(wrp);
			return;
		}

		this._resetTabs({tabGroup: "output"});
		const tabs = this._renderTabs(
			[
				new TabUiUtil.TabMeta({name: "PDF Preview"}),
				new TabUiUtil.TabMeta({name: "Data"}),
			],
			{tabGroup: "output", cbTabChange: this.doUiSave.bind(this)},
		);
		const [previewTab, dataTab] = tabs;
		ee`<div class="ve-flex-v-center ve-w-100 ve-no-shrink">${tabs.map(it => it.btnTab)}</div>`.appendTo(wrp);
		tabs.forEach(it => it.wrpTab.appendTo(wrp));

		// -- PDF Preview tab --------------------------------------------------
		this._renderPdfPreview(previewTab.wrpTab);

		// -- Data tab ---------------------------------------------------------
		const tblData = ee`<table class="ve-w-100 stats stats--book mkbru__wrp-output-tab-data"></table>`.appendTo(dataTab.wrpTab);
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

		// Download buttons (JSON + PDF) rendered in the sheet tab header
	}
	// -------------------------------------------------------------------------
	// PDF Export - faithful to 2024 official sheet via jsPDF
	// -------------------------------------------------------------------------


	// -------------------------------------------------------------------------
	// PDF Export - uses official 2024 sheet as background image, fills fields
	// -------------------------------------------------------------------------



	_renderPdfPreview (wrp) {
		const s = this._state;

		// Toolbar
		const btnJson = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-1"><span class="glyphicon glyphicon-download-alt ve-mr-1"></span>JSON</button>`
			.onn("click", () => {
				const out = this._ui._getJsonOutputTemplate();
				out.character = [DataUtil.cleanJson(MiscUtil.copy(s))];
				DataUtil.userDownload(DataUtil.getCleanFilename(s.name || "character"), out);
			});
		const btnPdf = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-1"><span class="glyphicon glyphicon-print ve-mr-1"></span>PDF</button>`
			.onn("click", () => this._doExportPdf());
		const btnStatblock = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-1" title="Export as creature statblock (Markdown)"><span class="glyphicon glyphicon-list-alt ve-mr-1"></span>Statblock</button>`
			.onn("click", () => this._doExportStatblock());
		const btnCards = ee`<button class="ve-btn ve-btn-xs ve-btn-default ve-mr-1" title="Send spells, items, feats, species and background to Card Builder"><span class="glyphicon glyphicon-th ve-mr-1"></span>Cards</button>`
			.onn("click", () => this._doExportCards());

		if (this._pdfSheetMode == null) this._pdfSheetMode = localStorage.getItem(CharacterBuilder._STORAGE_KEY_PDF_SHEET_MODE) || "standard";
		const btnStandard  = ee`<button class="ve-btn ve-btn-xs ve-mr-1" title="Standard class features layout">Standard</button>`;
		const btnExtended  = ee`<button class="ve-btn ve-btn-xs" title="Extended class features layout">Extended</button>`;
		const applySheetMode = (mode) => {
			this._pdfSheetMode = mode;
			localStorage.setItem(CharacterBuilder._STORAGE_KEY_PDF_SHEET_MODE, mode);
			btnStandard.toggleClass("ve-btn-primary", mode === "standard").toggleClass("ve-btn-default", mode !== "standard");
			btnExtended.toggleClass("ve-btn-primary", mode === "extended").toggleClass("ve-btn-default", mode !== "extended");
		};
		btnStandard.onn("click", () => { applySheetMode("standard"); regenerate(); });
		btnExtended.onn("click", () => { applySheetMode("extended"); regenerate(); });
		applySheetMode(this._pdfSheetMode);

		ee`<div class="ve-flex-v-center ve-mb-2 ve-pb-1" style="border-bottom:1px solid var(--rgb-border-grey)">
			<span class="ve-muted ve-italic ve-mr-2" style="font-size:.75em">${(s.styleHint === "classic") ? "D&D 2014 (5e)" : "D&D 2024 (5.5e)"}</span>
			<div class="ve-btn-group ve-mr-2">${btnStandard}${btnExtended}</div>
			<div class="ve-ml-auto">${btnJson}${btnPdf}${btnStatblock}${btnCards}</div>
		</div>`.appendTo(wrp);

		// Status / iframe
		const dispStatus = ee`<div class="ve-flex-vh-center ve-w-100 ve-py-3"><span class="ve-muted ve-italic">Generating PDF preview\u2026</span></div>`.appendTo(wrp);
		const iframe = ee`<iframe class="ve-w-100 ve-hidden" style="height:800px;border:none"></iframe>`.appendTo(wrp);

		const regenerate = () => {
			dispStatus.showVe(); iframe.hideVe();
			if (this._pdfBlobUrl) { URL.revokeObjectURL(this._pdfBlobUrl); this._pdfBlobUrl = null; }
			const genId = ++this._pdfGenId;
			this._pBuildPdf(this._pdfSheetMode).then(doc => {
				if (genId !== this._pdfGenId) return;
				const url = doc.output("bloburl");
				this._pdfBlobUrl = url;
				iframe.attr("src", url);
				dispStatus.hideVe();
				iframe.showVe();
			}).catch(err => {
				if (genId !== this._pdfGenId) return;
				dispStatus.empty().appends(`<span class="ve-error">PDF preview failed - use the Download PDF button above.</span>`);
				console.error("PDF preview:", err);
			});
		};

		// Revoke previous blob URL to avoid memory leaks
		if (this._pdfBlobUrl) { URL.revokeObjectURL(this._pdfBlobUrl); this._pdfBlobUrl = null; }
		const genId = ++this._pdfGenId;

		this._pBuildPdf(this._pdfSheetMode).then(doc => {
			if (genId !== this._pdfGenId) return; // stale render
			const url = doc.output("bloburl");
			this._pdfBlobUrl = url;
			iframe.attr("src", url);
			dispStatus.hideVe();
			iframe.showVe();
		}).catch(err => {
			if (genId !== this._pdfGenId) return;
			dispStatus.empty().appends(`<span class="ve-error">PDF preview failed - use the Download PDF button above.</span>`);
			console.error("PDF preview:", err);
		});
	}

	async _doExportPdf () {
		const doc = await this._pBuildPdf(this._pdfSheetMode);
		doc.save(`${DataUtil.getCleanFilename(this._state.name || "character")}-sheet.pdf`);
	}

	_doExportStatblock () {
		const s = this._state;
		const _stLevel = s => (s.classes || [{level: s.level || 1}]).reduce((a, c) => a + Math.max(1, parseInt(c.level) || 1), 0);
		const prof = s.profBonusOverride ?? _profBonus(_stLevel(s));
		const _mod = score => _abilMod(score);
		const _modStr = score => { const m = _mod(score); return `${m >= 0 ? "+" : ""}${m}`; };
		const _scoreCell = score => `${score} (${_modStr(score)})`;

		const SKILL_ABILITY = {
			"Acrobatics": "dex", "Animal Handling": "wis", "Arcana": "int",
			"Athletics": "str", "Deception": "cha", "History": "int",
			"Insight": "wis", "Intimidation": "cha", "Investigation": "int",
			"Medicine": "wis", "Nature": "int", "Perception": "wis",
			"Performance": "cha", "Persuasion": "cha", "Religion": "int",
			"Sleight of Hand": "dex", "Stealth": "dex", "Survival": "wis",
		};

		const allSaveProfs = new Set([...(s.savingThrowProfs || []), ...(s.featSavingThrowProfs || [])]);
		const allSkillProfs = new Set([...(s.skillProfs || []), ...(s.featSkillProfs || []), ...(s.classSkillChoices || [])]);
		const allExpertise  = new Set([...(s.skillExpertise || []), ...(s.featExpertise || []), ...(s.classExpertise || [])]);
		const allHalfProfs  = new Set(s.skillHalfProfs || []);

		const savesStr = ["str", "dex", "con", "int", "wis", "cha"]
			.filter(a => allSaveProfs.has(a))
			.map(a => `${a.charAt(0).toUpperCase()}${a.slice(1)} ${_modStr(_mod(s[a] || 10) + prof)}`)
			.join(", ");

		const skillsStr = Object.entries(SKILL_ABILITY)
			.filter(([sk]) => allSkillProfs.has(sk))
			.map(([sk, ab]) => {
				const bonus = allExpertise.has(sk) ? prof * 2 : allHalfProfs.has(sk) ? Math.floor(prof / 2) : prof;
				return `${sk} ${_modStr(_mod(s[ab] || 10) + bonus)}`;
			}).join(", ");

		const passPerc = 10 + _mod(s.wis || 10) + (allSkillProfs.has("Perception") ? (allExpertise.has("Perception") ? prof * 2 : prof) : 0);
		const ac = s.equippedAC != null ? s.equippedAC + (s.equippedShield ? 2 : 0) : s.ac;
		const languages = [...new Set([...(s.languages || []), ...(s.featLanguages || [])])].join(", ") || "\u2014";
		const classLine = (s.classes || (s.class ? [{cls: s.class, sub: s.subclass, level: s.level}] : []))
			.filter(c => c.cls)
			.map(c => `${c.cls}${c.sub ? ` (${c.sub})` : ""} ${c.level}`)
			.join(" / ");

		const lines = [
			`## ${s.name || "Character"}`,
			`*${s.size || "Medium"} humanoid (${s.species || "human"}), ${s.alignment || "Unaligned"}*`,
			``,
			`---`,
			``,
			`**Armor Class** ${ac}  `,
			`**Hit Points** ${s.hpMax || 0} (${s.hitDice || `${_stLevel(s)}d8`})  `,
			`**Speed** ${(s.speed || 30) + (s.featSpeedBonus || 0)} ft.  `,
			``,
			`---`,
			``,
			`| STR | DEX | CON | INT | WIS | CHA |`,
			`|:---:|:---:|:---:|:---:|:---:|:---:|`,
			`| ${_scoreCell(s.str || 10)} | ${_scoreCell(s.dex || 10)} | ${_scoreCell(s.con || 10)} | ${_scoreCell(s.int || 10)} | ${_scoreCell(s.wis || 10)} | ${_scoreCell(s.cha || 10)} |`,
			``,
			`---`,
			``,
		];
		if (savesStr) lines.push(`**Saving Throws** ${savesStr}  `);
		if (skillsStr) lines.push(`**Skills** ${skillsStr}  `);
		lines.push(`**Senses** passive Perception ${passPerc}  `);
		lines.push(`**Languages** ${languages}  `);
		lines.push(`**Proficiency Bonus** +${prof}  `);
		if (classLine) lines.push(`**Class** ${classLine}  `);
		if (s.background) lines.push(`**Background** ${s.background}  `);
		lines.push(``, `---`, ``);

		const features = (s.classFeatureItems || []).filter(i => !i.excluded);
		if (features.length) {
			lines.push(`### Class Features`, ``);
			features.forEach(f => {
				const [head, ...rest] = f.text.split("\n");
				lines.push(`***${head.replace(/^\[L\d+\]\s*/, "")}*** ${rest.join(" ")}`, ``);
			});
		}
		const traits = (s.speciesTraitItems || []).filter(i => !i.excluded);
		if (traits.length) {
			lines.push(`### Species Traits`, ``);
			traits.forEach(t => {
				const [head, ...rest] = t.text.split("\n");
				lines.push(`***${head}*** ${rest.join(" ")}`, ``);
			});
		}

		DataUtil.userDownloadText(`${DataUtil.getCleanFilename(s.name || "character")}-statblock.md`, lines.join("\n"));
	}

	async _doExportCards () {
		const s = this._state;
		const isNew = (s.styleHint ?? "one") !== "classic";
		const listItems = [];

		// In 5.5e mode prefer the version WITHOUT reprintedAs (the newer reprint);
		// in classic mode prefer the version WITH reprintedAs (the older original).
		// Falls back to any match if the preferred edition doesn't exist.
		const _pick = (candidates) => {
			if (!candidates.length) return null;
			if (candidates.length === 1) return candidates[0];
			const preferred = isNew
				? candidates.find(x => !x.reprintedAs?.length)
				: candidates.find(x => x.reprintedAs?.length);
			return preferred ?? candidates[0];
		};

		const _push = (entity, page, entityType, color, icon) => {
			if (!entity?.name || !entity?.source) return;
			const hashBuilder = UrlUtil.URL_TO_HASH_BUILDER[page];
			if (!hashBuilder) return;
			listItems.push({
				page,
				source: entity.source,
				hash: hashBuilder(entity),
				color,
				icon,
				count: 1,
				entityType,
			});
		};

		(s.spells || []).forEach(sp => {
			const nm = (sp.name || "").toLowerCase();
			const e = _pick(this._allSpells.filter(x => x.name.toLowerCase() === nm));
			if (e) _push(e, UrlUtil.PG_SPELLS, "spell", "#4a6898", "magic-swirl");
		});
		const _seenItemNames = new Set();
		[...(s.magicEquipment || []), ...(s.equipment || [])].forEach(it => {
			const nm = (it.name || "").toLowerCase();
			if (!nm || _seenItemNames.has(nm)) return;
			_seenItemNames.add(nm);
			const e = _pick(this._allItems.filter(x => x.name.toLowerCase() === nm));
			if (e) _push(e, UrlUtil.PG_ITEMS, "item", "#696969", "crossed-swords");
		});
		[...(s.bgFeat ? [s.bgFeat] : []), ...(s.feats || [])].filter(Boolean).forEach(name => {
			const nm = name.toLowerCase();
			const e = _pick(this._allFeats.filter(x => x.name.toLowerCase() === nm));
			if (e) _push(e, UrlUtil.PG_FEATS, "feat", "#aca300", "mighty-force");
		});
		if (s.species) {
			const nm = s.species.toLowerCase();
			const e = _pick(this._allSpecies.filter(x => x.name.toLowerCase() === nm));
			if (e) _push(e, UrlUtil.PG_RACES, "race", "#a7894b", "family-tree");
		}
		if (s.background) {
			const nm = s.background.toLowerCase();
			const e = _pick(this._allBackgrounds.filter(x => x.name.toLowerCase() === nm));
			if (e) _push(e, UrlUtil.PG_BACKGROUNDS, "background", "#a74b8d", "farmer");
		}

		// Optional feature choices (Fighting Style, Metamagic, Eldritch Invocations, etc.)
		{
			const slotsByKey = Object.fromEntries((s._optionalFeatureSlots || []).map(sl => [sl.key, sl]));
			Object.entries(s.optionalFeatureChoices || {}).forEach(([key, names]) => {
				const slot = slotsByKey[key];
				(names || []).filter(Boolean).forEach(name => {
					const nm = name.toLowerCase();
					if (slot?.dataSource === "feat") {
						const e = _pick((this._allFeats || []).filter(x => x.name.toLowerCase() === nm));
						if (e) _push(e, UrlUtil.PG_FEATS, "feat", "#aca300", "mighty-force");
					} else {
						const e = _pick((this._allOptFeatures || []).filter(x => x.name.toLowerCase() === nm));
						if (e) _push(e, UrlUtil.PG_OPT_FEATURES, "optionalfeature", "#3b6e4a", "magic-palm");
					}
				});
			});
		}

		const _TYPE_ORDER = ["race", "background", "optionalfeature", "feat", "creature", "spell", "item"];
		listItems.sort((a, b) => {
			const oa = _TYPE_ORDER.indexOf(a.entityType);
			const ob = _TYPE_ORDER.indexOf(b.entityType);
			if (oa !== ob) return (oa === -1 ? 99 : oa) - (ob === -1 ? 99 : ob);
			return a.hash.localeCompare(b.hash);
		});

		try {
			await StorageUtil["pSetForPage"]("cardState", {state: {state: {}}, listItems}, {page: "makecards.html"});
			window.open("makecards.html", "_blank");
		} catch (e) {
			JqueryUtil.doToast({content: `Card export failed: ${e.message}`, type: "danger"});
			throw e;
		}
	}

	async _pBuildPdf (sheetMode = "standard") {
		const s = this._state;
		// For manual mode the raw state value is the base score; add race/bg/feat
		// bonuses so the PDF reflects the true total.  For other modes _sg_syncAbilityScores
		// already wrote the total into state, so we just read it directly.
		const _stLevel = s => (s.classes || [{level: s.level || 1}]).reduce((a, c) => a + Math.max(1, parseInt(c.level) || 1), 0);
		const totalLevel = _stLevel(s);
		const totalAbl   = (abl) => Math.min(20, (s.sg_mode || "manual") === "manual"
			? (s[abl] || 10) + this._sg_getAsiBonus(abl) + this._sg_getFeatBonus(abl) + this._sg_getClassAsiBonus(abl)
			: (s[abl] || 10));
		const profBonus  = s.profBonusOverride ?? _profBonus(totalLevel);
		const abilMods   = Object.fromEntries(_ABILITIES.map(a => [a, _abilMod(totalAbl(a))]));
		const initiative = (s.initiative ?? abilMods.dex) + (s.featInitiativeBonus || 0);
		const _percMult  = ((s.skillExpertise||[]).includes("Perception") || (s.featExpertise||[]).includes("Perception") || (s.classExpertise||[]).includes("Perception")) ? 2 : ((s.skillProfs||[]).includes("Perception") || (s.classSkillChoices||[]).includes("Perception") || (s.featSkillProfs||[]).includes("Perception")) ? 1 : (s.skillHalfProfs||[]).includes("Perception") ? 0.5 : 0;
		const passPer    = 10 + abilMods.wis + profBonus * _percMult;
		// Collect all unique spellcasting abilities: from class data, feat choices, fallback to primary
		const spellAbilList = (() => {
			const abils = new Set(s.spellcastingAbilities || []);
			const activeFeatNames = new Set([...(s.bgFeat ? [s.bgFeat] : []), ...(s.feats || [])].filter(Boolean));
			Object.entries(s.featChoices || {}).forEach(([featName, chosen]) => {
				if (!activeFeatNames.has(featName)) return;
				if (chosen.spellcastingAbility) abils.add(chosen.spellcastingAbility);
			});
			if (!abils.size && s.spellcastingAbility) abils.add(s.spellcastingAbility);
			return [...abils].filter(Boolean);
		})();
		const spellMod   = spellAbilList.length ? abilMods[spellAbilList[0]] : null;
		const spellDC    = spellMod != null ? 8 + profBonus + spellMod : null;
		const spellAtk   = spellMod != null ? profBonus + spellMod : null;

		const hasSave    = abl => (s.savingThrowProfs||[]).includes(abl) || (s.featSavingThrowProfs||[]).some(p=>p.toLowerCase()===_ABILITY_FULL[abl]?.toLowerCase()||p.toLowerCase()===abl.toLowerCase());
		const hasSkill    = sk => (s.skillProfs||[]).includes(sk) || (s.featSkillProfs||[]).includes(sk) || (s.classSkillChoices||[]).includes(sk);
		const hasExpert   = sk => (s.skillExpertise||[]).includes(sk) || (s.featExpertise||[]).includes(sk) || (s.classExpertise||[]).includes(sk);
		const hasHalfProf = sk => (s.skillHalfProfs||[]).includes(sk);
		const saveBonus  = abl => abilMods[abl] + (hasSave(abl) ? profBonus : 0);
		const skillBonus = sk  => { const a=_SKILLS.find(x=>x.name===sk)?.ability||"str"; if (hasExpert(sk)) return abilMods[a]+profBonus*2; if (hasSkill(sk)) return abilMods[a]+profBonus; if (hasHalfProf(sk)) return abilMods[a]+Math.floor(profBonus/2); return abilMods[a]; };
		const fmod = n => n >= 0 ? `+${n}` : `${n}`;
		const v = (x,fb="") => (x!==undefined&&x!==null&&x!=="") ? String(x) : fb;

		// Compute effective AC, shield, and weapon entries from equipped items (always fresh).
		// Base unarmored = 10 + DEX mod; armor replaces it via its formula; shield always adds 2.
		const _DMG_TYPES = {S:"slashing",P:"piercing",B:"bludgeoning",F:"fire",C:"cold",L:"lightning",N:"necrotic",R:"radiant",T:"thunder",A:"acid"};
		const _allEquip = [...(s.equipment||[]), ...(s.magicEquipment||[])].filter(it => it.equipped);
		let _armorAC = null;
		let _hasEquippedShield = false;
		const _equippedWeapons = [];
		for (const _it of _allEquip) {
			const _e = this._getItemEntry(_it.name);
			if (!_e) continue;
			if      (_e.type === "LA") _armorAC = Math.max(_armorAC ?? 0, (_e.ac || 11) + abilMods.dex);
			else if (_e.type === "MA") _armorAC = Math.max(_armorAC ?? 0, (_e.ac || 13) + Math.min(abilMods.dex, 2));
			else if (_e.type === "HA") _armorAC = Math.max(_armorAC ?? 0, _e.ac || 16);
			else if (_e.type === "S")  _hasEquippedShield = true;
			if (_e.weapon) {
				const _props    = _e.property || [];
				const _finesse  = _props.includes("F");
				const _ranged   = _e.type === "R" || _e.type === "A";
				const _amod     = _finesse ? Math.max(abilMods.str, abilMods.dex) : (_ranged ? abilMods.dex : abilMods.str);
				const _atkBonus = fmod(_amod + profBonus);
				const _dmgType  = _DMG_TYPES[_e.dmgType] || _e.dmgType || "";
				const _dmgMod   = _amod !== 0 ? ` ${fmod(_amod)}` : "";
				_equippedWeapons.push({name: _it.name, atkBonus: _atkBonus, damage: `${_e.dmg1 || "-"}${_dmgMod}${_dmgType ? " " + _dmgType : ""}`, notes: _it.note || ""});
			}
		}
		const effectiveAC = s.ac != null ? s.ac : (_armorAC ?? (10 + abilMods.dex)) + (_hasEquippedShield ? 2 : 0);

		if (!window.jspdf) await new Promise((res,rej) => {
			const el = document.createElement("script");
			el.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
			el.onload=res; el.onerror=rej; document.head.appendChild(el);
		});
		const {jsPDF} = window.jspdf;
		const doc = new jsPDF({orientation:"portrait",unit:"mm",format:"letter"});
		const PW=215.9, PH=279.4;

		const _loadSheetImg = url => fetch(url).then(r => r.blob()).then(b => new Promise((res, rej) => {
			const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(b);
		}));
		const [P1, P2] = await Promise.all([
			_loadSheetImg(sheetMode === "extended" ? "js/character/extended-class-sheet-p1.jpg" : "js/character/standard-sheet-p1.jpg"),
			_loadSheetImg("js/character/sheet-p2.jpg"),
		]);
		const S = 215.9/612; // pt -> mm
		const pt = n => n*S;

		// Place text centred inside a field rect [x0,top,x1,bot] (pt, top-down)
		const inField = (text, x0,top,x1,bot, sz=9, bold=false) => {
			if (text===null||text===undefined||text==="") return;
			const cx = pt((x0+x1)/2), cy = pt((top+bot)/2) + sz*0.352/2;
			doc.setFontSize(sz); doc.setFont("helvetica", bold?"bold":"normal");
			doc.text(String(text), cx, cy, {align:"center"});
		};
		// Left-aligned text inside a field rect, with small left margin
		const inFieldL = (text, x0,top,x1,bot, sz=8) => {
			if (!text) return;
			const y = pt((top+bot)/2) + sz*0.352/2;
			doc.setFontSize(sz); doc.setFont("helvetica","normal");
			const lines = doc.splitTextToSize(String(text), pt(x1-x0)-1);
			lines.forEach((l,i) => doc.text(l, pt(x0)+0.5, y + i*sz*0.352*1.2));
		};
		// Multiline field (top-aligned)
		const inFieldML = (text, x0,top,x1,bot, sz=7) => {
			if (!text) return;
			const lh = sz * 0.352 * 1.6;   // line height in mm (~10pt leading for 7pt font)
			const y  = pt(top) + lh;        // first baseline one line-height below top edge
			doc.setFontSize(sz); doc.setFont("helvetica","normal");
			const lines = doc.splitTextToSize(String(text), pt(x1-x0)-1);
			lines.forEach((l,i) => {
				const ly = y + i*lh;
				if (ly > pt(bot) - 0.5) return;  // clip to field bottom
				doc.text(l, pt(x0)+0.5, ly);
			});
		};
		// Place text centred horizontally at a specific pt y midpoint (for label-aligned fields)
		const inFieldAtY = (text, x0,x1, yMidPt, sz=9, bold=false) => {
			if (text===null||text===undefined||text==="") return;
			const cx = pt((x0+x1)/2), cy = pt(yMidPt) + sz*0.352/2;
			doc.setFontSize(sz); doc.setFont("helvetica", bold?"bold":"normal");
			doc.text(String(text), cx, cy, {align:"center"});
		};
		// Filled proficiency pip at pt-space point (r=1.5 so diamond outline stays visible)
		const pip = (xPt, yPt) => {
			doc.setFillColor(15,15,15);
			doc.circle(pt(xPt), pt(yPt), pt(1.5), "F");
		};

		// ═══════════════════ PAGE 1 ═══════════════════
		doc.addImage(P1,"JPEG",0,0,PW,PH);
		doc.setTextColor(10,10,10);

		// Banner
		inFieldL(v(s.name,"New Character"),     26.6, 18.8, 248.1, 33.6,  9);
		inFieldL(v(s.background),               25.5, 42.0, 145.4, 55.5,  8);
		// Stack all classes/subclasses vertically, centred in their respective boxes
		const inFieldLStack = (lines, x0, top, x1, bot, sz) => {
			const nonEmpty = lines.filter(Boolean);
			if (!nonEmpty.length) return;
			const lh = sz * 0.352 * 1.3;
			const totalH = (nonEmpty.length - 1) * lh;
			const y0 = pt((top + bot) / 2) - totalH / 2 + sz * 0.352 * 0.35;
			doc.setFontSize(sz); doc.setFont("helvetica", "normal");
			nonEmpty.forEach((l, i) => doc.text(l, pt(x0) + 0.5, y0 + i * lh));
		};
		const _clsArr = s.classes || (s.class ? [{cls: s.class, sub: s.subclass, level: s.level || 1}] : []);
		const _clsEntries  = _clsArr.filter(c => c.cls);
		const _isMulticlass = _clsEntries.length > 1;
		const _clsLines = _clsEntries.map(c => _isMulticlass ? `${c.cls} (${c.level})` : c.cls);
		const _subLines = _clsEntries.map(c => c.sub || "").filter(Boolean);
		const _clsSz = _clsEntries.length > 2 ? 6 : 7;
		const _subSz = _subLines.length    > 2 ? 6 : 7;
		inFieldLStack(_clsLines, 150.6, 42.0, 248.8, 55.5, _clsSz);
		inFieldL(v(s.species),   25.0, 63.2, 145.2, 77.4,  8);
		inFieldLStack(_subLines, 150.6, 63.2, 249.2, 77.3, _subSz);
		inField (v(totalLevel),                             266.2, 28.7, 293.5, 51.0, 14, true);
		inField (String(effectiveAC),         325.5, 40.4, 362.8, 63.2, 14, true);
		inField (v(s.hpMax,"0"),              444.9, 61.7, 488.2, 75.6, 10, true);
		const _hitDiceStr = v(s.hitDice, "");
		inField (v(_hitDiceStr,""),           499.8, 61.7, 537.5, 75.8,  8);

		// Death saves - left blank for player to fill in

		// Combat stats
		inField(fmod(profBonus),   43.0, 150.9,  74.5, 173.3, 13, true);
		inField(fmod(initiative),  245.1, 135.0, 287.8, 157.3, 12, true);
		inField(String((s.speed||30) + (s.featSpeedBonus||0)), 338.1, 135.0, 386.5, 157.3, 12, true);
		inField(v(s.size,""),      436.7, 135.2, 479.5, 157.5,  9, true);
		inField(String(passPer),   528.8, 135.2, 581.8, 157.5, 12, true);

		// Ability modifiers + scores
		inField(fmod(abilMods.str),           29.3, 220.0,  59.1, 242.4, 13, true);
		inField(String(totalAbl("str")),       64.4, 222.4,  88.5, 244.8,  9);
		inField(fmod(abilMods.dex),           29.7, 339.6,  58.3, 361.9, 13, true);
		inField(String(totalAbl("dex")),       64.4, 343.2,  87.5, 363.9,  9);
		inField(fmod(abilMods.con),           29.7, 487.6,  58.6, 509.9, 13, true);
		inField(String(totalAbl("con")),       63.1, 491.2,  89.8, 512.0,  9);
		inField(fmod(abilMods.int),          137.9, 141.8, 166.5, 164.1, 13, true);
		inField(String(totalAbl("int")),      172.1, 145.1, 195.4, 165.8,  9);
		inField(fmod(abilMods.wis),          136.6, 317.8, 166.2, 340.1, 13, true);
		inField(String(totalAbl("wis")),      171.7, 321.5, 194.4, 342.3,  9);
		inField(fmod(abilMods.cha),          137.5, 494.2, 166.6, 516.5, 13, true);
		inField(String(totalAbl("cha")),      170.1, 498.0, 195.1, 518.8,  9);

		// Saving throws + skills
		// sk(bonus, fieldRect[4], pipCx, pipCy, hasPip)
		// Pip cx/cy are exact checkbox centres from the PDF form fields
		const sk = (bonus, x0,top,x1,bot, pipCx,pipCy, hasPip) => {
			inField(bonus, x0,top,x1,bot, 7.5, true);
			if (hasPip) pip(pipCx, pipCy);
		};
		// STR
		sk(fmod(saveBonus("str")),           27.9,263.8, 45.5,276.8, 21.9,272.6, hasSave("str"));
		sk(fmod(skillBonus("Athletics")),    28.1,283.7, 45.5,296.7, 22.0,292.4, hasSkill("Athletics"));
		// DEX
		sk(fmod(saveBonus("dex")),           27.7,383.3, 45.1,396.3, 21.8,392.1, hasSave("dex"));
		sk(fmod(skillBonus("Acrobatics")),   27.9,403.2, 45.2,416.2, 21.6,411.9, hasSkill("Acrobatics"));
		sk(fmod(skillBonus("Sleight of Hand")),27.8,417.4, 45.2,430.4, 21.7,426.1, hasSkill("Sleight of Hand"));
		sk(fmod(skillBonus("Stealth")),      27.9,431.5, 45.3,444.5, 21.5,440.5, hasSkill("Stealth"));
		// CON
		sk(fmod(saveBonus("con")),           27.9,531.5, 45.3,544.5, 21.9,540.2, hasSave("con"));
		// INT
		sk(fmod(saveBonus("int")),          135.7,185.4,153.1,198.4, 129.7,194.2, hasSave("int"));
		sk(fmod(skillBonus("Arcana")),      135.7,205.1,153.0,218.2, 129.6,214.0, hasSkill("Arcana"));
		sk(fmod(skillBonus("History")),     135.9,219.4,153.3,232.4, 129.6,228.2, hasSkill("History"));
		sk(fmod(skillBonus("Investigation")),135.9,233.5,153.3,246.6, 129.4,242.6, hasSkill("Investigation"));
		sk(fmod(skillBonus("Nature")),      135.7,247.7,153.1,260.7, 129.8,256.8, hasSkill("Nature"));
		sk(fmod(skillBonus("Religion")),    135.5,261.9,152.9,274.9, 129.8,270.9, hasSkill("Religion"));
		// WIS
		sk(fmod(saveBonus("wis")),          135.7,361.6,153.1,374.7, 129.7,370.7, hasSave("wis"));
		sk(fmod(skillBonus("Animal Handling")),135.7,381.6,153.1,394.6, 129.8,390.5, hasSkill("Animal Handling"));
		sk(fmod(skillBonus("Insight")),     135.7,395.6,153.1,408.6, 129.7,404.7, hasSkill("Insight"));
		sk(fmod(skillBonus("Medicine")),    135.7,409.8,153.0,422.9, 129.7,419.1, hasSkill("Medicine"));
		sk(fmod(skillBonus("Perception")),  135.6,424.2,153.0,437.2, 129.9,433.3, hasSkill("Perception"));
		sk(fmod(skillBonus("Survival")),    135.6,438.4,153.0,451.4, 129.8,447.4, hasSkill("Survival"));
		// CHA
		sk(fmod(saveBonus("cha")),          135.8,538.2,153.2,551.2, 129.7,547.2, hasSave("cha"));
		sk(fmod(skillBonus("Deception")),   135.7,558.1,153.1,571.1, 129.5,567.0, hasSkill("Deception"));
		sk(fmod(skillBonus("Intimidation")),135.7,572.4,153.0,585.4, 129.7,581.2, hasSkill("Intimidation"));
		sk(fmod(skillBonus("Performance")), 135.7,586.6,153.1,599.6, 129.4,595.6, hasSkill("Performance"));
		sk(fmod(skillBonus("Persuasion")),  135.7,600.7,153.1,613.8, 129.8,609.8, hasSkill("Persuasion"));

		// Shield pip
		if (_hasEquippedShield) pip(344.4, 80.0);

		// Armor training pips (exact checkbox centres)
		const armorPips = {
			"Light":   [64.1,  661.8],
			"Medium":  [98.6,  661.3],
			"Heavy":   [143.5, 661.7],
			"Shields": [181.4, 661.3],
		};
		const allArmorProfs   = [...new Set([...(s.armorProfs||[]),   ...(s.featArmorProfs||[])])];
		const allWeaponProfs  = [...new Set([...(s.weaponProfs||[]),  ...(s.featWeaponProfs||[])])];
		const allToolProfs    = [...new Set([...(s.toolProfs||[]),    ...(s.bgToolProfs||[]), ...(s.featToolProfs||[]), ...(s.classToolChoices||[]).filter(Boolean)])];
		const allLanguages    = [...new Set([...(s.languages||[]),    ...(s.featLanguages||[])])];
		allArmorProfs.forEach(p => { if (armorPips[p]) pip(...armorPips[p]); });

		// Heroic inspiration - left blank for player

		// Proficiencies
		const _wpnMasteries = (s.weaponMasteries || []).filter(Boolean);
		const _weaponProfsText = [allWeaponProfs.join(", ") || allArmorProfs.join(", "), _wpnMasteries.length ? `Masteries: ${_wpnMasteries.join(", ")}` : ""].filter(Boolean).join("\n");
		inFieldML(_weaponProfsText,  17.8,682.2,208.9,732.4, 6.5);
		inFieldML(allToolProfs.join(", "),   16.8,741.8,209.2,762.5, 6.5);

		// Weapons table
		const wpnFields = [
			[[231.4,201.4,337.2,219.3],[341.9,203.0,385.5,219.2],[390.0,202.7,464.6,219.2],[468.8,202.3,594.4,219.4]],
			[[231.6,221.4,337.2,238.9],[341.6,221.6,385.6,238.8],[389.9,221.4,464.8,238.8],[469.1,222.3,594.4,238.8]],
			[[231.6,240.8,337.0,258.6],[341.5,241.4,385.6,258.6],[390.3,240.8,464.9,258.6],[469.1,240.8,594.0,258.6]],
			[[231.5,261.6,337.1,278.4],[341.4,261.8,385.3,278.3],[390.0,261.8,464.9,278.3],[469.0,260.5,594.3,278.3]],
			[[231.5,281.1,337.1,298.2],[341.4,281.0,385.5,298.1],[390.0,281.0,464.6,298.1],[468.9,280.8,594.3,298.0]],
			[[231.5,300.0,337.1,317.8],[341.7,300.2,385.2,317.7],[390.1,300.3,464.3,317.8],[468.9,300.3,594.0,317.8]],
		];
		const _hiddenWpn = new Set(s.weaponHidden || []);
		const _wpnOv = s.weaponOverrides || {};

		// Apply user overrides to auto-computed equipped weapons
		_equippedWeapons.forEach(w => {
			const ov = _wpnOv[w.name];
			if (!ov) return;
			if (ov.atkBonus) w.atkBonus = ov.atkBonus;
			if (ov.damage)   w.damage   = ov.damage;
			if (ov.notes)    w.notes    = ov.notes;
		});

		// Damage cantrips - pick correct scaling die for character level
		const _cantripWpns = (s.spells || [])
			.map(sp => {
				const data = this._getSpellEntry(sp.name);
				if (!data || data.level !== 0 || !data.damageInflict?.length) return null;
				if (_hiddenWpn.has(sp.name)) return null;
				const lvl = totalLevel;
				let die = "";
				if (data.scalingLevelDice?.scaling) {
					const thresholds = Object.keys(data.scalingLevelDice.scaling).map(Number).sort((a,b)=>a-b);
					const key = thresholds.filter(t => t <= lvl).pop() ?? thresholds[0];
					die = data.scalingLevelDice.scaling[key];
				}
				const dmgType = data.damageInflict[0] || "";
				const damage = die ? `${die} ${dmgType}` : dmgType;
				let atkBonus = "";
				if (data.spellAttack?.length) atkBonus = spellAtk != null ? fmod(spellAtk) : "";
				else if (data.savingThrow?.length) atkBonus = spellDC != null ? `DC ${spellDC}` : "";
				const ov = _wpnOv[sp.name];
				return {
					name:     sp.name,
					atkBonus: ov?.atkBonus || atkBonus,
					damage:   ov?.damage   || damage,
					notes:    ov?.notes    || "",
				};
			})
			.filter(Boolean);

		([
			..._equippedWeapons.filter(w => !_hiddenWpn.has(w.name)),
			..._cantripWpns,
			...(s.weapons||[]).filter(w => !_hiddenWpn.has(w.name)),
		]).slice(0,6).forEach((w,i) => {
			const [n,a,d,no] = wpnFields[i];
			inFieldL(v(w?.name),     n[0],n[1],n[2],n[3], 7.5);
			inField (v(w?.atkBonus), a[0],a[1],a[2],a[3], 7.5);
			inFieldL(v(w?.damage),   d[0],d[1],d[2],d[3], 7.5);
			inFieldL(v(w?.notes),    no[0],no[1],no[2],no[3], 7);
		});

		// Weapon masteries - displayed below weapons box
	const _masteries = (s.weaponMasteries || []).filter(Boolean);
	if (_masteries.length) {
		// masteries now rendered in proficiencies section
	}

	// Class features (two columns), species traits, feats
		const _cfTexts = [
			...(s.classFeatureItems || []).filter(i => !i.excluded).map(i => i.text),
			...(s._optionalFeatureSlots || []).flatMap(slot => {
				const chosen = ((s.optionalFeatureChoices || {})[slot.key] || []).filter(Boolean);
				return chosen.length ? [`${slot.name}: ${chosen.join(", ")}`] : [];
			}),
		];
		const _cfHalf  = Math.ceil(_cfTexts.length / 2);
		if (sheetMode === "extended") {
			inFieldML(_cfTexts.slice(0, _cfHalf).join("\n\n"),  232.1,361.2,407.9,770.3, 6.5);
			inFieldML(_cfTexts.slice(_cfHalf).join("\n\n"),     418.5,361.2,593.7,770.9, 6.5);
		} else {
			inFieldML(_cfTexts.slice(0, _cfHalf).join("\n\n"),  232.1,361.2,407.9,563.8, 6.5);
			inFieldML(_cfTexts.slice(_cfHalf).join("\n\n"),     418.5,361.2,593.7,563.4, 6.5);
			inFieldML((s.speciesTraitItems || []).filter(i => !i.excluded).map(i => i.text).join("\n"), 232.4,606.2,395.9,770.3, 6.5);
			inFieldML(this._buildFeatsDescription(),            419.1,605.5,595.3,770.9, 6.5);
		}

		// ═══════════════════ PAGE 2 ═══════════════════
		doc.addPage();
		doc.addImage(P2,"JPEG",0,0,PW,PH);
		doc.setTextColor(10,10,10);

		// Spellcasting - values aligned to their label midpoints, not the tall field rects
		if (spellAbilList.length <= 1) {
			inFieldAtY(spellAbilList[0] ? _ABILITY_FULL[spellAbilList[0]] : "", 24.9, 135.1, 27.8, 8, true);
			inFieldAtY(spellMod!=null ? fmod(spellMod+profBonus) : "", 13, 48, 63.5, 9, true);
			inFieldAtY(spellDC!=null  ? String(spellDC) : "",         13, 48, 91.7, 9, true);
			inFieldAtY(spellAtk!=null ? fmod(spellAtk)  : "",         13, 48, 119.8, 9, true);
		} else {
			// Multiple spellcasting abilities - join with " / ", shrink font to fit
			const abilNames = spellAbilList.map(a => _ABILITY_FULL[a] || a).join(" / ");
			inFieldAtY(abilNames, 24.9, 135.1, 27.8, abilNames.length > 22 ? 6 : 7, true);
			const mods = spellAbilList.map(a => fmod(abilMods[a] + profBonus)).join("/");
			const dcs  = spellAbilList.map(a => String(8 + profBonus + abilMods[a])).join("/");
			const atks = spellAbilList.map(a => fmod(profBonus + abilMods[a])).join("/");
			inFieldAtY(mods, 13, 48, 63.5,  8, true);
			inFieldAtY(dcs,  13, 48, 91.7,  8, true);
			inFieldAtY(atks, 13, 48, 119.8, 8, true);
		}

		// Spell slots - Total fields
		// Slot total fields ordered L1-L9. Each group has top/mid/bot rows:
		// Group1 x=184 (L1-3), Group2 x=274 (L4-6), Group3 x=354 (L7-9)
		// Within each group: top row = lower level, bottom row = higher level
		const slotTotFields = [
			[184.3, 88.8,199.4, 99.2],[184.3,103.2,199.4,113.6],[184.3,117.4,199.4,127.7], // L1,L2,L3
			[273.8, 89.0,288.8, 99.4],[273.8,103.3,288.8,113.6],[273.8,117.4,288.8,127.8], // L4,L5,L6
			[353.5, 88.9,368.5, 99.2],[353.5,103.2,368.5,113.6],[353.5,117.3,368.5,127.7], // L7,L8,L9
		];
		for (let i=0;i<9;i++) {
			const reg=(s.spellSlots||[])[i]||0;
			const pct=(s.pactSlots||[])[i]||0;
			const tot = reg && pct ? `${reg},${pct}` : reg ? String(reg) : pct ? String(pct) : "";
			if (tot) { const f=slotTotFields[i]; inField(tot,f[0],f[1],f[2],f[3],8,true); }
		}

		// Prepared spells (30 rows; level x0=17.7, name x0=42.9, cast x0=157, range x0=191.6, notes x0=309.2)
		// Row 1: top=182.7 (level "0" field), pitch=19.8
		// Spell properties (level, cast time, range, C/R/M) come from the spell data lookup.
		const spellsSorted = (s.spells||[]).map(sp => {
			const data = this._getSpellEntry(sp.name);
			return {
				name:          sp.name,
				notes:         sp.notes || "",
				level:         data?.level ?? null,
				castingTime:   data ? this._fmtSpellCastingTime(data) : "",
				range:         data ? this._fmtSpellRange(data) : "",
				concentration: data ? this._isSpellConcentration(data) : false,
				ritual:        data ? !!(data.meta?.ritual)  : false,
				material:      data ? !!(data.components?.m) : false,
			};
		}).sort((a,b) => (a.level ?? 99) - (b.level ?? 99));
		spellsSorted.slice(0,29).forEach((sp,i) => {
			const top=182.7+i*19.8, bot=top+16.2;
			if (top>770) return;
			inField(sp.level!=null?(sp.level===0?"C":String(sp.level)):"",  17.7,top, 38.1,bot, 7);
			inFieldL(v(sp.name).slice(0,28),           42.9,top,152.4,bot, 7);
			inFieldL(v(sp.castingTime).slice(0,12),   157.0,top,186.9,bot, 6.5);
			inFieldL(v(sp.range).slice(0,10),         191.6,top,233.5,bot, 6.5);
			inFieldL(v(sp.notes).slice(0,20),         309.2,top,396.7,bot, 6.5);
		});

		// Spell C/R/M pips - exact per-column cy values from PDF form fields
		const CRM_C_CY = [191.2,211.0,230.8,250.5,270.3,290.0,309.8,329.4,349.3,368.8,
			388.9,408.6,428.2,447.9,467.7,487.4,507.0,526.7,546.4,566.2,
			585.8,605.5,625.2,645.0,664.7,684.4,704.1,723.8,743.5,763.2];
		const CRM_R_CY = [190.9,210.7,230.4,250.2,269.9,289.7,309.5,329.2,349.1,368.6,
			388.6,408.3,427.9,447.6,467.5,487.2,506.8,526.5,546.2,566.0,
			585.6,605.3,625.0,644.7,664.4,684.1,703.9,723.6,743.3,763.0];
		const CRM_M_CY = [191.0,210.7,230.5,250.3,270.0,289.8,309.6,329.2,349.1,368.6,
			388.6,408.3,427.9,447.6,467.2,487.2,506.8,526.5,546.2,566.0,
			585.6,605.3,625.0,644.7,664.4,684.1,703.9,723.6,743.3,763.0];
		spellsSorted.forEach((sp, i) => {
			if (i >= 30) return;
			if (sp.concentration) pip(247.0, CRM_C_CY[i]);
			if (sp.ritual)        pip(268.9, CRM_R_CY[i]);
			if (sp.material)      pip(291.0, CRM_M_CY[i]);
		});

		// Magic item attunement pips
		const attuneFields = [[429.6,615.4],[429.4,635.7],[429.5,655.9]];
		(s.magicEquipment||[]).filter(it => it.attuned).slice(0,3).forEach((item,i) => {
			pip(...attuneFields[i]);
			inFieldL(item.name, 436, attuneFields[i][1]-6, 594, attuneFields[i][1]+6, 7);
		});

		// Right column
		inFieldML(v(s.appearance)||([ s.age&&`Age: ${s.age}`, s.height&&`Ht: ${s.height}`, s.weight&&`Wt: ${s.weight}`, s.eyes&&`Eyes: ${s.eyes}`, s.skin&&`Skin: ${s.skin}`, s.hair&&`Hair: ${s.hair}`].filter(Boolean).join(", ")),  417.9, 38.4,593.7,105.9, 6.5);
		inFieldML([s.personalityTraits&&`Traits: ${s.personalityTraits}`, s.ideals&&`Ideals: ${s.ideals}`, s.bonds&&`Bonds: ${s.bonds}`, s.flaws&&`Flaws: ${s.flaws}`, s.backstory].filter(Boolean).join(" | "), 418.5,146.4,594.3,283.6, 6.5);
		inFieldL (v(s.alignment),  419.2,294.2,594.0,310.4, 8);
		inFieldML(allLanguages.join(", "), 418.5,351.7,595.7,383.7, 6.5);
		inFieldML([...(s.equipment||[]), ...(s.magicEquipment||[])].map(it=>`${it.name||"?"}${it.qty&&it.qty!==1?` x${it.qty}`:""}`).join(", "), 418.9,421.4,594.3,597.5, 6.5);

		// Coins
		[[s.cp,418.5,717.4,450.7,737.5],[s.sp,455.1,717.9,486.7,738.0],[s.ep,491.2,717.7,522.8,737.8],[s.gp,526.7,717.3,558.3,737.5],[s.pp,562.4,717.9,594.0,738.0]]
			.forEach(([val,x0,t,x1,b]) => inField(v(val,"0"), x0,t,x1,b, 9, true));

		return doc;
	}
}
CharacterBuilder._STORAGE_KEY_SAVED = "characterBuilderSaved";
CharacterBuilder._STORAGE_KEY_PDF_SHEET_MODE = "characterBuilderPdfSheetMode";
