// Copyright 2021 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

/*
 * Copyright (C) IBM Corp. 2009  All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of IBM Corp. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

/* eslint-disable rulesdir/no_underscored_properties */

import * as Common from '../../core/common/common.js';
import * as Host from '../../core/host/host.js';
import * as i18n from '../../core/i18n/i18n.js';
import * as Platform from '../../core/platform/platform.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as ObjectUI from '../../ui/legacy/components/object_ui/object_ui.js';
import * as Components from '../../ui/legacy/components/utils/utils.js';
import * as UI from '../../ui/legacy/legacy.js';
import type * as Protocol from '../../generated/protocol.js';
import * as Bindings from '../../models/bindings/bindings.js';
import { executeRuntimeScript } from '../../ui/legacy/components/utils/DataBindingUtils.js';
import dataBindingModelsPanelToolbar from 'DataBindingModelsPanelToolbar.css.js';

const UIStrings = {
    addModel: 'Add new model',
    refreshModels: 'Refresh models',
    noModels: 'No models found',
    deleteAllModels: 'Delete all models',
    deletModel: 'Delete model',
    /**
    *@description Value element text content in Watch Expressions Sidebar Pane of the Sources panel
    */
    notAvailable: '<not available>',
    /**
    *@description A context menu item in the Watch Expressions Sidebar Pane of the Sources panel and Network pane request.
    */
    copyValue: 'Copy value',
    autoUpdateBindModels: 'When enabled the models will be automatically updated',
    watchForModelChanges: 'Watch for model changes',
    loadModels: 'Load models',
    exportModels: 'Export models',
    failedToExportModels: 'Failed to export models. Error: {PH1}',
    failedToLoadModelsError: 'Failed to load models from "{PH1}" file. {PH2}',
    failedToLoadModels: 'Failed to load models from "{PH1}" file.',
    modelChangesIntervalLabel: 'Watch interval (ms)'
};
const str_ = i18n.i18n.registerUIStrings('panels/sources/WatchExpressionsSidebarPane.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);
let dataBindingModelsViewInstance: DataBindingModelsPanelView;

const DEFAULT_WATCH_INTERVAL = 2000;
// Disabled for now
// enum BindModelActions {
//     DELETE = 'delete',
//     ADD = 'add',
//     RENAME = 'rename'
// }

export class DataBindingModelsPanelView extends UI.ThrottledWidget.ThrottledWidget implements
    UI.Toolbar.ItemsProvider, UI.Toolbar.WrappableProvider {
    _emptyElement!: HTMLElement;
    _bindModels: BindModel[];
    _bindModelsSetting: Common.Settings.Setting<string[]>;
    _treeOutline: ObjectUI.BindObjectPropertiesSection.ObjectPropertiesSectionsTreeOutline;
    _expandController: ObjectUI.BindObjectPropertiesSection.ObjectPropertiesSectionsTreeExpandController;
    _linkifier: Components.Linkifier.Linkifier;
    _autoUpdateBindModelsSetting: Common.Settings.Setting<boolean> = Common.Settings.Settings.instance().moduleSetting('autoUpdateBindModels');
    _watchIntervalValue: Common.Settings.Setting<number> = Common.Settings.Settings.instance().moduleSetting('autoUpdateBindModelsInterval');
    _toolbarItems: (UI.Toolbar.ToolbarButton | UI.Toolbar.ToolbarSettingCheckbox | UI.Toolbar.ToolbarSeparator | UI.Toolbar.ToolbarItem)[] = [];
    _fileSelectorElement: HTMLInputElement | null = null;
    _watchInterval: any;
    _intervalInput: HTMLInputElement | null = null;
    _inputIntervalWrapper: HTMLDivElement | null = null;
    _hasInitToobarStyles = false;
    private constructor() {
        super(true);

        this.registerRequiredCSS('ui/legacy/components/object_ui/objectValue.css');
        this.registerRequiredCSS('panels/sources/watchExpressionsSidebarPane.css');

        this.createToolbar();
        this._createFileSelector();

        this._watchInterval = null;

        this._bindModels = [];
        this._bindModelsSetting =
            Common.Settings.Settings.instance().createLocalSetting<string[]>('dataBindingModels', []);
        this._bindModelsSetting.set([]);
        this.contentElement.classList.add('watch-expressions');
        this.contentElement.addEventListener('contextmenu', this._contextMenu.bind(this), false);
        this._treeOutline = new ObjectUI.BindObjectPropertiesSection.ObjectPropertiesSectionsTreeOutline();
        this._treeOutline.registerRequiredCSS('panels/sources/watchExpressionsSidebarPane.css');
        this._treeOutline.setShowSelectionOnKeyboardFocus(/* show */ true);
        this._expandController =
            new ObjectUI.BindObjectPropertiesSection.ObjectPropertiesSectionsTreeExpandController(this._treeOutline);

        UI.Context.Context.instance().addFlavorChangeListener(SDK.RuntimeModel.ExecutionContext, this.update, this);
        UI.Context.Context.instance().addFlavorChangeListener(SDK.DebuggerModel.CallFrame, this.update, this);
        this._linkifier = new Components.Linkifier.Linkifier();

        this._emptyElement = (this.contentElement.createChild('div', 'gray-info-message') as HTMLElement);
        this._emptyElement.textContent = i18nString(UIStrings.noModels);
        this._emptyElement.tabIndex = -1;

        if (this._autoUpdateBindModelsSetting.get()) {
            this.addAutoRefreshInterval();
        }

        this.update();
    }

    static instance(opts: {
        forceNew: boolean | null,
    } = { forceNew: null }): DataBindingModelsPanelView {
        const { forceNew } = opts;
        if (!dataBindingModelsViewInstance || forceNew) {
            dataBindingModelsViewInstance = new DataBindingModelsPanelView();
        }

        return dataBindingModelsViewInstance;
    }

    addAutoRefreshInterval() {
        if (this._watchInterval) return;

        this._inputIntervalWrapper?.classList.remove('hidden');

        this._watchInterval = setInterval(() => this.update(), this._watchIntervalValue.get())
    }

    clearWatchInterval() {
        if (this._watchInterval) {
            this._inputIntervalWrapper?.classList.add('hidden');
            clearInterval(this._watchInterval);
            this._watchInterval = null;
        }
    }

    handleAutoUpdateSetting() {
        if (this._autoUpdateBindModelsSetting.get()) {
            this.addAutoRefreshInterval();
        } else {
            this.clearWatchInterval();
        }
    }

    createToolbar() {
        this._toolbarItems = [];

        const refreshButton =
            new UI.Toolbar.ToolbarButton(i18nString(UIStrings.refreshModels), 'largeicon-refresh');
        refreshButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.update, this);
        this._toolbarItems.push(refreshButton);

        this._toolbarItems.push(new UI.Toolbar.ToolbarSeparator());

        const loadModelsIcon = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.loadModels), 'largeicon-load');
        loadModelsIcon.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this._selectFileToLoad.bind(this));
        const exportModelsIcon = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.exportModels), 'largeicon-download');
        exportModelsIcon.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this._saveToFile.bind(this));

        this._toolbarItems.push(loadModelsIcon);
        this._toolbarItems.push(exportModelsIcon);

        this._toolbarItems.push(new UI.Toolbar.ToolbarSeparator());

        // Disable for now
        // const addButton = new UI.Toolbar.ToolbarButton(i18nString(UIStrings.addModel), 'largeicon-add');
        // addButton.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this._addButtonClicked, this);
        // this._toolbarItems.push(addButton);

        this._autoUpdateBindModelsSetting.addChangeListener(this.handleAutoUpdateSetting.bind(this));

        this._toolbarItems.push(new UI.Toolbar.ToolbarSettingCheckbox(
            this._autoUpdateBindModelsSetting, i18nString(UIStrings.autoUpdateBindModels), i18nString(UIStrings.watchForModelChanges)));

        this._intervalInput = Object.assign(document.createElement('input') as HTMLInputElement, {
            type: 'number',
            inputMode: 'numeric',
            pattern: '\\d*',
            className: 'update-models-interval-input',
        });
        this._intervalInput.addEventListener('blur', this.handleWatchIntervalChange.bind(this));
        if (!this._watchIntervalValue.get()) {
            this._watchIntervalValue.set(DEFAULT_WATCH_INTERVAL);
            this._intervalInput.value = String(DEFAULT_WATCH_INTERVAL);
        } else {
            this._intervalInput.value = String(this._watchIntervalValue.get());
        }

        this._inputIntervalWrapper = document.createElement('div');
        this._inputIntervalWrapper.classList.add('hidden');

        const inputLabel = document.createElement('span');
        inputLabel.textContent = i18nString(UIStrings.modelChangesIntervalLabel);
        inputLabel.classList.add('update-models-interval-label');

        const separator = document.createElement('div');
        separator.classList.add('toolbar-divider');
        this._inputIntervalWrapper.appendChild(separator);
        this._inputIntervalWrapper.appendChild(inputLabel);
        this._inputIntervalWrapper.appendChild(this._intervalInput);

        const inputToolbarItem = new UI.Toolbar.ToolbarItem(this._inputIntervalWrapper);
        this._toolbarItems.push(inputToolbarItem);
    }

    wasShown(): void {
        super.wasShown();
        if (this._updateWhenVisible) {
            this.update();
        }
    }

    handleWatchIntervalChange() {
        if (!this._intervalInput!.value) {
            this._intervalInput!.value = String(this._watchIntervalValue.get());
            return;
        }

        const value = parseInt(this._intervalInput!.value);

        if (value === this._watchInterval) return;

        this._watchIntervalValue.set(value);

        this.clearWatchInterval();
        this.addAutoRefreshInterval();
    }

    _createFileSelector(): void {
        if (this._fileSelectorElement) {
            this._fileSelectorElement.remove();
        }
        this._fileSelectorElement = UI.UIUtils.createFileSelectorElement(this._loadFromFile.bind(this));
        this.element.appendChild(this._fileSelectorElement);
    }

    _selectFileToLoad(): void {
        if (this._fileSelectorElement) {
            this._fileSelectorElement.click();
        }
    }

    async readFileData(file: File) {
        const outputStream = new Common.StringOutputStream.StringOutputStream();
        const reader = new Bindings.FileUtils.ChunkedFileReader(file, /* chunkSize */ 10000000);
        const success = await reader.read(outputStream);
        if (!success) {
            const error = reader.error();
            if (error) throw new Error(error.message);

            return null;
        }

        return JSON.parse(outputStream.data());
    }

    async _loadFromFile(file: File): Promise<void> {
        let models = null;
        try {
            models = await this.readFileData(file);
        } catch (error: any | { message: string }) {
            Common.Console.Console.instance().error(i18nString(UIStrings.failedToLoadModelsError, { PH1: file.name, PH2: error?.message }));
        }

        if (!models || !await this.importModels(models)) {
            Common.Console.Console.instance().error(i18nString(UIStrings.failedToLoadModels, { PH1: file.name }));
        }
        this._createFileSelector();
    }

    async _saveToFile(): Promise<void> {
        const models = await this.getAllModelsData();
        if (!models) return;

        const now = new Date();
        const fileName = 'Models-' + Platform.DateUtilities.toISO8601Compact(now) + '.json';
        const stream = new Bindings.FileUtils.FileOutputStream();

        const accepted = await stream.open(fileName);
        if (!accepted) return;

        const backingStorage = new Bindings.TempFile.TempFileBackingStorage();
        backingStorage.appendString(JSON.stringify(models, undefined, 2));
        backingStorage.finishWriting();

        const error = (await backingStorage.writeToStream(stream) as {
            message: string,
            name: string,
            code: number,
        } | null);
        if (!error) return;

        Common.Console.Console.instance().error(
            i18nString(UIStrings.failedToExportModels, { PH1: error.message, PH2: error.name, PH3: error.code }));
    }

    async getModelNamesData() {
        const domModel = SDK.TargetManager.TargetManager.instance().mainTarget()?.model(SDK.DOMModel.DOMModel)
        const res = await domModel?.getDataBindingModelNames();
        if (!res || !res.models) return [];

        return res.models;
    }

    async getAllModelsData() {
        const domModel = SDK.TargetManager.TargetManager.instance().mainTarget()?.model(SDK.DOMModel.DOMModel)
        const res = await domModel?.getDataBindingModels();
        if (!res) return {};

        return res;
    }

    async importModels(data: object) {
        const domModel = SDK.TargetManager.TargetManager.instance().mainTarget()?.model(SDK.DOMModel.DOMModel)
        const res = await domModel?.importDataBindingModels(data);
        if (!res || res.getError()) return false;

        return true;
    }

    toolbarItems(): UI.Toolbar.ToolbarItem[] {
        return this._toolbarItems;
    }

    toolbarWrappable() {
        return true;
    }

    focus(): void {
        if (this.hasFocus()) {
            return;
        }
        if (this._bindModels.length > 0) {
            this._treeOutline.forceSelect();
        }
    }

    hasModels(): boolean {
        return Boolean(this._bindModelsSetting.get().length);
    }

    _saveModels(): void {
        const toSave = [];
        for (let i = 0; i < this._bindModels.length; i++) {
            const model = this._bindModels[i].modelName;
            if (model) toSave.push(model);
        }

        this._bindModelsSetting.set(toSave);
    }

    async doUpdate(): Promise<void> {
        if (!this._hasInitToobarStyles) {
            const toolbar = this.parentWidget()?.element.querySelector('.toolbar') as HTMLElement | null;
            if (toolbar && toolbar.shadowRoot) {
                toolbar.shadowRoot.adoptedStyleSheets = [...toolbar.shadowRoot.adoptedStyleSheets, dataBindingModelsPanelToolbar];
                this._hasInitToobarStyles = true;
            }
        }
        const modelNames = await this.getModelNamesData();
        this._emptyElement.classList.toggle('hidden', !!modelNames.length);

        for (let i = 0; i < modelNames.length; ++i) {
            const modelName = modelNames[i];
            const bindModel = this._bindModels[i];
            if (!bindModel) {
                this._createBindModel(modelName);
            } else {
                if (bindModel.modelName !== modelName) {
                    bindModel._expandController.stopWatchSectionsWithId(bindModel.modelName as string);
                    bindModel.modelName = modelName;
                }
                bindModel.update();
            }
        }

        if (this._bindModels.length > modelNames.length) {
            for (let i = modelNames.length; i < this._bindModels.length; i++) {
                this._treeOutline.removeChild(this._bindModels[i].treeElement());
            }

            this._bindModels.splice(modelNames.length, this._bindModels.length);
        }

        this._bindModelsSetting.set(modelNames);

        return Promise.resolve();
    }

    _createBindModel(modelName: string | null): BindModel {
        this.contentElement.appendChild(this._treeOutline.element);
        const bindModel = new BindModel(modelName, this._expandController, this._linkifier);
        // Disabled for now
        // bindModel.addEventListener(BindModel.Events.ModelUpdated, this._bindModelUpdated, this);
        this._treeOutline.appendChild(bindModel.treeElement());
        this._bindModels.push(bindModel);
        return bindModel;
    }

    // Disabled for now
    // async _bindModelUpdated(event: Common.EventTarget.EventTargetEvent): Promise<void> {
    //     const { bindModelObject, newModel, action } = (event.data as { bindModelObject: BindModel, newModel: string, action: BindModelActions });
    //     switch (action) {
    //         case BindModelActions.DELETE: {
    //             Platform.ArrayUtilities.removeElement(this._bindModels, bindModelObject);
    //             this._treeOutline.removeChild(bindModelObject.treeElement());
    //             this._emptyElement.classList.toggle('hidden', Boolean(this._bindModels.length));
    //             if (this._bindModels.length === 0) {
    //                 this._treeOutline.element.remove();
    //             }
    //             await Components.DataBindingUtils.unregisterBindModel(bindModelObject.model!);
    //             break;
    //         }
    //         case BindModelActions.ADD: {
    //             if (this._bindModels.find((bindModel) => bindModel.model === newModel)) {
    //                 console.warn(`Unable to add model with name '${newModel}' because it already exists!`);
    //                 break;
    //             }

    //             await Components.DataBindingUtils.createBindModel(newModel);
    //             bindModelObject._model = newModel;
    //             break;
    //         }
    //         case BindModelActions.RENAME: {
    //             if (bindModelObject.model === newModel) break;
    //             if (this._bindModels.find((bindModel) => bindModel.model === newModel)) {
    //                 console.warn(`Unable to rename model with name '${newModel}' because it already exists!`);
    //                 break;
    //             }
    //             await Components.DataBindingUtils.renameBindModel(newModel, bindModelObject.model!);
    //             bindModelObject._model = newModel;
    //             break;
    //         }
    //         default: break;
    //     }

    //     bindModelObject.update();
    //     this._saveModels();
    // }

    _contextMenu(event: MouseEvent): void {
        const contextMenu = new UI.ContextMenu.ContextMenu(event);
        this._populateContextMenu(contextMenu, event);
        contextMenu.show();
    }

    // Disable for now
    // async _addButtonClicked(): Promise<void> {
    //     this._emptyElement.classList.add('hidden');
    //     this._createBindModel(null).startEditing();
    // }

    _populateContextMenu(contextMenu: UI.ContextMenu.ContextMenu, event: MouseEvent): void {
        // Disable for now
        // let isEditing = false;
        // for (const bindModel of this._bindModels) {
        //     isEditing = isEditing || bindModel.isEditing();
        // }

        // if (!isEditing) {
        //     contextMenu.debugSection().appendItem(
        //         i18nString(UIStrings.addModel), this._addButtonClicked.bind(this));
        // }

        // if (this._bindModels.length > 1) {
        //     contextMenu.debugSection().appendItem(
        //         i18nString(UIStrings.deleteAllModels), this._deleteAllButtonClicked.bind(this));
        // }

        const treeElement = this._treeOutline.treeElementFromEvent(event);
        if (!treeElement) {
            return;
        }
        const currentBindModel =
            this._bindModels.find(bindModel => treeElement.hasAncestorOrSelf(bindModel.treeElement()));
        if (currentBindModel) {
            currentBindModel._populateContextMenu(contextMenu, event);
        }
    }

    // Disabled for now
    // _deleteAllButtonClicked(): void {
    //     this._bindModels = [];
    //     this._saveModels();
    //     this.update();
    // }
}

