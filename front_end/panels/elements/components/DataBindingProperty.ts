import * as UI from '../../../ui/legacy/legacy.js';
import * as ObjectUI from '../../../ui/legacy/components/object_ui/object_ui.js';
import * as SDK from '../../../core/sdk/sdk.js';
import * as Protocol from '../../../generated/protocol.js';
import * as i18n from '../../../core/i18n/i18n.js';

const UIStrings = {
  noErrors: 'No errors',
  outOfSync: 'Out of sync',
  upToDate: 'Up to date',
  evalError: 'Evaluation errors'
};

const str_ = i18n.i18n.registerUIStrings('panels/accessibility/AccessibilityNodeView.ts', UIStrings);
const i18nString = i18n.i18n.getLocalizedString.bind(undefined, str_);

export class DataBindBaseTreeElement extends UI.TreeOutline.TreeElement {
  private mark: UI.UIUtils.DevToolsIconLabel;
  constructor() {
    super('');
    this.selectable = false;
    this.setExpandable(true);
    this.setDisableSelectFocus(true)
    this.mark = this.createMark('');
    this.listItemElement.insertBefore(this.mark, this.listItemElement.firstChild);
  }

  async evalExpression(expr: string | undefined) {
    if (!expr) return null;
    const executionContext = UI.Context.Context.instance().flavor(SDK.RuntimeModel.ExecutionContext);
    if (!executionContext) {
      return null;
    }
    return await executionContext?.evaluate({ expression: expr, returnByValue: true }, false, true);
  }

  createMark(tooltip: string): UI.UIUtils.DevToolsIconLabel {
    const markElement = document.createElement('span', { is: 'dt-icon-label' }) as UI.UIUtils.DevToolsIconLabel;
    markElement.type = '';
    markElement.className = 'hidden';
    UI.Tooltip.Tooltip.install(markElement, tooltip);
    return markElement;
  }

