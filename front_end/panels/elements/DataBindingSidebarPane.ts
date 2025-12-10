import * as UI from '../../ui/legacy/legacy.js';
import * as SDK from '../../core/sdk/sdk.js';
import * as Common from '../../core/common/common.js';
import { ElementsSidebarPane } from './ElementsSidebarPane.js';
import * as ElementsComponents from './components/components.js';
import * as Protocol from '../../generated/protocol.js';
import * as i18n from '../../core/i18n/i18n.js';
import * as Platform from '../../core/platform/platform.js';
import { DataBindAttributeTreeElement } from './components/DataBindingProperty.js';
import dataBindingPanelToolbarStyles from 'dataBindingPanelToolbar.css.js';
let dataBindingPanelViewInstance: DataBindingSidebarPane;

const UIStrings = {
  noSelectedNodeInfo: 'No selected element',
  noAttributes: 'No data bind attributes for the selected node',
  fetchDataWarning: 'Unable to fetch data for the selected node',
  expandAllExpressions: 'Expand all the expressions in the tab',
  collapseAllExpressions: 'Collapse all the expressions in the tab',
  highlightAttributesSetting: 'Hover bind attributes',
  highlightAttributesSettingDescription: 'Show an informative popover when data-bind attribute is hovered in the elements tab and the option is enabled.'
};
const str_ = i18n.i18n.registerUIStrings('panels/elements/DataBindingSidebarPane.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

export class DataBindingSidebarPane extends ElementsSidebarPane {
  private dataBindingsPanel: HTMLElement;
  private treeOutline: UI.TreeOutline.TreeOutline;
  private treeElement: HTMLElement;
  private bindingAttributes: DataBindAttributeTreeElement[] = []
  private readonly noSelectedNodeInfo: Element;
  private readonly noAttributesInfo: Element;
  private readonly fetchDataWarning: Element;
  private activeWarningMessage: Element | null = null;
  private filterRegex: RegExp | null = null;

  constructor() {
    super(true);
    this.createToolbar();

    UI.Context.Context.instance().addFlavorChangeListener(SDK.DOMModel.DOMNode, this.doUpdate, this);
    SDK.TargetManager.TargetManager.instance().addModelListener(
      SDK.DOMModel.DOMModel, SDK.DOMModel.Events.DataBindingModelsSynchronized, this.doUpdate, this);
    SDK.TargetManager.TargetManager.instance().addModelListener(
      SDK.DOMModel.DOMModel, SDK.DOMModel.Events.AttrModified, this.onAttributeModified, this);

    this.noSelectedNodeInfo = this.createInfo(i18nString(UIStrings.noSelectedNodeInfo), 'hidden gray-info-message');
    this.noAttributesInfo = this.createInfo(i18nString(UIStrings.noAttributes), 'hidden gray-info-message');
    this.fetchDataWarning = this.createWarning(i18nString(UIStrings.fetchDataWarning), 'hidden gray-info-message');
    this.contentElement.classList.add('data-binding-panel-base');
    this.dataBindingsPanel = this.contentElement.createChild('div', 'data-bindings-panel');
    this.dataBindingsPanel.style.width = `100%`;

    this.treeElement = this.contentElement.createChild('div', 'bind-tree');
    this.treeOutline = new UI.TreeOutline.TreeOutlineInShadow();
    this.treeOutline.contentElement.classList.add('tree-outline');
    this.registerRequiredCSS('panels/elements/components/dataBindingProperty.css');
    this.registerRequiredCSS('ui/legacy/treeoutline.css');
    this.registerRequiredCSS('ui/legacy/components/object_ui/objectValue.css');
    this.registerRequiredCSS('ui/legacy/components/object_ui/objectPropertiesSection.css');
    this.registerRequiredCSS('panels/elements/dataBindingPanel.css');
    this.treeElement.appendChild(this.treeOutline.contentElement);

    this.doUpdate();
  }

  createArrowIcon(className: string) {
    const icon = document.createElement('span');
    icon.className = className;
    icon.textContent = "\A0\A0";
    return icon;
  }

  createToolbar() {
    const toolbar = new UI.Toolbar.Toolbar('', this.contentElement);
    toolbar._shadowRoot.adoptedStyleSheets = [...toolbar._shadowRoot.adoptedStyleSheets, dataBindingPanelToolbarStyles];

    const filterInput = this.createFilterElement(this.onFilterChange.bind(this));
    toolbar?.appendToolbarItem(filterInput);

    const expandIcon = this.createArrowIcon('expand-tree-icon');
    const expandAllBtn =
      new UI.Toolbar.ToolbarButton(i18nString(UIStrings.expandAllExpressions), expandIcon);
    expandAllBtn.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.expandTree.bind(this), this);
    toolbar?.appendToolbarItem(expandAllBtn);

    const collapseIcon = this.createArrowIcon('collapse-tree-icon');
    const collapseAllBtn =
      new UI.Toolbar.ToolbarButton(i18nString(UIStrings.collapseAllExpressions), collapseIcon);
    collapseAllBtn.addEventListener(UI.Toolbar.ToolbarButton.Events.Click, this.collapseTree.bind(this), this);
    toolbar?.appendToolbarItem(collapseAllBtn);

    const secondToolbar = new UI.Toolbar.Toolbar('second', this.contentElement);
    secondToolbar._shadowRoot.adoptedStyleSheets = [...secondToolbar._shadowRoot.adoptedStyleSheets, dataBindingPanelToolbarStyles];

    const highlightBindingAttributesSetting =
      Common.Settings.Settings.instance().moduleSetting('highlightBindingAttributes');
    highlightBindingAttributesSetting.setTitle(i18nString(UIStrings.highlightAttributesSetting));
    const highlightBindingAttributesBtn =
      new UI.Toolbar.ToolbarSettingCheckbox(highlightBindingAttributesSetting, i18nString(UIStrings.highlightAttributesSettingDescription));
    secondToolbar?.appendToolbarItem(highlightBindingAttributesBtn);
  }

  onFilterChange(value: RegExp | null) {
    this.bindingAttributes.forEach((attribute) => {
      const mutatorsVisible = attribute.filterMutators(value);
      if (mutatorsVisible) return attribute.toggleTreeElement(true);

      const attributeVisible = value ? attribute.attributeData?.attributeName.match(value) || attribute.attributeData?.attributeValue.match(value) : true;
      attribute.toggleTreeElement(!!attributeVisible);
    })
  }

  createFilterElement(filterCallback: (arg0: RegExp | null) => void): UI.Toolbar.ToolbarItem {
    const input = document.createElement('input');
    input.type = 'search';
    input.classList.add('filter-bindings-input');
    input.placeholder = 'Filter';

    const searchHandler = (): void => {
      const regex = input.value ? new RegExp(Platform.StringUtilities.escapeForRegExp(input.value), 'i') : null;
      this.filterRegex = regex;
      filterCallback(regex);
    }

    input.addEventListener('input', searchHandler, false);

    function keydownHandler(event: Event): void {
      const keyboardEvent = (event as KeyboardEvent);
      if (keyboardEvent.key !== Platform.KeyboardUtilities.ESCAPE_KEY || !input.value) {
        return;
      }
      keyboardEvent.consume(true);
      input.value = '';
      searchHandler();
    }
    input.addEventListener('keydown', keydownHandler, false);

    return new UI.Toolbar.ToolbarItem(input);
  }

  expandTree(event: Common.EventTarget.EventTargetEvent<Event>) {
    this.bindingAttributes.forEach((attribute) => attribute.expandRecursively());
  }

  collapseTree(event: Common.EventTarget.EventTargetEvent<Event>) {
    this.bindingAttributes.forEach((attribute) => attribute.collapseRecursively());
  }

  createInfo(textContent: string, className?: string): Element {
    const classNameOrDefault = className || 'gray-info-message';
    const info = this.contentElement.createChild('div', classNameOrDefault);
    info.textContent = textContent;
    return info;
  }

  createWarning(textContent: string, className?: string): Element {
    const classNameOrDefault = className || 'gray-info-message';
    const warn = this.contentElement.createChild('div', classNameOrDefault);
    const warnMark = this.createExclamationMark('');
    warn.appendChild(warnMark);
    const text = warn.createChild('span');
    text.textContent = textContent;
    return warn;
  }

  createExclamationMark(tooltip: string): Element {
    const exclamationElement = document.createElement('span', { is: 'dt-icon-label' }) as UI.UIUtils.DevToolsIconLabel;
    exclamationElement.type = 'smallicon-warning';
    UI.Tooltip.Tooltip.install(exclamationElement, tooltip);
    return exclamationElement;
  }

  populateTree(data: Protocol.DOM.DataBindAttributeData[]) {
    this.hideMessages();
    this.treeElement.classList.toggle('hidden', false);

    for (let i = 0; i < data.length; i++) {
      if (!this.bindingAttributes[i]) {
        const attrTree = new ElementsComponents.DataBindingProperty.DataBindAttributeTreeElement(data[i]);
        attrTree.setExpandable(true);
        attrTree.selectable = false;
        attrTree.expand();

        this.treeOutline.appendChild(attrTree);
        this.bindingAttributes.push(attrTree);
      } else {
        this.bindingAttributes[i].update(data[i]);
      }
    }

    if (this.bindingAttributes.length > data.length) {
      for (let i = data.length; i < this.bindingAttributes.length; i++) {
        this.treeOutline.removeChild(this.bindingAttributes[i]);
      }

      this.bindingAttributes.splice(data.length, this.bindingAttributes.length);
    }
  }

  onAttributeModified(event: Common.EventTarget.EventTargetEvent<{ node: SDK.DOMModel.DOMNode, name: string }>): void {
    const { node } = event.data;

    if (node.id === this.node()?.id) {
      this.doUpdate();
    }
  }

  showMessage(messageElement: Element) {
    this.activeWarningMessage?.classList.toggle('hidden', true);
    this.activeWarningMessage = messageElement;
    this.activeWarningMessage.classList.toggle('hidden', false);
    this.treeElement.classList.toggle('hidden', true);
  }

  hideMessages() {
    this.activeWarningMessage?.classList.toggle('hidden', true);
  }

  async doUpdate(): Promise<void> {
    const node = this.node();
    if (!node) return this.showMessage(this.noSelectedNodeInfo);

    const domModel = node.domModel();
    const data = await domModel?.getDataBindingDataForNode(node.id, node.nodeType(), node.nodeName());
    if (!data) return this.showMessage(this.fetchDataWarning);

    const attributes = data?.dataBindAttributes || [];
    if (!attributes.length) return this.showMessage(this.noAttributesInfo);

    this.populateTree(attributes);
    if (this.filterRegex) this.onFilterChange(this.filterRegex);
  }

  static instance(opts: {
    forceNew: boolean | null,
  } = { forceNew: null }): DataBindingSidebarPane {
    const { forceNew } = opts;
    if (!dataBindingPanelViewInstance || forceNew) {
      dataBindingPanelViewInstance = new DataBindingSidebarPane();
    }

    return dataBindingPanelViewInstance;
  }
}