export class BindModel extends Common.ObjectWrapper.ObjectWrapper {
    _treeElement!: ObjectUI.BindObjectPropertiesSection.RootElement;
    _nameElement!: Element;
    _valueElement!: Element;
    _modelName!: string | null
    _expandController: ObjectUI.BindObjectPropertiesSection.ObjectPropertiesSectionsTreeExpandController;
    _element: HTMLDivElement;
    _editing: boolean;
    _linkifier: Components.Linkifier.Linkifier;
    _textPrompt?: ObjectUI.BindObjectPropertiesSection.ObjectPropertyPrompt;
    _result?: SDK.RemoteObject.RemoteObject | null;
    _preventClickTimeout?: number;
    hideValueElement: () => void;
    showValueElement: () => void;
    constructor(
        modelName: string | null,
        expandController: ObjectUI.BindObjectPropertiesSection.ObjectPropertiesSectionsTreeExpandController,
        linkifier: Components.Linkifier.Linkifier) {
        super();

        this._modelName = modelName;
        this._expandController = expandController;
        this._element = document.createElement('div');
        this._element.classList.add('watch-expression');
        this._element.classList.add('monospace');
        this._editing = false;
        this._linkifier = linkifier;
        this.hideValueElement = this.toggleModelValue.bind(this, false);
        this.showValueElement = this.toggleModelValue.bind(this, true);

        this._createBindModel();
        this.update();
    }

