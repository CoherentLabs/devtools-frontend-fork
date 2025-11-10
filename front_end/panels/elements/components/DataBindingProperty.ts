import * as UI from '../../../ui/legacy/legacy.js';
import * as ObjectUI from '../../../ui/legacy/components/object_ui/object_ui.js';
import * as SDK from '../../../core/sdk/sdk.js';
import * as Protocol from '../../../generated/protocol.js';
import * as i18n from '../../../core/i18n/i18n.js';

const UIStrings = {
  noErrors: 'No errors',
  outOfSync: 'Out of sync',
  upToDate: 'Up to date',
  status: 'Status',
  evalError: 'Evaluation errors'
};

const str_ = i18n.i18n.registerUIStrings('panels/accessibility/AccessibilityNodeView.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

export class DataBindBaseTreeElement extends UI.TreeOutline.TreeElement {
  private warningMark: UI.UIUtils.DevToolsIconLabel;
  public executionContext: SDK.RuntimeModel.ExecutionContext | undefined
  constructor(executionContext?: SDK.RuntimeModel.ExecutionContext | undefined) {
    super('');
    this.selectable = false;
    this.setExpandable(true);
    this.executionContext = executionContext;
    this.setDisableSelectFocus(true);
    this.warningMark = this.createExclamationMark('');
    this.listItemElement.insertBefore(this.warningMark, this.listItemElement.firstChild);
  }

  setWarningMarkTip(tip: string) {
    this.warningMark.title = tip;
  }

  async evalExpression(expr: string | undefined) {
    if (!expr) return null;
    const executionContext = UI.Context.Context.instance().flavor(SDK.RuntimeModel.ExecutionContext);
    if (!executionContext) {
      return null;
    }
    return await executionContext?.evaluate({ expression: expr, returnByValue: true }, false, true);
  }

  createExclamationMark(tooltip: string): UI.UIUtils.DevToolsIconLabel {
    const exclamationElement = document.createElement('span', { is: 'dt-icon-label' }) as UI.UIUtils.DevToolsIconLabel;
    exclamationElement.type = 'smallicon-warning';
    exclamationElement.className = 'hidden';
    UI.Tooltip.Tooltip.install(exclamationElement, tooltip);
    return exclamationElement;
  }

  toggleExclamationMark(visible: boolean) {
    this.warningMark?.classList.toggle('hidden', !visible);
  }

  appendSpanElement(parent: Element, textContent: string, className?: string): HTMLSpanElement {
    const element = document.createElement('span');
    element.textContent = textContent;
    if (className) element.className = className;
    parent.appendChild(element);
    return element;
  }

  appendSeparatorElement(parent: Element): HTMLSpanElement {
    return this.appendSpanElement(parent, ':\xA0', 'separator');
  }

  toggleTreeElement(visible: boolean | undefined | null) {
    this.listItemElement.classList.toggle('hidden', !visible);
  }
}

export class DataBindNodeInfoTreeElement extends DataBindBaseTreeElement {
  private syncStatusElement: HTMLSpanElement | null = null;
  private evaluationErrorElement: HTMLSpanElement | null = null;
  public syncStatus?: boolean;
  public evaluationError?: string;
  constructor(evaluationError: string | undefined, syncStatus: boolean) {
    super();
    this.listItemElement.classList.add('monospace');
    this.listItemElement.classList.add('expressions-info');
    this.setExpandable(false);
    this.selectable = false;
    this.createElements();
    this.update(evaluationError, syncStatus);
  }

  updateStatus(syncStatus: boolean) {
    if (syncStatus !== this.syncStatus) {
      this.syncStatusElement!.textContent = syncStatus ? i18nString(UIStrings.upToDate) : i18nString(UIStrings.outOfSync);
      this.syncStatusElement?.classList.toggle('status-ok', syncStatus);
      this.syncStatusElement?.classList.toggle('bind-warning-message', !syncStatus);
    }

    this.syncStatus = syncStatus;
  }

  update(evaluationError: string | undefined, syncStatus: boolean) {
    if (evaluationError !== this.evaluationError) {
      this.evaluationErrorElement!.textContent = evaluationError ? evaluationError : i18nString(UIStrings.noErrors);
      this.evaluationErrorElement?.classList.toggle('status-ok', !evaluationError);
      this.evaluationErrorElement?.classList.toggle('bind-error-message', !!evaluationError);
    }

    this.evaluationError = evaluationError;
    this.updateStatus(syncStatus);
  }

  createElements(): void {
    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';
    const syncStatusElementWrapper = document.createElement('div');
    syncStatusElementWrapper.classList.add('bind-expression-status');

    this.appendSpanElement(syncStatusElementWrapper, i18nString(UIStrings.status), 'name');
    this.appendSeparatorElement(syncStatusElementWrapper);
    this.syncStatusElement = this.appendSpanElement(syncStatusElementWrapper, i18nString(UIStrings.upToDate), 'status-ok');

    const evaluationErrorWrapper = document.createElement('div');
    evaluationErrorWrapper.classList.add('bind-expression-eval-error');

    this.appendSpanElement(evaluationErrorWrapper, i18nString(UIStrings.evalError), 'name');
    this.appendSeparatorElement(evaluationErrorWrapper);
    this.evaluationErrorElement = this.appendSpanElement(evaluationErrorWrapper, i18nString(UIStrings.noErrors), `status-ok`);

    wrapper.appendChild(syncStatusElementWrapper);
    wrapper.appendChild(evaluationErrorWrapper);
    this.listItemElement.appendChild(wrapper);
  }
}

export class DataBindNodeTreeElement extends DataBindBaseTreeElement {
  private expressionElement: HTMLSpanElement | null = null;
  private valueElement: HTMLSpanElement | null = null;
  public expression?: string;
  public value?: string;
  public valueType?: string;
  public dataBindNodeInfoTree: DataBindNodeInfoTreeElement;
  constructor(expression: string, value: string, valueType: string, evaluationError: string | undefined, syncStatus: boolean, executionContext?: SDK.RuntimeModel.ExecutionContext | undefined) {
    super(executionContext);

    this.listItemElement.classList.add('monospace');
    this.listItemElement.classList.add('expressions-list');
    this.dataBindNodeInfoTree = new DataBindNodeInfoTreeElement(evaluationError, syncStatus);

    this.setWarningMarkTip('Warnings generated while evaluating the expression');
    this.createElements();
    this.update(expression, value, valueType, evaluationError, syncStatus);
  }

  update(expression: string, value: string, valueType: string, evaluationError: string | undefined, syncStatus: boolean) {
    this.toggleExclamationMark(!!evaluationError || !syncStatus);
    if (expression !== this.expression) this.expressionElement!.textContent = expression;
    if (value !== this.value) {
      this.valueElement!.textContent = value;
      if (this.valueElement) this.valueElement.className = `object-value-${valueType}`;
    }

    this.expression = expression;
    this.value = value;
    this.valueType = valueType;

    this.dataBindNodeInfoTree.update(evaluationError, syncStatus);
  }

  toggleBindNodeInfoTree(visible: boolean | undefined | null) {
    this.dataBindNodeInfoTree.toggleTreeElement(visible);
  }

  createElements(): void {
    this.expressionElement = this.appendSpanElement(this.listItemElement, '', 'object-value-string expression-name');
    this.appendSeparatorElement(this.listItemElement);
    this.valueElement = this.appendSpanElement(this.listItemElement, '', 'object-value-string');
    this.appendChild(this.dataBindNodeInfoTree);
  }
}

const EVALUATION_NODE_STATUS_WATCH_INTERVAL = 1000;

export class DataBindAttributeTreeElement extends DataBindBaseTreeElement {
  public attributeData: Protocol.DOM.DataBindAttributeData | null = null;
  private attributeNameElement: HTMLSpanElement;
  private attributeValueElement: HTMLSpanElement;
  private errorsContainerElement: HTMLElement;
  private dataBindNodeElements: DataBindNodeTreeElement[] = []
  private statusInterval: any;

  constructor(attributeData: Protocol.DOM.DataBindAttributeData, executionContext: SDK.RuntimeModel.ExecutionContext | undefined) {
    super(executionContext);

    this.listItemElement.classList.add('bind-attribute');
    this.setWarningMarkTip('Warnings generated while parsing the attribute');
    this.attributeNameElement = this.appendSpanElement(this.listItemElement, '', 'object-value-string name');
    this.appendSeparatorElement(this.listItemElement);
    this.attributeValueElement = this.appendSpanElement(this.listItemElement, '', 'object-value-string');
    this.errorsContainerElement = this.listItemElement.createChild('span', 'bind-error-message mutators', '');
    this.listItemElement.classList.add('monospace');
    this.update(attributeData);
  }

  async updateNodeStatus(node: DataBindNodeTreeElement) {
    const exprValue = await this.evalExpression(node.expression!);
    //@ts-ignore
    if (!exprValue?.object) return;
    let currentValue = null;
    switch (node.valueType) {
      case 'string':
      case 'undefined': {
        currentValue = node.value;
        break;
      }
      default: {
        currentValue = JSON.parse(node.value!);
      }
    }
    //@ts-ignore
    const outOfSync = exprValue?.object?.value as unknown !== currentValue;
    node.dataBindNodeInfoTree.updateStatus(!outOfSync);
    node.toggleExclamationMark(outOfSync);

    return outOfSync;
  }

  async checkNodesStatus() {
    // If we have just a single node then the expression is not complex and we can properly update its status with runtime evaluate
    if (this.dataBindNodeElements.length === 1) {
      this.updateNodeStatus(this.dataBindNodeElements[0]);
      return;
    }

    // If we have more than one node then the first node is the whole complex expression. Then the status of this node is set based on that if all the
    // other nodes are synchronized or not. If one node is out of sync then the whole expression if out of sync
    let hasNonSyncStatus = false;

    for (let [index, node] of this.dataBindNodeElements.entries()) {
      if (index === 0) continue;

      if (await this.updateNodeStatus(node)) hasNonSyncStatus = true;
    }

    this.dataBindNodeElements[0].dataBindNodeInfoTree.updateStatus(!hasNonSyncStatus);
    this.dataBindNodeElements[0].toggleExclamationMark(hasNonSyncStatus);
  }

  startTimers() {
    if (this.statusInterval) return;

    this.statusInterval = setInterval(this.checkNodesStatus.bind(this), EVALUATION_NODE_STATUS_WATCH_INTERVAL)
  }

  public resetTimers() {
    this.stopTimers();
    this.startTimers();
  }

  public stopTimers() {
    if (this.statusInterval) {
      clearInterval(this.statusInterval);
      this.statusInterval = null;
    }
  }

  public filterMutators(value: RegExp | null): boolean {
    let mutatorsVisible = false;

    this.dataBindNodeElements.forEach((node) => {
      const nodeVisible = value ? node.expression?.match(value) || node.value?.match(value) : true;
      node.toggleTreeElement(!!nodeVisible);
      node.toggleBindNodeInfoTree(!!nodeVisible);
      if (nodeVisible) mutatorsVisible = true;
    })

    return mutatorsVisible;
  }

  private updateMutators(attributeData: Protocol.DOM.DataBindAttributeData) {
    const mutatorsErrors = [] as string[];
    let nodeHasProblem = false;

    for (const mutator of attributeData.mutators) {
      if (mutator.parsingError) {
        mutatorsErrors.push(mutator.parsingError);
      }

      if (mutator.compilationError) {
        mutatorsErrors.push(mutator.compilationError);
      }

      const evalNodes = mutator.evaluationNodes;
      this.setExpandable(evalNodes.length > 0);

      for (let i = 0; i < evalNodes.length; i++) {
        const { evaluatableExpression, evaluatedValue, evaluationError, syncStatus, valueType } = evalNodes[i];
        if (!!evaluationError || !syncStatus) nodeHasProblem = true;

        if (!this.dataBindNodeElements[i]) {
          const node = new DataBindNodeTreeElement(evaluatableExpression, evaluatedValue, valueType, evaluationError, syncStatus, this.executionContext);
          this.appendChild(node);
          this.dataBindNodeElements[i] = node;
          continue;
        }

        this.dataBindNodeElements[i].update(evaluatableExpression, evaluatedValue, valueType, evaluationError, syncStatus);
      }

      if (this.dataBindNodeElements.length > evalNodes.length) {
        for (let i = evalNodes.length; i < this.dataBindNodeElements.length; i++) {
          this.removeChild(this.dataBindNodeElements[i]);
        }

        this.dataBindNodeElements.splice(evalNodes.length, this.dataBindNodeElements.length);
      }
    }

    this.toggleExclamationMark(mutatorsErrors.length > 0 || nodeHasProblem);
    this.errorsContainerElement.classList.toggle('hidden', mutatorsErrors.length === 0);
    this.errorsContainerElement.innerHTML = '';
    if (mutatorsErrors.length > 0) {
      this.errorsContainerElement.innerHTML += `(${mutatorsErrors.join('; ')})`;
    }
  }

  update(attributeData: Protocol.DOM.DataBindAttributeData) {
    this.toggleExclamationMark(false);

    if (attributeData.attributeName !== this.attributeData?.attributeName) {
      this.attributeNameElement.textContent = attributeData.attributeName;
    }

    if (attributeData.attributeValue !== this.attributeData?.attributeValue) {
      this.attributeValueElement.textContent = attributeData.attributeValue;
    }

    this.updateMutators(attributeData);
    this.attributeData = attributeData;
    this.checkNodesStatus();
  }
}