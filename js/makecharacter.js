import {BuilderBase} from "./makebrew/makebrew-builder-base.js";
import { CharacterBuilder } from "./makebrew/character-builder.js";
import {TagCondition, TaggerUtils} from "./converter/converterutils-tags.js";

class PageUi {
	constructor () {
		this._builders = {};

		this._eleMenuInner = null;
		this._wrpSource = null;
		this._wrpMain = null;
		this._wrpInput = null;
		this._wrpInputControls = null;
		this._wrpOutput = null;

		this._isInitialLoad = true;
		this.doSaveDebounced = MiscUtil.debounce(() => this._doSave(), 50);

		this._settings = {};
		this._saveSettingsDebounced = MiscUtil.debounce(() => this._doSaveSettings(), 50);
	}

	set characterBuilder(characterBuilder) { this._builders.characterBuilder = characterBuilder; }

	get builders () { return this._builders; }

	get activeBuilder () { return this._settings.activeBuilder || PageUi._DEFAULT_ACTIVE_BUILDER; }

	get wrpInput () { return this._wrpInput; }

	get wrpInputControls () { return this._wrpInputControls; }

	get wrpOutput () { return this._wrpOutput; }

	get wrpSideMenu () { return this._eleMenuInner; }


	_doSave () {
		if (this._isInitialLoad) return;
		return StorageUtil.pSetForPage(
			PageUi._STORAGE_STATE,
			{
				builders: Object.entries(this._builders).mergeMap(([name, builder]) => ({[name]: builder.getSaveableState()})),
			},
		);
	}

	_doSaveSettings () { return StorageUtil.pSetForPage(PageUi._STORAGE_SETTINGS, this._settings); }

	async init () {
		this._settings = await StorageUtil.pGetForPage(PageUi._STORAGE_SETTINGS) || {};

		this._wrpLoad = es(`#page_loading`);
		this._wrpSource = es(`#page_source`);
		this._wrpMain = es(`#page_main`);

		this._settings.activeBuilder = this._settings.activeBuilder || PageUi._DEFAULT_ACTIVE_BUILDER;

		this._initLhs();
		this._initRhs();
		await this._pInitSideMenu();

		const storedState = await StorageUtil.pGetForPage(PageUi._STORAGE_STATE) || {};
		if (storedState.builders) {
			Object.entries(storedState.builders).forEach(([name, state]) => {
				if (this._builders[name]) this._builders[name].setStateFromLoaded(state);
			});
		}

		this._doRenderActiveBuilder();
		this._doInitNavHandler();

		this.__setStageMain();
		this._sideMenuEnabled = true;

		this._isInitialLoad = false;
	}

	__setStageMain () {
		this._wrpLoad.hideVe();
		this._wrpSource.hideVe();
		this._wrpMain.showVe();
	}


	_initLhs () {
		this._wrpInput = es(`#content_input`);
		this._wrpInputControls = es(`#content_input_controls`);
	}

	_initRhs () {
		this._wrpOutput = es(`#content_output`);
	}

	getBuilderById (id) {
		id = id.toLowerCase().trim();
		const key = Object.keys(this._builders).find(k => k.toLowerCase().trim() === id);
		if (key) return this._builders[key];
	}

	async pSetActiveBuilderById (id) {
		id = id.toLowerCase().trim();
		const key = Object.keys(this._builders).find(k => k.toLowerCase().trim() === id);
		await this._pSetActiveBuilder(key);
	}

	async _pSetActiveBuilder (nxtActiveBuilder) {
		if (!this._builders[nxtActiveBuilder]) throw new Error(`Builder "${nxtActiveBuilder}" does not exist!`);

		this._settings.activeBuilder = nxtActiveBuilder;
		if (!Hist.initialLoad) Hist.replaceHistoryHash(UrlUtil.encodeForHash(this._settings.activeBuilder));
		const builder = this._builders[this._settings.activeBuilder];
		builder.renderInput();
		builder.renderOutput();
		await builder.pRenderSideMenu();
		this._saveSettingsDebounced();
	}

	async _pInitSideMenu () {
		const mnu = es(`.sidemenu`);

		const prevMode = this._settings.activeBuilder;

		this._eleMenuInner = ee`<div></div>`.appendTo(mnu);

		if (prevMode) await this._pSetActiveBuilder(prevMode);
	}

	set _sideMenuEnabled (val) { es(`.sidemenu__toggle`).toggleVe(!!val); }

	_doRenderActiveBuilder () {
		const activeBuilder = this._builders[this._settings.activeBuilder];
		activeBuilder.renderInput();
		activeBuilder.renderOutput();
	}