    treeElement(): UI.TreeOutline.TreeElement {
        return this._treeElement;
    }

    get modelName(): string | null {
        return this._modelName;
    }

    set modelName(value: string | null) {
        this._modelName = value;
    }

    update(): void {
        if (this._modelName) {
            const domModel = SDK.TargetManager.TargetManager.instance().mainTarget()?.model(SDK.DOMModel.DOMModel)
            domModel?.getDataBindingModels(false, this._modelName).then((res) => {
                //@ts-ignore
                if (res && res[this._modelName]) {
                    //@ts-ignore
                    const remoteObject = SDK.RemoteObject.RemoteObject.fromLocalObject(res[this._modelName]);
                    this._updateBindModel(remoteObject);
                } else {
                    this._updateBindModel();
                }
            });
        } else {
            this._updateBindModel();
        }
    }

    // Disabled for now
    // startEditing(): void {
    //     this._editing = true;
    //     this._treeElement.setDisableSelectFocus(true);
    //     this._element.removeChildren();
    //     const newDiv = this._element.createChild('div');
    //     newDiv.textContent = this._nameElement.textContent;
    //     this._textPrompt = new ObjectUI.BindObjectPropertiesSection.ObjectPropertyPrompt();
    //     this._textPrompt.renderAsBlock();
    //     const proxyElement =
    //         (this._textPrompt.attachAndStartEditing(newDiv, this._finishEditing.bind(this)) as HTMLElement);
    //     this._treeElement.listItemElement.classList.add('watch-expression-editing');
    //     this._treeElement.collapse();
    //     proxyElement.classList.add('watch-expression-text-prompt-proxy');
    //     proxyElement.addEventListener('keydown', this._promptKeyDown.bind(this), false);
    //     const selection = this._element.getComponentSelection();
    //     if (selection) {
    //         selection.selectAllChildren(newDiv);
    //     }
    // }