  toggleMark(visible: boolean, type = 'error', tip = '') {
    const newType = `smallicon-${type}`;
    this.mark.type = this.mark.type !== newType ? newType : this.mark.type;
    this.mark.title = tip;
    this.mark?.classList.toggle('hidden', !visible);
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

type DefaultNodeTypes = (DataBindNodeTreeElement | DataBindClassToggleNodeTreeElement)[];

export class DataBindBaseTreeElementWithSubNodes<T = DefaultNodeTypes> extends DataBindBaseTreeElement {
  public dataBindNodeElements: T;

  constructor() {
    super();
    this.dataBindNodeElements = [] as unknown as T;
  }

  clearNonUsedNodeElements(iteratedNodes: number) {
    const arr = this.dataBindNodeElements as unknown as DefaultNodeTypes;
    if (arr.length > iteratedNodes) {
      for (let i = iteratedNodes; i < arr.length; i++) {
        this.removeChild(arr[i]);
      }
      arr.splice(iteratedNodes, arr.length);
    }
  }

  createBindClassToggleNodeTreeElement(className: string, classState: string, evalNodes: Protocol.DOM.DataBindNode[]) {
    const node = new DataBindClassToggleNodeTreeElement(className, classState, evalNodes);
    this.appendChild(node);
    return node;
  }

  createBindNodeTreeElement(evaluatableExpression: string, evaluatedValue: string, valueType: string, evaluationError: string | undefined) {
    const node = new DataBindNodeTreeElement(evaluatableExpression, evaluatedValue, valueType, evaluationError);
    this.appendChild(node);
    return node;
  }
}

export class DataBindNodeInfoTreeElement extends DataBindBaseTreeElement {
  private evaluationErrorElement: HTMLSpanElement | null = null;
  public evaluationError?: string;
  constructor(evaluationError: string | undefined) {
    super();
    this.listItemElement.classList.add('monospace');
    this.listItemElement.classList.add('expressions-info');
    this.setExpandable(false);
    this.selectable = false;
    this.createElements();
    this.update(evaluationError);
  }

  update(evaluationError: string | undefined) {
    if (evaluationError !== this.evaluationError) {
      this.evaluationErrorElement!.textContent = evaluationError ? evaluationError : i18nString(UIStrings.noErrors);
      this.evaluationErrorElement?.classList.toggle('status-ok', !evaluationError);
      this.evaluationErrorElement?.classList.toggle('bind-error-message', !!evaluationError);
    }

    this.evaluationError = evaluationError;
  }

  createElements(): void {
    const wrapper = document.createElement('div');
    wrapper.style.width = '100%';

    const evaluationErrorWrapper = document.createElement('div');
    evaluationErrorWrapper.classList.add('bind-expression-eval-error');

    this.appendSpanElement(evaluationErrorWrapper, i18nString(UIStrings.evalError), 'name');
    this.appendSeparatorElement(evaluationErrorWrapper);
    this.evaluationErrorElement = this.appendSpanElement(evaluationErrorWrapper, i18nString(UIStrings.noErrors), `status-ok`);

    wrapper.appendChild(evaluationErrorWrapper);
    this.listItemElement.appendChild(wrapper);
  }
}

export class DataBindClassToggleNodeTreeElement extends DataBindBaseTreeElementWithSubNodes<DataBindNodeTreeElement[]> {
  private classNameElement: HTMLSpanElement | null = null;
  private classStateElement: HTMLSpanElement | null = null;
  public className?: string;
  public classState?: string;
  public evalNodes?: Protocol.DOM.DataBindNode[]
  constructor(className: string, classState: string, evalNodes: Protocol.DOM.DataBindNode[]) {
    super();

    this.listItemElement.classList.add('monospace');
    this.listItemElement.classList.add('expressions-list');

    this.expand();
    this.createElements();
    this.update(className, classState, evalNodes);
  }

  update(className: string, classState: string, evalNodes: Protocol.DOM.DataBindNode[]) {
    if (className !== this.className) this.classNameElement!.textContent = className;
    if (classState !== this.classState) this.classStateElement!.textContent = classState + '';

    this.className = className;
    this.classState = classState;
    this.updateEvalNodes(evalNodes);
  }

  updateEvalNodes(evalNodes: Protocol.DOM.DataBindNode[]) {
    let nodeHasError = false;
    let currentNodeIndex = 0;
    let iteratedNodes = 0;

    for (let j = 0; j < evalNodes.length; j++) {
      const { evaluatableExpression, evaluatedValue, evaluationError, valueType } = evalNodes[j];
      if (evaluationError || valueType === 'invalid') nodeHasError = true;
      iteratedNodes++;

      if (!this.dataBindNodeElements[currentNodeIndex]) {
        this.dataBindNodeElements[currentNodeIndex++] = this.createBindNodeTreeElement(evaluatableExpression, evaluatedValue, valueType, evaluationError);
        continue;
      }

      this.dataBindNodeElements[currentNodeIndex++].update(evaluatableExpression, evaluatedValue, valueType, evaluationError);
    }

    this.clearNonUsedNodeElements(iteratedNodes);

    if (nodeHasError) {
      this.toggleMark(true, 'error', 'Errors generated while parsing the attribute');
    }
  }

  createElements(): void {
    this.classNameElement = this.appendSpanElement(this.listItemElement, '', 'object-value-string');
    this.appendSeparatorElement(this.listItemElement);
    this.classStateElement = this.appendSpanElement(this.listItemElement, '', 'object-value-boolean');
  }
}

export class DataBindNodeTreeElement extends DataBindBaseTreeElement {
  private expressionElement: HTMLSpanElement | null = null;
  private valueElement: HTMLSpanElement | null = null;
  public expression?: string;
  public value?: string;
  public valueType?: string;
  public dataBindNodeInfoTree: DataBindNodeInfoTreeElement;
  constructor(expression: string, value: string, valueType: string, evaluationError: string | undefined) {
    super();

    this.listItemElement.classList.add('monospace');
    this.listItemElement.classList.add('expressions-list');
    this.dataBindNodeInfoTree = new DataBindNodeInfoTreeElement(evaluationError);

    this.createElements();
    this.update(expression, value, valueType, evaluationError);
  }

  update(expression: string, value: string, valueType: string, evaluationError: string | undefined) {
    if (!!evaluationError || valueType === 'invalid') {
      this.toggleMark(true, 'error', 'Errors generated while evaluating the expression');
    } else this.toggleMark(false);

    if (expression !== this.expression) this.expressionElement!.textContent = expression;
    if (value !== this.value) {
      this.valueElement!.textContent = value;
      if (this.valueElement) this.valueElement.className = `object-value-${valueType}`;
    }

    this.expression = expression;
    this.value = value;
    this.valueType = valueType;
    const error = evaluationError || (valueType === 'invalid' ? 'Trying to use invalid property' : '');
    this.dataBindNodeInfoTree.update(error);
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
export class DataBindAttributeTreeElement extends DataBindBaseTreeElementWithSubNodes {
  public attributeData: Protocol.DOM.DataBindAttributeData | null = null;
  private attributeNameElement: HTMLSpanElement;
  private attributeValueElement: HTMLSpanElement;
  private errorsContainerElement: HTMLElement;

  constructor(attributeData: Protocol.DOM.DataBindAttributeData) {
    super();

    this.listItemElement.classList.add('bind-attribute');
    this.attributeNameElement = this.appendSpanElement(this.listItemElement, '', 'object-value-string name');
    this.appendSeparatorElement(this.listItemElement);
    this.attributeValueElement = this.appendSpanElement(this.listItemElement, '', 'object-value-string');
    this.errorsContainerElement = this.listItemElement.createChild('span', 'bind-error-message mutators', '');
    this.listItemElement.classList.add('monospace');
    this.update(attributeData);
  }

  private filterDataBindNodeTree(value: RegExp | null, node: DataBindNodeTreeElement) {
    const nodeVisible = value ? node.expression?.match(value) || node.value?.match(value) : true;
    node.toggleTreeElement(!!nodeVisible);
    node.toggleBindNodeInfoTree(!!nodeVisible);
    return nodeVisible;
  }

  public filterMutators(value: RegExp | null): boolean {
    let mutatorsVisible = false;

    this.dataBindNodeElements.forEach((node) => {
      if (node instanceof DataBindClassToggleNodeTreeElement) {
        let nodeVisible = value ? node.className?.match(value) : true;
        node.dataBindNodeElements.forEach((bindNode) => {
          if (this.filterDataBindNodeTree(value, bindNode)) nodeVisible = true;
        });

        node.toggleTreeElement(!!nodeVisible);
        if (nodeVisible) mutatorsVisible = true;

        return;
      }

      if (this.filterDataBindNodeTree(value, node)) mutatorsVisible = true;
    })

    return mutatorsVisible;
  }

  private updateClassToggleMutators(attributeData: Protocol.DOM.DataBindAttributeData, classNames: RegExpMatchArray) {
    const mutatorsErrors = [] as string[];
    let hasError = false;

    let currentNodeIndex = 0;
    let iteratedNodes = 0;

    for (const [mutatorIndex, mutator] of attributeData.mutators.entries()) {
      if (mutator.parsingError) mutatorsErrors.push(mutator.parsingError);
      if (mutator.compilationError) mutatorsErrors.push(mutator.compilationError);

      const evalNodes = mutator.evaluationNodes;
      // Check if some of the eval nodes are having errors so we can show the error mark later
      for (let j = 0; j < evalNodes.length; j++) {
        const { evaluationError, valueType } = evalNodes[j];
        if (evaluationError || valueType === 'invalid') hasError = true;
      }

      if (!evalNodes.length) continue;

      this.setExpandable(true);

      const classState = evalNodes[0]?.evaluatedValue;
      const className = classNames[mutatorIndex];
      iteratedNodes++;

      const currentNode = this.dataBindNodeElements[currentNodeIndex];
      if (!currentNode) {
        this.dataBindNodeElements[currentNodeIndex++] = this.createBindClassToggleNodeTreeElement(className, classState, evalNodes);
        continue;
      }

      if (!(currentNode instanceof DataBindClassToggleNodeTreeElement)) {
        // Replace the item if before that it has been insance of DataBindNodeTreeElement
        this.removeChild(currentNode);
        this.dataBindNodeElements[currentNodeIndex++] = this.createBindClassToggleNodeTreeElement(className, classState, evalNodes);
      } else {
        // Update the node values if it is instance of DataBindClassToggleNodeTreeElement
        (this.dataBindNodeElements[currentNodeIndex++] as DataBindClassToggleNodeTreeElement).update(className, classState, evalNodes);
      }
    }

    this.clearNonUsedNodeElements(iteratedNodes);
    this.updateErrorsContainerElement(hasError, mutatorsErrors);
  }

  private updateMutators(attributeData: Protocol.DOM.DataBindAttributeData) {
    const mutatorsErrors = [] as string[];
    let hasError = false;

    let currentNodeIndex = 0;
    let iteratedNodes = 0;

    for (const mutator of attributeData.mutators) {
      if (mutator.parsingError) mutatorsErrors.push(mutator.parsingError);
      if (mutator.compilationError) mutatorsErrors.push(mutator.compilationError);

      const evalNodes = mutator.evaluationNodes;
      this.setExpandable(evalNodes.length > 0);

      for (let j = 0; j < evalNodes.length; j++) {
        const { evaluatableExpression, evaluatedValue, evaluationError, valueType } = evalNodes[j];
        if (evaluationError || valueType === 'invalid') hasError = true;
        iteratedNodes++;

        const currentNode = this.dataBindNodeElements[currentNodeIndex];
        if (!currentNode) {
          this.dataBindNodeElements[currentNodeIndex++] = this.createBindNodeTreeElement(evaluatableExpression, evaluatedValue, valueType, evaluationError);
          continue;
        }

        if (!(currentNode instanceof DataBindNodeTreeElement)) {
          // Replace node if the previous one has been instance of DataBindClassToggleTreeElement
          this.removeChild(currentNode);
          this.dataBindNodeElements[currentNodeIndex++] = this.createBindNodeTreeElement(evaluatableExpression, evaluatedValue, valueType, evaluationError);
        } else {
          // Update the node values if it is instance of DataBindClassToggleTreeElement
          (this.dataBindNodeElements[currentNodeIndex++] as DataBindNodeTreeElement).update(evaluatableExpression, evaluatedValue, valueType, evaluationError);
        }
      }
    }

    this.clearNonUsedNodeElements(iteratedNodes);
    this.updateErrorsContainerElement(hasError, mutatorsErrors);
  }

  clearNonUsedNodeElements(iteratedNodes: number) {
    if (this.dataBindNodeElements.length > iteratedNodes) {
      for (let i = iteratedNodes; i < this.dataBindNodeElements.length; i++) {
        this.removeChild(this.dataBindNodeElements[i]);
      }

      this.dataBindNodeElements.splice(iteratedNodes, this.dataBindNodeElements.length);
    }
  }

  updateErrorsContainerElement(nodeHasError: boolean, mutatorsErrors: string[]) {
    if (nodeHasError || mutatorsErrors.length > 0) {
      this.toggleMark(true, 'error', 'Errors generated while parsing the attribute');
    }

    this.errorsContainerElement.classList.toggle('hidden', mutatorsErrors.length === 0);
    this.errorsContainerElement.innerHTML = '';
    if (mutatorsErrors.length > 0) {
      this.errorsContainerElement.innerHTML += `(${mutatorsErrors.join('; ')})`;
    }
  }

  update(attributeData: Protocol.DOM.DataBindAttributeData) {
    this.toggleMark(false);

    if (attributeData.attributeName !== this.attributeData?.attributeName) {
      this.attributeNameElement.textContent = attributeData.attributeName;
    }

    if (attributeData.attributeValue !== this.attributeData?.attributeValue) {
      this.attributeValueElement.textContent = attributeData.attributeValue;
    }


    if (attributeData.attributeName === 'data-bind-class-toggle') {
      const classNames = attributeData.attributeValue.match(/[^:;]+(?=:)/g);

      if (classNames) this.updateClassToggleMutators(attributeData, classNames);
      else this.updateMutators(attributeData);
    } else {
      this.updateMutators(attributeData);
    }

    this.attributeData = attributeData;
  }
}