	_doInitNavHandler () {
		// More obnoxious than useful (the form is auto-saved automatically); disabled until further notice
		/*
		$(window).on("beforeunload", evt => {
			const message = this._builders[this._settings.activeBuilder].getOnNavMessage();
			if (message) {
				(evt || window.event).message = message;
				return message;
			}
		});
		*/
	}

	_getJsonOutputTemplate () {
		const timestamp = Math.round(Date.now() / 1000);
		return {dateAdded: timestamp, dateLastModified: timestamp};
	}
}
PageUi._STORAGE_STATE = "characterBuilderState";
PageUi._STORAGE_SETTINGS = "characterBuilderSettings";
PageUi._DEFAULT_ACTIVE_BUILDER = "characterBuilder";

class Makecharacter {
	static async doPageInit () {
		Makecharacter._LOCK = new VeLock();

		// generic init
		await Promise.all([
			PrereleaseUtil.pInit(),
			BrewUtil2.pInit(),
		]);
		ExcludeUtil.pInitialise().then(null); // don't await, as this is only used for search
		await this.pPrepareExistingEditableBrew();
		const brew = await BrewUtil2.pGetBrewProcessed();
		await SearchUiUtil.pDoGlobalInit();
		// Do this asynchronously, to avoid blocking the load
		SearchWidget.pDoGlobalInit();

		TaggerUtils.init({legendaryGroups: await DataUtil.legendaryGroup.pLoadAll(), spells: await DataUtil.spell.pLoadAll()});
		await TagCondition.pInit({conditionsBrew: brew.condition});

		// page-specific init
		await BuilderBase.pInitAll();
		Renderer.utils.bindPronounceButtons();
		await ui.init();

		if (window.location.hash.length) await Makecharacter.pHashChange();
		window.addEventListener("hashchange", Makecharacter.pHashChange.bind(Makecharacter));

		window.dispatchEvent(new Event("toolsLoaded"));
	}

	/**
	 * The editor requires that each entity has a `uniqueId`, as e.g. hashing the entity does not produce a
	 * stable ID (since there may be duplicates, or the name may change).
	 */
	static async pPrepareExistingEditableBrew () {
		const brew = MiscUtil.copy(await BrewUtil2.pGetOrCreateEditableBrewDoc());

		let isAnyMod = false;
		Object.values(ui.builders)
			.forEach(builder => {
				const isAnyModBuilder = builder.prepareExistingEditableBrew({brew});
				isAnyMod = isAnyMod || isAnyModBuilder;
			});

		if (!isAnyMod) return;

		await BrewUtil2.pSetEditableBrewDoc(brew);
	}

	static async pHashChange () {
		try {
			await Makecharacter._LOCK.pLock();
			return (await this._pHashChange());
		} finally {
			Makecharacter._LOCK.unlock();
		}
	}

	static async _pHashChange () {
		const [builderMode, ...sub] = Hist.getHashParts();
		Hist.initialLoad = false; // Once we've extracted the hash's parts, we no longer care about preserving it

		if (!builderMode) return Hist.replaceHistoryHash(UrlUtil.encodeForHash(ui.activeBuilder));

		const builder = ui.getBuilderById(builderMode);
		if (!builder) return Hist.replaceHistoryHash(UrlUtil.encodeForHash(ui.activeBuilder));

		await ui.pSetActiveBuilderById(builderMode); // (This will update the hash to the active builder)

		if (!sub.length) return;

		const initialLoadMeta = UrlUtil.unpackSubHash(sub[0]);
		if (!initialLoadMeta.statemeta) return;

		const [page, source, hash] = initialLoadMeta.statemeta;
		const toLoadOriginal = await DataLoader.pCacheAndGet(page, source, hash, {isCopy: true});

		const {toLoad, isAllowEditExisting} = await builder._pHashChange_pHandleSubHashes(sub, toLoadOriginal);

		if (
			!isAllowEditExisting
			|| !BrewUtil2.hasSourceJson(toLoad.source)
			|| !toLoad.uniqueId
		) return builder.pHandleSidebarLoadExistingData(toLoad, {isForce: true});

		return builder.pHandleSidebarEditUniqueId(toLoad.uniqueId);
	}
}
Makecharacter._LOCK = null;

const ui = new PageUi();

const characterBuilder = new CharacterBuilder();
ui.characterBuilder = characterBuilder;
characterBuilder.ui = ui;

window.addEventListener("load", async () => {
	await Makecharacter.doPageInit();
});