    isEditing(): boolean {
        return Boolean(this._editing);
    }

    // Disabled for now
    // _finishEditing(event: Event, canceled?: boolean): void {
    //     if (event) {
    //         event.consume(canceled);
    //     }

    //     this._editing = false;
    //     this._treeElement.setDisableSelectFocus(false);
    //     this._treeElement.listItemElement.classList.remove('watch-expression-editing');
    //     if (this._textPrompt) {
    //         this._textPrompt.detach();
    //         const newModel = canceled ? this._modelName : this._textPrompt.text();
    //         this._textPrompt = undefined;
    //         this._element.removeChildren();
    //         this._updateModel(BindModelActions.RENAME, newModel);
    //     }
    // }

    // _dblClickOnBindModel(event: Event): void {
    //     event.consume();
    //     if (!this.isEditing()) {
    //         this.startEditing();
    //     }
    // }

    // _updateModel(action: BindModelActions, newModel: string | null): void {
    //     if (this._modelName) {
    //         this._expandController.stopWatchSectionsWithId(this._modelName);
    //     }

    //     let processedAction;
    //     // Handle action if it is RENAME. We have three scenarions here - if you add new model, if you delete model or if you rename it.
    //     if (action === BindModelActions.RENAME) {
    //         if ((this._modelName === '' || this._modelName === null) && newModel !== null && newModel !== '') processedAction = BindModelActions.ADD;
    //         else if (this._modelName !== '' && (newModel === null || newModel === '')) processedAction = BindModelActions.DELETE;
    //         else processedAction = BindModelActions.RENAME;
    //     } else {
    //         processedAction = action;
    //     }

