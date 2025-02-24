/*
  This file is part of Cohtml, Gameface and Prysm - modern user interface technologies.

  Copyright (c) 2012-2023 Coherent Labs AD and/or its licensors. All
  rights reserved in all media.

  The coded instructions, statements, computer programs, and/or related
  material (collectively the "Data") in these files contain confidential
  and unpublished information proprietary Coherent Labs and/or its
  licensors, which is protected by United States of America federal
  copyright law and by international treaties.

  This software or source code is supplied under the terms of a license
  agreement and nondisclosure agreement with Coherent Labs AD and may
  not be copied, disclosed, or exploited except in accordance with the
  terms of that agreement. The Data may not be disclosed or distributed to
  third parties, in whole or in part, without the prior written consent of
  Coherent Labs AD.

  COHERENT LABS MAKES NO REPRESENTATION ABOUT THE SUITABILITY OF THIS
  SOURCE CODE FOR ANY PURPOSE. THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT
  HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES,
  INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
  MERCHANTABILITY, NONINFRINGEMENT, AND FITNESS FOR A PARTICULAR PURPOSE
  ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER, ITS AFFILIATES,
  PARENT COMPANIES, LICENSORS, SUPPLIERS, OR CONTRIBUTORS BE LIABLE FOR
  ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
  DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS
  HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT,
  STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN
  ANY WAY OUT OF THE USE OR PERFORMANCE OF THIS SOFTWARE OR SOURCE CODE,
  EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

import * as Common from '../../core/common/common.js';
import * as i18n from '../../core/i18n/i18n.js';
import * as UI from '../../ui/legacy/legacy.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as Protocol from '../../generated/protocol.js';

const clamp = (num: number, min: number, max: number) => Math.min(Math.max(num, min), max);

const UIStrings = {

  paintFlashing: 'Paint flashing',

  highlightsAreasOfThePageGreen:
    'Highlights areas of the page (green) that need to be repainted. May not be suitable for people prone to photosensitive epilepsy.',

  redrawFlashing: 'Redraw flashing',

  highlightsAreasOfThePageRed:
    'Highlights elements of the page (red) that need to be repainted. This highlights every element that is repainted during the frame.',

  dumpDomTitle: 'Dump DOM Tree',

  dumpDomDesc: 'Serialize the dom tree to a text file',

  dumpDomSubDesc: '(debug_dom_tree.log)',

  dumpStackingContextTitle: 'Dump Stacking Context tree',

  dumpStackingContextDesc: 'Serialize the stacking context tree to a text file',

  dumpStackingContextSubDesc: '(debug_stacking_contexts.json)',

  dumpUsedImagesTitle: 'Dump Used Images',

  dumpUsedImagesDesc: 'Serialize the used images in the view to a text file',

  dumpUsedImagesSubDesc: '(UsedImages.txt)',

  toggleMetaDataTitle: 'Emit Rendering Metadata',

  toggleMetaDataDesc: 'Emit metadata for the genrated rendering commands. The metadata can be seen in tools like RenderDoc',

  toggleContinuousRepaintTitle: 'Continuous Repaint',

  toggleContinuousRepaintDesc: 'Redraw the entire view every frame regardless of what the dirty regions are',

  captureBackendTitle: 'Capture Backend Buffer',

  captureBackendDesc: 'Seriazlie the generated backend commands for a single frame to a binary file',

  captureBackendSubDesc: '(CohtmlBackendBuffer.buff)',

  captureRendTitle: 'Capture Rend File',

  captureRendDesc: 'Seriazlie the generated rendering commands for a signel frame to a binary file',

  captureRendSubDesc: '(CohtmlRendCapture.rend)',

  capturePageTitle: 'Capture Full Page',

  capturePageDesc: 'Serialize the state of the whole view to a binary file',

  capturePageSubDesc: '(PageCapture.pcap)',

  clearCachedUnusedImagesTitle: 'Clear Cached Unused Images',

  clearCachedUnusedImagesDesc: 'Remove all unused images (raster and svg) from internal caches.',

  getSystemCacheTitle: 'Get System Cache Stats',

  getSystemCacheDesc: 'Get statistics for the system-wide caches',

  currentCapacityCountStr: 'Current Capacity Count: ',

  currentCapacityBytesStr: 'Current Capacity Memory: ',

  updateCacheStr: 'Update Cache',

  capacityStr: 'Capacity Count:',

  memoryStr: 'Capacity Memory:',

};
const SCRATCH_LAYERS_ID = 1;
const str_ = i18n.i18n.registerUIStrings('entrypoints/inspector_main/CohtmlPanel.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

function SizeString(sizeinBytes: number): string {
  if (isNaN(sizeinBytes)) {
    return "";
  }

  if (sizeinBytes < 1024) {
    return sizeinBytes + ' Bytes';
  } else if (sizeinBytes < 1024 * 1024) {
    return (sizeinBytes / 1024).toFixed(2) + ' KBs';
  } else {
    return (sizeinBytes / (1024 * 1024)).toFixed(2) + ' MBs';
  }
}

let cohtmlPanelViewInstance: CohtmlPanelView;


class RenoirCacheUIEntry {
  currentCountSpanElement: HTMLElement | null;
  currentBytesSpanElement: HTMLElement | null;

  constructor() {
    this.currentBytesSpanElement = null;
    this.currentCountSpanElement = null;
  }

};

export class CohtmlPanelView extends UI.Widget.VBox implements SDK.TargetManager.SDKModelObserver<SDK.CohtmlDebugModel.CohtmlDebugModel>{

  private drawMetaDataSetting: Common.Settings.Setting<any>;

  private continuousRepaintSetting: Common.Settings.Setting<any>;

  private cohtmlDebugModel?: SDK.CohtmlDebugModel.CohtmlDebugModel | null;

  private controlsPanel: HTMLElement;

  private contentPanel: HTMLElement;

  private renoirCachesWrapper!: HTMLElement;

  // The "frontend" state of the renior renoir caches. In the entries we keep the two HTML element which display the current capacity
  // count and bytes. The map maps from a cache type (scratchTextures, scratchLayers) to the entry with HTML elements (RenoirCacheUIEntry).
  private renoirCachesUIState: Map<number, RenoirCacheUIEntry>;

  private sidebar: HTMLElement;

  private x: number;

  private y: number;

  private leftWidth: number;

  private currentControlsWidth: number;

  private constructor() {
    super(true);
    this.currentControlsWidth = 50;
    this.x = this.y = 0;
    this.leftWidth = 0;
    this.registerRequiredCSS('entrypoints/inspector_main/renderingOptions.css');

    SDK.TargetManager.TargetManager.instance().observeModels(SDK.CohtmlDebugModel.CohtmlDebugModel, this);

    let mainTarget = SDK.TargetManager.TargetManager.instance().mainTarget();
    if (mainTarget) {
      this.cohtmlDebugModel = mainTarget.model(SDK.CohtmlDebugModel.CohtmlDebugModel);
    }

    this.renoirCachesUIState = new Map<number, RenoirCacheUIEntry>();

    this.drawMetaDataSetting = Common.Settings.Settings.instance().moduleSetting('drawMetaData');
    this.continuousRepaintSetting = Common.Settings.Settings.instance().moduleSetting('continuousRepaint');

    this.contentElement.classList.add('cohtml-panel-base');
    this.controlsPanel = this.contentElement.createChild('div', 'cohtml-panel controls-panel');
    this.controlsPanel.style.width = `${this.currentControlsWidth}%`;

    this.sidebar = this.contentElement.createChild('div', 'cohtml-sider');
    this.addSidebarEvents();

    this.contentPanel = this.contentElement.createChild('div', 'cohtml-panel content-panel');

    this.createToggleSettingsSection();
    this.createActionsSection();
    this.createCacheControlsSection();
    this.createRenderingCachesSection();
    this.resizingPanels = this.resizingPanels.bind(this);
    this.stopResizingPanels = this.stopResizingPanels.bind(this);
  }

  private onModelUpdated() {
    // once we have a valid cohtml model, we'll query the renoir caches states

    let cachesResult = this.cohtmlDebugModel?.getAvailableRenoirCahces();
    cachesResult?.then(caches => {
      this.renoirCachesWrapper.removeChildren();
      caches?.forEach(cache => {
        this.createCacheEntryForRenoirCache(cache.type, cache.title ? cache.title : '<unknown>', this.renoirCachesWrapper);
      });
      this.fetchCacheStates();
    });
  }

  private async fetchCacheStates() {
    if (!this.cohtmlDebugModel) return;

    const stats = await this.cohtmlDebugModel.getRenoirCahcesState();

    // update the HTML elements displaying the currenet capacity count and bytes
    this.updateReniorCachesUI(stats);
  }

  private updateCacheUI(state: Protocol.CohtmlDebug.RenoirCache | undefined) {
    if (!state) {
      return;
    }

    if (!this.renoirCachesUIState.has(state.type)) {
      return;
    }

    let uiCacheState = this.renoirCachesUIState.get(state.type);
    if (!uiCacheState
      || uiCacheState.currentBytesSpanElement == null
      || uiCacheState.currentCountSpanElement == null) {
      return;
    }

    uiCacheState.currentBytesSpanElement.innerText = UIStrings.currentCapacityBytesStr + SizeString(state.capacityBytes ? state.capacityBytes : 0);
    uiCacheState.currentCountSpanElement.innerText = UIStrings.currentCapacityCountStr + state.capacityCount;
  }

  private updateReniorCachesUI(cachesState: Protocol.CohtmlDebug.RenoirCachesState | null) {
    cachesState?.caches.forEach(cache => {
      this.updateCacheUI(cache);
    });
  }

  private cacheUpdateHandler(id: number, entryInput: HTMLInputElement, unitSelect?: HTMLSelectElement | null) {
    return async (event: Event) => {
      let inputElement = (entryInput as HTMLInputElement);
      if (inputElement.value.length == 0) {
        return;
      }
      let newSize = Number(inputElement.value);
      if (!isNaN(newSize)) {

        // JSON specifies only 32-bit integers so we can't send a bigger
        // number than 2^32 bytes (~ 2147 MBs; this should be enough for all caches)
        const MAX_32BIT_INTEGER = 2147483647;
        newSize = clamp(newSize, 0, MAX_32BIT_INTEGER);

        switch (unitSelect?.value) {
          case "Bytes": break;
          case "KBs": newSize *= 1024; break;
          case "MBs": newSize *= 1024 * 1024; break;
        }

        let setCount = !unitSelect;

        // create the object that will be send to the backend
        let state: Protocol.CohtmlDebug.RenoirCache = {
          type: id,
          capacityBytes: !setCount ? newSize : -1,
          capacityCount: setCount ? newSize : -1
        };

        const button = event.currentTarget;
        this.toggleButtonLoadingIndicator(button, true);
        // send the data to the backend (the C++ code)
        await this.cohtmlDebugModel?.setRenoirCacheState(state);

        // Cohtml does not update the caches immediatly but rather on the
        // next frame. Hence we can't request the new cache state immediatly but
        // have to "wait a little bit". 100ms is plenty of time but still keeps the
        // updating feeling interactive
        setTimeout(async () => {
          await this.fetchCacheStates();
          this.toggleButtonLoadingIndicator(button, false);
        }, 100);
      }
    };
  }

  private createCacheEntryForRenoirCache(id: number, title: string, parent: HTMLElement) {
    let cachePanel = parent.createChild('div', 'cache-entry');

    let cacheName = cachePanel.createChild('span', 'cache-title');
    cacheName.innerHTML = title;

    let newCacheUIEntry = new RenoirCacheUIEntry();
    const options = [
      { label: UIStrings.capacityStr, unitsSelect: false, currentCapacityLabel: UIStrings.currentCapacityCountStr, isCount: true },
      { label: UIStrings.memoryStr, unitsSelect: true, currentCapacityLabel: UIStrings.currentCapacityBytesStr, isCount: false },
    ];

    for (const { label, unitsSelect, currentCapacityLabel, isCount } of options) {
      const row = cachePanel.createChild('div', 'cache-wrapper');
      const capacityWrapper = row.createChild('div', 'cache-option');
      let entryName = capacityWrapper.createChild('span', 'label');
      entryName.innerText = label;

      // input field where the user enters the desired cache size
      let entryInput = capacityWrapper.createChild('input') as HTMLInputElement;
      entryInput.setAttribute('type', 'number');

      let unitSelect = null;
      if (unitsSelect) {
        const unitsWrapper = row.createChild('div', 'cache-option');
        // unit for the enered number (label + select element)
        let unit = unitsWrapper.createChild('span', 'label');
        unit.innerText = 'Unit:';
        let types: string[] = ["Bytes", "KBs", "MBs"];
        unitSelect = this.appendSelect("Type", types, unitsWrapper);
      }

      const buttonWrapper = row.createChild('div', 'cache-option button-wrapper');
      // button for updating the corresponding cache.
      const entryButton = UI.UIUtils.createTextButton(i18nString(UIStrings.updateCacheStr), void 0, 'cohtml-button margin-top-0');
      UI.ARIAUtils.markAsLink(entryButton);
      entryButton.disabled = !entryInput.value;
      //@ts-ignore
      entryInput.addEventListener('input', (event) => entryButton.disabled = !event.target.value)
      buttonWrapper.appendChild(entryButton);

      buttonWrapper.createChild('div', 'icon');

      // We need to make sure that the Scratch Layers are aways used with MBs because their minimum capacity memory is 4MB
      // and it does not make sense to set them in kbs or bytes. We recognize them by their id/position that is comming from the C++.
      // Make sure when you change their position in C++ - static constexpr InternalCaches s_ProcessedCaches[], to reflect the change here in SCRATCH_LAYERS_ID as well.
      if (unitSelect && id === SCRATCH_LAYERS_ID) {
        unitSelect.value = 'MBs';
        unitSelect.disabled = true;

        const warning = row.createChild('div', 'cache-option');
        warning.innerHTML="<span style='color:red;margin-right:3px;'>WARNING:</span> Scratch layer capacity memory cannot be set to less than 4MB!"
      }

      entryButton.onclick = this.cacheUpdateHandler(id, entryInput, unitSelect);

      let currentRow = cachePanel.createChild('div', 'cache-wrapper');
      let currentCapacity = currentRow.createChild('div', 'cache-option');
      currentCapacity.innerText = currentCapacityLabel;
      if (isCount) {
        newCacheUIEntry.currentCountSpanElement = currentCapacity;
      } else {
        newCacheUIEntry.currentBytesSpanElement = currentCapacity;
      }
    }

    // create the entry in the frontend map for the caches state
    this.renoirCachesUIState.set(id, newCacheUIEntry);
    parent.createChild('div', 'panel-section-separator')
  }

  static instance(opts: {
    forceNew: boolean | null,
  } = { forceNew: null }): CohtmlPanelView {
    const { forceNew } = opts;
    if (!cohtmlPanelViewInstance || forceNew) {
      cohtmlPanelViewInstance = new CohtmlPanelView();
    }

    return cohtmlPanelViewInstance;
  }

  private addSidebarEvents() {
    this.sidebar.addEventListener('mousedown', this.startResizingPanels.bind(this));
  }

  private startResizingPanels(event: MouseEvent) {
    this.x = event.clientX;
    this.y = event.clientY;
    this.leftWidth = this.sidebar.previousElementSibling?.getBoundingClientRect().width || 0;
    document.addEventListener('mousemove', this.resizingPanels);
    document.addEventListener('mouseup', this.stopResizingPanels);
  }

  private stopResizingPanels() {
    document.removeEventListener('mousemove', this.resizingPanels);
    document.removeEventListener('mouseup', this.stopResizingPanels);
  }

  private resizingPanels(event: MouseEvent) {
    const dx = event.clientX - this.x;
    const dy = event.clientY - this.y;

    const newLeftWidth = ((this.leftWidth + dx) * 100) / this.contentElement.getBoundingClientRect().width;
    if (newLeftWidth < 15 || newLeftWidth > 85) return;
    this.controlsPanel.style.width = `${newLeftWidth}%`;
    this.currentControlsWidth = newLeftWidth;
  }

  private createToggleSettingsSection() {
    this.createSectionHeader(this.controlsPanel, 'Toggle settings');

    this.appendCheckbox(
      i18nString(UIStrings.paintFlashing), i18nString(UIStrings.highlightsAreasOfThePageGreen),
      Common.Settings.Settings.instance().moduleSetting('showPaintRects'),
      this.controlsPanel
    );

    this.appendCheckbox(
      i18nString(UIStrings.redrawFlashing), i18nString(UIStrings.highlightsAreasOfThePageRed),
      Common.Settings.Settings.instance().moduleSetting('showRedrawRects'),
      this.controlsPanel
    );

    this.appendCheckbox(
      UIStrings.toggleMetaDataTitle, UIStrings.toggleMetaDataDesc,
      Common.Settings.Settings.instance().moduleSetting('drawMetaData'),
      this.controlsPanel
    );

    this.appendCheckbox(
      UIStrings.toggleContinuousRepaintTitle, UIStrings.toggleContinuousRepaintDesc,
      Common.Settings.Settings.instance().moduleSetting('continuousRepaint'),
      this.controlsPanel
    );

    this.controlsPanel.createChild('div', 'panel-section-separator')
  }

  private createActionsSection() {
    this.createSectionHeader(this.controlsPanel, 'Actions');

    this.createSimpleButton(UIStrings.dumpDomTitle, UIStrings.dumpDomDesc, 'dumpDOM', this.controlsPanel, UIStrings.dumpDomSubDesc);
    this.createSimpleButton(UIStrings.dumpStackingContextTitle, UIStrings.dumpStackingContextDesc, 'dumpStackingContext', this.controlsPanel, UIStrings.dumpStackingContextSubDesc);
    this.createSimpleButton(UIStrings.dumpUsedImagesTitle, UIStrings.dumpUsedImagesDesc, 'dumpUsedImages', this.controlsPanel, UIStrings.dumpUsedImagesSubDesc);
    this.createSimpleButton(UIStrings.captureBackendTitle, UIStrings.captureBackendDesc, 'captureBackend', this.controlsPanel, UIStrings.captureBackendSubDesc);
    this.createSimpleButton(UIStrings.captureRendTitle, UIStrings.captureRendDesc, 'captureRend', this.controlsPanel, UIStrings.captureRendSubDesc);
    this.createSimpleButton(UIStrings.capturePageTitle, UIStrings.capturePageDesc, 'capturePage', this.controlsPanel, UIStrings.capturePageSubDesc);
    this.controlsPanel.createChild('div', 'panel-section-separator');
  }

  private createRenderingCachesSection() {
    // The panel which controls the renoir caches. We will create an entry for each cache type.
    this.createSectionHeader(this.controlsPanel, 'Rendering Caches');

    this.renoirCachesWrapper = this.controlsPanel.createChild('div');

    this.controlsPanel.createChild('div', 'panel-section-separator');
  }

  private createCacheControlsSection() {
    this.createSectionHeader(this.controlsPanel, 'Cache controls');

    this.createSimpleButton(UIStrings.clearCachedUnusedImagesTitle, UIStrings.clearCachedUnusedImagesDesc, 'clearCachedUnusedImages', this.controlsPanel);

    this.createButton(UIStrings.getSystemCacheTitle, UIStrings.getSystemCacheDesc, this.controlsPanel, async (event: Event) => {
      if (this.cohtmlDebugModel) {
        const button = event.currentTarget;
        this.toggleButtonLoadingIndicator(button, true, true);
        const cacheStats = this.cohtmlDebugModel.getSystemCacheStats();
        cacheStats?.then((obj) => {
          if (obj) {
            this.displayImagesInContentPanel(obj);
            this.toggleButtonLoadingIndicator(button, false, true);
          }
        });
      }
    });

    this.controlsPanel.createChild('div', 'panel-section-separator');
  }

  private createSectionHeader(parentElement: HTMLElement, title: string) {
    const header = parentElement.createChild('div', 'cohtml-section-header');
    header.innerText = title;
  }

  private createSubSectionHeader(parentElement: HTMLElement, title: string) {
    const header = parentElement.createChild('div', 'cohtml-sub-section-header');
    header.innerText = title;
  }

  private displayImagesInContentPanel(imagesList: Protocol.CohtmlDebug.GetSystemCacheStatsResponse) {
    this.contentPanel.innerHTML = '';
    this.createSectionHeader(this.contentPanel, 'Used images');

    this.contentPanel.createChild('div', 'info-span').innerText = 'Alive Images Count: ' + imagesList.stats.aliveImagesCount;
    this.contentPanel.createChild('div', 'info-span').innerText = 'Alive Images Total Memory: ' + SizeString(imagesList.stats.aliveTotalBytesUsed);
    this.contentPanel.createChild('div', 'info-span').innerText = 'Orphaned Images Count: ' + imagesList.stats.orphanedImagesCount;
    this.contentPanel.createChild('div', 'info-span').innerText = 'Orphaned Images Total Memory: ' + SizeString(imagesList.stats.orphanedBytesUsed);

    function displayImagesAsUl(images: Protocol.CohtmlDebug.ImageData[], parent: HTMLElement) {
      const imagesListElement = parent.createChild('ul', 'image-list');
      images.forEach((img) => {
        const li = imagesListElement.createChild('li');
        li.title = img.name;
        li.createChild('div', 'selection fill');
        const elementWrapper = li.createChild('div', 'coh-img-element-wrapper');
        elementWrapper.createChild('span', 'coh-image-icon');
        elementWrapper.createChild('span', 'image-name').innerText = img.name;
        li.createChild('span', 'image-size').innerText = '[ ' + SizeString(img.sizeBytes) + ']';
      });
    }

    this.contentPanel.createChild('div', 'panel-section-separator');
    this.createSectionHeader(this.contentPanel, 'Alive Images List');
    displayImagesAsUl(imagesList.stats.aliveImages, this.contentPanel);
    this.contentPanel.createChild('div', 'panel-section-separator')
    this.createSectionHeader(this.contentPanel, 'Orphen Images List');
    displayImagesAsUl(imagesList.stats.orphanedImages, this.contentPanel);
  }

  private toggleButtonLoadingIndicator(button: EventTarget | null, spinnerVisible: boolean, displayReadyMessage: boolean = false) {
    if (!button) return;
    //@ts-ignore
    const buttonBlock = button.parentElement as HTMLElement;
    if (!buttonBlock) return;

    const loadingIndicator = buttonBlock.querySelector('.icon');
    loadingIndicator?.classList.toggle('hidden', !spinnerVisible);
    loadingIndicator?.classList.toggle('spinner', spinnerVisible);
    if (displayReadyMessage) {
      const readyMessage = buttonBlock.querySelector('.ready-message');

      if (!spinnerVisible) {
        readyMessage?.classList.toggle('visibility-hidden', false);
        readyMessage?.classList.toggle('fade-out', true);
      } else {
        readyMessage?.classList.toggle('visibility-hidden', true);
        readyMessage?.classList.toggle('fade-out', false);
      }
    }
  }

  private createSimpleButton(title: string, description: string, method: any, parent: HTMLElement, subDescription?: string) {
    this.createButton(title, description, parent, async (event: Event) => {
      if (this.cohtmlDebugModel && this.cohtmlDebugModel[method]) {
        const button = event.currentTarget;
        this.toggleButtonLoadingIndicator(button, true, true);
        const res = await this.cohtmlDebugModel[method]();
        this.toggleButtonLoadingIndicator(button, false, true);
      }
    }, subDescription);
  }

  private appendSelect(name: string, options: string[], element: HTMLElement): HTMLSelectElement {
    const select = element.createChild('select', 'chrome-select');

    for (let index = 0; index < options.length; ++index) {
      const option = (select.createChild('option') as HTMLOptionElement);
      option.value = options[index];
      option.textContent = options[index];
    }
    return select as HTMLSelectElement;
  }

  private createButton(label: string, desc: string, parent: HTMLElement, click: (event: Event) => void, subDescription?: string) {
    const newButtonBlock = parent.createChild('div', 'button-block');
    const buttonItem = UI.UIUtils.createTextButton(i18nString(label), click, 'cohtml-button');
    UI.ARIAUtils.markAsLink(buttonItem);

    const descItem = newButtonBlock.createChild('div', 'button-desc');
    descItem.innerText = desc;
    newButtonBlock.appendChild(descItem);

    if (subDescription) {
      const subDescItem = newButtonBlock.createChild('div', 'button-sub-desc');
      subDescItem.innerText = subDescription;
      newButtonBlock.appendChild(subDescItem);
    }
    const buttonWithLoader = newButtonBlock.createChild('div', 'button-wrapper');
    buttonWithLoader.appendChild(buttonItem);
    buttonWithLoader.createChild('div', 'icon hidden');

    const readyIndicator = buttonWithLoader.createChild('div', 'ready-message visibility-hidden');
    readyIndicator.textContent = 'Ready!';

  }

  private createCheckbox(label: string, subtitle: string, setting: Common.Settings.Setting<boolean>):
    UI.UIUtils.CheckboxLabel {
    const checkboxLabel = UI.UIUtils.CheckboxLabel.create(label, false, subtitle);
    UI.SettingsUI.bindCheckbox(checkboxLabel.checkboxElement, setting);
    return checkboxLabel;
  }

  private appendCheckbox(label: string, subtitle: string, setting: Common.Settings.Setting<boolean>, parent: HTMLElement):
    UI.UIUtils.CheckboxLabel {
    const checkbox = this.createCheckbox(label, subtitle, setting);
    parent.appendChild(checkbox);
    return checkbox;
  }

  modelAdded(cohtmlModel: SDK.CohtmlDebugModel.CohtmlDebugModel): void {
    this.cohtmlDebugModel = cohtmlModel;
    this.onModelUpdated();
  }

  modelRemoved(cohtmlModel: SDK.CohtmlDebugModel.CohtmlDebugModel): void {
    this.cohtmlDebugModel = null;
  }

}