    //     this.dispatchEventToListeners(BindModel.Events.ModelUpdated, { bindModelObject: this, newModel, action: processedAction });
    // }

    // _deleteModel(event: Event): void {
    //     event.consume(true);
    //     this._updateModel(BindModelActions.DELETE, null);
    // }

    _createBindModel(result?: SDK.RemoteObject.RemoteObject, exceptionDetails?: Protocol.Runtime.ExceptionDetails):
        void {
        this._result = result || null;

        this._element.removeChildren();
        const oldTreeElement = this._treeElement;
        this._createBindModelTreeElement(result, exceptionDetails);
        if (oldTreeElement && oldTreeElement.parent) {
            const root = oldTreeElement.parent;
            const index = root.indexOfChild(oldTreeElement);
            root.removeChild(oldTreeElement);
            root.insertChild(this._treeElement, index);
        }
        this._treeElement.select();
    }

    _updateBindModel(result?: SDK.RemoteObject.RemoteObject, exceptionDetails?: Protocol.Runtime.ExceptionDetails): void {
        this._result = result || null;
        this._updateBindModelTreeElement(result, exceptionDetails);
    }

    _createBindModelHeader(modelValue?: SDK.RemoteObject.RemoteObject, exceptionDetails?: Protocol.Runtime.ExceptionDetails): Element {
        const headerElement = this._element.createChild('div', 'watch-expression-header');
        const titleElement = headerElement.createChild('div', 'watch-expression-title tree-element-title');

        // Disabled for now
        // const deleteButton = UI.Icon.Icon.create('smallicon-cross', 'watch-expression-delete-button');
        // UI.Tooltip.Tooltip.install(deleteButton, i18nString(UIStrings.deletModel));
        // deleteButton.addEventListener('click', this._deleteModel.bind(this), false);
        // titleElement.appendChild(deleteButton);

        this._nameElement = ObjectUI.BindObjectPropertiesSection.BindObjectPropertiesSection.createNameElement(this._modelName);
        if (Boolean(exceptionDetails) || !modelValue) {
            this._valueElement = document.createElement('span');
            this._valueElement.classList.add('watch-expression-error');
            this._valueElement.classList.add('value');
            titleElement.classList.add('dimmed');
            this._valueElement.textContent = i18nString(UIStrings.notAvailable);
            if (exceptionDetails !== undefined && exceptionDetails.exception !== undefined &&
                exceptionDetails.exception.description !== undefined) {
                UI.Tooltip.Tooltip.install(this._valueElement as HTMLElement, exceptionDetails.exception.description);
            }
        } else {
            const propertyValue =
                ObjectUI.BindObjectPropertiesSection.BindObjectPropertiesSection.createPropertyValueWithCustomSupport(
                    modelValue, Boolean(exceptionDetails), false /* showPreview */, titleElement, this._linkifier);
            this._valueElement = propertyValue.element;
        }
        const separatorElement = document.createElement('span');
        separatorElement.classList.add('watch-expressions-separator');
        separatorElement.textContent = ': ';
        titleElement.append(this._nameElement, separatorElement, this._valueElement);

        return headerElement;
    }

    _updateBindModelHeader(modelValue?: SDK.RemoteObject.RemoteObject, exceptionDetails?: Protocol.Runtime.ExceptionDetails): void {
        const titleElement = this._element.querySelector('.tree-element-title');

        ObjectUI.BindObjectPropertiesSection.BindObjectPropertiesSection.updateNameElement(this._nameElement, this._modelName);
        if (Boolean(exceptionDetails) || !modelValue) {
            this._valueElement.classList.add('watch-expression-error');
            this._valueElement.classList.add('value');
            titleElement!.classList.add('dimmed');
            this._valueElement.textContent = i18nString(UIStrings.notAvailable);
            if (exceptionDetails !== undefined && exceptionDetails.exception !== undefined &&
                exceptionDetails.exception.description !== undefined) {
                UI.Tooltip.Tooltip.install(this._valueElement as HTMLElement, exceptionDetails.exception.description);
            }
        } else {
            titleElement!.classList.remove('dimmed');
            const propertyValue =
                ObjectUI.BindObjectPropertiesSection.BindObjectPropertiesSection.createPropertyValueWithCustomSupport(
                    modelValue, Boolean(exceptionDetails), false /* showPreview */, titleElement!, this._linkifier);
            titleElement?.removeChild(this._valueElement);
            this._valueElement = propertyValue.element;
            titleElement?.appendChild(this._valueElement);
        }

        this.toggleModelValue(!this._treeElement.expanded);
    }

    toggleModelValue(visible: boolean) {
        if (this._valueElement) this._valueElement.classList.toggle('hidden', !visible);
    }

    _createBindModelTreeElement(modelValue?: SDK.RemoteObject.RemoteObject, exceptionDetails?: Protocol.Runtime.ExceptionDetails): void {
        const headerElement = this._createBindModelHeader(modelValue, exceptionDetails);

        if (!exceptionDetails && modelValue && modelValue.hasChildren && !modelValue.customPreview()) {
            headerElement.classList.add('watch-expression-object-header');
            this._treeElement = new ObjectUI.BindObjectPropertiesSection.RootElement(this._modelName, modelValue, this._linkifier);
            this._expandController.watchSection(this._modelName as string, this._treeElement);
            this._treeElement.toggleOnClick = false;
            this._treeElement.listItemElement.addEventListener('click', this._onSectionClick.bind(this), false);
            // Disabled for now
            // this._treeElement.listItemElement.addEventListener('dblclick', this._dblClickOnBindModel.bind(this));
        } else {
            // Disabled for now
            // headerElement.addEventListener('dblclick', this._dblClickOnBindModel.bind(this));
            this._treeElement = new ObjectUI.BindObjectPropertiesSection.RootElement(this._modelName, modelValue);
        }
        this._treeElement.title = this._element;
        this._treeElement.listItemElement.classList.add('watch-expression-tree-item');

        // Disabled for now
        // this._treeElement.listItemElement.addEventListener('keydown', event => {
        //     if (event.key === 'Enter' && !this.isEditing()) {
        //         this.startEditing();
        //         event.consume(true);
        //     }
        // });
    }

    _updateBindModelTreeElement(modelValue?: SDK.RemoteObject.RemoteObject, exceptionDetails?: Protocol.Runtime.ExceptionDetails): void {
        this._updateBindModelHeader(modelValue, exceptionDetails);

        this._treeElement.update(this._modelName, modelValue);
        if (!exceptionDetails && modelValue && modelValue.hasChildren && !modelValue.customPreview()) {
            this._expandController.watchSection(this._modelName as string, this._treeElement);
        }
    }

    _onSectionClick(event: Event): void {
        event.consume(true);
        if (!this._treeElement) {
            return;
        }

        if (this._treeElement.expanded) {
            this._treeElement.collapse();
            this.showValueElement();
        } else if (!this._editing) {
            this._treeElement.expand();
            this.hideValueElement();
        }

        // Disabled for now
        // const mouseEvent = (event as MouseEvent);
        // if (mouseEvent.detail === 1) {
        //     this._preventClickTimeout = window.setTimeout(handleClick.bind(this), 333);
        // } else if (this._preventClickTimeout !== undefined) {
        //     window.clearTimeout(this._preventClickTimeout);
        //     this._preventClickTimeout = undefined;
        // }

        // function handleClick(this: BindModel): void {
        //     if (!this._treeElement) {
        //         return;
        //     }

        //     if (this._treeElement.expanded) {
        //         this._treeElement.collapse();
        //     } else if (!this._editing) {
        //         this._treeElement.expand();
        //     }
        // }
    }

    // Disabled for now
    // _promptKeyDown(event: KeyboardEvent): void {
    //     if (event.key === 'Enter' || isEscKey(event)) {
    //         this._finishEditing(event, isEscKey(event));
    //     }
    // }

    _populateContextMenu(contextMenu: UI.ContextMenu.ContextMenu, event: Event): void {
        // Disabled for now
        // if (!this.isEditing()) {
        //     contextMenu.editSection().appendItem(
        //         i18nString(UIStrings.deletModel), this._updateModel.bind(this, BindModelActions.DELETE, null));
        // }

        if (!this.isEditing() && this._result && (this._result.type === 'number' || this._result.type === 'string')) {
            contextMenu.clipboardSection().appendItem(
                i18nString(UIStrings.copyValue), this._copyValueButtonClicked.bind(this));
        }

        const target = UI.UIUtils.deepElementFromEvent(event);
        if (target && this._valueElement.isSelfOrAncestor(target) && this._result) {
            contextMenu.appendApplicableItems(this._result);
        }
    }

    _copyValueButtonClicked(): void {
        Host.InspectorFrontendHost.InspectorFrontendHostInstance.copyText(this._valueElement.textContent);
    }

    public static readonly watchObjectGroupId = 'watch-group';
}

export namespace BindModel {
    // TODO(crbug.com/1167717): Make this a const enum again
    // eslint-disable-next-line rulesdir/const_enum
    export const Events = {
        ModelUpdated: Symbol('ModelUpdated'),
    };
}
